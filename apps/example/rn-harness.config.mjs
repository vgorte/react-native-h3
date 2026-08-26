import { androidEmulator, androidPlatform } from '@react-native-harness/platform-android'
import { applePlatform, appleSimulator } from '@react-native-harness/platform-apple'

const config = {
  entryPoint: './index.js',
  // Must match the name `index.js` registers, which comes from `app.json`.
  appRegistryComponentName: 'H3Example',
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
      // AVD name as `emulator -list-avds` reports it.
      device: androidEmulator('afterglow_pixel'),
      bundleId: 'com.h3example',
    }),
  ],
}

export default config
