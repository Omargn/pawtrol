import { useCallback } from "react";
import { Alert } from "react-native";
import type { AuthGateway, ProfileName } from "@/domain/auth/authGateway";
import type { IdentityProvider } from "@/domain/auth/identityProvider";

type AuthDependencies = {
  gateway: AuthGateway;
  providers: { apple: IdentityProvider; google: IdentityProvider };
};

export function createAuthHooks({ gateway, providers }: AuthDependencies) {
  /**
   * Whether the user ended up signed in. Cancelling the provider's own sheet is neither a sign-in
   * nor a failure, so it answers false without alerting: the caller leaves the login step open
   * instead of closing it out from under someone who only backed out of Apple's or Google's sheet.
   */
  async function signInWith(provider: IdentityProvider) {
    const credential = await provider.requestCredential();
    if (!credential) return false;
    await gateway.signInWithIdToken(credential.provider, credential.idToken);
    if (credential.name) await saveProfileName(credential.name);
    return true;
  }

  /** The user is already signed in by now, so a name that can't be saved is logged, not reported as a failed sign-in. */
  async function saveProfileName(name: ProfileName) {
    try {
      await gateway.saveProfileName(name);
    } catch (error) {
      console.error("Saving profile name failed:", error);
    }
  }

  function useAuth() {
    const signInWithApple = useCallback(async () => {
      try {
        return await signInWith(providers.apple);
      } catch (error) {
        console.error("Apple sign-in error:", error);
        Alert.alert("Sign in with Apple failed", "Please try again.");
        return false;
      }
    }, []);

    const signInWithGoogle = useCallback(async () => {
      try {
        return await signInWith(providers.google);
      } catch (error) {
        console.error("Google sign-in error:", error);
        Alert.alert("Sign in with Google failed", "Please try again.");
        return false;
      }
    }, []);

    const signInWithEmail = useCallback(async (email: string, password: string) => {
      const outcome = await gateway.signInWithPassword(email, password);
      if (!outcome.ok) {
        Alert.alert("Login failed", outcome.message);
        return false;
      }
      return true;
    }, []);

    const signUpWithEmail = useCallback(async (fullName: string, email: string, password: string) => {
      const outcome = await gateway.signUp({ fullName, email, password });
      if (!outcome.ok) {
        Alert.alert("Sign up failed", outcome.message);
        return { ok: false as const };
      }
      if (!outcome.hasSession) {
        Alert.alert("Check your email", "We sent you a confirmation link to finish creating your account.");
        return { ok: true as const, needsConfirmation: true };
      }
      return { ok: true as const, needsConfirmation: false };
    }, []);

    const signOut = useCallback(() => gateway.signOut(), []);

    return { signInWithApple, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut };
  }

  return { useAuth };
}
