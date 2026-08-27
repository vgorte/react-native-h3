import { toBuffer } from './buffers'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'
import type { ContainmentModeValue, LatLng, Ring } from './types'

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

/**
 * Finds every cell whose centre falls inside a polygon.
 *
 * The polygon is GeoJSON-shaped: the first ring is the outer boundary, any further rings are holes,
 * and each point is a `[latitude, longitude]` pair in degrees. Note the order, which GeoJSON itself
 * reverses; a ring is not closed, so its first point is not repeated at the end.
 *
 * @param rings The outer ring first, then holes. An empty polygon yields no cells.
 * @param res The resolution, `0` to `15`.
 * @returns The cells covering the polygon, as a view onto the native buffer.
 * @throws {@linkcode H3Error} if a point is not a finite `[latitude, longitude]` pair, the
 * resolution is out of range, or the result would exceed this binding's limit of `4,000,000` cells.
 */
export function polygonToCells(rings: Ring[], res: number): BigUint64Array {
  try {
    return new BigUint64Array(native.polygonToCells(rings, res))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Finds the cells covering a polygon as {@linkcode polygonToCells} does, with a choice of
 * containment rule.
 *
 * `h3-js` names the mode with a string; here it is a number, so use the {@linkcode ContainmentMode}
 * constants rather than writing the literal. This is an experimental H3 API and may change
 * behaviour in a minor version of the underlying C library.
 *
 * @param rings The outer ring first, then holes, as `[latitude, longitude]` degrees.
 * @param res The resolution, `0` to `15`.
 * @param flags One of `ContainmentMode.center`, `.full`, `.overlapping` or `.overlappingBbox`.
 * @returns The cells covering the polygon, as a view onto the native buffer.
 * @throws {@linkcode H3Error} if the polygon, the resolution or the mode is invalid, or the result
 * would exceed this binding's limit of `4,000,000` cells.
 */
export function polygonToCellsExperimental(
  rings: Ring[],
  res: number,
  flags: ContainmentModeValue,
): BigUint64Array {
  try {
    return new BigUint64Array(native.polygonToCellsExperimental(rings, res, flags))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
