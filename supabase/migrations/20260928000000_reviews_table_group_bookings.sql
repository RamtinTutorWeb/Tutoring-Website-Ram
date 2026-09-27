-- =============================================================================
-- TutorPro: reviews table + group-event bookings
-- =============================================================================
--
--   1. Reviews move out of site_settings.content (a JSON array rewritten on
--      every edit) into their own table. Existing items keep their ids.
--   2. bookings.calendly_event_uri is no longer unique: a Calendly group event
--      has one event URI and many invitees. Upserts key on calendly_invitee_uri.
--
-- Same access model as 20260927000000_backend_only.sql: RLS on, no policies,
-- no anon/authenticated privileges; only the backend's service role reads/writes.
-- Safe to re-run.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. reviews
-- -----------------------------------------------------------------------------
create table if not exists public.reviews (
  id          text primary key default gen_random_uuid()::text,
  student_id  text references public.profiles (id) on delete set null,
  name        text not null,
  rating      int  not null check (rating between 1 and 5),
  text        text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists reviews_status_created_at_idx on public.reviews (status, created_at);
create index if not exists reviews_student_id_status_idx on public.reviews (student_id, status);

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;
grant all on public.reviews to service_role;

-- Move site_settings.content.reviews into the table, keeping ids and order.
-- Items without a status were public before, so they count as approved.
insert into public.reviews (id, name, rating, text, status, created_at)
select
  coalesce(nullif(item->>'id', ''), gen_random_uuid()::text),
  coalesce(nullif(trim(item->>'name'), ''), 'Anonymous'),
  greatest(1, least(5, round(coalesce(
    case when item->>'rating' ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$' then (item->>'rating')::numeric end,
    5
  ))))::int,
  coalesce(item->>'text', ''),
  case when item->>'status' = 'pending' then 'pending' else 'approved' end,
  now() + (ord * interval '1 millisecond')
from public.site_settings s,
     jsonb_array_elements(
       case when jsonb_typeof(s.content->'reviews') = 'array' then s.content->'reviews' else '[]'::jsonb end
     ) with ordinality as t(item, ord)
where s.key = 'content'
  and jsonb_typeof(item) = 'object'
on conflict (id) do nothing;

update public.site_settings
set content = content - 'reviews'
where key = 'content' and content ? 'reviews';

-- -----------------------------------------------------------------------------
-- 2. bookings: one event URI, many invitees
-- -----------------------------------------------------------------------------
alter table public.bookings drop constraint if exists bookings_calendly_event_uri_key;
create index if not exists bookings_calendly_event_uri_idx on public.bookings (calendly_event_uri);

-- Webhook upserts conflict on the invitee URI, which needs a real unique
-- constraint (init created it; make sure it's there).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bookings'::regclass and conname = 'bookings_calendly_invitee_uri_key'
  ) then
    alter table public.bookings add constraint bookings_calendly_invitee_uri_key unique (calendly_invitee_uri);
  end if;
end $$;
