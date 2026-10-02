begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

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

-- uploader, someone else
insert into auth.users (id, email) values
  ('20000000-0000-0000-0000-000000000001', 'uploader@test.dev'),
  ('20000000-0000-0000-0000-000000000002', 'other@test.dev');

select is(
  (select public from storage.buckets where id = 'report-photos'),
  false, 'the photo bucket is private'
);

select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('report-photos', '20000000-0000-0000-0000-000000000001/a.jpg', '20000000-0000-0000-0000-000000000001') $$,
  'users upload into their own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner)
     values ('report-photos', '20000000-0000-0000-0000-000000000002/a.jpg', '20000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'but not into anyone else''s'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos'),
  1, 'uploaders see their own unattached upload'
);

select pg_temp.login_as('20000000-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos'),
  0, 'nobody else does until it is attached'
);

select pg_temp.login_as('20000000-0000-0000-0000-000000000001');
select public.create_report(
  gen_random_uuid(), 'lost', 1::smallint, 'Small white dog', now(), -99.19, 19.38,
  p_photo_paths => array['20000000-0000-0000-0000-000000000001/a.jpg']
);
select pg_temp.login_anon();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos'),
  1, 'once attached to a public report, anyone can read it'
);

select pg_temp.logout();
update public.pet_reports set status = 'hidden';
select pg_temp.login_anon();
select is(
  (select count(*)::int from storage.objects where bucket_id = 'report-photos'),
  0, 'and it goes private again when the report is hidden'
);

select pg_temp.logout();
select * from finish();
rollback;
