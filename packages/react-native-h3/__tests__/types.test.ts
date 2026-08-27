import { describe, expect, test } from 'bun:test'
import { CONTAINMENT_MODE_BY_NAME, ContainmentMode } from '../src/types'

describe('containment modes', () => {
  test('maps every h3-js name to its H3 value', () => {
    // the names are h3-js's `POLYGON_TO_CELLS_FLAGS` keys, the numbers are H3's `ContainmentMode`.
    expect(CONTAINMENT_MODE_BY_NAME).toEqual({
      containmentCenter: ContainmentMode.center,
      containmentFull: ContainmentMode.full,
      containmentOverlapping: ContainmentMode.overlapping,
      containmentOverlappingBbox: ContainmentMode.overlappingBbox,
    })
    expect(Object.values(CONTAINMENT_MODE_BY_NAME)).toEqual([0, 1, 2, 3])
  })

  test('is frozen, so a caller cannot teach it a new name', () => {
    expect(Object.isFrozen(CONTAINMENT_MODE_BY_NAME)).toBe(true)
  })

  test('answers undefined for a name h3-js does not have', () => {
    // `regions.ts` turns that into `NaN`, which the native layer rejects.
    const unknown = (CONTAINMENT_MODE_BY_NAME as Record<string, number | undefined>).containmentNone
    expect(unknown).toBeUndefined()
  })
})
