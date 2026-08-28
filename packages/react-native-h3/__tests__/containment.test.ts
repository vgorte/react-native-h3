import { describe, expect, test } from 'bun:test'
import { toContainmentFlags } from '../src/containment'
import { ContainmentMode } from '../src/types'

describe('toContainmentFlags', () => {
  test('passes a ContainmentMode constant through untouched', () => {
    expect(toContainmentFlags(ContainmentMode.center)).toBe(0)
    expect(toContainmentFlags(ContainmentMode.overlappingBbox)).toBe(3)
  })

  test('resolves every h3-js name to its H3 value', () => {
    expect(toContainmentFlags('containmentCenter')).toBe(ContainmentMode.center)
    expect(toContainmentFlags('containmentFull')).toBe(ContainmentMode.full)
    expect(toContainmentFlags('containmentOverlapping')).toBe(ContainmentMode.overlapping)
    expect(toContainmentFlags('containmentOverlappingBbox')).toBe(ContainmentMode.overlappingBbox)
  })

  test('answers CONTAINMENT_INVALID for a name h3-js does not have', () => {
    // `4` is H3's `CONTAINMENT_INVALID`, which earns h3-js's own `E_OPTION_INVALID`
    expect(toContainmentFlags('containmentNone' as 'containmentCenter')).toBe(4)
  })
})
