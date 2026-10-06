import { Router, type Request } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { badRequest } from '../errors.js';
import { getClerkUser, getSessionUserId } from '../lib/clerk.js';
import { normalizeCatalog, normalizeOptions, normalizePages } from '../lib/content.js';
import { requireAdmin } from '../middleware/auth.js';
import { SELECTABLE_OPTION_KEYS, type Course, type FaqItem, type SiteContent } from '../types.js';

// site_settings rows: 'content' holds courses/examPrepTracks/faq,
// 'selectable_options' holds the dropdown choices, 'pages' the editable page copy.
// Reviews have their own table.
const CONTENT_KEY = 'content';
const OPTIONS_KEY = 'selectable_options';
const PAGES_KEY = 'pages';

const MAX_ITEMS = 500;
const str = (max: number) => z.string().trim().max(max);
const id = z.string().trim().min(1).max(100);

const courseSchema = z.object({ id, title: str(200), category: str(100), description: str(5000).default('') });
const faqSchema = z.object({ id, question: str(1000), answer: str(10000) });
const sectionSchema = z.object({ id, heading: str(200), body: str(20000) });
const sections = z.array(sectionSchema).max(50);

/** Empty, or an https URL (optionally limited to some hosts). */
const httpsUrl = (hosts?: string[]) =>
  str(2000).refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') return false;
      return !hosts || hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    } catch {
      return false;
    }
  }, hosts ? `must be an https://${hosts[0]}/... link` : 'must be an https:// link');

const pagesPatchSchema = z
  .object({
    home: z.object({
      kicker: str(200),
      title: str(300),
      subtitle: str(1000),
      teachingTitle: str(200),
      teachingText: str(5000),
      videoUrl: httpsUrl(),
    }),
    about: z.object({ title: str(200), intro: str(5000), photoUrl: httpsUrl(), sections }),
    examPrep: z.object({ intro: str(5000), timelinesTitle: str(200), timelinesText: str(5000) }),
    policy: z.object({ intro: str(5000), sections }),
    contact: z.object({ intro: str(2000), email: z.union([z.literal(''), z.email().max(320)]), phone: str(50) }),
    booking: z.object({ calendlyUrl: httpsUrl(['calendly.com']), intro: str(2000) }),
  })
  .partial();

const contentPatchSchema = z.object({
  courses: z.array(courseSchema).max(MAX_ITEMS).optional(),
  examPrepTracks: z.array(courseSchema).max(MAX_ITEMS).optional(),
  faq: z.array(faqSchema).max(MAX_ITEMS).optional(),
  selectableOptions: z
    .object(Object.fromEntries(SELECTABLE_OPTION_KEYS.map((k) => [k, z.array(str(200)).max(MAX_ITEMS).optional()])))
    .optional(),
  pages: pagesPatchSchema.optional(),
});

function arrayOf<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

type SettingsContent = Omit<SiteContent, 'reviews'>;

/** Everything in SiteContent except reviews (which come from the reviews table). */
export async function loadSettingsContent(): Promise<SettingsContent> {
  const settings = await db.getSettings([CONTENT_KEY, OPTIONS_KEY, PAGES_KEY]);
  const content = (settings[CONTENT_KEY] ?? {}) as Record<string, unknown>;
  const catalog = normalizeCatalog(arrayOf<Course>(content['courses']), arrayOf<Course>(content['examPrepTracks']));
  return {
    ...catalog,
    faq: arrayOf<FaqItem>(content['faq']),
    selectableOptions: normalizeOptions(settings[OPTIONS_KEY] as Record<string, unknown> | undefined),
    pages: normalizePages(settings[PAGES_KEY]),
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
    // Each page present in the patch replaces that page; the others are kept.
    pages: normalizePages({ ...current.pages, ...stripUndefined(patch.pages) }),
  };

  const { selectableOptions, pages, ...content } = next;
  await db.putSettings({ [CONTENT_KEY]: content, [OPTIONS_KEY]: selectableOptions, [PAGES_KEY]: pages });
  res.json({ ...next, reviews: await db.listReviews(true) } satisfies SiteContent);
});

function stripUndefined(obj: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj ?? {}).filter(([, v]) => v !== undefined));
}
