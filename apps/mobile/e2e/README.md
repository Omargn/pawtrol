# End-to-end tests

Smoke flows for [Maestro](https://maestro.mobile.dev) that drive a development build in the iOS Simulator.

They are **read-only**: they browse as a signed-out guest and use the demo reports, so they never write to whichever Supabase project the build points at. Flows that post, add sightings or chat need a disposable backend (a local `supabase start`) and test accounts, and don't exist yet.

## Running them

Requirements: Java 17+ and the Maestro CLI (`brew install openjdk@17 mobile-dev-inc/tap/maestro`), a booted simulator with a development build installed (`npx expo run:ios`), and Metro running with demo data on port 8081:

```bash
EXPO_PUBLIC_DEMO_DATA=1 npx expo start --dev-client
```

Then, from `apps/mobile`:

```bash
npm run e2e
```

`launch.yaml` clears the app's data and keychain on every run, so **use a simulator you don't mind being signed out of**. If several simulators are booted, pick one with `maestro --device <UDID> test ...`.

Set `APP_ID` to your bundle identifier if you build with `LOCAL_IOS_BUNDLE_ID` (it defaults to `dev.pawtrol.app`).

## Writing flows

- Select by visible text or accessibility label, not coordinates, so flows survive layout changes. If an element has neither, give it an `accessibilityLabel` that also helps screen readers.
- Start each flow with `runFlow: ../subflows/launch.yaml` so it doesn't depend on the previous one.
- Keep flows read-only unless they run against a local stack.
