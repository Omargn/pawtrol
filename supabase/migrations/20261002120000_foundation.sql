-- Foundation: extensions, the private schema, roles, profiles.
--
-- Conventions every later migration follows (docs/security.md):
-- * Every table: RLS on, then `revoke all` from anon/authenticated before
--   granting back exactly what the app needs. Supabase's default privileges
--   grant both roles everything on new tables, functions and sequences.
-- * Every function: `set search_path = ''` and schema-qualified names.
-- * security definer functions take the caller from auth.uid(), check
--   authorization themselves, and revoke execute from public and anon.
-- * RPC failures raise a stable message key (not_authenticated, not_allowed,
--   not_found, invalid_input, rate_limited) the app maps to its own copy.

create extension if not exists postgis with schema extensions;

-- Holds tables and functions no API role should reach directly. Not in the
-- exposed schemas (config.toml), and revoked anyway as defense in depth.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Some hosted projects ship an rls_auto_enable() event-trigger function that
-- PUBLIC can execute. Calling it outside an event trigger only errors, but the
-- security advisor flags it, so close it where it exists.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- ============================================================
-- Shared trigger: updated_at
-- ============================================================
create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ============================================================
-- Roles
--
-- A table checked live on every request rather than a JWT claim: a claim
-- stays valid until the token refreshes, so revoking a moderator wouldn't take
-- effect for up to an hour. Who holds a role is operational data, granted per
-- environment, never in a migration:
--   insert into private.user_roles (user_id, role)
--   select id, 'moderator' from auth.users where email = 'someone@example.com';
-- ============================================================
create table private.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- No policies on purpose: nothing reads this through the API, not even a
-- moderator. public.has_role() is the only sanctioned path.
alter table private.user_roles enable row level security;
revoke all on private.user_roles from public, anon, authenticated;

-- Whether the caller holds `required_role` (admins hold every role). Definer
-- so it can read private.user_roles; safe because it only ever answers about
-- auth.uid(), never an arbitrary user. Callable by the app too, to decide
-- whether to show moderation screens — RLS still decides what they can do.
create function public.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.user_roles
    where user_id = (select auth.uid())
      and role in (required_role, 'admin')
  );
$$;

revoke execute on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;

-- ============================================================
-- Profiles
--
-- The public face of an account: a display name shown on sightings and in
-- chat. Never an email or phone number — contact happens only in-app.
-- Created by a trigger on sign-up, so the client never inserts.
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 50),
  avatar_path  text check (length(avatar_path) <= 200),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- Column grant, not table: id and timestamps are never client-writable.
grant update (display_name, avatar_path) on public.profiles to authenticated;

create policy "profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- Every sign-in path writes the name to raw_user_meta_data.full_name (email
-- sign-up, and Apple's first authorization via updateUser). Users can edit
-- that metadata, which is fine here: it only seeds a display name they can
-- change anyway, and is never used for authorization.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Neighbor'), 50)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
