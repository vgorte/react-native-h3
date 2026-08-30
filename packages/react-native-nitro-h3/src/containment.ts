import type { ContainmentModeName, ContainmentModeValue } from './types'
import { CONTAINMENT_MODE_BY_NAME } from './types'

// H3's `CONTAINMENT_INVALID`, so an unrecognised mode name earns the same `E_OPTION_INVALID` that
// h3-js reports for one, rather than this package's own wording.
const CONTAINMENT_INVALID = 4

/**
 * Resolves a containment mode to the flags word the native layer expects.
 *
 * An unknown name falls through as `CONTAINMENT_INVALID`, which keeps H3 the only judge of the
 * mode. Shared so the synchronous and asynchronous fills cannot drift apart.
 *
 * @param flags A {@linkcode ContainmentMode} constant or the h3-js name for one.
 * @returns The number to hand across the bridge.
 */
export function toContainmentFlags(flags: ContainmentModeValue | ContainmentModeName): number {
  return typeof flags === 'number'
    ? flags
    : (CONTAINMENT_MODE_BY_NAME[flags] ?? CONTAINMENT_INVALID)
}
