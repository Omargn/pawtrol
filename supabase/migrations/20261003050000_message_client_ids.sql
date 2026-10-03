-- Messages: the client may choose a message's id.
--
-- Sending is a plain insert with no RPC, so nothing else makes a retry safe:
-- when a send times out the app can't tell whether the row landed. The app
-- now generates the id once per message and reuses it on every retry; a
-- second insert of the same id fails on the primary key (23505), which the
-- app reads as "already sent". Ids are random UUIDs, so choosing one grants
-- nothing: RLS still decides where the caller may write, and sender_id
-- still can't be set.
--
-- Additive: installed builds that leave the id to the default keep working.

grant insert (id) on public.messages to authenticated;
