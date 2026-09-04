/**
 * Thin typed query helpers. Each returns the supabase-js response object
 * unchanged ({ data, error, ... }); callers decide how to handle errors.
 * Row visibility is decided by RLS (see supabase/migrations), so the same
 * helper serves students (own rows) and admins (all rows).
 */
import type { TutorProSupabaseClient } from "./client";
import type { Json, ProfileInsert, SessionRequestInsert, SessionRequestStatus, SiteSettingKey } from "./types";

// ---------------------------------------------------------------------------
// site_settings
// ---------------------------------------------------------------------------
export function getSiteSettings(client: TutorProSupabaseClient) {
  return client.from("site_settings").select("key, content, updated_at");
}

export function getSiteSetting(client: TutorProSupabaseClient, key: SiteSettingKey | string) {
  return client.from("site_settings").select("key, content, updated_at").eq("key", key).maybeSingle();
}

export function upsertSiteSetting(client: TutorProSupabaseClient, key: SiteSettingKey | string, content: Json) {
  return client.from("site_settings").upsert({ key, content }, { onConflict: "key" }).select().single();
}

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

/** Own profile. RLS returns only the caller's row, so no explicit id filter is needed. */
export function getMyProfile(client: TutorProSupabaseClient) {
  return client.from("profiles").select("*").maybeSingle();
}

/**
 * Creates or updates the caller's profile. `id` must be the Clerk user id and
 * `email` is required on first insert (RLS rejects rows for other users).
 */
export function upsertMyProfile(client: TutorProSupabaseClient, profile: ProfileInsert) {
  return client.from("profiles").upsert(profile, { onConflict: "id" }).select().single();
}

// ---------------------------------------------------------------------------
// session_requests
// ---------------------------------------------------------------------------
export function createSessionRequest(client: TutorProSupabaseClient, input: SessionRequestInsert) {
  return client.from("session_requests").insert(input).select().single();
}

/** Student: own requests. Admin: every request. Newest first. */
export function listSessionRequests(client: TutorProSupabaseClient) {
  return client.from("session_requests").select("*").order("created_at", { ascending: false });
}

export function updateSessionRequestStatus(client: TutorProSupabaseClient, id: string, status: SessionRequestStatus) {
  return client.from("session_requests").update({ status }).eq("id", id).select().single();
}

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------

/** Student: own bookings. Admin: every booking. Soonest first. */
export function listBookings(client: TutorProSupabaseClient) {
  return client.from("bookings").select("*").order("start_at", { ascending: true });
}

// ---------------------------------------------------------------------------
// learner_courses
// ---------------------------------------------------------------------------

/** Student: own course records. Admin: every record. */
export function listLearnerCourses(client: TutorProSupabaseClient) {
  return client.from("learner_courses").select("*").order("registered_at", { ascending: false });
}
