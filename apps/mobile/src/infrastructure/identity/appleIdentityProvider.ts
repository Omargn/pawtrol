import type { AppleAuthenticationCredential } from "expo-apple-authentication";
import type { ProfileName } from "@/domain/auth/authGateway";
import type { IdentityProvider } from "@/domain/auth/identityProvider";

type AppleSdk = Pick<typeof import("expo-apple-authentication"), "signInAsync" | "AppleAuthenticationScope">;

function toProfileName(fullName: AppleAuthenticationCredential["fullName"]): ProfileName | undefined {
  if (!fullName) return undefined;
  const parts = [fullName.givenName, fullName.middleName, fullName.familyName].filter((part): part is string =>
    Boolean(part),
  );
  if (parts.length === 0) return undefined;
  return { fullName: parts.join(" "), givenName: fullName.givenName, familyName: fullName.familyName };
}

export function createAppleIdentityProvider(sdk: AppleSdk): IdentityProvider {
  return {
    async requestCredential() {
      let credential: AppleAuthenticationCredential;
      try {
        credential = await sdk.signInAsync({
          requestedScopes: [sdk.AppleAuthenticationScope.FULL_NAME, sdk.AppleAuthenticationScope.EMAIL],
        });
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ERR_REQUEST_CANCELED") {
          return null;
        }
        throw error;
      }

      if (!credential.identityToken) {
        throw new Error("No identityToken returned from Apple.");
      }

      // Apple only returns the full name on the first authorization.
      const name = toProfileName(credential.fullName);
      return { provider: "apple", idToken: credential.identityToken, ...(name && { name }) };
    },
  };
}
