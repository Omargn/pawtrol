import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { createAppleIdentityProvider } from "@/infrastructure/identity/appleIdentityProvider";
import { createGoogleIdentityProvider } from "@/infrastructure/identity/googleIdentityProvider";

// Supabase validates the ID token's audience against the web client ID, so
// both it and the iOS client ID must be configured even though only iOS
// signs in natively today.
GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

/** Production wiring: the one place where the sign-in contracts meet the real Apple and Google SDKs. */
export const identityProviders = {
  apple: createAppleIdentityProvider(AppleAuthentication),
  google: createGoogleIdentityProvider({ GoogleSignin, isErrorWithCode, statusCodes }),
};
