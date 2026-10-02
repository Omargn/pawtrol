# CLAUDE.md

Guidance for Claude Code working in this repository.

## Repository structure

No workspace tooling (no root `package.json`). `apps/mobile` and `supabase` are standalone; always `cd apps/mobile` before npm/Expo commands.

- `docs/architecture.md` — the layered seam in the mobile app and the rules that keep it intact.
- `docs/security.md` — the RLS model and the database rules every migration follows.
- `docs/adr/` — decisions and their reasons. Add one for any decision a contributor would otherwise re-litigate.
- `ENGINEERING.md` — the required workflow and review checklist for every change.

## Rules that are easy to break

- Never import `@/composition/supabaseClient` outside `src/composition`, or `src/infrastructure` from hooks, features, screens or UI. ESLint enforces this; don't disable the rule.
- Every new table needs RLS and a pgTAP test proving unauthorized access is rejected. `supabase/tests/database/00_security_guards.test.sql` fails CI otherwise.
- `src/types/database.types.ts` is generated (`npx supabase gen types typescript --project-id <ref>`); never edit it by hand once the schema exists.
- Install packages with `npx expo install`, not `npm install`, so versions match the SDK.
- Docker is not available on the maintainer's machine: database tests run in CI. Don't claim a migration works until CI has run it.
- `docs/ideas.md` is private and gitignored. Never commit it, quote it in public files, or reference the project it describes. `scripts/check-leaks.sh` guards this in CI.

## Verify

| Area | Command (from `apps/mobile` unless noted) |
|---|---|
| Lint | `npm run lint` |
| Types | `npm run typecheck` |
| Tests | `npm test` |
| Leak guard | `./scripts/check-leaks.sh` (repo root) |
| Database | CI only: `supabase db start && supabase test db` |
