import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import * as db from '../db.js';
import { env } from '../env.js';
import { forbidden, unauthorized } from '../errors.js';
import { getClerkUser, getSessionUserId, type ClerkUserInfo } from '../lib/clerk.js';
import type { Profile, Role } from '../types.js';

export interface Viewer {
  userId: string;
  role: Role;
  clerkUser: ClerkUserInfo;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      viewer?: Viewer;
    }
  }
}

/**
 * Requires a valid Clerk session. Role comes from the Clerk user's
 * `publicMetadata.role` (fetched once per user per 60s, see lib/clerk.ts).
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const userId = getSessionUserId(req);
  if (!userId) throw unauthorized();
  const clerkUser = await getClerkUser(userId);
  req.viewer = { userId, role: clerkUser.role, clerkUser };
  next();
};

/** requireAuth + role admin. */
export const requireAdmin: RequestHandler[] = [
  requireAuth,
  (req: Request, _res: Response, next: NextFunction) => {
    if (req.viewer?.role !== 'admin') throw forbidden();
    next();
  },
];

/**
 * For routes where auth is optional: the viewer when a valid session is sent,
 * otherwise null. A failed role lookup also yields null (the public view).
 */
export async function optionalViewer(req: Request): Promise<Viewer | null> {
  const userId = getSessionUserId(req);
  if (!userId) return null;
  try {
    const clerkUser = await getClerkUser(userId);
    return { userId, role: clerkUser.role, clerkUser };
  } catch (err) {
    console.warn(`${req.method} ${req.path}: role lookup failed, serving public view:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export function viewerOf(req: Request): Viewer {
  if (!req.viewer) throw unauthorized();
  return req.viewer;
}

/** Student id filter for list routes: admins see everything, students their own rows. */
export function ownerFilter(viewer: Viewer): string | undefined {
  return viewer.role === 'admin' ? undefined : viewer.userId;
}

/**
 * Makes sure the viewer has a `profiles` row (the Clerk webhook may not have
 * arrived yet) and that its email/role mirror Clerk. Name and phone are only
 * seeded on insert: after that PATCH /me owns them.
 */
export async function ensureProfile(viewer: Viewer): Promise<Profile> {
  const { clerkUser } = viewer;
  const existing = await db.getProfile(viewer.userId);
  if (!existing) {
    return db.insertProfileIfMissing({
      id: clerkUser.id,
      email: clerkUser.email,
      fullName: clerkUser.fullName,
      phone: clerkUser.phone,
      role: clerkUser.role,
    });
  }
  const patch: Partial<Pick<Profile, 'email' | 'role'>> = {};
  if (existing.role !== clerkUser.role) patch.role = clerkUser.role;
  if (clerkUser.email && existing.email !== clerkUser.email) patch.email = clerkUser.email;
  if (!Object.keys(patch).length) return existing;
  return (await db.updateProfile(viewer.userId, patch)) ?? existing;
}

/** Guards maintenance routes with the `x-admin-token` header (constant-time compare). */
export const requireAdminToken: RequestHandler = (req, _res, next) => {
  const expected = env.adminApiToken;
  const provided = req.get('x-admin-token');
  if (!expected || !provided) throw unauthorized();
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw unauthorized();
  next();
};
