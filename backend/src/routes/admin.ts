import { Router } from 'express';
import * as db from '../db.js';
import { env } from '../env.js';
import { ConfigError } from '../errors.js';
import { registerCalendlyWebhook } from '../lib/calendly.js';
import { requireAdmin, requireAdminToken } from '../middleware/auth.js';

export const adminRouter = Router();

adminRouter.get('/admin/users', ...requireAdmin, async (_req, res) => {
  res.json(await db.listProfiles());
});

/**
 * One-time setup: subscribes ${PUBLIC_API_URL}/webhooks/calendly to
 * invitee.created/canceled. Returns Calendly's status (409 = already exists).
 *
 *   curl -X POST $PUBLIC_API_URL/admin/calendly/register-webhook -H "x-admin-token: $ADMIN_API_TOKEN"
 */
adminRouter.post('/admin/calendly/register-webhook', requireAdminToken, async (_req, res) => {
  const { personalAccessToken, webhookSigningKey } = env.calendly;
  if (!personalAccessToken) throw new ConfigError('CALENDLY_PERSONAL_ACCESS_TOKEN');
  if (!webhookSigningKey) throw new ConfigError('CALENDLY_WEBHOOK_SIGNING_KEY');
  if (!env.publicApiUrl) throw new ConfigError('PUBLIC_API_URL');

  const result = await registerCalendlyWebhook({
    personalAccessToken,
    signingKey: webhookSigningKey,
    callbackUrl: `${env.publicApiUrl}/webhooks/calendly`,
  });
  res.status(result.status).json(result.body);
});
