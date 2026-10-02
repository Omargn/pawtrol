# 0001 — Contracts and adapters in the mobile app

**Status:** Accepted

## Context

The app reads and writes through Supabase, uses Apple and Google sign-in SDKs, and will add storage, location and camera. Calling those SDKs from screens and hooks makes every test a module mock and every schema change a hunt through components.

## Decision

- Per-feature contracts in `src/domain`, implemented by adapters in `src/infrastructure` that receive their client as an argument.
- `src/composition` is the only place that constructs adapters and touches the Supabase client.
- Hook logic in `create*Hooks(contract)` factories; `useX` modules bind them to production instances.
- The import rules are enforced with `import/no-restricted-paths`, not just documented.

## Consequences

- Tests use in-memory fakes and injected clients, with no `jest.mock`, and exercise real React Query caching.
- Swapping a backend piece (e.g. maps, analytics provider) touches one adapter and one composition file.
- Cost: a new data feature is five small files instead of one. We accept that; we explicitly don't add a DI container, React Context for dependencies, or a generic repository base class.
