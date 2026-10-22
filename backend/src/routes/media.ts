import { randomUUID } from 'node:crypto';
import express, { Router } from 'express';
import * as db from '../db.js';
import { badRequest } from '../errors.js';
import { requireAdmin } from '../middleware/auth.js';
import { safeFileName } from './resources.js';

/** Matches the `site-media` bucket (see the 20261022 migration). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

export const mediaRouter = Router();

/**
 * Admin image upload for public pages (tutor photo): raw body with the image's
 * Content-Type, `?name=<file name>`. Returns `{ url }`, a public URL.
 */
mediaRouter.post(
  '/media',
  ...requireAdmin,
  express.raw({ type: () => true, limit: MAX_IMAGE_BYTES }),
  async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (!body.length) throw badRequest('Empty file');
    const type = (req.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase();
    if (!IMAGE_TYPES.has(type)) throw badRequest('Only PNG, JPEG, WebP, GIF or AVIF images');
    const name = typeof req.query['name'] === 'string' ? req.query['name'] : '';
    const url = await db.uploadSiteMedia(`${randomUUID()}/${safeFileName(name)}`, body, type);
    res.status(201).json({ url });
  },
);
