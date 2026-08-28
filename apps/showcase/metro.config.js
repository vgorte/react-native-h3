const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const path = require('node:path')

const root = path.resolve(__dirname, '..', '..')

/**
 * Extends the default configuration so Metro also watches the workspace root.
 *
 * @see https://reactnative.dev/docs/metro
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],
}

module.exports = mergeConfig(getDefaultConfig(__dirname), config)
