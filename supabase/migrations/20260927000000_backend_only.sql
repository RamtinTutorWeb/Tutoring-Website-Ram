-- =============================================================================
-- TutorPro: backend-only data access
-- =============================================================================
--
-- The browser no longer talks to Supabase. The Railway backend is the only
-- client and uses the service-role key (which bypasses RLS). This migration:
--
--   1. Reshapes session_requests for the public contact form (guests allowed).
--   2. Adds total + recommendation to assessments.
--   3. Removes every client-facing RLS policy and table privilege for
--      anon/authenticated. RLS stays enabled as defense in depth, so a leaked
--      anon key reads and writes nothing.
--   4. Seeds default selectable options when they are empty.
--
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. session_requests
-- -----------------------------------------------------------------------------

-- Guests can submit requests; student_id is only set for signed-in students.
alter table public.session_requests alter column student_id drop not null;

alter table public.session_requests
  add column if not exists name           text    not null default '',
  add column if not exists email          text    not null default '',
  add column if not exists phone          text,
  add column if not exists contact_method text,
  add column if not exists consultation   boolean not null default false;

-- Existing rows came from signed-in students: backfill contact details.
update public.session_requests r
set name  = coalesce(nullif(r.name, ''), p.full_name, ''),
    email = coalesce(nullif(r.email, ''), p.email, ''),
    phone = coalesce(r.phone, p.phone)
from public.profiles p
where p.id = r.student_id
  and (r.name = '' or r.email = '' or r.phone is null);

-- hard_topics is a free-text field in the form, so store it as text.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'session_requests'
      and column_name = 'hard_topics' and data_type = 'ARRAY'
  ) then
    alter table public.session_requests alter column hard_topics drop default;
    alter table public.session_requests
      alter column hard_topics type text using array_to_string(hard_topics, ', ');
  end if;
end $$;
alter table public.session_requests alter column hard_topics set default '';
alter table public.session_requests alter column hard_topics set not null;

-- Status lifecycle: new -> accepted | declined -> scheduled -> closed.
alter table public.session_requests drop constraint if exists session_requests_status_check;
update public.session_requests set status = 'new' where status = 'open';
alter table public.session_requests alter column status set default 'new';
alter table public.session_requests
  add constraint session_requests_status_check
  check (status in ('new', 'accepted', 'declined', 'scheduled', 'closed'));

create index if not exists session_requests_created_at_idx
  on public.session_requests (created_at desc);

-- -----------------------------------------------------------------------------
-- 2. assessments
-- -----------------------------------------------------------------------------
alter table public.assessments
  add column if not exists total          numeric,
  add column if not exists recommendation text;

create index if not exists assessments_created_at_idx
  on public.assessments (created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Lock out anon/authenticated
-- -----------------------------------------------------------------------------

-- Drop every policy on our tables (names from the init migration, and any
-- added by hand since). Service role bypasses RLS and needs none.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'site_settings', 'session_requests', 'bookings',
                        'assessments', 'learner_courses', 'webhook_events')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

alter table public.profiles         enable row level security;
alter table public.site_settings    enable row level security;
alter table public.session_requests enable row level security;
alter table public.bookings         enable row level security;
alter table public.assessments      enable row level security;
alter table public.learner_courses  enable row level security;
alter table public.webhook_events   enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- The RLS helpers only existed for the dropped policies.
drop function if exists public.is_admin();
drop function if exists public.clerk_user_id();

-- Tables created by future migrations stay private too.
alter default privileges for role postgres in schema public revoke all on tables    from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on functions from anon, authenticated;

-- Explicit so the backend keeps working regardless of project defaults.
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- -----------------------------------------------------------------------------
-- 4. Default selectable options
-- -----------------------------------------------------------------------------
insert into public.site_settings (key, content)
values
  ('content', '{"courses": [], "examPrepTracks": [], "reviews": [], "faq": []}'::jsonb),
  ('selectable_options', '{}'::jsonb)
on conflict (key) do nothing;

update public.site_settings
set content = $json$
{
  "contactMethods": ["Email", "Phone", "WhatsApp"],
  "serviceTypes": ["High School", "University", "Exam Prep"],
  "urgencyWindows": ["Within 2 weeks", "Within 1 month", "Within 3 months"],
  "urgencyFlags": ["No", "Yes"],
  "assessmentSubjects": ["Math", "Physics", "Both"],
  "courseCategories": ["University Courses", "High School Courses", "Exam Prep"]
}
$json$::jsonb
where key = 'selectable_options' and content = '{}'::jsonb;

update public.site_settings
set content = '{"courses": [], "examPrepTracks": [], "reviews": [], "faq": []}'::jsonb
where key = 'content' and content = '{}'::jsonb;
