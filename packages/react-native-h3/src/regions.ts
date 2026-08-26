import { toBuffer } from './buffers'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'
import type { LatLng } from './types'

/**
 * Finds the outline of a set of cells, as GeoJSON-shaped polygons.
 *
 * The result nests polygons, then loops, then points. The first loop of each polygon is its outer
 * ring and any further loops are holes; no loop repeats its first point at the end.
 *
 * @param cells The cells to outline. They must all be valid, unique and of the same resolution.
 * @returns One entry per disjoint outline.
 * @throws {@linkcode H3Error} if the set is invalid, mixes resolutions or contains duplicates.
 */
export function cellsToMultiPolygon(cells: BigUint64Array): LatLng[][][] {
  try {
    return native.cellsToMultiPolygon(toBuffer(cells))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
