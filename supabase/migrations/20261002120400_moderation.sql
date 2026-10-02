-- Moderation: anyone signed in can flag content; enough independent flags
-- hide it until a moderator decides; every status change by moderation is
-- recorded in an append-only log.
--
-- Reports publish immediately (a lost pet can't wait for review), so this is
-- the safety net: rate limits stop volume, flags stop what slips through.

-- Distinct open flags that hide a target automatically. Low enough to act
-- before many people see a scam, high enough that one grudge can't do it.
create function private.auto_hide_threshold()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

revoke execute on function private.auto_hide_threshold() from public, anon, authenticated;

-- ============================================================
-- Flags. target_id is polymorphic (no foreign key); flag_content() checks the
-- target exists and is visible to the flagger before recording anything.
-- ============================================================
create table public.content_flags (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('report', 'sighting', 'message')),
  target_id   uuid not null,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null check (reason in ('spam', 'scam', 'abuse', 'wrong_info', 'other')),
  details     text check (length(trim(details)) between 1 and 500),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  unique (target_type, target_id, reporter_id)
);

-- The moderation queue: open flags, oldest first.
create index content_flags_open_idx on public.content_flags (created_at) where resolved_at is null;
create index content_flags_reporter_id_idx on public.content_flags (reporter_id);

alter table public.content_flags enable row level security;
revoke all on public.content_flags from anon, authenticated;
grant select on public.content_flags to authenticated;

create policy "reporters see their own flags"
  on public.content_flags for select
  to authenticated
  using (reporter_id = (select auth.uid()));

create policy "moderators see every flag"
  on public.content_flags for select
  to authenticated
  using ((select public.has_role('moderator')));

-- Moderators can read a private message only once someone in the
-- conversation has flagged it.
create policy "moderators read flagged messages"
  on public.messages for select
  to authenticated
  using (
    (select public.has_role('moderator'))
    and exists (
      select 1 from public.content_flags f
      where f.target_type = 'message' and f.target_id = messages.id
    )
  );

-- ============================================================
-- Moderation log: append-only. Rows are only ever inserted by the functions
-- below; a trigger refuses updates and deletes even from the table owner, so
-- the history can't be rewritten after the fact.
-- ============================================================
create table public.moderation_events (
  id          bigint generated always as identity primary key,
  target_type text not null check (target_type in ('report', 'sighting', 'message')),
  target_id   uuid not null,
  -- null when the system acted (auto-hide). No `on delete set null`: that is
  -- an update, which the append-only trigger refuses. A moderator account with
  -- log entries can't be deleted, by design; revoke the role instead.
  actor_id    uuid references public.profiles (id),
  action      text not null check (action in ('auto_hidden', 'hidden', 'restored', 'removed')),
  from_status text not null,
  to_status   text not null,
  reason      text check (length(reason) <= 500),
  created_at  timestamptz not null default now()
);

create index moderation_events_target_idx on public.moderation_events (target_type, target_id, created_at desc);
create index moderation_events_actor_id_idx on public.moderation_events (actor_id);

alter table public.moderation_events enable row level security;
revoke all on public.moderation_events from anon, authenticated;
grant select on public.moderation_events to authenticated;

create policy "moderators read the log"
  on public.moderation_events for select
  to authenticated
  using ((select public.has_role('moderator')));

create function private.forbid_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end;
$$;

revoke execute on function private.forbid_change() from public, anon, authenticated;

create trigger moderation_events_append_only
  before update or delete on public.moderation_events
  for each row execute function private.forbid_change();

-- ============================================================
-- Target helpers
-- ============================================================

-- Locks a target row and returns its status, or null if it doesn't exist.
create function private.lock_target_status(p_target_type text, p_target_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare
  current_status text;
begin
  case p_target_type
    when 'report' then
      select status into current_status from public.pet_reports where id = p_target_id for update;
    when 'sighting' then
      select status into current_status from public.sightings where id = p_target_id for update;
    when 'message' then
      select status into current_status from public.messages where id = p_target_id for update;
    else
      raise exception 'invalid_input' using errcode = '22023';
  end case;
  return current_status;
end;
$$;

create function private.set_target_status(p_target_type text, p_target_id uuid, p_status text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  case p_target_type
    when 'report' then
      update public.pet_reports set status = p_status where id = p_target_id;
    when 'sighting' then
      update public.sightings set status = p_status where id = p_target_id;
    when 'message' then
      update public.messages set status = p_status where id = p_target_id;
  end case;
end;
$$;

revoke execute on function private.lock_target_status(text, uuid) from public, anon, authenticated;
revoke execute on function private.set_target_status(text, uuid, text) from public, anon, authenticated;

-- ============================================================
-- flag_content
--
-- The flagger must be able to see the target (a participant, for a message)
-- and can't flag their own content. Flagging twice is a no-op. Reaching the
-- threshold hides the target and logs it as a system action.
-- ============================================================
create function public.flag_content(
  p_target_type text,
  p_target_id   uuid,
  p_reason      text,
  p_details     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid            uuid := private.require_user();
  author         uuid;
  visible        boolean;
  current_status text;
begin
  case p_target_type
    when 'report' then
      select r.created_by, r.status in ('active', 'reunited')
        into author, visible
      from public.pet_reports r where r.id = p_target_id;
    when 'sighting' then
      select s.created_by, s.status = 'visible' and r.status in ('active', 'reunited')
        into author, visible
      from public.sightings s join public.pet_reports r on r.id = s.report_id
      where s.id = p_target_id;
    when 'message' then
      select m.sender_id, m.status = 'visible' and uid in (c.owner_id, c.contact_id)
        into author, visible
      from public.messages m join public.conversations c on c.id = m.conversation_id
      where m.id = p_target_id;
    else
      raise exception 'invalid_input' using errcode = '22023';
  end case;

  if not coalesce(visible, false) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if author = uid then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  insert into public.content_flags (target_type, target_id, reporter_id, reason, details)
  values (p_target_type, p_target_id, uid, p_reason, nullif(trim(p_details), ''))
  on conflict (target_type, target_id, reporter_id) do nothing;
  if not found then
    return;
  end if;

  current_status := private.lock_target_status(p_target_type, p_target_id);
  if current_status in ('active', 'reunited', 'visible')
     and (select count(*) from public.content_flags f
          where f.target_type = p_target_type and f.target_id = p_target_id
            and f.resolved_at is null) >= private.auto_hide_threshold()
  then
    perform private.set_target_status(p_target_type, p_target_id, 'hidden');
    insert into public.moderation_events (target_type, target_id, actor_id, action, from_status, to_status)
    values (p_target_type, p_target_id, null, 'auto_hidden', current_status, 'hidden');
  end if;
end;
$$;

revoke execute on function public.flag_content(text, uuid, text, text) from public, anon;
grant execute on function public.flag_content(text, uuid, text, text) to authenticated;

-- ============================================================
-- moderate
--
-- restore: back to visible — for a report, active if it hasn't expired since,
--          expired otherwise (a reunited report that got hidden comes back
--          as reunited, read from the log).
-- hide:    hidden pending more review.
-- remove:  final; the content stays for the record but is never shown.
-- Resolves the target's open flags so they don't count toward hiding it again.
-- ============================================================
create function public.moderate(
  p_target_type text,
  p_target_id   uuid,
  p_action      text,
  p_reason      text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid            uuid := private.require_user();
  current_status text;
  next_status    text;
  event_action   text;
begin
  if not public.has_role('moderator') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  current_status := private.lock_target_status(p_target_type, p_target_id);
  if current_status is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  case p_action
    when 'hide' then
      next_status := 'hidden';
      event_action := 'hidden';
    when 'remove' then
      next_status := 'removed';
      event_action := 'removed';
    when 'restore' then
      event_action := 'restored';
      if p_target_type <> 'report' then
        next_status := 'visible';
      elsif (select e.from_status from public.moderation_events e
             where e.target_type = 'report' and e.target_id = p_target_id
               and e.to_status = 'hidden'
             order by e.created_at desc, e.id desc limit 1) = 'reunited' then
        next_status := 'reunited';
      elsif (select r.expires_at from public.pet_reports r where r.id = p_target_id) > now() then
        next_status := 'active';
      else
        next_status := 'expired';
      end if;
    else
      raise exception 'invalid_input' using errcode = '22023';
  end case;

  if current_status = next_status then
    return current_status;
  end if;
  if p_action = 'restore' and current_status not in ('hidden', 'removed') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  perform private.set_target_status(p_target_type, p_target_id, next_status);
  update public.content_flags
  set resolved_at = now()
  where target_type = p_target_type and target_id = p_target_id and resolved_at is null;
  insert into public.moderation_events (target_type, target_id, actor_id, action, from_status, to_status, reason)
  values (p_target_type, p_target_id, uid, event_action, current_status, next_status, nullif(trim(p_reason), ''));

  return next_status;
end;
$$;

revoke execute on function public.moderate(text, uuid, text, text) from public, anon;
grant execute on function public.moderate(text, uuid, text, text) to authenticated;
