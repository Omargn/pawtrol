# Security policy

Pawtrol handles where people's pets were lost and, often, where they live. Reports of weaknesses are very welcome.

## Reporting a vulnerability

**Please don't open a public issue, pull request or discussion.**

Report it privately through GitHub: the repository's **Security** tab → **Report a vulnerability**. Only the maintainers can see the report.

Include what you can of:

- what an attacker can read or do that they shouldn't, and as which kind of user (signed out, signed in, moderator);
- the steps, request or SQL that shows it;
- the commit or app version you tested.

You'll get an answer within a week. Once it's fixed, the advisory is published and names you as the reporter, unless you'd rather stay anonymous.

## Scope

In scope, most of all:

- **Row Level Security and the RPCs**: reading or writing rows you shouldn't, acting as another user, getting around a rate limit.
- **Location privacy**: recovering a report's or sighting's exact point, which is only ever published rounded to ~100 m ([docs/data-model.md](docs/data-model.md#location-privacy)).
- **Photo privacy**: an upload that keeps its EXIF GPS position.
- **Contact details**: any way to learn another user's email.
- **Storage**: reading photos of content that is no longer public.

Out of scope:

- The publishable key being in the app bundle. It is public by design; RLS is the boundary ([docs/security.md](docs/security.md)).
- Findings that need a rooted or jailbroken device, or physical access to an unlocked one.
- Denial of service by volume, and reports from automated scanners without a demonstrated impact.

Please test only against your own Supabase project or a local stack (`supabase start`), never against other people's data, and don't run load tests against the hosted demo.

## Supported versions

Only the latest commit on `main` gets fixes. There are no released versions yet.
