import { Router } from 'express';
import { configured, devAuthEnabled } from '../env.js';

export const healthRouter = Router();

/** Liveness plus which integrations have credentials. Presence only, never values. */
healthRouter.get('/health', (_req, res) => {
  res.set('Cache-Control', 'no-store').json({ ok: true, configured: configured(), ...(devAuthEnabled() ? { devAuth: true } : {}) });
});
