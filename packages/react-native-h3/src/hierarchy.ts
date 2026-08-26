import type { UInt64 } from 'react-native-nitro-modules'
import { toBuffer } from './buffers'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Finds the ancestor of a cell at a coarser resolution.
 *
 * @param cell The cell.
 * @param res The target resolution, no finer than the cell's own.
 * @returns The ancestor, or the cell itself when `res` is its own resolution.
 * @throws {@linkcode H3Error} if the cell is not valid, or `res` is finer than the cell's.
 */
export function cellToParent(cell: bigint, res: number): bigint {
  try {
    return native.cellToParent(cell as UInt64, res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Finds the centre child of a cell at a finer resolution.
 *
 * @param cell The cell.
 * @param res The target resolution, no coarser than the cell's own.
 * @returns The centre child, which is the first entry of {@linkcode cellToChildren}.
 * @throws {@linkcode H3Error} if the cell is not valid, or `res` is coarser than the cell's.
 */
export function cellToCenterChild(cell: bigint, res: number): bigint {
  try {
    return native.cellToCenterChild(cell as UInt64, res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Counts the children a cell has at a finer resolution.
 *
 * The count is exact rather than an upper bound, and it is what {@linkcode cellToChildren}
 * allocates. Pentagons have fewer children than hexagons, which this accounts for.
 *
 * @param cell The cell.
 * @param res The target resolution.
 * @returns The number of children.
 * @throws {@linkcode H3Error} if the cell is not valid, or `res` is coarser than the cell's.
 */
export function cellToChildrenSize(cell: bigint, res: number): number {
  try {
    return native.cellToChildrenSize(cell as UInt64, res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Finds the position of a cell within the ordered children of one of its ancestors.
 *
 * @param cell The cell.
 * @param parentRes The ancestor's resolution.
 * @returns The position, `0` to `cellToChildrenSize(ancestor, cell's resolution) - 1`.
 * @throws {@linkcode H3Error} if the cell is not valid, or `parentRes` is finer than the cell's.
 */
export function cellToChildPos(cell: bigint, parentRes: number): number {
  try {
    return native.cellToChildPos(cell as UInt64, parentRes)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Finds the child of a cell at a given position and resolution, inverting
 * {@linkcode cellToChildPos}.
 *
 * @param childPos The position, `0` to `cellToChildrenSize(parent, childRes) - 1`.
 * @param parent The ancestor cell.
 * @param childRes The child's resolution.
 * @returns The child cell.
 * @throws {@linkcode H3Error} if the parent is not valid, or either number is out of range.
 */
export function childPosToCell(childPos: number, parent: bigint, childRes: number): bigint {
  try {
    return native.childPosToCell(childPos, parent as UInt64, childRes)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Lists every child of a cell at a finer resolution, in order.
 *
 * The result is a view onto the buffer C++ produced, not a copy, and holds exactly
 * `cellToChildrenSize(cell, res)` entries, so it may be indexed by child position.
 *
 * @param cell The cell.
 * @param res The target resolution.
 * @returns The children, the centre child first.
 * @throws {@linkcode H3Error} if the cell is not valid, or `res` is coarser than the cell's.
 */
export function cellToChildren(cell: bigint, res: number): BigUint64Array {
  try {
    return new BigUint64Array(native.cellToChildren(cell as UInt64, res))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Reduces a set of cells to the smallest set covering the same area.
 *
 * Wherever all children of a cell are present they are replaced by that parent, recursively. The
 * input must hold no duplicates and no cell twice over at different resolutions.
 *
 * Diverges from `h3-js`, which accepts an index that is not a cell instead of throwing.
 *
 * @param cells The cells to compact.
 * @returns The compacted set, which is never longer than the input.
 * @throws {@linkcode H3Error} if the input holds a duplicate or a cell that is not valid.
 */
export function compactCells(cells: BigUint64Array): BigUint64Array {
  try {
    return new BigUint64Array(native.compactCells(toBuffer(cells)))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Expands a compacted set so that every cell sits at the given resolution.
 *
 * Diverges from `h3-js`, which accepts an index that is not a cell instead of throwing.
 *
 * @param cells The compacted cells, all at `res` or coarser.
 * @param res The target resolution.
 * @returns Every cell of the expanded set, in input order.
 * @throws {@linkcode H3Error} if a cell is not valid or finer than `res`, or `res` is out of range.
 */
export function uncompactCells(cells: BigUint64Array, res: number): BigUint64Array {
  try {
    return new BigUint64Array(native.uncompactCells(toBuffer(cells), res))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
