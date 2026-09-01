#!/bin/bash
# Builds the example app in Release for a physical device and installs it there.
#
# Usage:
#   H3_IOS_TEAM_ID=ABCDE12345 scripts/build-device-release.sh ios <device-udid>
#   scripts/build-device-release.sh android <serial>
set -euo pipefail
# release-it hooks and IDE runners get no Homebrew profile; the directory is absent on Linux.
# Appended, never prepended: the runner image carries its own Ruby, and shadowing the one
# `ruby/setup-ruby` installed would hand `bundle` a lockfile its Bundler cannot read.
export PATH=$PATH:/opt/homebrew/bin

PLATFORM="${1:-}"
DEVICE="${2:-}"
case "$PLATFORM" in
  ios | android) ;;
  *) echo "Unsupported platform: '${PLATFORM}'. Use ios or android." >&2; exit 1 ;;
esac
if [ -z "${DEVICE}" ]; then
  echo "Missing device. Pass an iOS device UDID or an adb serial as the second argument." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXAMPLE="${ROOT}/apps/example"

IOS_BUNDLE_ID='org.reactjs.native.example.H3Example'
ANDROID_PACKAGE='com.h3example'

build_ios() {
  if [ -z "${H3_IOS_TEAM_ID:-}" ]; then
    echo "H3_IOS_TEAM_ID is unset. Export the Apple Developer team id that signs device builds." >&2
    exit 1
  fi

  cd "${EXAMPLE}/ios"
  # Bundler, not the system `pod`: `Gemfile.lock` pins the CocoaPods that wrote `Podfile.lock`.
  # Runs every time: it also rewrites the machine-local `REACT_NATIVE_PATH` in the project file,
  # and a stale one fails the bundle phase.
  bundle exec pod install

  local build_folder="${EXAMPLE}/ios/build/device-release"
  # Signing settings stay on the command line: the stock template carries no `DEVELOPMENT_TEAM`
  # and the tracked project file must come out of a device build unchanged.
  xcodebuild \
    -workspace H3Example.xcworkspace \
    -scheme H3Example \
    -configuration Release \
    -destination "id=${DEVICE}" \
    -derivedDataPath "${build_folder}" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="${H3_IOS_TEAM_ID}" \
    CODE_SIGN_STYLE=Automatic \
    build

  local app="${build_folder}/Build/Products/Release-iphoneos/H3Example.app"
  if [ ! -d "${app}" ]; then
    echo "No app bundle at ${app}" >&2
    exit 1
  fi
  # `devicectl` resolves the UDID itself, no separate identifier lookup
  xcrun devicectl device install app --device "${DEVICE}" "${app}"
  echo "Installed ${IOS_BUNDLE_ID} on ${DEVICE}"
}

build_android() {
  cd "${EXAMPLE}/android"
  ./gradlew assembleRelease

  # the template signs Release with the checked-in debug keystore, which a benchmark run accepts
  local apk="${EXAMPLE}/android/app/build/outputs/apk/release/app-release.apk"
  if [ ! -f "${apk}" ]; then
    echo "No APK at ${apk}. Built instead:" >&2
    ls -1 "${EXAMPLE}/android/app/build/outputs/apk/release" >&2 || true
    exit 1
  fi
  adb -s "${DEVICE}" install -r "${apk}"
  echo "Installed ${ANDROID_PACKAGE} on ${DEVICE}"
}

if [ "${PLATFORM}" = ios ]; then
  build_ios
else
  build_android
fi
