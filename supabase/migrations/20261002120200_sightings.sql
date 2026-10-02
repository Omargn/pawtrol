-- Sightings: "I saw this pet here, at this time" on someone's report.
--
-- Same location rule as reports: the exact point is never granted; everyone,
-- the report's owner included, reads the ~100 m snapped point. A sighting's
-- author may well be standing at their own door.

create table public.sightings (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.pet_reports (id) on delete cascade,
  created_by      uuid not null references public.profiles (id) on delete cascade,
  client_id       uuid not null,
  status          text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  seen_at         timestamptz not null,
  note            text check (length(trim(note)) between 1 and 500),
  photo_path      text unique check (length(photo_path) <= 200),
  location        extensions.geography(point, 4326) not null,
  public_lng      double precision generated always as
                    (extensions.st_x(extensions.st_snaptogrid(location::extensions.geometry, 0.001))) stored,
  public_lat      double precision generated always as
                    (extensions.st_y(extensions.st_snaptogrid(location::extensions.geometry, 0.001))) stored,
  created_at      timestamptz not null default now(),
  unique (created_by, client_id)
);

-- A report's timeline, newest first.
create index sightings_report_id_idx on public.sightings (report_id, seen_at desc);
create index sightings_created_by_idx on public.sightings (created_by, created_at desc);

alter table public.sightings enable row level security;
revoke all on public.sightings from anon, authenticated;
grant select (
  id, report_id, created_by, status, seen_at, note, photo_path, public_lng, public_lat, created_at
) on public.sightings to anon, authenticated;

-- The subquery runs under pet_reports' RLS, so a sighting is only public
-- while its report is.
create policy "visible sightings of visible reports are public"
  on public.sightings for select
  to anon, authenticated
  using (
    status = 'visible'
    and exists (select 1 from public.pet_reports r where r.id = report_id)
  );

create policy "authors see their own sightings"
  on public.sightings for select
  to authenticated
  using (created_by = (select auth.uid()));

create policy "moderators see every sighting"
  on public.sightings for select
  to authenticated
  using ((select public.has_role('moderator')));

-- ============================================================
-- pet_reports.sighting_count = visible sightings. Recounted rather than
-- incremented: a report has tens of sightings at most, and a recount can't
-- drift when a moderator hides or restores one. Definer because pet_reports
-- has no update policy for anyone.
-- ============================================================
create function private.sync_sighting_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.report_id, old.report_id);
begin
  update public.pet_reports r
  set sighting_count = (
    select count(*) from public.sightings s where s.report_id = target and s.status = 'visible'
  )
  where r.id = target;
  return null;
end;
$$;

revoke execute on function private.sync_sighting_count() from public, anon, authenticated;

create trigger sightings_sync_count
  after insert or delete or update of status on public.sightings
  for each row execute function private.sync_sighting_count();

-- A photo can be attached once, to a report or to a sighting.
create or replace function private.assert_own_photo(uid uuid, path text)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if path is null
     or split_part(path, '/', 1) <> uid::text
     or not exists (
       select 1 from storage.objects o
       where o.bucket_id = 'report-photos' and o.name = path
     )
     or exists (select 1 from public.report_photos p where p.storage_path = path)
     or exists (select 1 from public.sightings s where s.photo_path = path)
  then
    raise exception 'invalid_input' using errcode = '22023', detail = 'photo';
  end if;
end;
$$;

-- ============================================================
-- add_sighting
--
-- Only on an active report. Idempotent on (caller, client_id); at most 20 new
-- sightings per user per hour.
-- ============================================================
create function public.add_sighting(
  p_client_id  uuid,
  p_report_id  uuid,
  p_seen_at    timestamptz,
  p_lng        double precision,
  p_lat        double precision,
  p_note       text default null,
  p_photo_path text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid         uuid := private.require_user();
  sighting_id uuid;
begin
  perform private.lock_user(uid);

  select s.id into sighting_id
  from public.sightings s
  where s.created_by = uid and s.client_id = p_client_id;
  if found then
    return sighting_id;
  end if;

  if not exists (select 1 from public.pet_reports r where r.id = p_report_id and r.status = 'active') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.sightings s
      where s.created_by = uid and s.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  perform private.assert_point(p_lng, p_lat);
  if p_client_id is null
     or p_seen_at is null
     or p_seen_at > now() + interval '5 minutes'
     or p_seen_at < now() - interval '90 days'
  then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  if p_photo_path is not null then
    perform private.assert_own_photo(uid, p_photo_path);
  end if;

  insert into public.sightings (report_id, created_by, client_id, seen_at, note, photo_path, location)
  values (
    p_report_id, uid, p_client_id, p_seen_at, nullif(trim(p_note), ''), p_photo_path,
    extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography
  )
  returning id into sighting_id;

  return sighting_id;
end;
$$;

revoke execute on function public.add_sighting(uuid, uuid, timestamptz, double precision, double precision, text, text) from public, anon;
grant execute on function public.add_sighting(uuid, uuid, timestamptz, double precision, double precision, text, text) to authenticated;
