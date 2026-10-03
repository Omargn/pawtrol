import * as AppleAuthentication from "expo-apple-authentication";
import { GoogleSignin, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { createAppleIdentityProvider } from "@/infrastructure/identity/appleIdentityProvider";
import { createGoogleIdentityProvider } from "@/infrastructure/identity/googleIdentityProvider";

// Each provider exists only once it's configured (see .env.example); null
// otherwise, so the sign-in screen hides it instead of offering a button that
// can only fail. Configuring Google without a client ID crashes natively, so
// it must not run at import time unconditionally.
const appleEnabled = process.env.EXPO_OS === "ios" && process.env.EXPO_PUBLIC_APPLE_SIGN_IN === "1";
const googleEnabled = process.env.EXPO_OS === "ios" && Boolean(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID);

if (googleEnabled) {
  // Supabase validates the ID token's audience against the web client ID, so
  // both it and the iOS client ID must be configured.
  GoogleSignin.configure({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
}

/** Production wiring: the one place where the sign-in contracts meet the real Apple and Google SDKs. */
export const identityProviders = {
  apple: appleEnabled ? createAppleIdentityProvider(AppleAuthentication) : null,
  google: googleEnabled ? createGoogleIdentityProvider({ GoogleSignin, isErrorWithCode, statusCodes }) : null,
};
