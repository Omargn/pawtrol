-- In-app chat between a report's owner and someone who has news about it.
-- This is the only contact channel: no phone number or email is ever shown.

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  report_id       uuid not null references public.pet_reports (id) on delete cascade,
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  contact_id      uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  unique (report_id, contact_id),
  check (owner_id <> contact_id)
);

-- The inbox: each side's conversations, most recently active first.
create index conversations_owner_id_idx on public.conversations (owner_id, last_message_at desc nulls last);
create index conversations_contact_id_idx on public.conversations (contact_id, last_message_at desc nulls last);

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;
-- Created only through start_conversation(); last_message_at by trigger.

create policy "participants see their conversations"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) in (owner_id, contact_id));

-- ============================================================
-- Messages
--
-- Inserted directly (no RPC): RLS is enough to say who may write where, and
-- sender_id defaults to the caller with no grant to set it, so nobody can
-- write as someone else.
-- ============================================================
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body            text not null check (length(trim(body)) between 1 and 1000),
  status          text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at      timestamptz not null default now()
);

-- A conversation's history, paged backwards from the newest.
create index messages_conversation_id_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_id_idx on public.messages (sender_id);

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

-- The conversations subquery runs under that table's RLS: only participants
-- get a row back. Moderators read a message only once it's been flagged
-- (content_flags policy in the moderation migration).
create policy "participants read visible messages and their own"
  on public.messages for select
  to authenticated
  using (
    (status = 'visible' or sender_id = (select auth.uid()))
    and exists (select 1 from public.conversations c where c.id = conversation_id)
  );

create policy "participants write as themselves"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and status = 'visible'
    and exists (select 1 from public.conversations c where c.id = conversation_id)
  );

-- Keeps the inbox order without a max() per conversation on every load, and
-- caps how fast one sender can write: 30 messages a minute is far above a
-- person typing and far below a script.
create function private.on_message_inserted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.lock_user(new.sender_id);
  if (select count(*) from public.messages m
      where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') > 30 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end;
$$;

revoke execute on function private.on_message_inserted() from public, anon, authenticated;

create trigger messages_on_inserted
  after insert on public.messages
  for each row execute function private.on_message_inserted();

-- ============================================================
-- start_conversation
--
-- The caller opens (or gets back) their conversation about an active report.
-- One per (report, contact); at most 10 new conversations per user per hour,
-- which stops one account messaging every owner in a city.
-- ============================================================
create function public.start_conversation(p_report_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid             uuid := private.require_user();
  report_owner    uuid;
  conversation_id uuid;
begin
  perform private.lock_user(uid);

  select c.id into conversation_id
  from public.conversations c
  where c.report_id = p_report_id and c.contact_id = uid;
  if found then
    return conversation_id;
  end if;

  select r.created_by into report_owner
  from public.pet_reports r
  where r.id = p_report_id and r.status = 'active';
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if report_owner = uid then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  if (select count(*) from public.conversations c
      where c.contact_id = uid and c.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;

  insert into public.conversations (report_id, owner_id, contact_id)
  values (p_report_id, report_owner, uid)
  returning id into conversation_id;

  return conversation_id;
end;
$$;

revoke execute on function public.start_conversation(uuid) from public, anon;
grant execute on function public.start_conversation(uuid) to authenticated;
