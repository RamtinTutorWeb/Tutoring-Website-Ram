import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Calendly webhook signing: header `Calendly-Webhook-Signature: t=<unix>,v1=<hex>`
 * where v1 = HMAC-SHA256(signing_key, `${t}.${rawBody}`).
 */
export const SIGNATURE_TOLERANCE_SECONDS = 3 * 60;

export function signCalendlyPayload(rawBody: string | Buffer, signingKey: string, timestamp: number): string {
  const v1 = createHmac('sha256', signingKey).update(`${timestamp}.`).update(rawBody).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

export function verifyCalendlySignature(
  rawBody: Buffer,
  header: string,
  signingKey: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  let t: string | undefined;
  let v1: string | undefined;
  for (const part of header.split(',')) {
    const [key, value] = part.trim().split('=', 2);
    if (key === 't') t = value;
    if (key === 'v1') v1 = value;
  }
  const timestamp = Number(t);
  if (!t || !v1 || !Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac('sha256', signingKey).update(`${timestamp}.`).update(rawBody).digest();
  const provided = Buffer.from(v1, 'hex');
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// --- Webhook subscription (one-time admin setup) ---------------------------------

const CALENDLY_API = 'https://api.calendly.com';
export const CALENDLY_EVENTS = ['invitee.created', 'invitee.canceled'] as const;

async function calendlyFetch(path: string, pat: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CALENDLY_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
}

export interface RegisterResult {
  status: number;
  body: Record<string, unknown>;
}

/**
 * Creates an organization-scoped subscription for invitee.created/canceled.
 * Calendly answers 409 if an identical subscription already exists (harmless).
 */
export async function registerCalendlyWebhook(opts: {
  personalAccessToken: string;
  signingKey: string;
  callbackUrl: string;
}): Promise<RegisterResult> {
  const meRes = await calendlyFetch('/users/me', opts.personalAccessToken);
  if (!meRes.ok) {
    const detail: unknown = await meRes.json().catch(() => null);
    return { status: 502, body: { error: 'Calendly /users/me failed', status: meRes.status, detail } };
  }
  const me = (await meRes.json()) as { resource?: { uri?: string; current_organization?: string } };
  const organization = me.resource?.current_organization;
  const user = me.resource?.uri;
  if (!organization || !user) {
    return { status: 502, body: { error: 'Calendly /users/me did not return organization and user URIs' } };
  }

  const subRes = await calendlyFetch('/webhook_subscriptions', opts.personalAccessToken, {
    method: 'POST',
    body: JSON.stringify({
      url: opts.callbackUrl,
      events: CALENDLY_EVENTS,
      organization,
      user,
      scope: 'organization',
      signing_key: opts.signingKey,
    }),
  });
  const calendly: unknown = await subRes.json().catch(() => null);
  return {
    status: subRes.status,
    body: { ok: subRes.ok, callbackUrl: opts.callbackUrl, events: CALENDLY_EVENTS, scope: 'organization', calendly },
  };
}
