#!/usr/bin/env bash

set -euo pipefail

app_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
device_name="${PERSIMMON_IOS_DEVICE:-yum phone}"
derived_data="${PERSIMMON_IOS_DERIVED_DATA:-$app_root/ios/build/release-device}"
development_team="${PERSIMMON_APPLE_TEAM_ID:-G7ZSY874L2}"
app_path="$derived_data/Build/Products/Release-iphoneos/Persimmon.app"

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
