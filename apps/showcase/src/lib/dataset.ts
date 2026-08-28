import { Image } from 'react-native'
import asset from '../../assets/points-de.bin'

/** Counts the coordinates in the bundled sample. */
export const POINT_COUNT = 100_000

let cached: Promise<Float64Array> | null = null

/**
 * Loads the bundled coordinate sample as interleaved `lat, lng` doubles.
 *
 * The bytes are little endian, which every simulator, emulator and phone this app runs on is.
 * The result is cached, so a screen may call this on every mount.
 */
export function loadPoints(): Promise<Float64Array> {
  cached ??= (async () => {
    const source = Image.resolveAssetSource(asset)
    if (!source) {
      throw new Error('Could not resolve points-de.bin as a bundled asset')
    }
    const response = await fetch(source.uri)
    const buffer = await response.arrayBuffer()
    const points = new Float64Array(buffer)
    if (points.length !== POINT_COUNT * 2) {
      throw new Error(`Expected ${POINT_COUNT * 2} doubles in points-de.bin, read ${points.length}`)
    }
    return points
  })()
  return cached
}
