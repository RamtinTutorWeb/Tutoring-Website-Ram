import { Router, type Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import * as db from '../db.js';
import { HttpError, notFound } from '../errors.js';
import { ensureProfile, requireAdmin, requireAuth, viewerOf } from '../middleware/auth.js';
import { REVIEW_STATUSES } from '../types.js';

const name = z.string().trim().min(1, 'required').max(100);
const rating = z.number().int().min(1).max(5);
const text = z.string().trim().min(1, 'required').max(2000);

const newReviewSchema = z.object({ rating, text, name: z.string().trim().max(100).optional() });
const reviewPatchSchema = z.object({
  status: z.enum(REVIEW_STATUSES).optional(),
  name: name.optional(),
  rating: rating.optional(),
  text: text.optional(),
});

/** A student may have at most this many reviews waiting for approval. */
export const MAX_PENDING_REVIEWS = 3;

// Per user, not per IP: requireAuth runs first. Rejected submissions don't count.
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  keyGenerator: (req: Request) => req.viewer!.userId,
  skipFailedRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many reviews, please try again later' });
  },
});

function reviewId(req: Request): string {
  const id = req.params['id'];
  if (typeof id !== 'string' || !id || id.length > 200) throw notFound('Review');
  return id;
}

export const reviewsRouter = Router();

/** Students' reviews wait for approval; an admin's are published immediately. */
reviewsRouter.post('/reviews', requireAuth, createLimiter, async (req, res) => {
  const input = newReviewSchema.parse(req.body ?? {});
  const viewer = viewerOf(req);
  const profile = await ensureProfile(viewer);
  const isAdmin = viewer.role === 'admin';
  if (!isAdmin && (await db.countPendingReviews(viewer.userId)) >= MAX_PENDING_REVIEWS) {
    throw new HttpError(429, 'You already have reviews waiting for approval');
  }
  const review = await db.createReview({
    studentId: viewer.userId,
    name: input.name || profile.fullName || 'Student',
    rating: input.rating,
    text: input.text,
    status: isAdmin ? 'approved' : 'pending',
  });
  res.status(201).json(review);
});

reviewsRouter.patch('/reviews/:id', ...requireAdmin, async (req, res) => {
  const id = reviewId(req);
  const patch = reviewPatchSchema.parse(req.body ?? {});
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const updated = await db.updateReview(id, clean);
  if (!updated) throw notFound('Review');
  res.json(updated);
});

reviewsRouter.delete('/reviews/:id', ...requireAdmin, async (req, res) => {
  if (!(await db.deleteReview(reviewId(req)))) throw notFound('Review');
  res.status(204).end();
});
