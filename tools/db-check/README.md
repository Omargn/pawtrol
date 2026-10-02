# db-check

Runs `supabase/migrations`, `supabase/seed.sql` and every pgTAP file in `supabase/tests/database` on [PGlite](https://pglite.dev) (Postgres compiled to WebAssembly), so you can test the database without Docker.

```bash
cd tools/db-check
npm install
npm run check               # migrations + seed + tests
npm run check -- --no-seed  # without seed.sql
```

**It is an approximation.** `supabase-shim.sql` recreates only what the migrations touch (API roles, `auth.uid()`, Supabase's default grants, a minimal `storage` and `cron`). Things it can't catch: Storage's own triggers and API, pg_cron actually running, Realtime, GoTrue. CI runs the real stack (`supabase db start && supabase test db`) and is the source of truth.
