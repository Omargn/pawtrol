-- One select policy per role per table.
--
-- Postgres evaluates every permissive policy that applies to a role and ORs
-- the results, so three policies for `authenticated` cost three checks per
-- row (the performance advisor's multiple_permissive_policies). Each table
-- now has one policy for anon and one for authenticated, whose USING is the
-- OR of the old ones: the same rows are visible to the same people, which the
-- pgTAP suite pins.

-- ---------------------------------------------------------------- pet_reports
drop policy "open and reunited reports are public" on public.pet_reports;
drop policy "authors see their own reports" on public.pet_reports;
drop policy "moderators see every report" on public.pet_reports;

create policy "anyone reads open and reunited reports"
  on public.pet_reports for select
  to anon
  using (status in ('active', 'reunited'));

create policy "users read public reports, their own, and all if moderating"
  on public.pet_reports for select
  to authenticated
  using (
    status in ('active', 'reunited')
    or created_by = (select auth.uid())
    or (select public.has_role('moderator'))
  );

-- ---------------------------------------------------------------- sightings
drop policy "visible sightings of visible reports are public" on public.sightings;
drop policy "authors see their own sightings" on public.sightings;
drop policy "moderators see every sighting" on public.sightings;

-- The pet_reports subqueries run under that table's RLS, so a sighting is
-- only public while its report is visible to the same caller.
create policy "anyone reads visible sightings of visible reports"
  on public.sightings for select
  to anon
  using (
    status = 'visible'
    and exists (select 1 from public.pet_reports r where r.id = report_id)
  );

create policy "users read public sightings, their own, and all if moderating"
  on public.sightings for select
  to authenticated
  using (
    (status = 'visible' and exists (select 1 from public.pet_reports r where r.id = report_id))
    or created_by = (select auth.uid())
    or (select public.has_role('moderator'))
  );

-- ---------------------------------------------------------------- content_flags
drop policy "reporters see their own flags" on public.content_flags;
drop policy "moderators see every flag" on public.content_flags;

create policy "users read their own flags, moderators all"
  on public.content_flags for select
  to authenticated
  using (
    reporter_id = (select auth.uid())
    or (select public.has_role('moderator'))
  );

-- ---------------------------------------------------------------- messages
drop policy "participants read visible messages and their own" on public.messages;
drop policy "moderators read flagged messages" on public.messages;

-- Participants read their conversations (the conversations subquery runs
-- under that table's RLS); moderators read a message only once it's flagged.
create policy "participants read their messages, moderators flagged ones"
  on public.messages for select
  to authenticated
  using (
    (
      (status = 'visible' or sender_id = (select auth.uid()))
      and exists (select 1 from public.conversations c where c.id = conversation_id)
    )
    or (
      (select public.has_role('moderator'))
      and exists (
        select 1 from public.content_flags f
        where f.target_type = 'message' and f.target_id = messages.id
      )
    )
  );
