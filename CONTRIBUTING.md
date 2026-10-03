# Contributing to Pawtrol

Thanks for helping reunite pets with their people. This page is the practical guide; [ENGINEERING.md](ENGINEERING.md) holds the bar every change is reviewed against.

## Before you start

- **Bugs and small fixes**: open a pull request directly, or an issue first if you're unsure it's a bug.
- **Features and anything touching the schema**: open an issue to agree on the approach first. Decisions with lasting consequences get an [ADR](docs/adr/README.md).
- **Security problems**: never in a public issue. See [SECURITY.md](SECURITY.md).

By contributing you agree that your work is released under the [MIT License](LICENSE) and to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Read first

| Doc | What's in it |
|---|---|
| [docs/architecture.md](docs/architecture.md) | The layers in the mobile app and the rules that keep them apart |
| [docs/security.md](docs/security.md) | The RLS model and the rules every migration follows |
| [docs/data-model.md](docs/data-model.md) | Tables, RPCs and error keys |
| [ENGINEERING.md](ENGINEERING.md) | Priorities, workflow and the review checklist |

## Setup

Requirements: Node 22+, Xcode (iOS) or Android Studio, the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), and either Docker (for a local Supabase stack) or a Supabase project of your own.

```bash
cd apps/mobile
npm install
cp .env.example .env
```

Fill in `.env` with your Supabase URL and **publishable** key (never the service role key). Then build and run a development build; Expo Go lacks the native modules:

```bash
npx expo run:ios
```

`EXPO_PUBLIC_DEMO_DATA=1` adds 60 read-only demo reports around Mexico City, handy when your database is empty. It only applies to development builds.

### A database to work against

- **Local stack (recommended)**: `supabase start` from the repo root applies every migration and `supabase/seed.sql`. The seed's demo accounts have published passwords, so it is for local use only.
- **Your own hosted project**: `supabase link --project-ref <ref>` and `supabase db push`. See the README for granting yourself the moderator role.

Please don't point development builds at someone else's project, and never write test data to a shared production database.

## Workflow

1. Branch from `main`.
2. Make the change inside the architecture: contract in `src/domain`, adapter in `src/infrastructure`, wiring in `src/composition`, hooks in `src/hooks`, UI in `src/features` ([how to add a data feature](docs/architecture.md#adding-a-data-feature)).
3. Add tests for the behavior, including the failure paths.
4. Run the checks below. They're what CI runs.
5. Open a pull request and fill in the template.

### Checks

From `apps/mobile`:

```bash
npm run lint        # includes the layer boundaries
npm run typecheck
npm test
```

From the repo root:

```bash
./scripts/check-leaks.sh
supabase db start && supabase test db   # the database tests, needs Docker
```

Without Docker, `cd tools/db-check && npm run check` runs the migrations and pgTAP tests on PGlite. It's a fast approximation: CI's run on the real stack is the one that counts.

### End-to-end tests

Smoke flows for [Maestro](https://maestro.mobile.dev) live in `apps/mobile/e2e`. They are read-only, so they're safe against any backend. See [apps/mobile/e2e/README.md](apps/mobile/e2e/README.md).

## Conventions

- **Layers**: ESLint's `import/no-restricted-paths` enforces them. Don't disable the rule; move the code instead.
- **Tests**: no `jest.mock`. Use the in-memory fakes in `src/test-utils` and inject clients into adapters.
- **Dependencies**: `npx expo install <package>`, not `npm install`, so versions match the SDK. Justify new ones in the PR.
- **Generated code**: `src/types/database.types.ts` is generated (`supabase gen types typescript`); don't edit it by hand.
- **User-facing copy**: plain English for now; i18n comes later. Error messages stay generic: no SQL, stack traces or internal ids.
- **Commits**: imperative subject under ~72 characters ("Add sightings to the report page"), a body that explains why.

## Database changes

- One migration per change in `supabase/migrations/`, with a header comment explaining the non-obvious choices.
- Every new table needs RLS, explicit grants and a pgTAP test proving unauthorized access is rejected (anon, another user, owner, moderator). `00_security_guards.test.sql` fails CI otherwise.
- Tests must not depend on `seed.sql`: scope every count to the test's own fixture ids.
- Migrations must be safe for existing rows and for app builds already installed.
- Run the Supabase security advisors after applying a migration; new warnings are regressions unless [docs/security.md](docs/security.md#accepted-advisor-findings) accepts them.
