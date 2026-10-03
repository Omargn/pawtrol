# 0005 — Read-only Maestro smoke tests, run locally, not in CI yet

**Status:** Accepted

## Context

Unit, hook and adapter tests run on fakes, and pgTAP covers the database, but nothing drives the real app: navigation, native modules, deep links and the wiring in `src/composition`. Options were Detox (gray-box, deeply tied to the build and the React Native version) and Maestro (black-box YAML over the accessibility tree, no app changes).

Two constraints shaped the decision:

- The only shared backend is production. A test that posts, adds a sighting or sends a message would write real rows that other people see.
- iOS simulator runs in CI need macOS runners and a native build on every run, which is slow and costs ten times a Linux minute.

## Decision

- Use **Maestro**, with flows in `apps/mobile/e2e`, selecting by visible text and accessibility labels only.
- Flows are **read-only**: they run signed out against the demo reports (`EXPO_PUBLIC_DEMO_DATA=1`), so they're safe against any backend.
- They run **locally** (`npm run e2e`) on a development build, not in CI for now.

## Consequences

- Catches broken navigation, deep links and guest gating without risking production data.
- The flows clear the app's data and keychain, so they need a simulator nobody is signed into.
- Writing flows (post, sighting, chat, moderation) need a disposable backend: a local `supabase start` with seeded test accounts. Add them together with a CI job (macOS runner, `expo run:ios` build cached by fingerprint) when the project has a second maintainer or the build is cached.
