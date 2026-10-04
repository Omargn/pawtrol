<div align="center">

# 🐾 Pawtrol

**Lost and found pets on a map.**

Post a pet you lost or found, see reports near you, add a sighting, and message the owner without either side sharing a phone number or an email.

[![CI](https://github.com/Omargn/pawtrol/actions/workflows/ci.yml/badge.svg)](https://github.com/Omargn/pawtrol/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Expo SDK 58](https://img.shields.io/badge/Expo-SDK%2058-000020?logo=expo&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey)

[Features](#features) · [Getting started](#getting-started) · [Architecture](docs/architecture.md) · [Roadmap](#roadmap) · [Contributing](#contributing)

</div>

<!--
Screenshots: drop PNGs in docs/images/ and uncomment.
<p align="center">
  <img src="docs/images/map.png" width="240" alt="Map of nearby reports" />
  <img src="docs/images/report.png" width="240" alt="Report details with sightings" />
  <img src="docs/images/chat.png" width="240" alt="In-app chat" />
</p>
-->

> **Status:** the MVP is feature-complete. Not yet released to the stores. See the [roadmap](#roadmap).

## Features

| | |
|---|---|
| 🗺️ **Map and list** | Nearby lost and found reports with clustering and filters |
| 📸 **Post with photos** | Report a lost or found pet in a few taps |
| 👀 **Sightings** | "I saw this dog here at 6 pm", pinned on the report |
| 💬 **In-app chat** | Reach the owner without sharing a phone number or email |
| 🎉 **Reunited and renew** | Close your report when the pet is home, or keep it alive |
| 🛡️ **Moderation** | Flagging and a moderator queue with undo |

## Why it's built the way it is

- **The database is the security boundary.** The app talks to Postgres directly through Supabase, so Row Level Security, not client code, decides who reads and writes what. Every policy is tested with pgTAP. → [docs/security.md](docs/security.md), [docs/data-model.md](docs/data-model.md)
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
| `scripts`, `tools` | Repo tooling; `tools/db-check` runs the database tests without Docker |

There is no workspace tooling: `cd apps/mobile` before running npm or Expo commands.

## Getting started

Requirements: Node 22+, Xcode (iOS) or Android Studio, a Supabase project.

```bash
cd apps/mobile
npm install
cp .env.example .env   # then fill in your Supabase URL and publishable key
                       # EXPO_PUBLIC_DEMO_DATA=1 adds demo reports in Mexico City
npx expo run:ios       # a development build; Expo Go lacks the native modules
```

Checks (the same ones CI runs):

```bash
npm run lint && npm run typecheck && npm test
```

End-to-end smoke tests run locally with [Maestro](https://maestro.mobile.dev): `npm run e2e` ([how](apps/mobile/e2e/README.md)).

Database tests run in CI on the real Supabase stack (`supabase db start && supabase test db`). Without Docker, `tools/db-check` runs them on PGlite as a fast approximation.

### Your own Supabase project

Apply the schema with `supabase link --project-ref <ref>` and `supabase db push`, or connect the repo through Supabase's GitHub integration with "Deploy to production" so every push to `main` applies new migrations. The integration only deploys pushes made after it was connected. `seed.sql` is for local and preview databases only: its demo accounts have published passwords.

Then:

```bash
supabase db advisors --linked                                          # security and performance checks
supabase gen types typescript --linked > apps/mobile/src/types/database.types.ts
```

Moderators are granted per environment in the SQL editor, never through a migration:

```sql
insert into private.user_roles (user_id, role)
select id, 'moderator' from auth.users where email = 'you@example.com';
```

## Roadmap

- [x] **Phase 0** — skeleton, layered architecture with lint-enforced boundaries, auth layer, CI
- [x] **Phase 1** — schema, RLS, RPCs and pgTAP tests
- [x] **Phase 2** — map with clustering, list, filters and report details
- [x] **Phase 3** — posting a report with photos, sign-in
- [x] **Phase 4** — sightings
- [x] **Phase 5** — in-app chat
- [x] **Phase 6** — moderation, "reunited", expiry
- [x] **Phase 7** — contributor docs and E2E tests

Later: push alerts for nearby lost pets, offline posting, automatic lost↔found matching.

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); security problems go through [SECURITY.md](SECURITY.md), never a public issue. Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
