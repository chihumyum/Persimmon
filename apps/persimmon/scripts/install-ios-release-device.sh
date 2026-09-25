#!/usr/bin/env bash

set -euo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device_name="${PERSIMMON_IOS_DEVICE:-yum phone}"
derived_data="${PERSIMMON_IOS_DERIVED_DATA:-$app_root/ios/build/release-device}"
development_team="${PERSIMMON_APPLE_TEAM_ID:-G7ZSY874L2}"
app_path="$derived_data/Build/Products/Release-iphoneos/Persimmon.app"

# Apply config plugins before building an existing generated project, including
# the scene lifecycle required by the iOS 27 SDK.
(
  cd "$app_root"
  CI=1 pnpm exec expo prebuild --platform ios --no-install --no-clean
)

# pnpm patch hashes are part of a native package's real path. Refresh the Pods
# project before building so it cannot keep compiling a superseded patched
# dependency after `pnpm install` changes that path.
(
  cd "$app_root/ios"
  pod install
)

NODE_ENV=production xcodebuild \
  -workspace "$app_root/ios/Persimmon.xcworkspace" \
  -scheme Persimmon \
  -configuration Release \
  -destination "platform=iOS,name=$device_name" \
  -derivedDataPath "$derived_data" \
  -allowProvisioningUpdates \
  DEVELOPMENT_TEAM="$development_team" \
  build

if [[ ! -d "$app_path" ]]; then
  echo "Release app not found at $app_path" >&2
  exit 1
fi

# devicectl installs without launching, so a locked phone does not turn a
# successful Release build/install into a false failure.
xcrun devicectl device install app --device "$device_name" "$app_path"
