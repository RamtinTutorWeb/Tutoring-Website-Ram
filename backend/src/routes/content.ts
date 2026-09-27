import { Router, type Request } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { badRequest } from '../errors.js';
import { getClerkUser, getSessionUserId } from '../lib/clerk.js';
import { normalizeCatalog, normalizeOptions } from '../lib/content.js';
import { requireAdmin } from '../middleware/auth.js';
import { SELECTABLE_OPTION_KEYS, type Course, type FaqItem, type SiteContent } from '../types.js';

// site_settings rows: 'content' holds courses/examPrepTracks/faq,
// 'selectable_options' holds the dropdown choices. Reviews have their own table.
const CONTENT_KEY = 'content';
const OPTIONS_KEY = 'selectable_options';

const MAX_ITEMS = 500;
const str = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(100);

const courseSchema = z.object({ id, title: str(200), category: str(100), description: str(5000).default('') });
const faqSchema = z.object({ id, question: str(1000), answer: str(10000) });

const contentPatchSchema = z.object({
  courses: z.array(courseSchema).max(MAX_ITEMS).optional(),
  examPrepTracks: z.array(courseSchema).max(MAX_ITEMS).optional(),
  faq: z.array(faqSchema).max(MAX_ITEMS).optional(),
  selectableOptions: z
    .object(Object.fromEntries(SELECTABLE_OPTION_KEYS.map((k) => [k, z.array(str(200)).max(MAX_ITEMS).optional()])))
    .optional(),
});

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type SettingsContent = Omit<SiteContent, 'reviews'>;

/** Everything in SiteContent except reviews (which come from the reviews table). */
export async function loadSettingsContent(): Promise<SettingsContent> {
  const settings = await db.getSettings([CONTENT_KEY, OPTIONS_KEY]);
  const content = (settings[CONTENT_KEY] ?? {}) as Record<string, unknown>;
  const catalog = normalizeCatalog(arrayOf<Course>(content['courses']), arrayOf<Course>(content['examPrepTracks']));
  return {
    ...catalog,
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
  const [content, reviews] = await Promise.all([loadSettingsContent(), db.listReviews(await viewerIsAdmin(req))]);
  res.json({ ...content, reviews } satisfies SiteContent);
});

/** Partial update: keys that are present replace the stored value; others are kept. */
contentRouter.put('/content', ...requireAdmin, async (req, res) => {
  const body: unknown = req.body ?? {};
  if (typeof body === 'object' && body !== null && 'reviews' in body) {
    throw badRequest('reviews: not accepted here, use the /reviews routes');
  }
  const patch = contentPatchSchema.parse(body);
  const current = await loadSettingsContent();

  const catalog = normalizeCatalog(patch.courses ?? current.courses, patch.examPrepTracks ?? current.examPrepTracks);
  const next: SettingsContent = {
    ...catalog,
    faq: patch.faq ?? current.faq,
    selectableOptions: normalizeOptions({ ...current.selectableOptions, ...stripUndefined(patch.selectableOptions) }),
  };

  const { selectableOptions, ...content } = next;
  await db.putSettings({ [CONTENT_KEY]: content, [OPTIONS_KEY]: selectableOptions });
  res.json({ ...next, reviews: await db.listReviews(true) } satisfies SiteContent);
});

function stripUndefined(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined));
}
