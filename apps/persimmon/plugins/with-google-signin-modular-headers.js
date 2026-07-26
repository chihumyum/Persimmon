const { withPodfile } = require("expo/config-plugins");

const GENERATED_BLOCK = `  # @generated begin persimmon-google-signin-modular-headers
  # GoogleSignIn 9 pulls in the Swift AppCheckCore pod. Its Objective-C
  # dependencies need module maps when CocoaPods links them statically.
  pod 'GoogleUtilities', :modular_headers => true
  pod 'RecaptchaInterop', :modular_headers => true
  # @generated end persimmon-google-signin-modular-headers`;

module.exports = function withGoogleSigninModularHeaders(config) {
  return withPodfile(config, (podfileConfig) => {
    const podfile = podfileConfig.modResults.contents;
    if (podfile.includes(GENERATED_BLOCK)) {
      return podfileConfig;
    }

    const targetAnchor = "  use_expo_modules!";
    if (!podfile.includes(targetAnchor)) {
      throw new Error(
        "Unable to add Google Sign-In modular headers: Expo Podfile target anchor was not found.",
      );
    }

    podfileConfig.modResults.contents = podfile.replace(
      targetAnchor,
      `${targetAnchor}\n\n${GENERATED_BLOCK}`,
    );
    return podfileConfig;
  });
};
