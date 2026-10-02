# Engineering rules

Binding for every change in this repo. `docs/architecture.md` and `docs/security.md` hold the specifics; this file sets the bar and the workflow.

## Priorities

In this order when they conflict:

1. **Security** — RLS is the only enforcement boundary. Nothing ships that weakens it.
2. **Maintainability** — simple, explicit code in the existing architecture that someone else can safely change in six months.
3. **SOLID** — one reason to change per module; depend on contracts, not concrete clients.
4. **Scalability** — still behaves at 10× the users, rows and concurrent requests.

If a request can only be met by violating one of these, stop and say so.

## Principles

- **Reuse before creating.** Search for an existing hook, component, contract or policy first. Extract a shared abstraction only when a second real caller exists.
- **No dead code.** No unused imports, exports, flags or commented-out code.
- **Minimal, focused diffs.** No unrelated refactors folded in.
- **Separation of concerns.** Rules in the database; data access behind `src/domain` contracts; screens and components render.
- **Errors.** Never swallow them in a broad `try/catch`. Client-facing messages stay generic: no stack traces, SQL, or internal IDs.
- **Tests.** Behavior changes come with tests, including failure paths. Security-sensitive changes prove that unauthorized access is *rejected*, not only that authorized access works. Keep testable logic out of modules that import `react-native-reanimated` or `react-native-worklets`, which can't load in Jest.
- **Dependencies.** Prefer what's installed or what Expo ships. Justify anything new against maintenance status and bundle size.
- **Scalability.** Bound every list, select only needed columns, filter and sort in the database, index what you filter on, avoid N+1. Multi-step writes are one RPC/transaction and safe against retries and double-submit. Growing lists are virtualized; subscriptions are cleaned up.
- **Migrations** are safe for existing rows *and* for app builds already installed.

## Workflow

1. **Understand** the requested behavior and which layers/tables it touches.
2. **Inspect** for existing implementations and policies.
3. **Plan** the smallest maintainable approach, noting security implications.
4. **Implement** within the architecture.
5. **Security review**: authn/authz, input validation, data exposure, secrets, error handling.
6. **Clean up** anything the change made obsolete.
7. **Verify** with the commands in `CLAUDE.md`.

## Checklist

**Always**
- [ ] Smallest reasonable diff; follows the architecture; nothing unrelated
- [ ] Reused what exists; no duplicated rules
- [ ] Layers respected (lint passes); new code depends on contracts
- [ ] No dead code or debug leftovers
- [ ] Errors handled intentionally; client-facing copy generic
- [ ] Tests added or updated, including failure paths
- [ ] Lint, typecheck, tests and leak guard pass

**Data access, RLS or migrations**
- [ ] Every new table has RLS, explicit grants and a pgTAP test with anon / other user / owner / moderator cases
- [ ] `security definer` functions follow docs/security.md
- [ ] Queries bounded, indexed, no N+1
- [ ] Safe for existing rows and installed builds
- [ ] Supabase security advisors show no new warnings

**Writes and state transitions**
- [ ] Atomic in one RPC/transaction
- [ ] Idempotent or guarded by a constraint against retries and double-submit

## Reporting

When reporting a change as done: one line per priority on how it was addressed (or "not affected" and why), which conditional checklist sections applied, and anything skipped with the reason.
