/**
 * Every Supabase query lives here. Callers get camelCase API shapes; rows stay
 * snake_case inside this module. Tests replace this module wholesale.
 */
import { conflict } from './errors.js';
import { getSupabase } from './lib/supabase.js';
import type {
  Assessment,
  Booking,
  BookingStatus,
  CourseStatus,
  LearnerCourse,
  Profile,
  RequestStatus,
  Role,
  SessionRequest,
} from './types.js';

interface PgError {
  message: string;
  code?: string;
}

function check(error: PgError | null, what: string): void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

const UNIQUE_VIOLATION = '23505';

// --- profiles --------------------------------------------------------------------

interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: Role;
  created_at: string;
}

const PROFILE_COLS = 'id, email, full_name, phone, role, created_at';

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  email: r.email,
  fullName: r.full_name,
  phone: r.phone,
  role: r.role,
  createdAt: r.created_at,
});

export interface ProfileWrite {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: Role;
}

export async function getProfile(id: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from('profiles').select(PROFILE_COLS).eq('id', id).maybeSingle<ProfileRow>();
  check(error, 'profiles select');
  return data ? toProfile(data) : null;
}

/** Inserts, or on conflict leaves the existing row alone. Returns the stored row. */
export async function insertProfileIfMissing(p: ProfileWrite): Promise<Profile> {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert(
      { id: p.id, email: p.email, full_name: p.fullName, phone: p.phone, role: p.role },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  check(error, 'profiles insert');
  const stored = await getProfile(p.id);
  if (!stored) throw new Error(`profiles insert: row ${p.id} missing after insert`);
  return stored;
}

/** Full overwrite from Clerk (webhook). */
export async function upsertProfile(p: ProfileWrite): Promise<void> {
  const { error } = await getSupabase()
    .from('profiles')
    .upsert({ id: p.id, email: p.email, full_name: p.fullName, phone: p.phone, role: p.role }, { onConflict: 'id' });
  check(error, 'profiles upsert');
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'email' | 'fullName' | 'phone' | 'role'>>,
): Promise<Profile | null> {
  const row: Record<string, unknown> = {};
  if (patch.email !== undefined) row['email'] = patch.email;
  if (patch.fullName !== undefined) row['full_name'] = patch.fullName;
  if (patch.phone !== undefined) row['phone'] = patch.phone;
  if (patch.role !== undefined) row['role'] = patch.role;
  const { data, error } = await getSupabase()
    .from('profiles')
    .update(row)
    .eq('id', id)
    .select(PROFILE_COLS)
    .maybeSingle<ProfileRow>();
  check(error, 'profiles update');
  return data ? toProfile(data) : null;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await getSupabase().from('profiles').delete().eq('id', id);
  check(error, 'profiles delete');
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select(PROFILE_COLS)
    .order('created_at', { ascending: false })
    .returns<ProfileRow[]>();
  check(error, 'profiles list');
  return (data ?? []).map(toProfile);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function findProfileIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id')
    .ilike('email', escapeLike(email))
    .limit(1)
    .maybeSingle<{ id: string }>();
  check(error, 'profiles lookup');
  return data?.id ?? null;
}

// --- site_settings -----------------------------------------------------------------

export async function getSettings(keys: string[]): Promise<Record<string, unknown>> {
  const { data, error } = await getSupabase()
    .from('site_settings')
    .select('key, content')
    .in('key', keys)
    .returns<Array<{ key: string; content: unknown }>>();
  check(error, 'site_settings select');
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.content]));
}

export async function putSettings(entries: Record<string, unknown>): Promise<void> {
  const rows = Object.entries(entries).map(([key, content]) => ({ key, content }));
  if (!rows.length) return;
  const { error } = await getSupabase().from('site_settings').upsert(rows, { onConflict: 'key' });
  check(error, 'site_settings upsert');
}

// --- session_requests ----------------------------------------------------------------

interface RequestRow {
  id: string;
  student_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  contact_method: string | null;
  service_type: string | null;
  subject: string | null;
  urgency_window: string | null;
  is_urgent: boolean;
  hard_topics: string | null;
  preferred_slot: string | null;
  earliest_date: string | null;
  message: string | null;
  consultation: boolean;
  status: RequestStatus;
  created_at: string;
}

const REQUEST_COLS =
  'id, student_id, name, email, phone, contact_method, service_type, subject, urgency_window, is_urgent, hard_topics, preferred_slot, earliest_date, message, consultation, status, created_at';

const toRequest = (r: RequestRow): SessionRequest => ({
  id: r.id,
  studentId: r.student_id,
  name: r.name,
  email: r.email,
  phone: r.phone ?? '',
  contactMethod: r.contact_method ?? '',
  serviceType: r.service_type ?? '',
  subject: r.subject ?? '',
  urgencyWindow: r.urgency_window ?? '',
  isUrgent: r.is_urgent,
  hardTopics: r.hard_topics ?? '',
  preferredSlot: r.preferred_slot ?? '',
  earliestDate: r.earliest_date ?? '',
  message: r.message ?? '',
  consultation: r.consultation,
  status: r.status,
  createdAt: r.created_at,
});

export interface RequestInsert {
  studentId: string | null;
  name: string;
  email: string;
  phone: string;
  contactMethod: string;
  serviceType: string;
  subject: string;
  urgencyWindow: string;
  isUrgent: boolean;
  hardTopics: string;
  preferredSlot: string;
  earliestDate: string | null;
  message: string;
  consultation: boolean;
}

export async function createRequest(r: RequestInsert): Promise<SessionRequest> {
  const { data, error } = await getSupabase()
    .from('session_requests')
    .insert({
      student_id: r.studentId,
      name: r.name,
      email: r.email,
      phone: r.phone,
      contact_method: r.contactMethod,
      service_type: r.serviceType,
      subject: r.subject,
      urgency_window: r.urgencyWindow,
      is_urgent: r.isUrgent,
      hard_topics: r.hardTopics,
      preferred_slot: r.preferredSlot,
      earliest_date: r.earliestDate,
      message: r.message,
      consultation: r.consultation,
    })
    .select(REQUEST_COLS)
    .single<RequestRow>();
  check(error, 'session_requests insert');
  return toRequest(data!);
}

/** Newest first. `studentId` limits to one student's rows. */
export async function listRequests(studentId?: string): Promise<SessionRequest[]> {
  let query = getSupabase().from('session_requests').select(REQUEST_COLS);
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('created_at', { ascending: false }).returns<RequestRow[]>();
  check(error, 'session_requests list');
  return (data ?? []).map(toRequest);
}

export async function getRequest(id: string): Promise<SessionRequest | null> {
  const { data, error } = await getSupabase()
    .from('session_requests')
    .select(REQUEST_COLS)
    .eq('id', id)
    .maybeSingle<RequestRow>();
  check(error, 'session_requests select');
  return data ? toRequest(data) : null;
}

export async function setRequestStatus(id: string, status: RequestStatus): Promise<SessionRequest | null> {
  const { data, error } = await getSupabase()
    .from('session_requests')
    .update({ status })
    .eq('id', id)
    .select(REQUEST_COLS)
    .maybeSingle<RequestRow>();
  check(error, 'session_requests update');
  return data ? toRequest(data) : null;
}

// --- bookings ------------------------------------------------------------------------

interface BookingRow {
  id: string;
  student_id: string | null;
  request_id: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  event_type_name: string | null;
  start_at: string | null;
  end_at: string | null;
  status: BookingStatus;
  cancel_reason: string | null;
}

const BOOKING_COLS =
  'id, student_id, request_id, invitee_name, invitee_email, event_type_name, start_at, end_at, status, cancel_reason';

const toBooking = (r: BookingRow): Booking => ({
  id: r.id,
  studentId: r.student_id,
  requestId: r.request_id,
  inviteeName: r.invitee_name,
  inviteeEmail: r.invitee_email,
  eventTypeName: r.event_type_name,
  startAt: r.start_at,
  endAt: r.end_at,
  status: r.status,
  cancelReason: r.cancel_reason,
});

/** Ordered by start time. */
export async function listBookings(studentId?: string): Promise<Booking[]> {
  let query = getSupabase().from('bookings').select(BOOKING_COLS);
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('start_at', { ascending: true, nullsFirst: false }).returns<BookingRow[]>();
  check(error, 'bookings list');
  return (data ?? []).map(toBooking);
}

export interface BookingUpsert {
  calendlyInviteeUri: string;
  calendlyEventUri: string;
  inviteeEmail: string | null;
  inviteeName: string | null;
  eventTypeName: string | null;
  startAt: string | null;
  endAt: string | null;
  status: BookingStatus;
  cancelReason: string | null;
  studentId: string | null;
  requestId: string | null;
  raw: unknown;
}

/** Keyed on the Calendly invitee URI, so created -> canceled updates one row. */
export async function upsertBooking(b: BookingUpsert): Promise<void> {
  const { error } = await getSupabase()
    .from('bookings')
    .upsert(
      {
        calendly_invitee_uri: b.calendlyInviteeUri,
        calendly_event_uri: b.calendlyEventUri,
        invitee_email: b.inviteeEmail,
        invitee_name: b.inviteeName,
        event_type_name: b.eventTypeName,
        start_at: b.startAt,
        end_at: b.endAt,
        status: b.status,
        cancel_reason: b.cancelReason,
        student_id: b.studentId,
        request_id: b.requestId,
        raw: b.raw,
      },
      { onConflict: 'calendly_invitee_uri' },
    );
  check(error, 'bookings upsert');
}

// --- learner_courses -------------------------------------------------------------------

interface LearnerCourseRow {
  id: string;
  student_id: string;
  course_id: string;
  status: CourseStatus;
  registered_at: string;
}

const LEARNER_COURSE_COLS = 'id, student_id, course_id, status, registered_at';

const toLearnerCourse = (r: LearnerCourseRow): LearnerCourse => ({
  id: r.id,
  studentId: r.student_id,
  courseId: r.course_id,
  status: r.status,
  registeredAt: r.registered_at,
});

export async function listLearnerCourses(studentId?: string): Promise<LearnerCourse[]> {
  let query = getSupabase().from('learner_courses').select(LEARNER_COURSE_COLS);
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('registered_at', { ascending: false }).returns<LearnerCourseRow[]>();
  check(error, 'learner_courses list');
  return (data ?? []).map(toLearnerCourse);
}

/** Throws a 409 HttpError when the student already has this course. */
export async function createLearnerCourse(studentId: string, courseId: string): Promise<LearnerCourse> {
  const { data, error } = await getSupabase()
    .from('learner_courses')
    .insert({ student_id: studentId, course_id: courseId, status: 'registered' })
    .select(LEARNER_COURSE_COLS)
    .single<LearnerCourseRow>();
  if (error?.code === UNIQUE_VIOLATION) throw conflict('Already registered for this course');
  check(error, 'learner_courses insert');
  return toLearnerCourse(data!);
}

export async function getLearnerCourse(id: string): Promise<LearnerCourse | null> {
  const { data, error } = await getSupabase()
    .from('learner_courses')
    .select(LEARNER_COURSE_COLS)
    .eq('id', id)
    .maybeSingle<LearnerCourseRow>();
  check(error, 'learner_courses select');
  return data ? toLearnerCourse(data) : null;
}

export async function deleteLearnerCourse(id: string): Promise<void> {
  const { error } = await getSupabase().from('learner_courses').delete().eq('id', id);
  check(error, 'learner_courses delete');
}

export async function setLearnerCourseStatus(id: string, status: CourseStatus): Promise<LearnerCourse | null> {
  const { data, error } = await getSupabase()
    .from('learner_courses')
    .update({ status })
    .eq('id', id)
    .select(LEARNER_COURSE_COLS)
    .maybeSingle<LearnerCourseRow>();
  check(error, 'learner_courses update');
  return data ? toLearnerCourse(data) : null;
}

// --- assessments -------------------------------------------------------------------------

interface AssessmentRow {
  id: string;
  student_id: string;
  subject: string | null;
  answers: unknown;
  score: number | string | null;
  total: number | string | null;
  recommendation: string | null;
  created_at: string;
}

const ASSESSMENT_COLS = 'id, student_id, subject, answers, score, total, recommendation, created_at';

const num = (v: number | string | null): number | null => (v === null ? null : Number(v));

const toAssessment = (r: AssessmentRow): Assessment => ({
  id: r.id,
  studentId: r.student_id,
  subject: r.subject,
  answers: r.answers,
  score: num(r.score),
  total: num(r.total),
  recommendation: r.recommendation,
  createdAt: r.created_at,
});

export interface AssessmentInsert {
  studentId: string;
  subject: string | null;
  answers: unknown;
  score: number | null;
  total: number | null;
  recommendation: string | null;
}

export async function createAssessment(a: AssessmentInsert): Promise<Assessment> {
  const { data, error } = await getSupabase()
    .from('assessments')
    .insert({
      student_id: a.studentId,
      subject: a.subject,
      answers: a.answers,
      score: a.score,
      total: a.total,
      recommendation: a.recommendation,
    })
    .select(ASSESSMENT_COLS)
    .single<AssessmentRow>();
  check(error, 'assessments insert');
  return toAssessment(data!);
}

export async function listAssessments(studentId?: string): Promise<Assessment[]> {
  let query = getSupabase().from('assessments').select(ASSESSMENT_COLS);
  if (studentId) query = query.eq('student_id', studentId);
  const { data, error } = await query.order('created_at', { ascending: false }).returns<AssessmentRow[]>();
  check(error, 'assessments list');
  return (data ?? []).map(toAssessment);
}

// --- webhook_events (idempotency ledger) ----------------------------------------------------

export type WebhookProvider = 'clerk' | 'calendly';

/**
 * Records an event before processing. Returns false when (provider, eventId)
 * was already recorded, i.e. this delivery is a duplicate.
 */
export async function recordWebhookEvent(
  provider: WebhookProvider,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('webhook_events')
    .upsert(
      { provider, event_id: eventId, event_type: eventType, payload },
      { onConflict: 'provider,event_id', ignoreDuplicates: true },
    )
    .select('id');
  check(error, 'webhook_events insert');
  return (data?.length ?? 0) > 0;
}

/** Un-records a failed event so the provider's retry is processed again. Never throws. */
export async function forgetWebhookEvent(provider: WebhookProvider, eventId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('webhook_events')
    .delete()
    .eq('provider', provider)
    .eq('event_id', eventId);
  if (error) console.error(`webhook_events cleanup failed for ${provider}:${eventId}: ${error.message}`);
}
