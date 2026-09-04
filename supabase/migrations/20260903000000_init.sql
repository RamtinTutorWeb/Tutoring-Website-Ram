-- =============================================================================
-- TutorPro: initial Supabase Postgres schema
-- =============================================================================
--
-- PREREQUISITE: Clerk as a third-party auth provider
-- ----------------------------------------------------
-- This schema does NOT use Supabase Auth users. Identity comes from Clerk.
-- Supabase must be told to trust Clerk-issued JWTs:
--
--   1. In the Clerk dashboard open "Integrations" (or "Configure > Supabase")
--      and enable the Supabase integration. Copy the Clerk domain shown there
--      (e.g. `your-app.clerk.accounts.dev` or `clerk.yourdomain.com`).
--   2. In the Supabase dashboard go to
--        Authentication > Sign In / Providers > Third-party auth > Add provider > Clerk
--      and paste that domain. For local dev add the same thing to
--      `supabase/config.toml` under `[auth.third_party.clerk]`.
--   3. The frontend passes Clerk's session token to supabase-js via the
--      `accessToken` client option. Supabase validates the JWT against Clerk's
--      JWKS and exposes the claims to Postgres:
--        auth.jwt()->>'sub'   = Clerk user id (e.g. `user_2abc...`)
--        auth.jwt()->>'role'  = 'authenticated'  (added by Clerk's integration)
--
-- All row-level security below is keyed on that `sub` claim through
-- `public.clerk_user_id()`. Rows are written by the browser (subject to RLS)
-- or by serverless webhook handlers using the service-role key (bypasses RLS).
--
-- The file is written to be re-runnable: `if not exists`, `create or replace`,
-- `drop policy if exists`, and `on conflict do nothing`.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- Clerk user id of the caller, or null for anon / service-role requests.
create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '');
$$;

-- Generic updated_at maintenance trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- One row per Clerk user. Created by the Clerk `user.created` webhook
-- (service role) or lazily by the client on first sign-in.
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id          text primary key,                     -- Clerk user id
  email       text not null,
  full_name   text,
  phone       text,
  role        text not null default 'student'
              check (role in ('student', 'admin')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- True when the caller has a profile row with role = 'admin'.
-- Defined after profiles because SQL function bodies are validated on create.
-- security definer so the lookup is not itself blocked by RLS on profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = public.clerk_user_id()
      and p.role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- site_settings
-- Key/value JSON blobs edited from the admin settings page.
-- Keys: 'content' (courses, exam prep tracks, reviews, faq),
--       'selectable_options' (dropdown choices),
--       'session_settings' (durations, session types).
-- -----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  content     jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

insert into public.site_settings (key, content)
values
  ('content', '{}'::jsonb),
  ('selectable_options', '{}'::jsonb),
  ('session_settings', '{}'::jsonb)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- session_requests
-- A student asking for tutoring. Admin accepts/declines; a Calendly booking
-- may later reference it.
-- -----------------------------------------------------------------------------
create table if not exists public.session_requests (
  id              uuid primary key default gen_random_uuid(),
  student_id      text not null references public.profiles (id) on delete cascade,
  subject         text,
  service_type    text,
  urgency_window  text,
  is_urgent       boolean not null default false,
  hard_topics     text[] not null default '{}',
  preferred_slot  text,
  earliest_date   date,
  message         text,
  status          text not null default 'open'
                  check (status in ('open', 'accepted', 'declined', 'scheduled')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- bookings
-- Mirror of Calendly scheduled events, written by the Calendly webhook
-- handler with the service role. student_id is resolved from invitee_email
-- when a matching profile exists.
-- -----------------------------------------------------------------------------
create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  student_id            text references public.profiles (id) on delete set null,
  request_id            uuid references public.session_requests (id) on delete set null,
  calendly_event_uri    text not null unique,
  calendly_invitee_uri  text unique,
  invitee_email         text,
  invitee_name          text,
  event_type_name       text,
  start_at              timestamptz,
  end_at                timestamptz,
  status                text not null default 'scheduled'
                        check (status in ('scheduled', 'canceled')),
  cancel_reason         text,
  raw                   jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- assessments
-- Placement questionnaire + test submissions.
-- -----------------------------------------------------------------------------
create table if not exists public.assessments (
  id          uuid primary key default gen_random_uuid(),
  student_id  text not null references public.profiles (id) on delete cascade,
  subject     text,
  answers     jsonb not null default '{}'::jsonb,
  score       numeric,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- learner_courses
-- Courses an admin has assigned to a student, with progress status.
-- course_id refers to a course id inside site_settings.content.
-- -----------------------------------------------------------------------------
create table if not exists public.learner_courses (
  id             uuid primary key default gen_random_uuid(),
  student_id     text not null references public.profiles (id) on delete cascade,
  course_id      text not null,
  status         text not null default 'registered'
                 check (status in ('registered', 'in-progress', 'passed')),
  registered_at  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (student_id, course_id)
);

-- -----------------------------------------------------------------------------
-- webhook_events
-- Idempotency ledger for Clerk and Calendly webhooks. Service role only.
-- -----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id           uuid primary key default gen_random_uuid(),
  provider     text not null check (provider in ('clerk', 'calendly')),
  event_id     text not null,
  event_type   text not null,
  payload      jsonb,
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);

-- -----------------------------------------------------------------------------
-- updated_at triggers
-- -----------------------------------------------------------------------------
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

drop trigger if exists session_requests_set_updated_at on public.session_requests;
create trigger session_requests_set_updated_at
  before update on public.session_requests
  for each row execute function public.set_updated_at();

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

drop trigger if exists learner_courses_set_updated_at on public.learner_courses;
create trigger learner_courses_set_updated_at
  before update on public.learner_courses
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists session_requests_student_id_idx
  on public.session_requests (student_id);
create index if not exists session_requests_status_idx
  on public.session_requests (status);

create index if not exists bookings_student_id_idx
  on public.bookings (student_id);
create index if not exists bookings_request_id_idx
  on public.bookings (request_id);
create index if not exists bookings_start_at_idx
  on public.bookings (start_at);

create index if not exists assessments_student_id_idx
  on public.assessments (student_id);

create index if not exists learner_courses_student_id_idx
  on public.learner_courses (student_id);

create index if not exists webhook_events_provider_received_idx
  on public.webhook_events (provider, received_at desc);

-- -----------------------------------------------------------------------------
-- Row level security
-- -----------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.site_settings    enable row level security;
alter table public.session_requests enable row level security;
alter table public.bookings         enable row level security;
alter table public.assessments      enable row level security;
alter table public.learner_courses  enable row level security;
alter table public.webhook_events   enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  to authenticated
  using (id = public.clerk_user_id());

-- A user may create their own row but cannot self-assign admin.
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own"
  on public.profiles for insert
  to authenticated
  with check (id = public.clerk_user_id() and role = 'student');

-- A user may edit their own row but cannot change their role.
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = public.clerk_user_id())
  with check (
    id = public.clerk_user_id()
    and role = (select p.role from public.profiles p where p.id = public.clerk_user_id())
  );

drop policy if exists "profiles: admin all" on public.profiles;
create policy "profiles: admin all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- site_settings ---------------------------------------------------------------
drop policy if exists "site_settings: public read" on public.site_settings;
create policy "site_settings: public read"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "site_settings: admin insert" on public.site_settings;
create policy "site_settings: admin insert"
  on public.site_settings for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "site_settings: admin update" on public.site_settings;
create policy "site_settings: admin update"
  on public.site_settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- session_requests ------------------------------------------------------------
drop policy if exists "session_requests: student insert own" on public.session_requests;
create policy "session_requests: student insert own"
  on public.session_requests for insert
  to authenticated
  with check (student_id = public.clerk_user_id());

drop policy if exists "session_requests: student select own" on public.session_requests;
create policy "session_requests: student select own"
  on public.session_requests for select
  to authenticated
  using (student_id = public.clerk_user_id());

drop policy if exists "session_requests: admin all" on public.session_requests;
create policy "session_requests: admin all"
  on public.session_requests for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- bookings (writes come from the service role via webhooks) -----------------
drop policy if exists "bookings: student select own" on public.bookings;
create policy "bookings: student select own"
  on public.bookings for select
  to authenticated
  using (student_id = public.clerk_user_id());

drop policy if exists "bookings: admin all" on public.bookings;
create policy "bookings: admin all"
  on public.bookings for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- assessments -----------------------------------------------------------------
drop policy if exists "assessments: student insert own" on public.assessments;
create policy "assessments: student insert own"
  on public.assessments for insert
  to authenticated
  with check (student_id = public.clerk_user_id());

drop policy if exists "assessments: student select own" on public.assessments;
create policy "assessments: student select own"
  on public.assessments for select
  to authenticated
  using (student_id = public.clerk_user_id());

drop policy if exists "assessments: admin all" on public.assessments;
create policy "assessments: admin all"
  on public.assessments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- learner_courses -------------------------------------------------------------
drop policy if exists "learner_courses: student select own" on public.learner_courses;
create policy "learner_courses: student select own"
  on public.learner_courses for select
  to authenticated
  using (student_id = public.clerk_user_id());

drop policy if exists "learner_courses: admin all" on public.learner_courses;
create policy "learner_courses: admin all"
  on public.learner_courses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- webhook_events: intentionally no policies. RLS is enabled, so anon and
-- authenticated get nothing; only the service role (which bypasses RLS) can
-- read or write.

-- -----------------------------------------------------------------------------
-- Grants (Supabase convention: RLS decides rows, grants decide verbs)
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

grant execute on function public.clerk_user_id() to anon, authenticated;
grant execute on function public.is_admin()      to anon, authenticated;

grant select on public.site_settings to anon;
grant select, insert, update on public.site_settings to authenticated;

grant select, insert, update, delete on public.profiles         to authenticated;
grant select, insert, update, delete on public.session_requests to authenticated;
grant select, insert, update, delete on public.bookings         to authenticated;
grant select, insert, update, delete on public.assessments      to authenticated;
grant select, insert, update, delete on public.learner_courses  to authenticated;

-- webhook_events: no grants to anon/authenticated. service_role already has
-- full privileges on public via Supabase defaults.
revoke all on public.webhook_events from anon, authenticated;
