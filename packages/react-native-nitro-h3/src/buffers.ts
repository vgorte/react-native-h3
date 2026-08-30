/**
 * Hands a cell set to the native layer as a plain `ArrayBuffer`.
 *
 * Every cell set this package returns is a view whose byte length is its whole buffer, so the
 * common case passes through without copying. A view the caller built themselves may be a window
 * onto a larger buffer, and passing `.buffer` would then hand native the wrong cells, so that case
 * is copied.
 *
 * @param cells The cells to hand over.
 * @returns A buffer holding exactly those cells.
 */
export function toBuffer(cells: BigUint64Array): ArrayBuffer {
  if (cells.byteOffset === 0 && cells.byteLength === cells.buffer.byteLength) {
    return cells.buffer as ArrayBuffer
  }
  return cells.slice().buffer as ArrayBuffer
}
