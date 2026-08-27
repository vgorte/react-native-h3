import type { UInt64 } from 'react-native-nitro-modules'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Reads the average area of a cell at a resolution, in square kilometres.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The average area in square kilometres.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getHexagonAreaAvgKm2(res: number): number {
  try {
    return native.getHexagonAreaAvgKm2(res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the average area of a cell at a resolution, in square metres.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The average area in square metres.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getHexagonAreaAvgM2(res: number): number {
  try {
    return native.getHexagonAreaAvgM2(res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the average edge length of a cell at a resolution, in kilometres.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The average edge length in kilometres.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getHexagonEdgeLengthAvgKm(res: number): number {
  try {
    return native.getHexagonEdgeLengthAvgKm(res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the average edge length of a cell at a resolution, in metres.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The average edge length in metres.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getHexagonEdgeLengthAvgM(res: number): number {
  try {
    return native.getHexagonEdgeLengthAvgM(res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Counts the cells at a resolution.
 *
 * The largest value, at resolution `15`, is `569707381193162`, which a JavaScript number represents
 * exactly, so this returns `number` rather than `bigint`.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The number of cells.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getNumCells(res: number): number {
  try {
    return native.getNumCells(res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Lists all `122` resolution `0` cells.
 *
 * These are the roots of the H3 hierarchy: every cell at every resolution descends from one of
 * them, and twelve of them are pentagons.
 *
 * @returns The `122` base cells.
 */
export function getRes0Cells(): BigUint64Array {
  try {
    return new BigUint64Array(native.getRes0Cells())
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Lists the twelve pentagons at a resolution.
 *
 * There are exactly twelve at every resolution. They are why cell sets are ragged: a disk or ring
 * touching one holds fewer cells than the formula suggests.
 *
 * @param res The resolution, `0` to `15`.
 * @returns The twelve pentagons.
 * @throws {@linkcode H3Error} if the resolution is out of range.
 */
export function getPentagons(res: number): BigUint64Array {
  try {
    return new BigUint64Array(native.getPentagons(res))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the icosahedron faces a cell intersects, as numbers from `0` to `19`.
 *
 * One or two for a hexagon, five for a pentagon. H3's `-1` padding is dropped, so every entry is a
 * real face and `0` among them means face zero.
 *
 * @param cell The cell.
 * @returns The faces the cell touches.
 * @throws {@linkcode H3Error} if the cell is not valid.
 */
export function getIcosahedronFaces(cell: bigint): number[] {
  try {
    return native.getIcosahedronFaces(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
