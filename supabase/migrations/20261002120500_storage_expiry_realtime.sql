-- Photo storage, report expiry, and realtime.

-- ============================================================
-- Storage: one private bucket. Files go under `{user_id}/{uuid}.jpg`; the app
-- re-encodes every photo to JPEG on the device first, which is also what
-- strips EXIF (GPS included). Reads use signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "users upload into their own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'report-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Readable by the uploader, or by anyone who can see the report or sighting
-- it's attached to (those subqueries run under their tables' RLS). An upload
-- that was never attached stays private to its uploader.
create policy "photos follow their report's visibility"
  on storage.objects for select
  to anon, authenticated
  using (
    bucket_id = 'report-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.report_photos p where p.storage_path = objects.name)
      or exists (select 1 from public.sightings s where s.photo_path = objects.name)
    )
  );

-- No update or delete policies: an attached photo can't be swapped or pulled
-- out from under a report. Orphaned uploads are a cleanup job's problem.

-- ============================================================
-- Expiry: an active report closes after 30 days unless its owner renews it.
-- Hourly is plenty; the map query also filters on expires_at, so a report
-- disappears from it on time even between runs.
-- ============================================================
create extension if not exists pg_cron with schema pg_catalog;

create function private.expire_reports()
returns integer
language sql
set search_path = ''
as $$
  with expired as (
    update public.pet_reports
    set status = 'expired'
    where status = 'active' and expires_at <= now()
    returning 1
  )
  select count(*)::integer from expired;
$$;

revoke execute on function private.expire_reports() from public, anon, authenticated;

select cron.schedule('expire-pet-reports', '7 * * * *', 'select private.expire_reports()');

-- ============================================================
-- Realtime: messages only, so a conversation updates live. Subscribers get
-- the rows RLS lets them read: their own conversations.
--
-- pet_reports is deliberately NOT published: changes are streamed from the
-- WAL with the whole row, exact `location` included, and the app must never
-- receive that column. The map refreshes on pan and focus instead; a
-- broadcast of ids only can be added later if live updates are worth it.
-- ============================================================
alter publication supabase_realtime add table public.messages;
