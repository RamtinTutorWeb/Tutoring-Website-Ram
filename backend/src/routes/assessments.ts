import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { ensureProfile, ownerFilter, requireAuth, viewerOf } from '../middleware/auth.js';

const createSchema = z.object({
  subject: z.string().trim().max(200).nullish().transform((v) => v || null),
  answers: z.unknown().transform((v) => v ?? {}),
  score: z.number().finite().nullish().transform((v) => v ?? null),
  total: z.number().finite().nullish().transform((v) => v ?? null),
  recommendation: z.string().trim().max(5000).nullish().transform((v) => v || null),
});

// Answers are free-form JSON; cap them so one submission can't bloat the table.
const MAX_ANSWERS_BYTES = 64 * 1024;

export const assessmentsRouter = Router();

assessmentsRouter.post('/assessments', requireAuth, async (req, res) => {
  const input = createSchema.parse(req.body ?? {});
  if (JSON.stringify(input.answers).length > MAX_ANSWERS_BYTES) {
    res.status(400).json({ error: 'answers: too large' });
    return;
  }
  const viewer = viewerOf(req);
  await ensureProfile(viewer);
  res.status(201).json(await db.createAssessment({ ...input, studentId: viewer.userId }));
});

assessmentsRouter.get('/assessments', requireAuth, async (req, res) => {
  res.json(await db.listAssessments(ownerFilter(viewerOf(req))));
});
