import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { ensureProfile, requireAuth, viewerOf } from '../middleware/auth.js';
import type { Review } from '../types.js';
import { CONTENT_KEY, loadContent } from './content.js';

const newReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  text: z.string().trim().min(1, 'required').max(2000),
  name: z.string().trim().max(100).optional(),
});

export const reviewsRouter = Router();

/** Signed-in users submit a review; it stays `pending` (hidden from the public) until an admin approves it. */
reviewsRouter.post('/reviews', requireAuth, async (req, res) => {
  const input = newReviewSchema.parse(req.body ?? {});
  const profile = await ensureProfile(viewerOf(req));
  const review: Review = {
    id: `review_${randomUUID()}`,
    name: input.name || profile.fullName || 'Student',
    rating: input.rating,
    text: input.text,
    status: 'pending',
  };
  const { selectableOptions: _options, ...content } = await loadContent();
  await db.putSettings({ [CONTENT_KEY]: { ...content, reviews: [...content.reviews, review] } });
  res.status(201).json(review);
});
