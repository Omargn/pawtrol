const { withEntitlementsPlist } = require("expo/config-plugins");

// expo-apple-authentication adds the Sign in with Apple entitlement on every
// prebuild. That capability needs a paid Apple Developer Program membership,
// so contributors on a free Personal Team set WITHOUT_APPLE_SIGN_IN=1 and this
// strips it back out (see app.config.js).
module.exports = function withoutAppleSignInEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults["com.apple.developer.applesignin"];
    return config;
  });
};
