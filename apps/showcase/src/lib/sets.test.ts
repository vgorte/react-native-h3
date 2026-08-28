import { describe, expect, test } from 'bun:test'
import { intersectCells, toCellSet } from './sets'

describe('toCellSet', () => {
  test('drops duplicates and keeps bigints', () => {
    expect(toCellSet(new BigUint64Array([1n, 2n, 2n]))).toEqual(new Set([1n, 2n]))
  })
})

describe('intersectCells', () => {
  test('keeps only cells present in every set', () => {
    expect(intersectCells([new Set([1n, 2n, 3n]), new Set([2n, 3n]), new Set([3n])])).toEqual(
      new Set([3n]),
    )
  })

  test('is empty for no sets', () => {
    expect(intersectCells([]).size).toBe(0)
  })

  test('returns the single set unchanged', () => {
    expect(intersectCells([new Set([4n])])).toEqual(new Set([4n]))
  })
})
