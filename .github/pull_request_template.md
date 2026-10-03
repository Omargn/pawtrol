## What and why

<!-- What changes for users or contributors, and why. Link the issue: "Closes #123". -->

## How it was verified

<!-- Commands run, and what you checked by hand (device, screens, data). Screenshots for UI changes. -->

## Checklist

See [ENGINEERING.md](../ENGINEERING.md) for the full bar.

- [ ] Lint, typecheck, tests and the leak guard pass
- [ ] Tests cover the new behavior, including failure paths
- [ ] Layers respected; no dead code or debug leftovers
- [ ] Client-facing errors stay generic

**Only if this touches the database**

- [ ] New tables have RLS, explicit grants and pgTAP tests for anon / other user / owner / moderator
- [ ] `security definer` functions follow docs/security.md
- [ ] Safe for existing rows and installed app builds
- [ ] Writes are atomic and safe to retry
- [ ] Ran the Supabase advisors; no new warnings
