/**
 * Hands a typed-array view to the native layer as a plain `ArrayBuffer`.
 *
 * Every set this package returns is a view whose byte length is its whole buffer, so the
 * common case passes through without copying. A view the caller built themselves may be a window
 * onto a larger buffer, and passing `.buffer` would then hand native the wrong values, so that
 * case is copied.
 *
 * @param view The cells or interleaved coordinates to hand over.
 * @returns A buffer holding exactly those values.
 */
export function toBuffer(view: BigUint64Array | Float64Array): ArrayBuffer {
  if (view.byteOffset === 0 && view.byteLength === view.buffer.byteLength) {
    return view.buffer as ArrayBuffer
  }
  return view.slice().buffer as ArrayBuffer
}
