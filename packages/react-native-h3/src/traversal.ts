import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Finds every cell within grid distance `k` of the origin, including the origin itself.
 *
 * The result is a view onto the buffer C++ produced, not a copy, and contains only real cells:
 * H3 pads its output with holes around pentagons, and those are removed natively before the
 * buffer crosses. Expect fewer than `1 + 3k(k + 1)` entries near a pentagon.
 *
 * @throws {@linkcode H3Error} If the origin is not a valid cell or `k` is negative.
 */
export function gridDisk(origin: bigint, k: number): BigUint64Array {
  try {
    return new BigUint64Array(native.gridDisk(origin, k))
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
