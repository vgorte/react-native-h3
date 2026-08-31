#!/bin/bash
# Builds the example app for the iOS simulator with dynamic and with static frameworks.
#
# Usage:
#   scripts/build-ios-variants.sh
#   scripts/build-ios-variants.sh static
#   scripts/build-ios-variants.sh dynamic
set -euo pipefail
# release-it hooks and IDE runners get no Homebrew profile; the directory is absent on Linux.
# Appended, never prepended: the runner image carries its own Ruby, and shadowing the one
# `ruby/setup-ruby` installed would hand `bundle` a lockfile its Bundler cannot read.
export PATH=$PATH:/opt/homebrew/bin

# no argument builds both, which is what the release runbook invokes; CI passes one per job
VARIANT="${1:-both}"
case "$VARIANT" in
  static | dynamic | both) ;;
  *) echo "Unsupported variant: ${VARIANT}. Use static, dynamic or no argument for both." >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS="${ROOT}/apps/example/ios"

# the restore at the end is a hard reset, so start from a clean tree
DIRTY="$(git -C "${ROOT}" status --porcelain apps/example/ios)"
if [ -n "${DIRTY}" ]; then
  echo "apps/example/ios has uncommitted changes, refusing to run:" >&2
  echo "${DIRTY}" >&2
  exit 1
fi

build_variant() {
  local label="$1"
  cd "${IOS}"
  # Bundler, not the system `pod`: `Gemfile.lock` pins the CocoaPods that wrote `Podfile.lock`
  # the Podfile keys off `ENV['USE_FRAMEWORKS'] != nil`, so dynamic means unset, not empty
  if [ "${label}" = static ]; then
    USE_FRAMEWORKS=static bundle exec pod install
  else
    unset USE_FRAMEWORKS
    bundle exec pod install
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

if [ "${VARIANT}" = both ]; then
  build_variant static
  build_variant dynamic
else
  build_variant "${VARIANT}"
fi

# the static pass rewrites both files and neither may reach a commit
cd "${ROOT}"
git checkout -- apps/example/ios/Podfile.lock apps/example/ios/H3Example.xcodeproj/project.pbxproj
LEFTOVER="$(git status --porcelain apps/example/ios)"
if [ -n "${LEFTOVER}" ]; then
  echo "apps/example/ios is not clean after the restore:" >&2
  echo "${LEFTOVER}" >&2
  exit 1
fi
