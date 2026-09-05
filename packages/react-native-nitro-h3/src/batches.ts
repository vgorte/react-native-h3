import { toBuffer } from './buffers'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'
import type { CellBoundaries } from './types'

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

/**
 * Reads the boundaries of many cells at once, one native call for the whole set.
 *
 * Additive to the h3-js surface: this is {@linkcode cellToBoundary} over a typed array, laid out
 * for renderers that build meshes or paths from a flat buffer. Cell `i` starts at `i * stride` in
 * `vertices` and uses `vertexCounts[i]` pairs: `5` for a pentagon at an even resolution and `10` at
 * an odd one, `6` for a hexagon, `7` or `8` where one crosses an icosahedron edge. One cell weighs
 * `161` bytes here rather than the `8` of a cell set. An empty input returns empty arrays, with
 * `stride` still `20`.
 *
 * @param cells The cells.
 * @returns The stride, the `[lat, lng]` pairs in degrees padded to the stride with `NaN`, and the
 * vertex count of each cell.
 * @throws {@linkcode H3Error} if a cell is not valid (the message names its index, as in
 * `cells[1]: ...`), or the input would exceed a cell ceiling set with {@linkcode configure}.
 */
export function cellsToBoundaries(cells: BigUint64Array): CellBoundaries {
  try {
    const result = native.cellsToBoundaries(toBuffer(cells))
    return {
      stride: result.stride,
      vertices: new Float64Array(result.vertices),
      vertexCounts: new Uint8Array(result.vertexCounts),
    }
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
