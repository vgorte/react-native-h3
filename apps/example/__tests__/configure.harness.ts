import { configure, gridDisk, H3Error, latLngToCell, polygonToCellsAsync } from 'react-native-h3'
import { afterEach, describe, expect, test } from 'react-native-harness'

const SAN_FRANCISCO_BOX: [lat: number, lng: number][][] = [
  [
    [37.8, -122.45],
    [37.8, -122.39],
    [37.74, -122.39],
    [37.74, -122.45],
  ],
]

describe('the opt-in cell ceiling', () => {
  afterEach(() => {
    configure({ maxCellCount: Infinity })
  })

  test('a fill runs with no configure call at all', () => {
    // the ceiling that proves the new default is 4,000,001 cells, too much to allocate here, so
    // `CellSetCallCeiling.StartsWithNoLimit` in `cpp/test` carries that half
    expect(gridDisk(latLngToCell(37.7749, -122.4194, 9), 10).length).toBe(331)
  })

  test('a lowered ceiling refuses a synchronous fill, in the message the C++ layer words', () => {
    configure({ maxCellCount: 100 })

    let thrown: unknown
    try {
      // `maxGridDiskSize(10)` is `3 * 10 * 11 + 1`, so the reported size is exactly 331
      gridDisk(latLngToCell(37.7749, -122.4194, 9), 10)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(H3Error)
    expect((thrown as H3Error).message).toBe(
      'The requested result of 331 cells exceeds the cell limit of 100 set with configure({ maxCellCount }). Raise or remove the limit to allow it.',
    )
    expect((thrown as H3Error).code).toBeUndefined()
  })

  test('the worker thread reads the same ceiling, so an async fill is refused too', async () => {
    configure({ maxCellCount: 100 })

    let thrown: unknown
    try {
      await polygonToCellsAsync(SAN_FRANCISCO_BOX, 9)
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(H3Error)
    // `maxPolygonToCellsSize` over-estimates, so only the limit half of the wording is fixed
    expect((thrown as H3Error).message).toContain(
      'exceeds the cell limit of 100 set with configure({ maxCellCount }). Raise or remove the limit to allow it.',
    )
  })

  test('Infinity restores the default, and the refused call then succeeds', async () => {
    const origin = latLngToCell(37.7749, -122.4194, 9)
    configure({ maxCellCount: 100 })
    expect(() => gridDisk(origin, 10)).toThrow(H3Error)

    configure({ maxCellCount: Infinity })

    expect(gridDisk(origin, 10).length).toBe(331)
    expect((await polygonToCellsAsync(SAN_FRANCISCO_BOX, 9)).length).toBe(321)
  })

  test('a ceiling that is neither Infinity nor a positive integer is refused', () => {
    for (const maxCellCount of [0, -1, 1.5, NaN, -Infinity]) {
      let thrown: unknown
      try {
        configure({ maxCellCount })
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(H3Error)
      expect((thrown as H3Error).message).toBe(
        'maxCellCount must be a positive integer or Infinity',
      )
    }
  })

  test('an absent field leaves the ceiling alone', () => {
    configure({ maxCellCount: 100 })
    configure({})

    expect(() => gridDisk(latLngToCell(37.7749, -122.4194, 9), 10)).toThrow(H3Error)
  })
})
