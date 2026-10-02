# Architecture

## System shape

One Supabase project (Postgres + PostGIS, Auth, Storage, Realtime) and one Expo app that talks to it directly with `@supabase/supabase-js`. There is no API server in between, so the database is where the security model and the business rules live (see [security.md](security.md)).

## Mobile: contracts and adapters

```
src/app (Expo Router screens)
   │ import
   ▼
features/<f>/components, hooks/useX ──► hooks/createXHooks(contract)    TanStack Query: keys, invalidation
   │ binds the factory to                    │ depends only on
   │ the production instance                 ▼
   │                                    src/domain/<f>                    types, contracts, pure rules
   ▼                                         ▲ implements
src/composition/<f>.ts ───────────────► src/infrastructure/*              Supabase and native SDK adapters
   │ the only importer of
   ▼
composition/supabaseClient.ts, expo-apple-authentication, google-signin
```

| Folder | Holds | May import |
|---|---|---|
| `src/domain` | Types, contracts, pure rules | Nothing else in the app (type-only `@/types/database.types` is fine) |
| `src/infrastructure` | Adapters; receive their client/SDK as an argument | `domain`, `types` |
| `src/composition` | Production wiring, one export per file | Anything; the only place that touches the Supabase client |
| `src/hooks` | `create*Hooks(contract)` factories and `useX` bindings | `domain`, `composition` (bindings only) |
| `src/features/<f>` | Feature components and hooks | `domain`, `hooks`, `ui` |
| `src/app` | Routes only: every file is a screen | `features`, `hooks`, `ui` |
| `src/ui` | Design tokens and primitives | `ui` |
| `src/test-utils` | In-memory fakes and render helpers | Tests only |

The boundaries are enforced by `import/no-restricted-paths` in `apps/mobile/eslint.config.js`, so a violation fails lint and CI.

### Rules that keep the seam intact

- **Adapters take their client as an argument** (`createSupabaseAuthGateway(client)`) and have no import-time side effects. Queries, RPC names and embeds live only there.
- **Hook logic lives in `hooks/create*Hooks.ts`.** The public `useX` modules only bind a factory to its production instance. Query keys are part of the behavior: realtime and mutations invalidate by them.
- **Development-only behavior wraps a contract** (a decorator that simulates slow, offline or failing answers), never replaces an adapter, and is applied only under `__DEV__`.
- **No DI container, React Context for dependencies, generic CRUD interface, or class hierarchy.** A factory bound at module level is enough; one small contract per feature.
- **Error conventions.** Writes reject with an `Error` carrying user-facing copy and the original as `cause`; reads reject with the underlying error. Email/password auth returns an outcome with a safe message, and sign-up collapses every reason the user can't act on into one message so it can't be used to find out which emails have accounts.

### Testing follows the seam

- Adapter tests inject a fake client (`{ from, rpc }`, `{ auth }`, `{ channel }`) or fake SDK. No `jest.mock`.
- Hook tests build the factory on an in-memory fake from `src/test-utils`, exercising real caching and invalidation.
- One test drives the real supabase-js client with an injected `fetch` and storage, pinning library behavior the contract relies on (sign-out).

### Adding a data feature

1. Contract and types in `src/domain/<feature>`.
2. Adapter in `src/infrastructure/supabase/`, taking the client as an argument, with tests.
3. Wiring in `src/composition/<feature>.ts`.
4. `hooks/create<Feature>Hooks.ts` + `hooks/use<Feature>.ts`.
5. An `inMemory<Feature>` fake in `src/test-utils` and hook tests.

## State

- **Server state**: TanStack Query.
- **UI state**: local `useState`/`useReducer`; multi-step flows (posting a report) use a tested state machine in a plain module.
- **Shareable state** (filters, selected report): Expo Router params, so a deep link reproduces the view.
- No global client store until something needs one that isn't server or URL state.

## Database

Migrations in `supabase/migrations/`, in order, each with a header comment explaining the non-obvious choices. pgTAP tests in `supabase/tests/database/`. See [security.md](security.md) for the rules every migration follows and [data-model.md](data-model.md) (Phase 1) for the schema.
