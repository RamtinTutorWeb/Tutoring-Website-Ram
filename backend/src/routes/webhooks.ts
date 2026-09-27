/**
 * Provider webhooks. Mounted with express.raw() (see app.ts): signatures are
 * computed over the exact bytes received, so req.body is a Buffer here.
 *
 * Both handlers are idempotent through the webhook_events ledger: an event is
 * recorded before processing and un-recorded if processing fails, so the
 * provider's retry runs again.
 */
import { Router, type Request, type Response } from 'express';
import { Webhook, WebhookVerificationError } from 'svix';
import * as db from '../db.js';
import { env } from '../env.js';
import { ConfigError } from '../errors.js';
import { verifyCalendlySignature } from '../lib/calendly.js';
import { forgetClerkUser, roleFromMetadata } from '../lib/clerk.js';
import type { BookingStatus } from '../types.js';
import { isUuid } from './params.js';

export const webhooksRouter = Router();

function rawBody(req: Request): Buffer {
  return Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
}

async function processOnce(
  res: Response,
  provider: db.WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown,
  handle: () => Promise<void>,
): Promise<void> {
  const fresh = await db.recordWebhookEvent(provider, eventId, eventType, payload);
  if (!fresh) {
    res.json({ ok: true, duplicate: true });
    return;
  }
  try {
    await handle();
  } catch (err) {
    console.error(`${provider} webhook: failed to process ${eventType} (${eventId}):`, err instanceof Error ? err.message : err);
    await db.forgetWebhookEvent(provider, eventId);
    res.status(500).json({ error: 'Failed to process webhook' });
    return;
  }
  res.json({ ok: true, type: eventType });
}

// --- Clerk (Svix-signed) -------------------------------------------------------------

interface ClerkUserData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: Array<{ id: string; email_address: string }>;
  primary_email_address_id?: string | null;
  phone_numbers?: Array<{ id: string; phone_number: string }>;
  primary_phone_number_id?: string | null;
  public_metadata?: Record<string, unknown> | null;
}

function profileFromClerk(user: ClerkUserData): db.ProfileWrite | null {
  const emails = user.email_addresses ?? [];
  const email = (emails.find((e) => e.id === user.primary_email_address_id) ?? emails[0])?.email_address
    .trim()
    .toLowerCase();
  if (!email) return null;
  const phones = user.phone_numbers ?? [];
  const phone = (phones.find((p) => p.id === user.primary_phone_number_id) ?? phones[0])?.phone_number.trim();
  const fullName = [user.first_name, user.last_name].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  return {
    id: user.id,
    email,
    fullName: fullName || null,
    phone: phone || null,
    // Clerk metadata is the role source of truth; demotion is mirrored too.
    role: roleFromMetadata(user.public_metadata),
  };
}

webhooksRouter.post('/webhooks/clerk', async (req, res) => {
  const secret = env.clerk.webhookSigningSecret;
  if (!secret) throw new ConfigError('CLERK_WEBHOOK_SIGNING_SECRET');

  const svixId = req.get('svix-id');
  const svixTimestamp = req.get('svix-timestamp');
  const svixSignature = req.get('svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing Svix signature headers' });
    return;
  }

  let event: { type: string; data: unknown };
  try {
    const body = rawBody(req);
    new Webhook(secret).verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    event = JSON.parse(body.toString('utf8'));
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  if (typeof event?.type !== 'string') {
    res.status(400).json({ error: 'Unexpected payload shape' });
    return;
  }

  await processOnce(res, 'clerk', svixId, event.type, event, async () => {
    const data = (event.data ?? {}) as Partial<ClerkUserData>;
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        if (typeof data.id !== 'string') throw new Error(`${event.type} without user id`);
        forgetClerkUser(data.id);
        const profile = profileFromClerk(data as ClerkUserData);
        if (!profile) {
          console.warn(`clerk webhook: user ${data.id} has no email address; profile not written`);
          return;
        }
        await db.upsertProfile(profile);
        return;
      }
      case 'user.deleted':
        if (typeof data.id === 'string') {
          forgetClerkUser(data.id);
          await db.deleteProfile(data.id);
        }
        return;
      default:
        // Subscribed but unhandled: acknowledge so Clerk stops retrying.
        return;
    }
  });
});

// --- Calendly (HMAC-signed) --------------------------------------------------------------

interface CalendlyInvitee {
  uri: string;
  event: string;
  email?: string;
  name?: string | null;
  tracking?: { utm_content?: string | null } | null;
  cancellation?: { reason?: string | null } | null;
  scheduled_event?: { name?: string | null; start_time?: string; end_time?: string } | null;
}

interface CalendlyBody {
  event: string;
  created_at: string;
  payload: CalendlyInvitee;
}

function isCalendlyBody(value: unknown): value is CalendlyBody {
  const body = value as Partial<CalendlyBody> | null;
  return (
    typeof body?.event === 'string' &&
    typeof body.created_at === 'string' &&
    typeof body.payload?.uri === 'string' &&
    typeof body.payload.event === 'string'
  );
}

async function applyInviteeEvent(body: CalendlyBody, status: BookingStatus): Promise<void> {
  const invitee = body.payload;
  const scheduled = invitee.scheduled_event ?? {};
  const email = invitee.email?.trim().toLowerCase() || null;

  // /book?request=<id> passes the request id through Calendly as utm_content.
  const utm = invitee.tracking?.utm_content?.trim();
  const request = utm && isUuid(utm) ? await db.getRequest(utm) : null;

  const studentId = (email ? await db.findProfileIdByEmail(email) : null) ?? request?.studentId ?? null;

  await db.upsertBooking({
    calendlyInviteeUri: invitee.uri,
    calendlyEventUri: invitee.event,
    inviteeEmail: email,
    inviteeName: invitee.name?.trim() || null,
    eventTypeName: scheduled.name?.trim() || null,
    startAt: scheduled.start_time ?? null,
    endAt: scheduled.end_time ?? null,
    status,
    cancelReason: status === 'canceled' ? invitee.cancellation?.reason?.trim() || null : null,
    studentId,
    requestId: request?.id ?? null,
    raw: body,
  });

  if (!request) return;
  if (status === 'scheduled' && request.status !== 'scheduled') {
    await db.setRequestStatus(request.id, 'scheduled');
  } else if (status === 'canceled' && request.status === 'scheduled') {
    // Let the student pick another time from the same link.
    await db.setRequestStatus(request.id, 'accepted');
  }
}

webhooksRouter.post('/webhooks/calendly', async (req, res) => {
  const signingKey = env.calendly.webhookSigningKey;
  if (!signingKey) {
    console.warn('calendly webhook received but CALENDLY_WEBHOOK_SIGNING_KEY is not set; ignoring');
    res.status(503).json({ error: 'Calendly is not configured' });
    return;
  }
  const signature = req.get('calendly-webhook-signature');
  if (!signature) {
    res.status(400).json({ error: 'Missing Calendly-Webhook-Signature header' });
    return;
  }
  const body = rawBody(req);
  if (!verifyCalendlySignature(body, signature, signingKey)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Invalid payload' });
    return;
  }
  if (!isCalendlyBody(parsed)) {
    res.status(400).json({ error: 'Unexpected payload shape' });
    return;
  }
  const event = parsed;

  const eventId = `${event.event}:${event.payload.uri}:${event.created_at}`;
  await processOnce(res, 'calendly', eventId, event.event, event, async () => {
    if (event.event === 'invitee.created') await applyInviteeEvent(event, 'scheduled');
    else if (event.event === 'invitee.canceled') await applyInviteeEvent(event, 'canceled');
    // Anything else is acknowledged so Calendly does not retry.
  });
});
