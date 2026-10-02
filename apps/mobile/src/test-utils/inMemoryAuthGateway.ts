import type { AuthGateway, AuthSession, AuthUser } from "@/domain/auth/authGateway";
import { SIGN_UP_FAILED_MESSAGE } from "@/domain/auth/authGateway";

export function makeAuthSession(overrides: Partial<AuthUser> = {}): AuthSession {
  return {
    user: {
      id: "user-1",
      email: "a@b.com",
      createdAt: "2026-09-01T00:00:00Z",
      fullName: null,
      avatarUrl: null,
      ...overrides,
    },
  };
}

type Options = {
  /** email -> password */
  accounts?: Record<string, string>;
  session?: AuthSession | null;
  /**
   * Sign-ups succeed without a session, as when the project requires email confirmation — which
   * this one does. Every address then answers the same way, taken or not.
   */
  requireEmailConfirmation?: boolean;
  /** An ID token the provider's backend would refuse. */
  refusedIdToken?: string;
  /**
   * Like supabase-js (INITIAL_SESSION), tell each new listener the current session soon after it
   * subscribes, without waiting for a change. On by default; turn it off to test the listener alone.
   */
  emitInitialSession?: boolean;
};

/** An AuthGateway holding one session in memory; every change is announced to listeners, like the real one. */
export function createInMemoryAuthGateway({
  accounts = { "a@b.com": "pw" },
  session = null,
  requireEmailConfirmation = false,
  refusedIdToken,
  emitInitialSession = true,
}: Options = {}) {
  const accountBook = { ...accounts };
  const listeners = new Set<(session: AuthSession | null) => void>();
  let current = session;

  const setSession = (next: AuthSession | null) => {
    current = next;
    listeners.forEach((listener) => listener(next));
  };

  const gateway: AuthGateway = {
    async getSession() {
      return current;
    },

    onSessionChange(listener) {
      listeners.add(listener);
      // Asynchronous, reads the session as of delivery, and skipped if the listener already left, as in supabase-js.
      if (emitInitialSession) queueMicrotask(() => listeners.has(listener) && listener(current));
      return () => {
        listeners.delete(listener);
      };
    },

    async signInWithPassword(email, password) {
      if (accountBook[email] !== password) return { ok: false, message: "Invalid credentials" };
      setSession(makeAuthSession({ email }));
      return { ok: true };
    },

    async signUp({ fullName, email, password }) {
      // With Confirm email on, GoTrue answers a taken address exactly as it answers a new one — no
      // session, no error — so sign-up can't be used to find out which emails have accounts. That
      // decision comes before the account book on purpose: an unconfirmed sign-up records nothing,
      // because the real project answers "Email not confirmed" rather than letting it sign in.
      if (requireEmailConfirmation) return { ok: true, hasSession: false };
      // Same message the Supabase gateway gives: a taken email is not distinguishable from any other refusal.
      if (email in accountBook) return { ok: false, message: SIGN_UP_FAILED_MESSAGE };
      accountBook[email] = password;
      setSession(makeAuthSession({ email, fullName }));
      return { ok: true, hasSession: true };
    },

    async signInWithIdToken(provider, idToken) {
      if (idToken === refusedIdToken) throw new Error("Invalid ID token");
      setSession(makeAuthSession({ id: `${provider}-user`, email: null }));
    },

    async saveProfileName({ fullName }) {
      if (!current) throw new Error("Not signed in");
      setSession({ user: { ...current.user, fullName } });
    },

    async signOut() {
      setSession(null);
    },
  };

  return { gateway, currentSession: () => current, listenerCount: () => listeners.size };
}
