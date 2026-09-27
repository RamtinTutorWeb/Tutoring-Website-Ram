/**
 * In-memory stand-ins for the two module boundaries the tests replace:
 * src/db.ts (Supabase) and src/lib/clerk.ts (Clerk). Wired up in setup.ts.
 */
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { vi } from 'vitest';
import type * as realDb from '../src/db.js';
import { conflict } from '../src/errors.js';
import type { ClerkUserInfo } from '../src/lib/clerk.js';
import type { Assessment, Booking, LearnerCourse, Profile, SessionRequest } from '../src/types.js';

type Db = typeof realDb;

export const state = {
  profiles: new Map<string, Profile>(),
  settings: new Map<string, unknown>(),
  requests: [] as SessionRequest[],
  bookings: new Map<string, Booking & { requestId: string | null }>(),
  learnerCourses: [] as LearnerCourse[],
  assessments: [] as Assessment[],
  webhookEvents: new Set<string>(),
};

export const clerkUsers = new Map<string, ClerkUserInfo>();

export function resetState(): void {
  state.profiles.clear();
  state.settings.clear();
  state.requests.length = 0;
  state.bookings.clear();
  state.learnerCourses.length = 0;
  state.assessments.length = 0;
  state.webhookEvents.clear();
  clerkUsers.clear();
  clerkUsers.set('user_student', {
    id: 'user_student',
    email: 'student@test.dev',
    fullName: 'Sam Student',
    phone: null,
    role: 'student',
  });
  clerkUsers.set('user_admin', {
    id: 'user_admin',
    email: 'admin@test.dev',
    fullName: 'Ada Admin',
    phone: null,
    role: 'admin',
  });
}

/** `Authorization: Bearer test_<userId>` stands in for a verified Clerk session. */
export const auth = (userId: string) => ({ Authorization: `Bearer test_${userId}` });

export const fakeClerk = {
  clerkAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getSessionUserId: (req: Request) => /^Bearer test_(\S+)$/.exec(req.get('authorization') ?? '')?.[1] ?? null,
  getClerkUser: vi.fn(async (userId: string) => {
    const user = clerkUsers.get(userId);
    if (!user) throw new Error(`clerk: no user ${userId}`);
    return user;
  }),
  forgetClerkUser: vi.fn(),
};

const now = () => new Date().toISOString();

export const fakeDb: Db = {
  getProfile: vi.fn(async (id) => state.profiles.get(id) ?? null),
  insertProfileIfMissing: vi.fn(async (p) => {
    if (!state.profiles.has(p.id)) state.profiles.set(p.id, { ...p, createdAt: now() });
    return state.profiles.get(p.id)!;
  }),
  upsertProfile: vi.fn(async (p) => {
    state.profiles.set(p.id, { ...p, createdAt: state.profiles.get(p.id)?.createdAt ?? now() });
  }),
  updateProfile: vi.fn(async (id, patch) => {
    const existing = state.profiles.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch };
    state.profiles.set(id, updated);
    return updated;
  }),
  deleteProfile: vi.fn(async (id) => {
    state.profiles.delete(id);
  }),
  listProfiles: vi.fn(async () => [...state.profiles.values()]),
  findProfileIdByEmail: vi.fn(
    async (email) => [...state.profiles.values()].find((p) => p.email.toLowerCase() === email.toLowerCase())?.id ?? null,
  ),

  getSettings: vi.fn(async (keys: string[]) =>
    Object.fromEntries(keys.filter((k) => state.settings.has(k)).map((k) => [k, state.settings.get(k)])),
  ),
  putSettings: vi.fn(async (entries) => {
    for (const [k, v] of Object.entries(entries)) state.settings.set(k, structuredClone(v));
  }),

  createRequest: vi.fn(async (r) => {
    const row: SessionRequest = {
      ...r,
      earliestDate: r.earliestDate ?? '',
      id: randomUUID(),
      status: 'new',
      createdAt: now(),
    };
    state.requests.unshift(row);
    return row;
  }),
  listRequests: vi.fn(async (studentId) => state.requests.filter((r) => !studentId || r.studentId === studentId)),
  getRequest: vi.fn(async (id) => {
    const row = state.requests.find((r) => r.id === id);
    return row ? { ...row } : null;
  }),
  setRequestStatus: vi.fn(async (id, status) => {
    const row = state.requests.find((r) => r.id === id);
    if (!row) return null;
    row.status = status;
    return { ...row };
  }),

  listBookings: vi.fn(async (studentId) =>
    [...state.bookings.values()].filter((b) => !studentId || b.studentId === studentId),
  ),
  upsertBooking: vi.fn(async (b) => {
    const existing = state.bookings.get(b.calendlyInviteeUri);
    state.bookings.set(b.calendlyInviteeUri, {
      id: existing?.id ?? randomUUID(),
      studentId: b.studentId,
      requestId: b.requestId,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      eventTypeName: b.eventTypeName,
      startAt: b.startAt,
      endAt: b.endAt,
      status: b.status,
      cancelReason: b.cancelReason,
    });
  }),

  listLearnerCourses: vi.fn(async (studentId) =>
    state.learnerCourses.filter((c) => !studentId || c.studentId === studentId),
  ),
  createLearnerCourse: vi.fn(async (studentId, courseId) => {
    if (state.learnerCourses.some((c) => c.studentId === studentId && c.courseId === courseId)) {
      throw conflict('Already registered for this course');
    }
    const row: LearnerCourse = { id: randomUUID(), studentId, courseId, status: 'registered', registeredAt: now() };
    state.learnerCourses.push(row);
    return row;
  }),
  getLearnerCourse: vi.fn(async (id) => {
    const row = state.learnerCourses.find((c) => c.id === id);
    return row ? { ...row } : null;
  }),
  deleteLearnerCourse: vi.fn(async (id) => {
    const i = state.learnerCourses.findIndex((c) => c.id === id);
    if (i >= 0) state.learnerCourses.splice(i, 1);
  }),
  setLearnerCourseStatus: vi.fn(async (id, status) => {
    const row = state.learnerCourses.find((c) => c.id === id);
    if (!row) return null;
    row.status = status;
    return { ...row };
  }),

  createAssessment: vi.fn(async (a) => {
    const row: Assessment = { ...a, id: randomUUID(), createdAt: now() };
    state.assessments.unshift(row);
    return row;
  }),
  listAssessments: vi.fn(async (studentId) => state.assessments.filter((a) => !studentId || a.studentId === studentId)),

  recordWebhookEvent: vi.fn(async (provider, eventId) => {
    const key = `${provider}:${eventId}`;
    if (state.webhookEvents.has(key)) return false;
    state.webhookEvents.add(key);
    return true;
  }),
  forgetWebhookEvent: vi.fn(async (provider, eventId) => {
    state.webhookEvents.delete(`${provider}:${eventId}`);
  }),
};

/** Resend's `emails.send`, shared with the mocked `resend` package. */
export const sendMail = vi.fn(async (_payload: Record<string, unknown>) => ({ data: { id: 'email_1' }, error: null }));
