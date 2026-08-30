import { androidEmulator, androidPlatform } from '@react-native-harness/platform-android'
import { applePlatform, appleSimulator } from '@react-native-harness/platform-apple'

// `H3_SANITIZER` is set by `harness-android.yml` and by `scripts/device-ios.sh`; unset locally.
const SANITIZED = (process.env.H3_SANITIZER ?? '') !== ''
const TIMEOUT_SCALE = SANITIZED ? 4 : 1

const config = {
  entryPoint: './index.js',
  // Must match the name `index.js` registers, which comes from `app.json`.
  appRegistryComponentName: 'H3Example',
  // A sanitised build boots and runs several times slower, so every timeout scales with it.
  bridgeTimeout: 60000 * TIMEOUT_SCALE,
  testTimeout: 5000 * TIMEOUT_SCALE,
  bundleStartTimeout: 60000 * TIMEOUT_SCALE,
  platformReadyTimeout: 300000 * TIMEOUT_SCALE,
  // Harness polls `adb shell pidof` once a second and reads a missing pid as a dead app, which a
  // slow sanitised start turns into false crashes; a sanitizer report reaches the device log anyway.
  detectNativeCrashes: !SANITIZED,
  runners: [
    applePlatform({
      name: 'ios',
      // Device name and runtime version as `xcrun simctl list` reports them.
      device: appleSimulator('iPhone 17 Pro', '26.5'),
      // The Xcode template derives this from `PRODUCT_NAME`.
      bundleId: 'org.reactjs.native.example.H3Example',
    }),
    androidPlatform({
      name: 'android',
      // AVD name as `emulator -list-avds` reports it. The second argument is what
      // `callstackincubator/react-native-harness` requires so a CI runner can create the AVD;
      // it is ignored locally, where the harness reuses the AVD that already exists.
      device: androidEmulator('afterglow_pixel', {
        apiLevel: 36,
        profile: 'pixel_7',
        // what the `pixel_7` profile itself asks for; a smaller value here is ignored, because
        // `avdmanager` has already written the profile's size into `config.ini`
        diskSize: '6G',
        heapSize: '228M',
      }),
      bundleId: 'com.h3example',
    }),
  ],
}

export default config
