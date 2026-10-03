# Security model

The app talks to Postgres directly through Supabase with the publishable key, which anyone can extract from the bundle. **Row Level Security is therefore the only real enforcement boundary.** Client-side checks (hiding a button, a guarded route) are UX, never protection.

## Threats this project designs for

| Threat | Mitigation |
|---|---|
| Revealing where an owner lives through "last seen" locations | Public reads return locations rounded to ~100 m; exact coordinates only to the author |
| Revealing the poster's location through photo metadata | Photos are re-encoded on the device (EXIF stripped) before upload |
| Scams and harassment through exposed contact details | No phone or email is ever shown; contact is in-app chat only, between the two participants |
| Spam and fake reports | Per-user rate limits in the write RPCs; community flags auto-hide content at a threshold; moderators review |
| Finding out which emails have accounts | Email confirmation on; sign-up failures the user can't act on share one message |
| A moderator's access outliving its revocation | Roles live in a table checked on every request, not in a JWT claim |
| Leaked secrets | Only the URL and publishable key in `EXPO_PUBLIC_*`; service role only in Edge Function secrets; gitleaks in CI |

## Database rules

Every migration follows these. `supabase/tests/database/00_security_guards.test.sql` checks the schema-wide ones in CI.

- **Every table** has RLS enabled and explicit grants. Supabase grants `anon`/`authenticated` full table privileges by default, so revoke first, then grant back only what's needed. Column-level grants do nothing while a table-level grant exists.
- **Server-owned columns** (counters, statuses, anything a trigger or function maintains) are never client-writable.
- **Sensitive writes go through RPCs** (`security definer`). Tables that only change through an RPC have no client `insert`/`update` policy at all.
- **Policies**: `update` needs both `using` and `with check`. Write `(select auth.uid())` and `(select public.has_role('moderator'))` so Postgres evaluates them once per query, not per row. Never authorize on `user_metadata`, which users can edit themselves.
- **`security definer` functions**:
  - `set search_path = ''` and schema-qualified names;
  - take the acting user from `(select auth.uid())`, never from a parameter;
  - check authorization in their own body;
  - lock the rows they read to decide (`for update`);
  - `revoke execute ... from public, anon` (Postgres grants `execute` to `public` by default). Trigger functions also revoke it from `authenticated`.
- **Views** are created `with (security_invoker = true)`.
- **Realtime**: a table joins the publication only after its select policies are correct and tested, because subscribers receive every row RLS lets them read.
- **Roles**: `private.user_roles` + `public.has_role(text)`. Granting a role is an operational, per-environment action, never a migration or an env var.
- **After every migration**, run the Supabase security advisors and resolve new warnings.

## Accepted advisor findings

Run the advisors after every migration (`supabase db advisors --linked`, or `get_advisors` over MCP). These findings are expected and stay:

| Lint | Where | Why it stays |
|---|---|---|
| `authenticated_security_definer_function_executable` (WARN) | The write RPCs (`create_report`, `add_sighting`, `mark_reunited`, `renew_report`, `start_conversation`, `flag_content`, `moderate`) and `has_role` | They are the API: the only way to write those tables, so signed-in users must call them. Each takes the caller from `auth.uid()`, checks authorization in its body, pins `search_path`, and is revoked from `anon`. `has_role` must be definer to read `private.user_roles`, and RLS policies call it as `authenticated`. |
| `rls_enabled_no_policy` (INFO) | `private.user_roles` | No API role should read it at all; `has_role()` is the only path. |
| `unused_index` (INFO) | Any | Until there is real traffic. Revisit with production stats before dropping one. |

Anything else is a regression to fix before merging.

## Testing policies

Each table's pgTAP file covers at least: anonymous user, another signed-in user, the owner, and a moderator. Assert that forbidden reads return nothing and forbidden writes raise, not only that allowed access works.

## Client rules

- The session is stored in the device keychain/keystore ([ADR 0003](adr/0003-session-storage.md)).
- The user's own location is never sent to the server except as a location they deliberately chose for a report or sighting. The map asks for the *visible area*, snapped outward to a grid a quarter of its size, not for the device position.
- Photos are fetched through short-lived signed URLs and cached on the device by storage path, so a re-signed URL never re-downloads a photo.
- Analytics events never carry precise coordinates.

## Reporting a vulnerability

Please don't open a public issue. Until `SECURITY.md` lands (Phase 7), contact the maintainer privately through GitHub.
