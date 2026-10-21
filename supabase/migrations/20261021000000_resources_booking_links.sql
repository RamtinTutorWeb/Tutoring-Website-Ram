-- =============================================================================
-- TutorPro: resource library + Calendly manage links on bookings
-- =============================================================================
--
--   1. resources: files (Supabase Storage, private bucket `resources`) and
--      links/videos the tutor shares. Visibility:
--        public   -> anyone, listed on /resources (marketing samples)
--        students -> any signed-in student
--        private  -> only the students in student_ids
--   2. bookings.cancel_url / reschedule_url from the Calendly invitee payload,
--      so students can manage a session from their dashboard.
--
-- Same access model as 20260927000000_backend_only.sql: RLS on, no policies,
-- no anon/authenticated privileges; only the backend's service role reads/writes.
-- Files are served through short-lived signed URLs the backend issues.
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. resources
-- -----------------------------------------------------------------------------
create table if not exists public.resources (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text not null default '',
  kind          text not null check (kind in ('file', 'link', 'video')),
  url           text,
  storage_path  text unique,
  file_name     text,
  mime_type     text,
  size_bytes    bigint,
  subject       text not null default '',
  course_id     text,
  visibility    text not null default 'students' check (visibility in ('public', 'students', 'private')),
  student_ids   text[] not null default '{}',
  featured      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint resources_kind_target check (
    (kind = 'file' and storage_path is not null) or (kind <> 'file' and url is not null)
  )
);

create index if not exists resources_visibility_created_at_idx on public.resources (visibility, created_at desc);
create index if not exists resources_student_ids_idx on public.resources using gin (student_ids);

drop trigger if exists resources_set_updated_at on public.resources;
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

alter table public.resources enable row level security;
revoke all on public.resources from anon, authenticated;
grant all on public.resources to service_role;

-- Private bucket: no public URLs, 50 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('resources', 'resources', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- -----------------------------------------------------------------------------
-- 2. bookings: Calendly manage links
-- -----------------------------------------------------------------------------
alter table public.bookings add column if not exists cancel_url text;
alter table public.bookings add column if not exists reschedule_url text;

-- Backfill from the stored webhook payloads.
update public.bookings
set cancel_url = raw->'payload'->>'cancel_url',
    reschedule_url = raw->'payload'->>'reschedule_url'
where cancel_url is null and raw ? 'payload';
