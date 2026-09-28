import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import * as db from '../db.js';
import { env } from '../env.js';
import { notFound } from '../errors.js';
import { getClerkUser, getSessionUserId } from '../lib/clerk.js';
import { sendNewRequestEmail, sendRequestAcceptedEmail } from '../lib/mail.js';
import { ensureProfile, ownerFilter, requireAdmin, requireAuth, viewerOf } from '../middleware/auth.js';
import { REQUEST_STATUSES } from '../types.js';
import { uuidParam } from './params.js';

const text = (max: number) => z.string().trim().max(max).optional().default('');

const newRequestSchema = z.object({
  name: z.string().trim().min(1, 'required').max(200),
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  phone: text(50),
  contactMethod: text(100),
  serviceType: text(100),
  subject: text(200),
  urgencyWindow: text(100),
  isUrgent: z.boolean().optional().default(false),
  hardTopics: text(2000),
  preferredSlot: text(200),
  earliestDate: z
    .union([z.literal(''), z.iso.date()])
    .optional()
    .transform((v) => (v ? v : null)),
  message: text(5000),
  consultation: z.boolean().optional().default(false),
});

const statusSchema = z.object({ status: z.enum(REQUEST_STATUSES) });

// Public, unauthenticated, and sends email: keep it from being used as a spam cannon.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  handler: (_req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later' });
  },
});

export const requestsRouter = Router();

requestsRouter.post('/requests', createLimiter, async (req, res) => {
  const input = newRequestSchema.parse(req.body ?? {});

  // Auth is optional here: a signed-in student gets the request linked to them.
  let studentId: string | null = null;
  const userId = getSessionUserId(req);
  if (userId) {
    const clerkUser = await getClerkUser(userId);
    await ensureProfile({ userId, role: clerkUser.role, clerkUser });
    studentId = userId;
  }

  const created = await db.createRequest({ ...input, studentId });
  await sendNewRequestEmail(created);
  res.status(201).json(created);
});

requestsRouter.get('/requests', requireAuth, async (req, res) => {
  res.json(await db.listRequests(ownerFilter(viewerOf(req))));
});

requestsRouter.patch('/requests/:id', ...requireAdmin, async (req, res) => {
  const id = uuidParam(req, 'Request');
  const { status } = statusSchema.parse(req.body ?? {});
  const before = await db.getRequest(id);
  if (!before) throw notFound('Request');

  const updated = await db.setRequestStatus(id, status);
  if (!updated) throw notFound('Request');
  // Only on the transition, so re-saving an accepted request doesn't resend.
  if (status === 'accepted' && before.status !== 'accepted') {
    await sendRequestAcceptedEmail(updated);
  }
  res.json(updated);
});
