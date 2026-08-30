import { describe, expect, test } from 'bun:test'
import h3 from 'h3-js'
import { EXTREME_COORDINATES, PENTAGON_NEIGHBOURHOODS, RES0_CELLS } from './corpus'
import { callMany, skipWithoutProbe } from './probe'

describe.skipIf(skipWithoutProbe)('parity: batches', () => {
  test('latLngsToCells equals element-wise h3-js latLngToCell over the corpus centres', () => {
    // corpus cells give deterministic, pentagon- and transmeridian-heavy coordinates
    const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]
    const pairs = [
      ...cells.map((cell) => h3.cellToLatLng(cell)),
      ...EXTREME_COORDINATES.map(({ lat, lng }) => [lat, lng] as [number, number]),
    ]
    const flat = pairs.flat()
    const [answer] = callMany([`latLngsToCells ${flat.join(',')} 9`])
    const expected = pairs.map(([lat, lng]) => h3.latLngToCell(lat as number, lng as number, 9))
    expect(answer).toEqual(expected)
  })

  test('cellsToLatLngs equals element-wise h3-js cellToLatLng over the corpus', () => {
    const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]
    const [answer] = callMany([`cellsToLatLngs ${cells.join(',')}`]) as [number[]]
    const expected = cells.flatMap((cell) => h3.cellToLatLng(cell))
    expect(answer.length).toBe(expected.length)
    for (let i = 0; i < expected.length; i++) {
      expect(answer[i]).toBeCloseTo(expected[i] as number, 12)
    }
  })

  test('an empty batch answers empty in both directions', () => {
    const answers = callMany(['latLngsToCells - 9', 'cellsToLatLngs -'])
    expect(answers[0]).toEqual([])
    expect(answers[1]).toEqual([])
  })

  test('failures name the element, odd counts are refused', () => {
    const answers = callMany([
      `cellsToLatLngs ${RES0_CELLS[0]},1`,
      'latLngsToCells 1,2,3 9',
      'latLngsToCells 37.7749,-122.4194 99',
    ])
    expect((answers[0] as Error).message).toBe('cells[1]: Cell argument was not valid (code: 5)')
    expect((answers[1] as Error).message).toBe(
      'A coordinate set must hold an even number of doubles',
    )
    // a batch-wide bad resolution fails on the first pair, so the index reads 0
    expect((answers[2] as Error).message).toBe(
      'coords[0]: Resolution argument was outside of acceptable range (code: 4)',
    )
  })
})
