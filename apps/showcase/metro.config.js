const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')
const defaults = getDefaultConfig(__dirname)

/**
 * Extends the default configuration with the workspace root and the binary asset extension.
 *
 * @see https://reactnative.dev/docs/metro
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
  resolver: {
    // the coordinate sample is an asset, not a module
    assetExts: [...defaults.resolver.assetExts, 'bin'],
  },
}

module.exports = mergeConfig(defaults, config)
