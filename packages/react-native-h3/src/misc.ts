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
