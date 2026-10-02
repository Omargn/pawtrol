begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

create function pg_temp.login_as(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select set_config('role', 'authenticated', true);
$$;
create function pg_temp.logout() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
  select set_config('role', 'none', true);
$$;

-- author, three flaggers, a moderator
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'author@test.dev'),
  ('10000000-0000-0000-0000-000000000002', 'flagger1@test.dev'),
  ('10000000-0000-0000-0000-000000000003', 'flagger2@test.dev'),
  ('10000000-0000-0000-0000-000000000004', 'flagger3@test.dev'),
  ('10000000-0000-0000-0000-000000000005', 'mod@test.dev');
insert into private.user_roles (user_id, role) values ('10000000-0000-0000-0000-000000000005', 'moderator');

create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('report', public.create_report(gen_random_uuid(), 'found', 1::smallint, 'Send me $50 to get your dog back', now(), -99.18, 19.39));
select throws_ok(
  format('select public.flag_content(%L, %L, %L)', 'report', (select id from ids where name = 'report'), 'scam'),
  '42501', 'not_allowed', 'authors cannot flag their own content'
);

-- ---------------------------------------------------------------- auto-hide
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select public.flag_content('report', (select id from ids where name = 'report'), 'scam');
select public.flag_content('report', (select id from ids where name = 'report'), 'spam');
select is(
  (select count(*)::int from public.content_flags),
  1, 'flagging the same thing twice counts once'
);
select throws_ok(
  format('select public.flag_content(%L, %L, %L)', 'report', gen_random_uuid(), 'scam'),
  'P0002', 'not_found', 'a target that does not exist cannot be flagged'
);
select throws_ok(
  format('select public.flag_content(%L, %L, %L)', 'report', (select id from ids where name = 'report'), 'because'),
  '23514', null, 'reasons come from a fixed list'
);

select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
select public.flag_content('report', (select id from ids where name = 'report'), 'scam');
select pg_temp.login_as('10000000-0000-0000-0000-000000000002');
select is(
  (select status from public.pet_reports where id = (select id from ids where name = 'report')),
  'active', 'two flags are not enough to hide'
);

select pg_temp.login_as('10000000-0000-0000-0000-000000000004');
select public.flag_content('report', (select id from ids where name = 'report'), 'scam', 'Asking for money');
select is(
  (select count(*)::int from public.pet_reports where id = (select id from ids where name = 'report')),
  0, 'the third flag hides the report'
);
select is(
  (select count(*)::int from public.content_flags),
  1, 'flaggers only see their own flags'
);
select is(
  (select count(*)::int from public.moderation_events),
  0, 'and not the moderation log'
);

-- ---------------------------------------------------------------- moderator
select throws_ok(
  format('select public.moderate(%L, %L, %L)', 'report', (select id from ids where name = 'report'), 'restore'),
  '42501', 'not_allowed', 'only moderators moderate'
);

select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select results_eq(
  $$ select action, actor_id, from_status, to_status from public.moderation_events $$,
  $$ values ('auto_hidden', null::uuid, 'active', 'hidden') $$,
  'the auto-hide is logged as a system action'
);
select is((select count(*)::int from public.content_flags where resolved_at is null), 3, 'moderators see every open flag');
select is(
  public.moderate('report', (select id from ids where name = 'report'), 'restore', 'Checked with the author'),
  'active', 'restoring an unexpired report makes it active'
);
select is(
  (select count(*)::int from public.content_flags where resolved_at is null),
  0, 'and resolves its flags'
);
select is(
  public.moderate('report', (select id from ids where name = 'report'), 'remove', 'Confirmed scam'),
  'removed', 'moderators can remove'
);
select is(
  (select count(*)::int from public.moderation_events where actor_id = '10000000-0000-0000-0000-000000000005'),
  2, 'every moderator action is logged with its actor'
);

-- A reunited report that gets hidden comes back as reunited.
select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('happy', public.create_report(gen_random_uuid(), 'lost', 1::smallint, 'Found him!', now(), -99.18, 19.39));
select public.mark_reunited((select id from ids where name = 'happy'));
select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select public.moderate('report', (select id from ids where name = 'happy'), 'hide');
select is(
  public.moderate('report', (select id from ids where name = 'happy'), 'restore'),
  'reunited', 'a restored report gets back the status it had before being hidden'
);

-- ---------------------------------------------------------------- flagged messages
-- Conversations need an active report, so reopen this one for the chat part.
select pg_temp.logout();
update public.pet_reports set status = 'active' where id = (select id from ids where name = 'happy');
select pg_temp.login_as('10000000-0000-0000-0000-000000000003');
insert into ids values ('chat', public.start_conversation((select id from ids where name = 'happy')));
insert into public.messages (conversation_id, body) select id, 'Pay me or else' from ids where name = 'chat';
insert into public.messages (conversation_id, body) select id, 'Hello' from ids where name = 'chat';

select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.messages), 0, 'moderators cannot read private messages');

select pg_temp.login_as('10000000-0000-0000-0000-000000000001');
select public.flag_content('message', (select id from public.messages where body = 'Pay me or else'), 'abuse');
select pg_temp.login_as('10000000-0000-0000-0000-000000000005');
select results_eq(
  $$ select body from public.messages $$,
  $$ values ('Pay me or else') $$,
  'until one is flagged, and then only that one'
);

-- ---------------------------------------------------------------- append-only log
select pg_temp.logout();
select throws_ok(
  $$ update public.moderation_events set reason = 'rewritten' $$,
  '42501', null, 'the moderation log cannot be edited, even by the owner'
);
select throws_ok(
  $$ delete from public.moderation_events $$,
  '42501', null, 'or deleted'
);

select * from finish();
rollback;
