import { useEffect, useRef, useState } from "react";
import type { AuthGateway, AuthSession, AuthUser } from "@/domain/auth/authGateway";

/** Reading who is signed in is all this needs; taking the whole gateway would suggest it can also change that. */
type SessionSource = Pick<AuthGateway, "getSession" | "onSessionChange">;

// Every AuthUser field, so adding one to the type breaks the build here instead of
// silently leaving consumers on a stale value.
const COMPARED_FIELDS: Record<keyof AuthUser, true> = {
  id: true,
  email: true,
  createdAt: true,
  fullName: true,
  avatarUrl: true,
};

/**
 * Whether two sessions describe the same signed-in user. supabase-js refreshes the access token
 * roughly hourly while the app is open, and every refresh hands the gateway a fresh Session that
 * becomes a fresh AuthSession — same fields, new reference. Field by field rather than a deep
 * compare because AuthUser is flat values and AuthSession holds nothing else.
 */
function isSameSession(a: AuthSession | null, b: AuthSession | null) {
  if (a === b) return true;
  if (!a || !b) return false; // null -> session and session -> null are real changes.
  return (Object.keys(COMPARED_FIELDS) as (keyof AuthUser)[]).every((key) => a.user[key] === b.user[key]);
}

export function createAuthSessionHooks(gateway: SessionSource) {
  /**
   * Every consumer subscribes on its own and reads the stored session once. Two components use this
   * today, so N listeners is cheaper than the machinery to share one. Past four or five, replace the
   * body with a single subscription feeding a React Query entry (`["auth", "session"]`), so mounting
   * a consumer costs a cache read instead of another listener and another storage round-trip.
   *
   * An equivalent session keeps the reference it already has, so a token refresh — which the gateway
   * reports like any other change — doesn't re-render consumers over fields that didn't move.
   */
  function useSession() {
    const [session, setSession] = useState<AuthSession | null>(null);
    const [loading, setLoading] = useState(true);
    // What was last handed to setSession. Comparing here rather than inside the updater skips the
    // state call entirely: React re-renders the component once even when an update is a no-op.
    const delivered = useRef<AuthSession | null>(null);

    useEffect(() => {
      let sawChange = false;

      const deliver = (next: AuthSession | null) => {
        if (isSameSession(delivered.current, next)) return;
        delivered.current = next;
        setSession(next);
      };

      gateway
        .getSession()
        .then((stored) => {
          // A change that arrived while this was in flight is newer than what it returns.
          if (!sawChange) deliver(stored);
        })
        .catch((error) => {
          console.error("Loading the session failed:", error);
        })
        .finally(() => setLoading(false));

      return gateway.onSessionChange((next) => {
        sawChange = true;
        deliver(next);
      });
    }, []);

    return { session, loading };
  }

  return { useSession };
}
