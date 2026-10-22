-- =============================================================================
-- TutorPro: public bucket for site images (tutor photo, etc.)
-- =============================================================================
-- Public read (images are shown on public pages), 5 MB, images only. Only the
-- backend's service role writes, through POST /media (admin). Safe to re-run.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
