import type { VercelRequest, VercelResponse } from '@vercel/node';
import { timingSafeEqual } from 'node:crypto';
import {
  getAdminApiToken,
  getCalendlyPersonalAccessToken,
  getCalendlyWebhookSigningKey,
  getPublicBaseUrl,
  MissingEnvError,
} from '../_lib/env';
import { headerValue } from '../_lib/rawBody';

/**
 * POST /api/calendly/register-webhook
 *
 * One-time convenience: creates the Calendly webhook subscription that points
 * at `${PUBLIC_BASE_URL}/api/calendly/webhook` for `invitee.created` and
 * `invitee.canceled`, scoped to the organization. Guarded by the
 * `x-admin-token` header, which must equal `ADMIN_API_TOKEN`.
 *
 *   curl -X POST https://<domain>/api/calendly/register-webhook \
 *        -H "x-admin-token: $ADMIN_API_TOKEN"
 *
 * Returns Calendly's JSON response (201 on success). Calendly rejects a second
 * subscription with the same URL+events+scope with 409, which is harmless.
 */

const CALENDLY_API = 'https://api.calendly.com';
const EVENTS = ['invitee.created', 'invitee.canceled'] as const;

interface CalendlyUserMe {
  resource?: {
    uri?: string;
    current_organization?: string;
  };
}

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

async function calendlyFetch(path: string, pat: string, init?: RequestInit): Promise<Response> {
  return fetch(`${CALENDLY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${pat}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!tokenMatches(headerValue(req, 'x-admin-token'), getAdminApiToken())) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const pat = getCalendlyPersonalAccessToken();
    if (!pat) {
      res.status(500).json({ error: 'CALENDLY_PERSONAL_ACCESS_TOKEN is not set' });
      return;
    }
    const signingKey = getCalendlyWebhookSigningKey();
    const callbackUrl = `${getPublicBaseUrl()}/api/calendly/webhook`;

    const meRes = await calendlyFetch('/users/me', pat);
    if (!meRes.ok) {
      const detail: unknown = await meRes.json().catch(() => null);
      res.status(502).json({ error: 'Calendly /users/me failed', status: meRes.status, detail });
      return;
    }
    const me = (await meRes.json()) as CalendlyUserMe;
    const organization = me.resource?.current_organization;
    const user = me.resource?.uri;
    if (!organization || !user) {
      res.status(502).json({ error: 'Calendly /users/me did not return organization and user URIs' });
      return;
    }

    const subRes = await calendlyFetch('/webhook_subscriptions', pat, {
      method: 'POST',
      body: JSON.stringify({
        url: callbackUrl,
        events: EVENTS,
        organization,
        user,
        scope: 'organization',
        signing_key: signingKey,
      }),
    });
    const subJson: unknown = await subRes.json().catch(() => null);

    res.status(subRes.status).json({
      ok: subRes.ok,
      callbackUrl,
      events: EVENTS,
      scope: 'organization',
      calendly: subJson,
    });
  } catch (err) {
    if (err instanceof MissingEnvError) {
      res.status(500).json({ error: `${err.envName} is not set` });
      return;
    }
    console.error('register-webhook failed', err instanceof Error ? err.message : err);
    res.status(500).json({ error: 'Failed to register webhook' });
  }
}
