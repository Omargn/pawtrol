begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.login_anon() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"anon"}', true);
  select set_config('role', 'anon', true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'none', true);
$$;

-- owner, witness
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'owner@test.dev'),
  ('d0000000-0000-0000-0000-000000000002', 'witness@test.dev');
insert into storage.objects (bucket_id, name, owner) values
  ('report-photos', 'd0000000-0000-0000-0000-000000000001/dog.jpg', 'd0000000-0000-0000-0000-000000000001'),
  ('report-photos', 'd0000000-0000-0000-0000-000000000002/seen.jpg', 'd0000000-0000-0000-0000-000000000002');

create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;

select pg_temp.login_as('d0000000-0000-0000-0000-000000000001');
insert into ids values ('report', public.create_report(
  gen_random_uuid(), 'lost', 1::smallint, 'Black lab', now() - interval '1 day', -99.16, 19.41,
  p_photo_paths => array['d0000000-0000-0000-0000-000000000001/dog.jpg']
));

select pg_temp.login_anon();
select throws_ok(
  format('select public.add_sighting(gen_random_uuid(), %L, now(), -99.15, 19.42)', (select id from ids where name = 'report')),
  '42501', null, 'anon cannot add sightings'
);

select pg_temp.login_as('d0000000-0000-0000-0000-000000000002');
insert into ids values ('sighting', public.add_sighting(
  'e0000000-0000-0000-0000-000000000001', (select id from ids where name = 'report'),
  now() - interval '3 hours', -99.15123, 19.42456, ' Near the park ',
  'd0000000-0000-0000-0000-000000000002/seen.jpg'
));
select is(
  public.add_sighting('e0000000-0000-0000-0000-000000000001', (select id from ids where name = 'report'), now(), 0, 0),
  (select id from ids where name = 'sighting'),
  'a retried sighting returns the first one'
);
select is(
  (select sighting_count from public.pet_reports where id = (select id from ids where name = 'report')),
  1, 'the report counts its sightings'
);
select throws_ok(
  format('select public.add_sighting(gen_random_uuid(), %L, now(), -99.15, 19.42, null, %L)',
         (select id from ids where name = 'report'), 'd0000000-0000-0000-0000-000000000001/dog.jpg'),
  '22023', 'invalid_input', 'a photo already attached elsewhere cannot be reused'
);
select throws_ok(
  format('select public.add_sighting(gen_random_uuid(), %L, now(), -99.15, 19.42)', gen_random_uuid()),
  'P0002', 'not_found', 'a sighting needs an existing report'
);
select throws_ok(
  $$ insert into public.sightings (report_id, created_by, client_id, seen_at, location)
     select id, 'd0000000-0000-0000-0000-000000000002', gen_random_uuid(), now(), 'SRID=4326;POINT(0 0)' from ids where name = 'report' $$,
  '42501', null, 'sightings cannot be inserted directly'
);

select pg_temp.login_anon();
select results_eq(
  $$ select note, public_lng, public_lat from public.sightings where id = (select id from ids where name = 'sighting') $$,
  $$ values ('Near the park', -99.151::double precision, 19.425::double precision) $$,
  'anyone reads a sighting, with its location snapped'
);
select throws_ok(
  $$ select location from public.sightings $$,
  '42501', null, 'the exact sighting location is not readable'
);

-- A hidden sighting leaves the public timeline and the count.
select pg_temp.logout();
update public.sightings set status = 'hidden' where id = (select id from ids where name = 'sighting');
select is(
  (select sighting_count from public.pet_reports where id = (select id from ids where name = 'report')),
  0, 'the count only includes visible sightings'
);
select pg_temp.login_anon();
select is((select count(*)::int from public.sightings), 0, 'a hidden sighting is not public');
select pg_temp.login_as('d0000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.sightings), 1, 'its author still sees it');

-- Sightings follow their report out of view.
select pg_temp.logout();
update public.sightings set status = 'visible' where id = (select id from ids where name = 'sighting');
update public.pet_reports set status = 'hidden' where id = (select id from ids where name = 'report');
select pg_temp.login_anon();
select is((select count(*)::int from public.sightings), 0, 'sightings of a hidden report are not public');
select pg_temp.login_as('d0000000-0000-0000-0000-000000000002');
select throws_ok(
  format('select public.add_sighting(gen_random_uuid(), %L, now(), -99.15, 19.42)', (select id from ids where name = 'report')),
  'P0002', 'not_found', 'and a hidden report takes no new ones'
);

select pg_temp.logout();
select * from finish();
rollback;
