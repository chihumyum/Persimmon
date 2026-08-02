const GOOGLE_CLIENT_ID_PATTERN =
  /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i;
const DEFAULT_GOOGLE_IOS_CLIENT_ID =
  "51752452441-gueqiurk1lrkeamljiqntn28ed6n5gg7.apps.googleusercontent.com";
const DEFAULT_GOOGLE_ANDROID_CLIENT_ID =
  "51752452441-8q55ns0e3k8h47q9h5uqa3487rui5639.apps.googleusercontent.com";

function configuredClientId(value) {
  return (
    typeof value === "string" &&
    GOOGLE_CLIENT_ID_PATTERN.test(value) &&
    !value.includes("REPLACE")
  );
}

function reversedIosClientId(clientId) {
  return `com.googleusercontent.apps.${clientId.replace(
    /\.apps\.googleusercontent\.com$/i,
    "",
  )}`;
}

module.exports = ({ config }) => {
  const iosClientId =
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ??
    DEFAULT_GOOGLE_IOS_CLIENT_ID;
  const androidClientId =
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ??
    DEFAULT_GOOGLE_ANDROID_CLIENT_ID;
  const plugins = [
    ...(config.plugins ?? []),
    "./plugins/with-google-signin-modular-headers",
  ];

  if (configuredClientId(iosClientId)) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: reversedIosClientId(iosClientId) },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra ?? {}),
      googleDrive: {
        iosClientId,
        androidClientId,
      },
    },
  };
};
