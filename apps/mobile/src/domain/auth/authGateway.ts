/** The signed-in user as the app sees them; provider quirks (avatar_url vs picture) are already resolved. */
export type AuthUser = {
  id: string;
  email: string | null;
  createdAt: string;
  fullName: string | null;
  avatarUrl: string | null;
};

/** Deliberately carries no tokens: the app never needs them, only the gateway does. */
export type AuthSession = { user: AuthUser };

export type AuthOutcome = { ok: true } | { ok: false; message: string };

/** `hasSession` is false when the account must confirm its email before signing in. */
export type SignUpOutcome = { ok: true; hasSession: boolean } | { ok: false; message: string };

/**
 * What a sign-up failure says when the reason isn't the user's to fix. Supabase answers "User
 * already registered", which tells anyone who asks whether an email has an account, so only the
 * errors the user can act on (a weak password, an invalid address) keep their own message.
 */
export const SIGN_UP_FAILED_MESSAGE = "We couldn't create that account. Check your details, or sign in if you already have one.";

export type ProfileName = { fullName: string; givenName: string | null; familyName: string | null };

/**
 * Who is signed in and how to change that. Email/password failures come back
 * as an outcome with a message safe to show; every other operation except
 * `signOut` rejects when it fails.
 */
export type AuthGateway = {
  getSession(): Promise<AuthSession | null>;
  /** Calls `listener` on every sign-in, sign-out and token refresh; the returned function stops listening. */
  onSessionChange(listener: (session: AuthSession | null) => void): () => void;
  signInWithPassword(email: string, password: string): Promise<AuthOutcome>;
  signUp(input: { fullName: string; email: string; password: string }): Promise<SignUpOutcome>;
  /** Exchanges an ID token issued by Apple or Google for a session. Rejects when the token is refused. */
  signInWithIdToken(provider: "apple" | "google", idToken: string): Promise<void>;
  /** Stores the name Apple only reports on first authorization. Rejects when it can't save it. */
  saveProfileName(name: ProfileName): Promise<void>;
  /**
   * Signs out of this device and resolves even when revoking the session on the server fails: the
   * local session is cleared regardless, and listeners hear about it through `onSessionChange`.
   */
  signOut(): Promise<void>;
};
