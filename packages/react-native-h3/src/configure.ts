import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/** Holds the settings {@linkcode configure} accepts. Every field is optional. */
export interface H3Config {
  /**
   * Caps how many cells one call may allocate, which guards against exhausting device memory.
   *
   * Defaults to `4_000_000` cells, 32 MB as a `BigUint64Array`. `Infinity` removes the ceiling
   * altogether; any other value must be an integer of `1` or more.
   */
  maxCellCount?: number
}

/**
 * Changes settings that apply to every later call.
 *
 * The ceiling is read where a call allocates, so it governs every cell-producing operation, the
 * four `Async` variants included.
 *
 * @param options The settings to change. A field left out leaves that setting untouched.
 * @throws {@linkcode H3Error} if `maxCellCount` is neither `Infinity` nor an integer of `1` or more.
 */
export function configure(options: H3Config): void {
  if (options.maxCellCount !== undefined) {
    try {
      native.setMaxCellCount(options.maxCellCount)
    } catch (error) {
      rethrowAsH3Error(error)
    }
  }
}
