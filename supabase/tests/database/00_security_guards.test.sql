-- Schema-wide guards from docs/security.md. They pass vacuously on an empty
-- schema and then hold every later migration to the same rules, so a table or
-- function added without them fails CI instead of shipping.
begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select is_empty(
  $$
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  $$,
  'every table in public has row level security enabled'
);

select is_empty(
  $$
    select p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (
        select 1 from unnest(coalesce(p.proconfig, '{}')) as setting
        where setting like 'search_path=%'
      )
  $$,
  'every security definer function pins its search_path'
);

select is_empty(
  $$
    select p.proname
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
  $$,
  'no security definer function is executable by anon'
);

select * from finish();
rollback;
