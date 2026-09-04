import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getConfiguredSummary } from './_lib/env';

/**
 * GET /api/health
 * Liveness check plus a boolean map of which integrations have their env vars set.
 * Reports presence only, never values.
 */
export default function handler(req: VercelRequest, res: VercelResponse): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'tutorpro-api',
    configured: getConfiguredSummary(),
  });
}
