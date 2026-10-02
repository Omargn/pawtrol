begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

-- Session helpers: act as a signed-in user, as anon, or back as postgres.
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

insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@test.dev', '{"full_name":"Ana"}'),
  ('a0000000-0000-0000-0000-000000000002', 'ben@test.dev', '{}'),
  ('a0000000-0000-0000-0000-000000000003', 'mod@test.dev', '{"full_name":"Mod"}'),
  ('a0000000-0000-0000-0000-000000000004', 'root@test.dev', '{"full_name":"Root"}');
insert into private.user_roles (user_id, role) values
  ('a0000000-0000-0000-0000-000000000003', 'moderator'),
  ('a0000000-0000-0000-0000-000000000004', 'admin');

select results_eq(
  $$ select display_name from public.profiles where id::text like 'a0000000-%' order by id $$,
  $$ values ('Ana'), ('Neighbor'), ('Mod'), ('Root') $$,
  'sign-up creates a profile, falling back to a neutral name'
);

-- anon
select pg_temp.login_anon();
select is((select count(*)::int from public.profiles where id::text like 'a0000000-%'), 4, 'anon can read display names');
select throws_ok(
  $$ select public.has_role('moderator') $$, '42501', null,
  'anon cannot call has_role'
);

-- a regular user
select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
update public.profiles set display_name = 'Ana B' where id = 'a0000000-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Hacked' where id = 'a0000000-0000-0000-0000-000000000002';
select pg_temp.logout();
select results_eq(
  $$ select display_name from public.profiles where id in ('a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002') order by id $$,
  $$ values ('Ana B'), ('Neighbor') $$,
  'users rename themselves but not others'
);

select pg_temp.login_as('a0000000-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.profiles set created_at = now() where id = 'a0000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'server-owned profile columns are not writable'
);
select throws_ok(
  $$ select * from private.user_roles $$, '42501', null,
  'the roles table is unreachable through the API roles'
);
select is(public.has_role('moderator'), false, 'a regular user is not a moderator');

select pg_temp.login_as('a0000000-0000-0000-0000-000000000003');
select is(public.has_role('moderator'), true, 'a moderator is a moderator');
select is(public.has_role('admin'), false, 'a moderator is not an admin');

select pg_temp.login_as('a0000000-0000-0000-0000-000000000004');
select is(public.has_role('moderator'), true, 'an admin holds every role');

select pg_temp.logout();
select * from finish();
rollback;
