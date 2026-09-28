import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { ensureProfile, requireAuth, viewerOf } from '../middleware/auth.js';

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => (v ? v : null));

const mePatchSchema = z.object({
  fullName: nullableText(200).optional(),
  phone: nullableText(50).optional(),
});

export const meRouter = Router();

meRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await ensureProfile(viewerOf(req)));
});

meRouter.patch('/me', requireAuth, async (req, res) => {
  const patch = mePatchSchema.parse(req.body ?? {});
  const viewer = viewerOf(req);
  const profile = await ensureProfile(viewer);
  if (patch.fullName === undefined && patch.phone === undefined) {
    res.json(profile);
    return;
  }
  const updated = await db.updateProfile(viewer.userId, {
    ...(patch.fullName !== undefined ? { fullName: patch.fullName } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
  });
  res.json(updated ?? profile);
});
