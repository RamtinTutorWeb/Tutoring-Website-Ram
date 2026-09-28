import { clerkMiddleware, createClerkClient, getAuth, type ClerkClient } from '@clerk/express';
import type { Request, RequestHandler } from 'express';
import { configured, env } from '../env.js';
import { ConfigError } from '../errors.js';
import type { Role } from '../types.js';

/** The Clerk user fields the backend needs, with role already resolved. */
export interface ClerkUserInfo {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
}

let client: ClerkClient | undefined;

function getClient(): ClerkClient {
  if (!client) {
    if (!configured().clerk) throw new ConfigError('Clerk');
    client = createClerkClient({
      secretKey: env.clerk.secretKey,
      publishableKey: env.clerk.publishableKey,
    });
  }
  return client;
}

/**
 * Verifies the `Authorization: Bearer <session token>` header (networkless, via
 * JWKS) and attaches Clerk's auth object. Without Clerk keys it is a no-op and
 * every request is treated as signed out.
 */
export function clerkAuth(): RequestHandler {
  if (!configured().clerk) {
    console.warn('Clerk is not configured: all authenticated routes will return 401');
    return (_req, _res, next) => next();
  }
  return clerkMiddleware({
    clerkClient: getClient(),
    // In production only accept tokens minted for our own frontend origins.
    ...(env.isProduction && env.frontendOrigins.length ? { authorizedParties: env.frontendOrigins } : {}),
  });
}

/** Clerk user id of a valid session on this request, or null. */
export function getSessionUserId(req: Request): string | null {
  if (!configured().clerk) return null;
  return getAuth(req).userId ?? null;
}

/** `publicMetadata.role` is the role source of truth; anything but "admin" is a student. */
export function roleFromMetadata(metadata: Record<string, unknown> | null | undefined): Role {
  return metadata?.['role'] === 'admin' ? 'admin' : 'student';
}

// Role changes in the Clerk dashboard take effect within this window.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX = 1_000;
const cache = new Map<string, { user: ClerkUserInfo; expires: number }>();

/** Fetches a Clerk user (email, name, phone, role), cached in memory for 60s. */
export async function getClerkUser(userId: string): Promise<ClerkUserInfo> {
  const hit = cache.get(userId);
  if (hit && hit.expires > Date.now()) return hit.user;

  const u = await getClient().users.getUser(userId);
  const fullName = [u.firstName, u.lastName].map((p) => (p ?? '').trim()).filter(Boolean).join(' ');
  const user: ClerkUserInfo = {
    id: u.id,
    email: (u.primaryEmailAddress ?? u.emailAddresses[0])?.emailAddress.trim().toLowerCase() ?? '',
    fullName: fullName || null,
    phone: (u.primaryPhoneNumber ?? u.phoneNumbers[0])?.phoneNumber.trim() || null,
    role: roleFromMetadata(u.publicMetadata),
  };

  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(userId, { user, expires: Date.now() + CACHE_TTL_MS });
  return user;
}

/** Drops a cached user, e.g. after a Clerk `user.updated` webhook. */
export function forgetClerkUser(userId: string): void {
  cache.delete(userId);
}
