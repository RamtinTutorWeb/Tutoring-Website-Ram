import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCalendlyWebhookSigningKey } from '../_lib/env';
import { headerValue, readRawBody } from '../_lib/rawBody';
import { getSupabaseAdmin } from '../_lib/supabaseAdmin';
import { forgetWebhookEvent, recordWebhookEvent } from '../_lib/webhookEvents';

/**
 * POST /api/calendly/webhook
 *
 * Receives `invitee.created` / `invitee.canceled` and mirrors them into
 * `public.bookings`. Links a booking to a `session_requests` row when the
 * scheduling link carried `utm_content=<request uuid>` (the /book page does
 * this), and to a `profiles` row by invitee email.
 *
 * Signature: header `Calendly-Webhook-Signature: t=<unix>,v1=<hex>` where
 * v1 = HMAC-SHA256(signing_key, `${t}.${rawBody}`). Rejected when older than
 * TOLERANCE_SECONDS. Raw body is required, so body parsing is disabled.
 */
export const config = { api: { bodyParser: false } };

const TOLERANCE_SECONDS = 3 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- Narrow types for the Calendly fields we read ------------------------------

interface CalendlyScheduledEvent {
  uri?: string;
  name?: string | null;
  start_time?: string;
  end_time?: string;
  status?: string;
}

interface CalendlyTracking {
  utm_campaign?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
}

interface CalendlyCancellation {
  canceled_by?: string;
  reason?: string | null;
  canceler_type?: string;
}

interface CalendlyInvitee {
  uri: string;
  email?: string;
  name?: string | null;
  event: string;
  created_at?: string;
  tracking?: CalendlyTracking | null;
  cancellation?: CalendlyCancellation | null;
  scheduled_event?: CalendlyScheduledEvent | null;
}

interface CalendlyWebhookBody {
  event: string;
  created_at: string;
  created_by?: string;
  payload: CalendlyInvitee;
}

type BookingStatus = 'scheduled' | 'canceled';

interface BookingUpsert {
  calendly_invitee_uri: string;
  calendly_event_uri: string;
  invitee_email: string | null;
  invitee_name: string | null;
  event_type_name: string | null;
  start_at: string | null;
  end_at: string | null;
  status: BookingStatus;
  cancel_reason: string | null;
  raw: unknown;
  request_id?: string;
  student_id?: string;
}

// --- Signature ------------------------------------------------------------------

interface ParsedSignature {
  timestamp: number;
  signature: string;
}

function parseSignatureHeader(header: string): ParsedSignature | undefined {
  let t: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  if (!t || !v1) return undefined;
  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) return undefined;
  return { timestamp, signature: v1 };
}

function verifySignature(rawBody: Buffer, header: string, signingKey: string): boolean {
  const parsed = parseSignatureHeader(header);
  if (!parsed) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', signingKey)
    .update(`${parsed.timestamp}.`)
    .update(rawBody)
    .digest();
  const provided = Buffer.from(parsed.signature, 'hex');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

// --- Payload helpers ------------------------------------------------------------

function isWebhookBody(value: unknown): value is CalendlyWebhookBody {
  if (typeof value !== 'object' || value === null) return false;
  const body = value as { event?: unknown; created_at?: unknown; payload?: unknown };
  if (typeof body.event !== 'string' || typeof body.created_at !== 'string') return false;
  const payload = body.payload as { uri?: unknown; event?: unknown } | null | undefined;
  return (
    typeof payload === 'object' && payload !== null && typeof payload.uri === 'string' && typeof payload.event === 'string'
  );
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

async function findStudentIdByEmail(email: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseAdmin()
    .from('profiles')
    .select('id')
    .ilike('email', escapeLike(email))
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) {
    throw new Error(`profiles lookup failed: ${error.message}`);
  }
  return data?.id;
}

async function findRequestStudentId(requestId: string): Promise<string | undefined> {
  const { data, error } = await getSupabaseAdmin()
    .from('session_requests')
    .select('student_id')
    .eq('id', requestId)
    .maybeSingle<{ student_id: string }>();
  if (error) {
    throw new Error(`session_requests lookup failed: ${error.message}`);
  }
  return data?.student_id;
}

async function markRequestScheduled(requestId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from('session_requests')
    .update({ status: 'scheduled' })
    .eq('id', requestId);
  if (error) {
    throw new Error(`session_requests update failed: ${error.message}`);
  }
}

async function upsertBooking(body: CalendlyWebhookBody, status: BookingStatus): Promise<void> {
  const invitee = body.payload;
  const scheduled = invitee.scheduled_event ?? {};
  const email = invitee.email?.trim().toLowerCase() || null;

  const booking: BookingUpsert = {
    calendly_invitee_uri: invitee.uri,
    calendly_event_uri: invitee.event,
    invitee_email: email,
    invitee_name: invitee.name?.trim() || null,
    event_type_name: scheduled.name?.trim() || null,
    start_at: scheduled.start_time ?? null,
    end_at: scheduled.end_time ?? null,
    status,
    cancel_reason: status === 'canceled' ? invitee.cancellation?.reason?.trim() || null : null,
    raw: body,
  };

  const utmContent = invitee.tracking?.utm_content?.trim();
  const requestId = utmContent && UUID_RE.test(utmContent) ? utmContent : undefined;
  if (requestId) {
    booking.request_id = requestId;
  }

  let studentId = email ? await findStudentIdByEmail(email) : undefined;
  if (!studentId && requestId) {
    studentId = await findRequestStudentId(requestId);
  }
  if (studentId) {
    booking.student_id = studentId;
  }

  const { error } = await getSupabaseAdmin()
    .from('bookings')
    .upsert(booking, { onConflict: 'calendly_invitee_uri' });
  if (error) {
    throw new Error(`bookings upsert failed: ${error.message}`);
  }

  if (status === 'scheduled' && requestId) {
    await markRequestScheduled(requestId);
  }
}

// --- Handler ------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const signatureHeader = headerValue(req, 'calendly-webhook-signature');
  if (!signatureHeader) {
    res.status(400).json({ error: 'Missing Calendly-Webhook-Signature header' });
    return;
  }

  let body: CalendlyWebhookBody;
  try {
    const rawBody = await readRawBody(req);
    if (!verifySignature(rawBody, signatureHeader, getCalendlyWebhookSigningKey())) {
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }
    const parsed: unknown = JSON.parse(rawBody.toString('utf8'));
    if (!isWebhookBody(parsed)) {
      res.status(400).json({ error: 'Unexpected payload shape' });
      return;
    }
    body = parsed;
  } catch (err) {
    console.error('calendly webhook: verification error', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Webhook verification failed' });
    return;
  }

  const eventId = `${body.event}:${body.payload.uri}:${body.created_at}`;
  let recorded = false;
  try {
    const { duplicate } = await recordWebhookEvent('calendly', eventId, body.event, body);
    if (duplicate) {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    recorded = true;

    switch (body.event) {
      case 'invitee.created':
        await upsertBooking(body, 'scheduled');
        break;
      case 'invitee.canceled':
        await upsertBooking(body, 'canceled');
        break;
      default:
        // Acknowledge anything else so Calendly does not retry.
        break;
    }

    res.status(200).json({ ok: true, event: body.event });
  } catch (err) {
    console.error(`calendly webhook: failed to process ${body.event}`, err instanceof Error ? err.message : err);
    if (recorded) {
      await forgetWebhookEvent('calendly', eventId);
    }
    res.status(500).json({ error: 'Failed to process webhook' });
  }
}
