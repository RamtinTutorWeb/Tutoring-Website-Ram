import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Webhook, WebhookVerificationError } from 'svix';
import { getClerkWebhookSigningSecret } from '../_lib/env';
import { headerValue, readRawBody } from '../_lib/rawBody';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forgetWebhookEvent, recordWebhookEvent } from '../_lib/webhookEvents';

/**
 * POST /api/clerk/webhook
 *
 * Receives Clerk user events (signed by Svix) and mirrors them into
 * `public.profiles`. Idempotent on the `svix-id` header via `webhook_events`.
 *
 * Signature verification needs the exact raw bytes, so body parsing is disabled
 * and the body is read from the stream.
 */
export const config = { api: { bodyParser: false } };

// --- Narrow types for the Clerk fields we read --------------------------------

interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkPhoneNumber {
  id: string;
  phone_number: string;
}

interface ClerkUserData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  phone_numbers?: ClerkPhoneNumber[];
  primary_phone_number_id?: string | null;
  public_metadata?: Record<string, unknown> | null;
}

interface ClerkDeletedUserData {
  id?: string;
  deleted?: boolean;
}

interface ClerkEvent {
  type: string;
  data: unknown;
}

type ProfileRole = 'student' | 'admin';

interface ProfileUpsert {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role?: ProfileRole;
}

// --- Helpers ------------------------------------------------------------------

function isClerkEvent(value: unknown): value is ClerkEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string' &&
    'data' in value
  );
}

function isClerkUserData(value: unknown): value is ClerkUserData {
  return typeof value === 'object' && value !== null && typeof (value as { id?: unknown }).id === 'string';
}

function primaryEmail(user: ClerkUserData): string | undefined {
  const list = user.email_addresses ?? [];
  const primary = list.find((e) => e.id === user.primary_email_address_id) ?? list[0];
  const email = primary?.email_address.trim().toLowerCase();
  return email ? email : undefined;
}

function primaryPhone(user: ClerkUserData): string | null {
  const list = user.phone_numbers ?? [];
  const primary = list.find((p) => p.id === user.primary_phone_number_id) ?? list[0];
  const phone = primary?.phone_number.trim();
  return phone ? phone : null;
}

function fullName(user: ClerkUserData): string | null {
  const name = [user.first_name, user.last_name]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ');
  return name ? name : null;
}

function toProfile(user: ClerkUserData): ProfileUpsert | undefined {
  const email = primaryEmail(user);
  if (!email) return undefined;
  const profile: ProfileUpsert = {
    id: user.id,
    email,
    full_name: fullName(user),
    phone: primaryPhone(user),
  };
  // Only promote to admin from Clerk metadata. Otherwise omit `role` so an
  // insert gets the column default ('student') and an update keeps the
  // existing value.
  if (user.public_metadata?.['role'] === 'admin') {
    profile.role = 'admin';
  }
  return profile;
}

async function upsertProfile(user: ClerkUserData): Promise<void> {
  const profile = toProfile(user);
  if (!profile) {
    console.warn(`clerk webhook: user ${user.id} has no email address; profile not written`);
    return;
  }
  const { error } = await getSupabaseAdmin().from('profiles').upsert(profile, { onConflict: 'id' });
  if (error) {
    throw new Error(`profiles upsert failed: ${error.message}`);
  }
}

async function deleteProfile(data: ClerkDeletedUserData): Promise<void> {
  if (!data.id) return;
  const { error } = await getSupabaseAdmin().from('profiles').delete().eq('id', data.id);
  if (error) {
    throw new Error(`profiles delete failed: ${error.message}`);
  }
}

// --- Handler ------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const svixId = headerValue(req, 'svix-id');
  const svixTimestamp = headerValue(req, 'svix-timestamp');
  const svixSignature = headerValue(req, 'svix-signature');
  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing Svix signature headers' });
    return;
  }

  let event: ClerkEvent;
  try {
    const rawBody = await readRawBody(req);
    // svix 2.x `verify` throws WebhookVerificationError on failure and returns nothing.
    new Webhook(getClerkWebhookSigningSecret()).verify(rawBody, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    });
    const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
    if (!isClerkEvent(parsed)) {
      res.status(400).json({ error: 'Unexpected payload shape' });
      return;
    }
    event = parsed;
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    console.error('clerk webhook: verification error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Webhook verification failed' });
    return;
  }

  let recorded = false;
  try {
    const { duplicate } = await recordWebhookEvent('clerk', svixId, event.type, event);
    if (duplicate) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    recorded = true;

    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        if (!isClerkUserData(event.data)) {
          throw new Error(`event ${event.type} missing user data`);
        }
        await upsertProfile(event.data);
        break;
      case 'user.deleted':
        await deleteProfile((event.data ?? {}) as ClerkDeletedUserData);
        break;
      default:
        // Subscribed-but-unhandled event types are acknowledged so Clerk stops retrying.
        break;
    }

    res.status(200).json({ ok: true, type: event.type });
  } catch (err) {
    console.error(`clerk webhook: failed to process ${event.type} (${svixId})`, err instanceof Error ? err.message : err);
    if (recorded) {
      await forgetWebhookEvent('clerk', svixId);
    }
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
