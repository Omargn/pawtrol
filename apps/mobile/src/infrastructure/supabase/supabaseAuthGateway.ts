import type { AuthError, Session, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AuthGateway, AuthSession, SignUpOutcome } from "@/domain/auth/authGateway";
import { SIGN_UP_FAILED_MESSAGE } from "@/domain/auth/authGateway";

// user_metadata is untyped JSON the provider (or the client) filled in, so only trust non-blank strings.
const text = (value: unknown) => (typeof value === "string" && value.trim() !== "" ? value : null);

// Sign-up errors the user fixes by editing the form. Every other reason — above all "User already
// registered" — collapses into one message, so signing up can't be used to probe for accounts.
const ACTIONABLE_SIGN_UP_ERRORS = new Set(["weak_password", "validation_failed", "email_address_invalid"]);

function toSignUpFailure(error: AuthError): SignUpOutcome {
  const actionable = error.code !== undefined && ACTIONABLE_SIGN_UP_ERRORS.has(error.code);
  return { ok: false, message: actionable ? error.message : SIGN_UP_FAILED_MESSAGE };
}

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  const { user } = session;
  const metadata = user.user_metadata ?? {};
  return {
    user: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      fullName: text(metadata.full_name),
      avatarUrl: text(metadata.avatar_url) ?? text(metadata.picture),
    },
  };
}

export function createSupabaseAuthGateway(client: SupabaseClient<Database>): AuthGateway {
  return {
    async getSession() {
      const { data } = await client.auth.getSession();
      return toAuthSession(data.session);
    },

    onSessionChange(listener) {
      const { data } = client.auth.onAuthStateChange((_event, session) => listener(toAuthSession(session)));
      return () => data.subscription.unsubscribe();
    },

    async signInWithPassword(email, password) {
      const { error } = await client.auth.signInWithPassword({ email, password });
      return error ? { ok: false, message: error.message } : { ok: true };
    },

    async signUp({ fullName, email, password }) {
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
      return error ? toSignUpFailure(error) : { ok: true, hasSession: Boolean(data.session) };
    },

    async signInWithIdToken(provider, idToken) {
      const { error } = await client.auth.signInWithIdToken({ provider, token: idToken });
      if (error) throw error;
    },

    async saveProfileName({ fullName, givenName, familyName }) {
      const { error } = await client.auth.updateUser({
        data: { full_name: fullName, given_name: givenName, family_name: familyName },
      });
      if (error) throw error;
    },

    // supabase-js clears the local session and announces SIGNED_OUT even when revoking it
    // server-side fails (network, 5xx), so the user is signed out either way.
    async signOut() {
      const { error } = await client.auth.signOut();
      if (error) console.error("Server-side sign-out failed:", error);
    },
  };
}
