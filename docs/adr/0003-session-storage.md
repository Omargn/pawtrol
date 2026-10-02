# 0003 — Session in SecureStore, chunked

**Status:** Accepted

## Context

supabase-js persists the session (access and refresh tokens) through a storage adapter. AsyncStorage is unencrypted, so a refresh token there is readable from a device backup or a rooted device. SecureStore uses the iOS Keychain and Android Keystore but warns above 2048 bytes per value, and a session with provider metadata is typically 3–4 KB.

Options considered:

1. **AsyncStorage** — simplest; tokens stored in plain text. Rejected.
2. **Encrypt into AsyncStorage** with an AES key held in SecureStore (Supabase's documented `LargeSecureStore`). Adds `aes-js` and a random-values polyfill, and our own crypto code to review.
3. **Split the value across several SecureStore entries.** No new dependencies; everything stays in the keychain.

## Decision

Option 3: `createChunkedSecureStorage` in `src/infrastructure/storage`, 500 characters per entry (under 2048 bytes even at 4 bytes per character). The chunk count is written last and removed first, so a write interrupted by the app being killed reads as "signed out" rather than a token stitched from two versions.

Web keeps `localStorage`, guarded for the static render pass.

## Consequences

- No new dependencies; covered by unit tests with a fake store.
- An interrupted write signs the user out (rare; acceptable).
- A session is ~8 keychain reads at startup, which is negligible next to the network refresh.
- Revisit if SecureStore's limit changes or sessions grow much larger.
