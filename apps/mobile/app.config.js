/**
 * Extends app.json (which Expo passes in as `config`) with per-developer
 * overrides, read from the gitignored .env so nobody commits
 * their own identifiers (see .env.example):
 *
 * - LOCAL_IOS_BUNDLE_ID: two contributors building to their own Personal
 *   Team devices can't share one Apple App ID.
 * - GOOGLE_IOS_URL_SCHEME: the reversed iOS client ID Google Sign-In
 *   redirects to. The plugin refuses to build without it, so Google sign-in
 *   is only wired in when it's set.
 * - WITHOUT_APPLE_SIGN_IN=1: strips the Sign in with Apple entitlement, which
 *   free Apple accounts can't sign.
 * - GOOGLE_MAPS_ANDROID_API_KEY: Android maps render through Google Maps,
 *   which needs a key; iOS uses Apple Maps and needs none.
 */
module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? [])];

  if (process.env.GOOGLE_IOS_URL_SCHEME) {
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }]);
  }
  plugins.push(["react-native-maps", { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }]);
  if (process.env.WITHOUT_APPLE_SIGN_IN === "1") {
    plugins.push("./plugins/withoutAppleSignInEntitlement.js");
  }

  return {
    ...config,
    plugins,
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.LOCAL_IOS_BUNDLE_ID || config.ios?.bundleIdentifier,
    },
  };
};
