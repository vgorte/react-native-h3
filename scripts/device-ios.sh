#!/bin/bash
# Builds the example app for the iOS simulator under a sanitizer and runs the harness suite.
#
# Usage:
#   scripts/device-ios.sh default
#   scripts/device-ios.sh asan
#   scripts/device-ios.sh tsan
set -euo pipefail
export PATH=/opt/homebrew/bin:$PATH

FLAVOR="${1:-default}"

# Build settings, not the `-enableAddressSanitizer` / `-enableThreadSanitizer` action flags:
# those belong to a scheme action, and `xcodebuild build` silently ignores the thread one.
# They reach xcodebuild through the CLI's `--extra-params`.
case "$FLAVOR" in
  default) EXTRA_PARAMS='';                              SANITIZER='' ;;
  asan)    EXTRA_PARAMS='ENABLE_ADDRESS_SANITIZER=YES';  SANITIZER='address' ;;
  tsan)    EXTRA_PARAMS='ENABLE_THREAD_SANITIZER=YES';   SANITIZER='thread' ;;
  *) echo "Unsupported flavor: ${FLAVOR}. Use default, asan or tsan." >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="${ROOT}/apps/example"
SIMULATOR='iPhone 17 Pro'

# `H3_SANITIZER` scales the four timeouts in `rn-harness.config.mjs`
export H3_SANITIZER="${SANITIZER}"

cd "${EXAMPLE}"

# one derived-data tree per flavor, so a sanitised build never reuses a plain one
BUILD_FOLDER="${EXAMPLE}/ios/build/${FLAVOR}"
APP_PATH="${BUILD_FOLDER}/Build/Products/Debug-iphonesimulator/H3Example.app"

if [ -n "${EXTRA_PARAMS}" ]; then
  bunx react-native build-ios --mode Debug \
    --buildFolder "${BUILD_FOLDER}" --extra-params "${EXTRA_PARAMS}"
else
  bunx react-native build-ios --mode Debug --buildFolder "${BUILD_FOLDER}"
fi

# `run-ios` cannot install this build: it resolves the app from `xcodebuild -showBuildSettings`,
# which never sees `-derivedDataPath` (`runCommand/getBuildSettings.js:30`), so it would install
# whatever sits in the shared derived-data tree. `simctl` installs exactly what was just built.
xcrun simctl bootstatus "${SIMULATOR}" -b
xcrun simctl install "${SIMULATOR}" "${APP_PATH}"

bun run test:ios
