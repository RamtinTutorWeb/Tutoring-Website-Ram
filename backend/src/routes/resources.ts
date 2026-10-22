import { randomUUID } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import * as db from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { sendResourceSharedEmail } from '../lib/mail.js';
import { optionalViewer, requireAdmin, type Viewer } from '../middleware/auth.js';
import { RESOURCE_KINDS, RESOURCE_VISIBILITIES, type Resource } from '../types.js';
import { uuidParam } from './params.js';

/** Matches the `resources` bucket's file_size_limit (see the 20261021 migration). */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

// `<uuid>/<name>` as produced by POST /resources/files; nothing else may be attached.
const STORAGE_PATH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]{1,200}$/;

const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^https?:\/\/[^\s]+$/i.test(v), 'must be an http(s) URL');

const fields = {
  title: z.string().trim().min(1, 'required').max(200),
  description: z.string().trim().max(5000),
  kind: z.enum(RESOURCE_KINDS),
  url: httpUrl.nullable(),
  storagePath: z.string().regex(STORAGE_PATH_RE, 'unknown file').nullable(),
  fileName: z.string().trim().max(200).nullable(),
  mimeType: z.string().trim().max(200).nullable(),
  sizeBytes: z.number().int().min(0).max(MAX_FILE_BYTES).nullable(),
  subject: z.string().trim().max(100),
  courseId: z.string().trim().max(100).nullable(),
  visibility: z.enum(RESOURCE_VISIBILITIES),
  studentIds: z.array(z.string().trim().min(1).max(100)).max(500),
  featured: z.boolean(),
};

const createSchema = z.object({
  ...fields,
  description: fields.description.default(''),
  url: fields.url.optional().default(null),
  storagePath: fields.storagePath.optional().default(null),
  fileName: fields.fileName.optional().default(null),
  mimeType: fields.mimeType.optional().default(null),
  sizeBytes: fields.sizeBytes.optional().default(null),
  subject: fields.subject.default(''),
  courseId: fields.courseId.optional().default(null),
  visibility: fields.visibility.default('students'),
  studentIds: fields.studentIds.default([]),
  featured: fields.featured.default(false),
});
const patchSchema = z.object(fields).partial();

/** Files need an uploaded object, links/videos a URL; the other target is cleared. */
function normalizeTarget(r: db.ResourceWrite): db.ResourceWrite {
  if (r.kind === 'file') {
    if (!r.storagePath) throw badRequest('storagePath: upload a file first');
    return { ...r, url: null, fileName: r.fileName || r.storagePath.split('/')[1]! };
  }
  if (!r.url) throw badRequest('url: required for links and videos');
  return { ...r, storagePath: null, fileName: null, mimeType: null, sizeBytes: null };
}

/** Only private resources carry a share list. */
function normalizeSharing(r: db.ResourceWrite): db.ResourceWrite {
  return { ...r, studentIds: r.visibility === 'private' ? [...new Set(r.studentIds)] : [] };
}

/** API shape: never the storage path; the share list is admin-only. */
function present(resource: db.StoredResource, viewer: Viewer | null): Resource {
  const { storagePath: _path, ...rest } = resource;
  return viewer?.role === 'admin' ? rest : { ...rest, studentIds: [] };
}

function canView(resource: db.StoredResource, viewer: Viewer | null): boolean {
  if (resource.visibility === 'public') return true;
  if (!viewer) return false;
  if (viewer.role === 'admin' || resource.visibility === 'students') return true;
  return resource.studentIds.includes(viewer.userId);
}

/** Emails students newly added to a private resource's share list. Never throws. */
async function notifyShared(resource: db.StoredResource, previous: string[] = []): Promise<void> {
  if (resource.visibility !== 'private') return;
  const added = resource.studentIds.filter((id) => !previous.includes(id));
  await Promise.all(
    added.map(async (id) => {
      try {
        const profile = await db.getProfile(id);
        if (profile?.email) await sendResourceSharedEmail(profile, resource);
      } catch (err) {
        console.error(`resource share mail to ${id} failed:`, err instanceof Error ? err.message : err);
      }
    }),
  );
}

/** Keeps letters, digits, dot, dash, underscore and spaces; storage keys must be URL-safe-ish. */
export function safeFileName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  const cleaned = base
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^[.-]+/, '')
    .slice(-120);
  return cleaned || 'file';
}

function queryString(req: Request, key: string): string {
  const value = req.query[key];
  return typeof value === 'string' ? value : '';
}

export const resourcesRouter = Router();

/** Public: visitors get public resources; students also get shared ones; admins get everything. */
resourcesRouter.get('/resources', async (req, res) => {
  const viewer = await optionalViewer(req);
  const scope = !viewer ? 'public' : viewer.role === 'admin' ? 'all' : { studentId: viewer.userId };
  const resources = await db.listResources(scope);
  res.json(resources.filter((r) => canView(r, viewer)).map((r) => present(r, viewer)));
});

/** `{ url }` to open: a 5-minute signed link for files, the target itself for links/videos. */
resourcesRouter.get('/resources/:id/download', async (req, res) => {
  const id = uuidParam(req, 'Resource');
  const viewer = await optionalViewer(req);
  const resource = await db.getResource(id);
  // Hidden and missing look the same, so ids can't be probed.
  if (!resource || !canView(resource, viewer)) throw notFound('Resource');
  if (resource.kind !== 'file' || !resource.storagePath) {
    res.json({ url: resource.url });
    return;
  }
  const url = await db.signResourceFile(resource.storagePath, resource.fileName ?? 'download');
  res.set('Cache-Control', 'no-store').json({ url });
});

/**
 * Admin upload, step 1 of 2: raw body (any Content-Type), `?name=<original file name>`.
 * Returns the fields to send with POST /resources (or PATCH to replace a file).
 * app.ts keeps express.json() off this path so JSON files arrive as raw bytes.
 */
resourcesRouter.post(
  '/resources/files',
  ...requireAdmin,
  express.raw({ type: () => true, limit: MAX_FILE_BYTES }),
  async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) throw badRequest('Empty file');
    const fileName = safeFileName(queryString(req, 'name'));
    const mimeType = (req.get('content-type') ?? '').split(';')[0]!.trim() || 'application/octet-stream';
    const storagePath = `${randomUUID()}/${fileName}`;
    await db.uploadResourceFile(storagePath, body, mimeType);
    res.status(201).json({ storagePath, fileName, mimeType, sizeBytes: body.length });
  },
);

resourcesRouter.post('/resources', ...requireAdmin, async (req, res) => {
  const input = normalizeSharing(normalizeTarget(createSchema.parse(req.body ?? {})));
  const created = await db.createResource(input);
  await notifyShared(created);
  res.status(201).json(present(created, req.viewer!));
});

resourcesRouter.patch('/resources/:id', ...requireAdmin, async (req, res) => {
  const id = uuidParam(req, 'Resource');
  const patch = patchSchema.parse(req.body ?? {});
  const current = await db.getResource(id);
  if (!current) throw notFound('Resource');

  const { id: _id, createdAt: _c, storagePath, ...currentFields } = current;
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
  const next = normalizeSharing(normalizeTarget({ ...currentFields, storagePath, ...clean } as db.ResourceWrite));
  const updated = await db.updateResource(id, next);
  if (!updated) throw notFound('Resource');

  // A replaced or detached file is no longer referenced.
  if (storagePath && storagePath !== updated.storagePath) await db.removeResourceFile(storagePath);
  await notifyShared(updated, current.visibility === 'private' ? current.studentIds : []);
  res.json(present(updated, req.viewer!));
});

resourcesRouter.delete('/resources/:id', ...requireAdmin, async (req, res) => {
  const deleted = await db.deleteResource(uuidParam(req, 'Resource'));
  if (!deleted) throw notFound('Resource');
  if (deleted.storagePath) await db.removeResourceFile(deleted.storagePath);
  res.status(204).end();
});
