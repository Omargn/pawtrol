# 0002 — The database is the security boundary

**Status:** Accepted

## Context

A thin API server would be one more thing for contributors to run and deploy, and would still need the same authorization rules. Supabase exposes Postgres through PostgREST with RLS, plus RPCs for multi-step writes.

## Decision

- No API server. The app talks to Supabase directly with the publishable key.
- Authorization lives in RLS policies and `security definer` RPCs, following [security.md](../security.md).
- Writes with rules (rate limits, idempotency, state transitions, counters) go through RPCs; tables they own have no client write policies.
- Background work that needs elevated rights (push, expiry) runs in Edge Functions or `pg_cron`, with the service role kept in their secrets.

## Consequences

- One place to audit and test: pgTAP covers every policy with anon / other user / owner / moderator cases.
- Business rules shared by any future client (web, admin) hold automatically.
- Cost: SQL becomes application code and must be reviewed as carefully. Contributors need Docker to run database tests locally; CI runs them on every PR.
