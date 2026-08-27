import type { UInt64 } from 'react-native-nitro-modules'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Reports whether the index is a valid cell.
 *
 * @param cell The index to check.
 * @returns `true` for a well-formed cell of any resolution.
 */
export function isValidCell(cell: bigint): boolean {
  try {
    return native.isValidCell(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reports whether the index is valid as anything: a cell, a directed edge or a vertex.
 *
 * @param index The index to check.
 * @returns `true` if any of the three modes accepts it.
 */
export function isValidIndex(index: bigint): boolean {
  try {
    return native.isValidIndex(index as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reports whether the index is a valid directed edge.
 *
 * @param edge The index to check.
 * @returns `true` for a well-formed directed edge.
 */
export function isValidDirectedEdge(edge: bigint): boolean {
  try {
    return native.isValidDirectedEdge(edge as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reports whether the index is a valid vertex.
 *
 * @param vertex The index to check.
 * @returns `true` for a well-formed vertex.
 */
export function isValidVertex(vertex: bigint): boolean {
  try {
    return native.isValidVertex(vertex as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reports whether the cell is one of the twelve pentagons at its resolution.
 *
 * @param cell The cell.
 * @returns `true` for a pentagon.
 */
export function isPentagon(cell: bigint): boolean {
  try {
    return native.isPentagon(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reports whether the cell's resolution uses Class III orientation.
 *
 * @param cell The cell.
 * @returns `true` for the odd resolutions, which are rotated against their parents.
 */
export function isResClassIII(cell: bigint): boolean {
  try {
    return native.isResClassIII(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the resolution of a cell, `0` to `15`.
 *
 * Answers `-1` for anything that is not a valid cell, as h3-js does. That guard is
 * {@linkcode isValidCell} alone, so a valid directed edge and a valid vertex answer `-1` as well.
 *
 * @param index The index to read.
 * @returns The resolution, or `-1` if `index` is not a valid cell.
 */
export function getResolution(index: bigint): number {
  try {
    return native.getResolution(index as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the base cell number, `0` to `121`.
 *
 * Works on directed edges too, where it answers the base cell of the origin. Unlike
 * {@linkcode getResolution}, it does not validate its argument, so an invalid index yields an
 * arbitrary number rather than a sentinel.
 *
 * @param cell A cell or a directed edge.
 * @returns The base cell number.
 */
export function getBaseCellNumber(cell: bigint): number {
  try {
    return native.getBaseCellNumber(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reads the indexing digit at the given position.
 *
 * Digits are 1-indexed: digit `1` is the child digit for resolution `1`. Resolution `0` has no
 * digit, because it is given by the base cell number.
 *
 * @param cell The cell.
 * @param digit Which digit to read, `1` to `15`.
 * @returns The digit, `0` to `6`, or `7` for a position beyond the cell's resolution.
 * @throws {@linkcode H3Error} if the cell is not valid, or `digit` is outside `1` to `15`.
 */
export function getIndexDigit(cell: bigint, digit: number): number {
  try {
    return native.getIndexDigit(cell as UInt64, digit)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Builds a cell from a base cell number and its child digits.
 *
 * The argument order follows h3-js rather than the C library, whose order is
 * `(res, baseCellNumber, digits)`. Putting the array between the two numbers means a transposition
 * is a type error rather than a runtime surprise.
 *
 * @param baseCellNumber The base cell, `0` to `121`.
 * @param digits Exactly `res` child digits, each `0` to `6`. Empty for resolution `0`.
 * @param res The resolution, `0` to `15`.
 * @returns The cell.
 * @throws {@linkcode H3Error} if any argument is out of range, or `digits` does not have length
 * `res`.
 */
export function constructCell(baseCellNumber: number, digits: number[], res: number): bigint {
  try {
    return native.constructCell(baseCellNumber, digits, res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Writes an index in the canonical lowercase hexadecimal form h3-js and the H3 documentation use.
 *
 * @param cell A cell, directed edge or vertex.
 * @returns The index as up to sixteen hexadecimal digits, without a leading `0x`.
 */
export function cellToString(cell: bigint): string {
  try {
    return native.cellToString(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Parses a hexadecimal index of the kind h3-js produces.
 *
 * This decodes; it does not check. A string that parses to a nonsense index returns that index
 * rather than throwing, so call {@linkcode isValidCell} if the input is not trusted.
 *
 * @param text Up to sixteen hexadecimal digits, without a leading `0x`.
 * @returns The index.
 * @throws {@linkcode H3Error} if the string cannot be parsed at all.
 */
export function cellFromString(text: string): bigint {
  try {
    return native.cellFromString(text)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
