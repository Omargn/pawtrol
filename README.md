# Pawtrol

Lost and found pets on a map. Post a pet you lost or found, see reports near you, add a sighting ("I saw this dog here at 6 pm"), and message the owner without either side sharing a phone number or an email.

> **Status:** early development (Phase 0 — skeleton). Nothing user-facing works yet; see the [roadmap](#roadmap).

## Why it's built the way it is

- **The database is the security boundary.** The app talks to Postgres directly through Supabase, so Row Level Security, not client code, decides who reads and writes what. Every policy is tested with pgTAP. → [docs/security.md](docs/security.md)
- **Privacy by default.** Contact happens only through in-app chat. Public maps show a report's location rounded to about 100 m (the "last seen" spot is often someone's home). Photos are re-encoded on the device to strip EXIF GPS before upload.
- **Contracts and adapters.** Screens and hooks depend on small per-feature contracts; Supabase and the native SDKs sit behind them, so tests run against in-memory fakes with no module mocks. → [docs/architecture.md](docs/architecture.md)

## Stack

Expo (SDK 58) · Expo Router · React Native · TypeScript · TanStack Query · Supabase (Postgres + PostGIS, Auth, Storage, Realtime) · Jest · pgTAP · GitHub Actions

## Repository layout

| Path | What it is |
|---|---|
| `apps/mobile` | The Expo app (iOS, Android) |
| `supabase` | Migrations, pgTAP tests, seed data, local config |
| `docs` | Architecture, security model, ADRs |
| `scripts` | Repo tooling |

There is no workspace tooling: `cd apps/mobile` before running npm or Expo commands.

## Getting started

Requirements: Node 22+, Xcode (iOS) or Android Studio, a Supabase project.

```bash
cd apps/mobile
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
npx expo run:ios       # a development build; Expo Go lacks the native modules
```

Checks (the same ones CI runs):

```bash
npm run lint && npm run typecheck && npm test
```

Database tests run in CI (`supabase db start && supabase test db`). Locally they need Docker.

## Roadmap

- [x] **Phase 0** — skeleton, layered architecture with lint-enforced boundaries, auth layer, CI
- [ ] **Phase 1** — schema, RLS, RPCs and pgTAP tests
- [ ] **Phase 2** — map with clustering and report details
- [ ] **Phase 3** — posting a report with photos
- [ ] **Phase 4** — sightings
- [ ] **Phase 5** — in-app chat
- [ ] **Phase 6** — moderation, "reunited", expiry
- [ ] **Phase 7** — contributor docs and E2E tests

Later: push alerts for nearby lost pets, offline posting, automatic lost↔found matching.

## License

[MIT](LICENSE)
