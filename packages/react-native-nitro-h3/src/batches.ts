import { toBuffer } from './buffers'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Finds the cells containing many coordinates at once, one native call for the whole set.
 *
 * Additive to the h3-js surface: this is {@linkcode latLngToCell} over a typed array, for the hot
 * paths where per-call overhead dominates. The order is latitude first, unlike GeoJSON.
 *
 * @param coords Interleaved `[lat0, lng0, lat1, lng1, ...]` in degrees.
 * @param res Resolution, `0` to `15`.
 * @returns One cell per pair, in input order.
 * @throws {@linkcode H3Error} if the length of `coords` is odd, a pair is rejected (the message
 * names its index, and a batch-wide bad `res` reads `coords[0]`), or the result would exceed a
 * cell ceiling set with {@linkcode configure}. An empty input returns an empty result without
 * judging `res`.
 */
export function latLngsToCells(coords: Float64Array, res: number): BigUint64Array {
  try {
    return new BigUint64Array(native.latLngsToCells(toBuffer(coords), res))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Finds the centres of many cells at once, one native call for the whole set.
 *
 * Additive to the h3-js surface: this is {@linkcode cellToLatLng} over a typed array, sized for
 * circle layers, heatmaps and other renderers that consume flat coordinate buffers. The order is
 * latitude first, unlike GeoJSON.
 *
 * @param cells The cells.
 * @returns Interleaved `[lat0, lng0, lat1, lng1, ...]` in degrees, two entries per cell.
 * @throws {@linkcode H3Error} if a cell is not valid (the message names its index), or the input
 * would exceed a cell ceiling set with {@linkcode configure}.
 */
export function cellsToLatLngs(cells: BigUint64Array): Float64Array {
  try {
    return new Float64Array(native.cellsToLatLngs(toBuffer(cells)))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
