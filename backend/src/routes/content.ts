import { Router, type Request } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { getClerkUser, getSessionUserId } from '../lib/clerk.js';
import { normalizeCatalog, normalizeOptions } from '../lib/content.js';
import { requireAdmin } from '../middleware/auth.js';
import { SELECTABLE_OPTION_KEYS, type Course, type FaqItem, type Review, type SiteContent } from '../types.js';

// site_settings rows: 'content' holds courses/examPrepTracks/reviews/faq,
// 'selectable_options' holds the dropdown choices.
export const CONTENT_KEY = 'content';
const OPTIONS_KEY = 'selectable_options';

const MAX_ITEMS = 500;
const str = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(100);

const courseSchema = z.object({ id, title: str(200), category: str(100), description: str(5000).default('') });
const reviewSchema = z.object({
  id,
  name: str(200),
  rating: z.number().min(0).max(5),
  text: str(5000),
  status: z.enum(['pending', 'approved']).optional(),
});
const faqSchema = z.object({ id, question: str(1000), answer: str(10000) });

const contentPatchSchema = z.object({
  courses: z.array(courseSchema).max(MAX_ITEMS).optional(),
  examPrepTracks: z.array(courseSchema).max(MAX_ITEMS).optional(),
  reviews: z.array(reviewSchema).max(MAX_ITEMS).optional(),
  faq: z.array(faqSchema).max(MAX_ITEMS).optional(),
  selectableOptions: z
    .object(Object.fromEntries(SELECTABLE_OPTION_KEYS.map((k) => [k, z.array(str(200)).max(MAX_ITEMS).optional()])))
    .optional(),
});

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function loadContent(): Promise<SiteContent> {
  const settings = await db.getSettings([CONTENT_KEY, OPTIONS_KEY]);
  const content = (settings[CONTENT_KEY] ?? {}) as Record<string, unknown>;
  const catalog = normalizeCatalog(arrayOf<Course>(content['courses']), arrayOf<Course>(content['examPrepTracks']));
  return {
    ...catalog,
    reviews: arrayOf<Review>(content['reviews']),
    faq: arrayOf<FaqItem>(content['faq']),
    selectableOptions: normalizeOptions(settings[OPTIONS_KEY] as Record<string, unknown> | undefined),
  };
}

export const contentRouter = Router();

/** Pending reviews are only visible to admins (auth is optional on this route). */
async function viewerIsAdmin(req: Request): Promise<boolean> {
  const userId = getSessionUserId(req);
  if (!userId) return false;
  try {
    return (await getClerkUser(userId)).role === 'admin';
  } catch (err) {
    console.warn('GET /content: role lookup failed, serving public view:', err instanceof Error ? err.message : err);
    return false;
  }
}

contentRouter.get('/content', async (req, res) => {
  const content = await loadContent();
  if (!(await viewerIsAdmin(req))) content.reviews = content.reviews.filter((r) => r.status !== 'pending');
  res.json(content);
});

/** Partial update: keys that are present replace the stored value; others are kept. */
contentRouter.put('/content', ...requireAdmin, async (req, res) => {
  const patch = contentPatchSchema.parse(req.body ?? {});
  const current = await loadContent();

  const catalog = normalizeCatalog(patch.courses ?? current.courses, patch.examPrepTracks ?? current.examPrepTracks);
  const next: SiteContent = {
    ...catalog,
    reviews: patch.reviews ?? current.reviews,
    faq: patch.faq ?? current.faq,
    selectableOptions: normalizeOptions({ ...current.selectableOptions, ...stripUndefined(patch.selectableOptions) }),
  };

  const { selectableOptions, ...content } = next;
  await db.putSettings({ [CONTENT_KEY]: content, [OPTIONS_KEY]: selectableOptions });
  res.json(next);
});

function stripUndefined(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined));
}
