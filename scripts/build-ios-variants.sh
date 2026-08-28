#!/bin/bash
# Builds the example app for the iOS simulator with dynamic and with static frameworks.
#
# Usage:
#   scripts/build-ios-variants.sh
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="${ROOT}/apps/example/ios"

build_variant() {
  local label="$1"
  cd "${IOS}"
  # the Podfile keys off `ENV['USE_FRAMEWORKS'] != nil`, so dynamic means unset, not empty
  if [ "${label}" = static ]; then
    USE_FRAMEWORKS=static pod install
  else
    unset USE_FRAMEWORKS
    pod install
  fi
  xcodebuild \
    -workspace H3Example.xcworkspace \
    -scheme H3Example \
    -configuration Debug \
    -sdk iphonesimulator \
    -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "${IOS}/build/variants-${label}" \
    ARCHS=arm64 \
    CODE_SIGNING_ALLOWED=NO \
    build
  echo "BUILD_OK ${label}"
}

build_variant static
build_variant dynamic

# a static-frameworks lockfile must never be committed, and the static pass also leaves header
# search paths in the project file that the dynamic pass does not undo
cd "${ROOT}"
git checkout -- apps/example/ios/Podfile.lock apps/example/ios/H3Example.xcodeproj/project.pbxproj
git status --short apps/example/ios
