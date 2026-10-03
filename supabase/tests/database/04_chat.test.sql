begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

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

-- owner, finder, outsider
insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'owner@test.dev'),
  ('f0000000-0000-0000-0000-000000000002', 'finder@test.dev'),
  ('f0000000-0000-0000-0000-000000000003', 'outsider@test.dev');

create temp table ids (name text primary key, id uuid);
grant all on ids to anon, authenticated;

select pg_temp.login_as('f0000000-0000-0000-0000-000000000001');
insert into ids values ('report', public.create_report(gen_random_uuid(), 'lost', 2::smallint, 'Orange cat', now(), -99.17, 19.40));
select throws_ok(
  format('select public.start_conversation(%L)', (select id from ids where name = 'report')),
  '42501', 'not_allowed', 'owners cannot open a conversation with themselves'
);

select pg_temp.login_as('f0000000-0000-0000-0000-000000000002');
insert into ids values ('conversation', public.start_conversation((select id from ids where name = 'report')));
select is(
  public.start_conversation((select id from ids where name = 'report')),
  (select id from ids where name = 'conversation'),
  'opening it again returns the same conversation'
);

insert into public.messages (conversation_id, body)
select id, 'I think I saw your cat on 5th street' from ids where name = 'conversation';
select is(
  (select sender_id from public.messages limit 1),
  'f0000000-0000-0000-0000-000000000002'::uuid,
  'the sender is always the caller'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, sender_id, body)
     select id, 'f0000000-0000-0000-0000-000000000001', 'impersonated' from ids where name = 'conversation' $$,
  '42501', null, 'nobody can write as someone else'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, body) select id, '   ' from ids where name = 'conversation' $$,
  '23514', null, 'blank messages are rejected'
);

-- Retries: the client picks the id, and resending it can't duplicate the message.
select lives_ok(
  $$ insert into public.messages (id, conversation_id, body)
     select 'e0000000-0000-0000-0000-000000000001', id, 'Sent with my own id' from ids where name = 'conversation' $$,
  'the sender may choose the message id'
);
select throws_ok(
  $$ insert into public.messages (id, conversation_id, body)
     select 'e0000000-0000-0000-0000-000000000001', id, 'Sent with my own id' from ids where name = 'conversation' $$,
  '23505', null, 'resending the same id is refused instead of duplicated'
);
select is(
  (select count(*)::int from public.messages where id = 'e0000000-0000-0000-0000-000000000001'),
  1, 'so the message exists once'
);

select pg_temp.login_as('f0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.conversations), 1, 'the owner sees the conversation');
select is(
  (select body from public.messages where id <> 'e0000000-0000-0000-0000-000000000001'),
  'I think I saw your cat on 5th street', 'and reads the message'
);
select isnt(
  (select last_message_at from public.conversations limit 1), null,
  'the inbox order is kept up to date'
);

select pg_temp.login_as('f0000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.conversations), 0, 'outsiders see no conversations');
select is((select count(*)::int from public.messages), 0, 'or messages');
select throws_ok(
  $$ insert into public.messages (conversation_id, body) select id, 'spam' from ids where name = 'conversation' $$,
  '42501', null, 'or write into them'
);

select pg_temp.login_anon();
select throws_ok($$ select * from public.conversations $$, '42501', null, 'anon cannot read conversations');

-- Rate limit: 30 messages a minute per sender (two are already sent above).
select pg_temp.login_as('f0000000-0000-0000-0000-000000000002');
select lives_ok(
  $$ insert into public.messages (conversation_id, body)
     select ids.id, 'msg ' || n from ids, generate_series(1, 28) n where ids.name = 'conversation' $$,
  'thirty messages a minute are fine'
);
select throws_ok(
  $$ insert into public.messages (conversation_id, body) select id, 'one too many' from ids where name = 'conversation' $$,
  'P0001', 'rate_limited', 'the thirty-first is rate limited'
);

select pg_temp.logout();
select * from finish();
rollback;
