begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

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

-- owner, stranger, moderator
insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'owner@test.dev'),
  ('b0000000-0000-0000-0000-000000000002', 'stranger@test.dev'),
  ('b0000000-0000-0000-0000-000000000003', 'mod@test.dev');
insert into private.user_roles (user_id, role) values ('b0000000-0000-0000-0000-000000000003', 'moderator');
insert into storage.objects (bucket_id, name, owner) values
  ('report-photos', 'b0000000-0000-0000-0000-000000000001/one.jpg', 'b0000000-0000-0000-0000-000000000001'),
  ('report-photos', 'b0000000-0000-0000-0000-000000000002/theirs.jpg', 'b0000000-0000-0000-0000-000000000002');

-- ---------------------------------------------------------------- create
select pg_temp.login_anon();
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'Brown dog', now(), -99.13337, 19.43263) $$,
  '42501', null, 'anon cannot post'
);

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;

insert into ids values ('report', public.create_report(
  'c0000000-0000-0000-0000-000000000001', 'lost', 1::smallint, '  Brown dog, red collar  ',
  now() - interval '2 hours', -99.13337, 19.43263, 'Toby', 'brown', 'medium',
  array['b0000000-0000-0000-0000-000000000001/one.jpg']
));
select is(
  public.create_report('c0000000-0000-0000-0000-000000000001', 'lost', 1::smallint, 'Retry', now(), -99.1, 19.4),
  (select id from ids where name = 'report'),
  'a retry with the same client_id returns the first report'
);
select is(
  (select count(*)::int from public.pet_reports where created_by = 'b0000000-0000-0000-0000-000000000001'),
  1, 'and creates nothing new'
);
select is(
  (select description from public.pet_reports where id = (select id from ids where name = 'report')),
  'Brown dog, red collar', 'text is trimmed'
);
select results_eq(
  $$ select storage_path, position::int from public.report_photos where report_id = (select id from ids where name = 'report') $$,
  $$ values ('b0000000-0000-0000-0000-000000000001/one.jpg', 0) $$,
  'photos are attached in order'
);

select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'x', now(), -99.1, 95) $$,
  '22023', 'invalid_input', 'latitude out of range is rejected'
);
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'x', now() + interval '1 day', -99.1, 19.4) $$,
  '22023', 'invalid_input', 'a last-seen time in the future is rejected'
);
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'stolen', 1::smallint, 'x', now(), -99.1, 19.4) $$,
  '23514', null, 'an unknown kind is rejected'
);
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'x', now(), -99.1, 19.4,
       p_photo_paths => array['b0000000-0000-0000-0000-000000000002/theirs.jpg']) $$,
  '22023', 'invalid_input', 'someone else''s upload cannot be attached'
);
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'x', now(), -99.1, 19.4,
       p_photo_paths => array['b0000000-0000-0000-0000-000000000001/never-uploaded.jpg']) $$,
  '22023', 'invalid_input', 'a path that was never uploaded cannot be attached'
);
select throws_ok(
  $$ insert into public.pet_reports (created_by, client_id, kind, species_id, description, last_seen_at, location, expires_at)
     values ('b0000000-0000-0000-0000-000000000001', gen_random_uuid(), 'lost', 1, 'x', now(),
             'SRID=4326;POINT(0 0)', now() + interval '1 day') $$,
  '42501', null, 'reports cannot be inserted directly'
);
select throws_ok(
  $$ update public.pet_reports set status = 'active' $$,
  '42501', null, 'reports cannot be updated directly'
);

-- ---------------------------------------------------------------- rate limit
select lives_ok(
  $$ select public.create_report(gen_random_uuid(), 'found', 2::smallint, 'Cat', now(), -99.2, 19.4)
     from generate_series(1, 4) $$,
  'five reports in an hour are fine'
);
select throws_ok(
  $$ select public.create_report(gen_random_uuid(), 'found', 2::smallint, 'Cat', now(), -99.2, 19.4) $$,
  'P0001', 'rate_limited', 'the sixth is rate limited'
);

-- ---------------------------------------------------------------- location privacy
select pg_temp.login_anon();
select throws_ok(
  $$ select location from public.pet_reports $$,
  '42501', null, 'the exact location column is not readable'
);
select results_eq(
  $$ select public_lng, public_lat from public.pet_reports where id = (select id from ids where name = 'report') $$,
  $$ values (-99.133::double precision, 19.433::double precision) $$,
  'everyone reads the location snapped to ~100 m'
);
select is(
  (select count(*)::int from public.reports_in_bbox(-99.14, 19.42, -99.12, 19.44) where id = (select id from ids where name = 'report')),
  1, 'the map query finds the report'
);
select is(
  (select count(*)::int from public.reports_in_bbox(-99.1334, 19.4326, -99.1333, 19.4327) where id = (select id from ids where name = 'report')),
  0, 'a tiny box around the exact point finds nothing, so it cannot be searched for'
);
select is(
  (select kind from public.reports_near(-99.133, 19.433, 1000) where id = (select id from ids where name = 'report')),
  'lost', 'the nearby query finds it too'
);
select is(
  (select count(*)::int from public.reports_in_bbox(-99.14, 19.42, -99.12, 19.44, kinds => array['found']) where id = (select id from ids where name = 'report')),
  0, 'kind filters apply'
);

-- ---------------------------------------------------------------- status changes
select pg_temp.login_as('b0000000-0000-0000-0000-000000000002');
select throws_ok(
  format('select public.mark_reunited(%L)', (select id from ids where name = 'report')),
  '42501', 'not_allowed', 'only the owner can mark a report reunited'
);

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select lives_ok(
  format('select public.mark_reunited(%L)', (select id from ids where name = 'report')),
  'the owner marks it reunited'
);
select pg_temp.login_anon();
select is(
  (select status from public.pet_reports where id = (select id from ids where name = 'report')),
  'reunited', 'a reunited report stays public'
);
select is(
  (select count(*)::int from public.reports_in_bbox(-99.14, 19.42, -99.12, 19.44) where id = (select id from ids where name = 'report')),
  0, 'but leaves the map'
);
select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select throws_ok(
  format('select public.renew_report(%L)', (select id from ids where name = 'report')),
  '42501', 'not_allowed', 'a reunited report cannot be renewed'
);

-- ---------------------------------------------------------------- expiry
select pg_temp.login_as('b0000000-0000-0000-0000-000000000002');
insert into ids values ('old', public.create_report(gen_random_uuid(), 'lost', 2::smallint, 'Grey cat', now(), -99.13, 19.43));

select pg_temp.logout();
update public.pet_reports set expires_at = now() - interval '1 minute' where id = (select id from ids where name = 'old');
select is(private.expire_reports() >= 1, true, 'the expiry job closes overdue reports');

select pg_temp.login_anon();
select is(
  (select count(*)::int from public.pet_reports where id = (select id from ids where name = 'old')),
  0, 'an expired report is no longer public'
);
select pg_temp.login_as('b0000000-0000-0000-0000-000000000002');
select is(
  (select status from public.pet_reports where id = (select id from ids where name = 'old')),
  'expired', 'its owner still sees it'
);
select ok(
  public.renew_report((select id from ids where name = 'old')) > now() + interval '29 days',
  'and can renew it for another 30 days'
);
select is(
  (select status from public.pet_reports where id = (select id from ids where name = 'old')),
  'active', 'which makes it active again'
);

-- ---------------------------------------------------------------- hidden
select pg_temp.logout();
update public.pet_reports set status = 'hidden' where id = (select id from ids where name = 'old');

select pg_temp.login_as('b0000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.pet_reports where id = (select id from ids where name = 'old')),
  0, 'a hidden report is invisible to other users'
);
select pg_temp.login_as('b0000000-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.pet_reports where id = (select id from ids where name = 'old')),
  1, 'but visible to moderators'
);
select pg_temp.login_as('b0000000-0000-0000-0000-000000000002');
select throws_ok(
  format('select public.renew_report(%L)', (select id from ids where name = 'old')),
  '42501', 'not_allowed', 'and its owner cannot renew it back into view'
);

select pg_temp.logout();
select * from finish();
rollback;
