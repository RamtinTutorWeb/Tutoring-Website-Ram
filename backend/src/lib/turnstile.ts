import { env } from '../env.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token. Without TURNSTILE_SECRET_KEY every
 * request passes (the check is opt-in). A Cloudflare outage fails closed.
 */
export async function verifyTurnstile(token: unknown, remoteIp: string | undefined): Promise<boolean> {
  const secret = env.turnstileSecretKey;
  if (!secret) return true;
  if (typeof token !== 'string' || !token || token.length > 2048) return false;
  try {
    const body = new URLSearchParams({ secret, response: token, ...(remoteIp ? { remoteip: remoteIp } : {}) });
    const res = await fetch(VERIFY_URL, { method: 'POST', body, signal: AbortSignal.timeout(5000) });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch (err) {
    console.error('turnstile verify failed:', err instanceof Error ? err.message : err);
    return false;
  }
}
