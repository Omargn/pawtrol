import type { IdentityProvider } from "@/domain/auth/identityProvider";

type GoogleSdk = Pick<
  typeof import("@react-native-google-signin/google-signin"),
  "GoogleSignin" | "isErrorWithCode" | "statusCodes"
>;

export function createGoogleIdentityProvider(sdk: GoogleSdk): IdentityProvider {
  return {
    async requestCredential() {
      await sdk.GoogleSignin.hasPlayServices();

      let idToken: string | null;
      try {
        const response = await sdk.GoogleSignin.signIn();
        if (response.type !== "success") {
          return null;
        }
        idToken = response.data.idToken;
      } catch (error) {
        if (sdk.isErrorWithCode(error) && error.code === sdk.statusCodes.SIGN_IN_CANCELLED) {
          return null;
        }
        throw error;
      }

      if (!idToken) {
        throw new Error("No idToken returned from Google.");
      }

      return { provider: "google", idToken };
    },
  };
}
