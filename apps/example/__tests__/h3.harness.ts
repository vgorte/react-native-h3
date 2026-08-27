import {
  ContainmentMode,
  cellsToMultiPolygon,
  cellToBoundary,
  cellToLatLng,
  getResolution,
  gridDisk,
  H3Error,
  latLngToCell,
  polygonToCells,
  polygonToCellsExperimental,
} from 'react-native-h3'
import { expect, test } from 'react-native-harness'

const SAN_FRANCISCO_RES_9 = 0x89283082803ffffn
const PENTAGON_RES_1 = 0x81083ffffffffffn
const SAN_FRANCISCO_RECTANGLE: [lat: number, lng: number][] = [
  [37.85, -122.5],
  [37.85, -122.35],
  [37.7, -122.35],
  [37.7, -122.5],
]

test('a UInt64 with the high bit set survives the crossing', () => {
  const cell = latLngToCell(37.7749, -122.4194, 9)
  expect(typeof cell).toBe('bigint')
  expect(cell).toBe(SAN_FRANCISCO_RES_9)
  // H3 sets bit 63 on every valid cell; a signed intermediate anywhere would corrupt this.
  expect(cell > 0n).toBe(true)
  expect(cell.toString(16)).toBe('89283082803ffff')
})

test('a cell set arrives as a BigUint64Array of the compacted length', () => {
  const disk = gridDisk(SAN_FRANCISCO_RES_9, 1)
  expect(disk).toBeInstanceOf(BigUint64Array)
  expect(disk.length).toBe(7)
  expect(disk.byteLength).toBe(7 * 8)
  for (const cell of disk) {
    expect(cell).not.toBe(0n)
  }
})

test('pentagon holes are removed natively, not padded into JS', () => {
  const disk = gridDisk(PENTAGON_RES_1, 1)
  // maxGridDiskSize(1) is 7; a pentagon yields 6 real cells and one hole.
  expect(disk.length).toBe(6)
  for (const cell of disk) {
    expect(cell).not.toBe(0n)
  }
})

test('the returned buffer is a view, and JS may hold it', () => {
  const disk = gridDisk(SAN_FRANCISCO_RES_9, 2)
  const first = disk[0]
  const copy = new BigUint64Array(disk)
  expect(disk.buffer.byteLength).toBe(disk.length * 8)
  expect(copy[0]).toBe(first)
})

test('errors arrive as H3Error with upstream wording and no Nitro prefix', () => {
  let thrown: unknown
  try {
    latLngToCell(37.7749, -122.4194, 99)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  expect((thrown as H3Error).message).toBe(
    'Resolution argument was outside of acceptable range (code: 4)',
  )
  expect((thrown as H3Error).code).toBe(4)
})

test('an invalid cell is rejected by the C layer', () => {
  let thrown: unknown
  try {
    gridDisk(1n, 1)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  expect((thrown as H3Error).message).toBe('Cell argument was not valid (code: 5)')
  expect((thrown as H3Error).code).toBe(5)
})

test('a negative k is rejected by the C layer', () => {
  let thrown: unknown
  try {
    gridDisk(SAN_FRANCISCO_RES_9, -1)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  expect((thrown as H3Error).message).toBe('Argument was outside of acceptable range (code: 2)')
  expect((thrown as H3Error).code).toBe(2)
})

test('three-level nesting crosses the bridge intact', () => {
  // `LatLng[][][]` is expressible in nitrogen but is not covered by Nitro's own test module.
  const single = cellsToMultiPolygon(new BigUint64Array([SAN_FRANCISCO_RES_9]))
  expect(Array.isArray(single)).toBe(true)
  expect(single.length).toBe(1)
  expect(single[0]?.length).toBe(1)
  expect(single[0]?.[0]?.length).toBe(6)
  expect(typeof single[0]?.[0]?.[0]?.lat).toBe('number')
  expect(typeof single[0]?.[0]?.[0]?.lng).toBe('number')
})

test('a multi-cell outline keeps its shape', () => {
  const disk = cellsToMultiPolygon(gridDisk(SAN_FRANCISCO_RES_9, 1))
  expect(disk.length).toBe(1)
  expect(disk[0]?.length).toBe(1)
  expect(disk[0]?.[0]?.length).toBe(18)
})

test('a cell boundary is a flat array of structs', () => {
  const boundary = cellToBoundary(SAN_FRANCISCO_RES_9)
  expect(boundary.length).toBe(6)
  expect(boundary[0]?.lat).toBeCloseTo(37.7720104773324, 9)
  expect(boundary[0]?.lng).toBeCloseTo(-122.41701147197293, 9)
})

test('a cell centre round-trips to the same cell', () => {
  const centre = cellToLatLng(SAN_FRANCISCO_RES_9)
  expect(latLngToCell(centre.lat, centre.lng, 9)).toBe(SAN_FRANCISCO_RES_9)
})

test('getResolution answers -1 for anything that is not a cell', () => {
  expect(getResolution(SAN_FRANCISCO_RES_9)).toBe(9)
  // h3-js guards this with `isValidCell` alone; `1n` is not a cell at all.
  expect(getResolution(1n)).toBe(-1)
})

test('a containment mode may be named the way h3-js names it', () => {
  const byName = polygonToCellsExperimental([SAN_FRANCISCO_RECTANGLE], 7, 'containmentCenter')
  const byNumber = polygonToCellsExperimental([SAN_FRANCISCO_RECTANGLE], 7, ContainmentMode.center)
  expect(Array.from(byName)).toEqual(Array.from(byNumber))
  expect(Array.from(byName)).toEqual(Array.from(polygonToCells([SAN_FRANCISCO_RECTANGLE], 7)))
})

test('an unknown containment mode name is rejected by the C layer', () => {
  let thrown: unknown
  try {
    // @ts-expect-error the point is what happens when the type is ignored
    polygonToCellsExperimental([SAN_FRANCISCO_RECTANGLE], 7, 'containmentNone')
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  // the name resolves to `NaN`, so the narrowing in C++ rejects it before H3 sees a mode.
  expect((thrown as H3Error).message).toBe('Containment mode must be an integer')
  expect((thrown as H3Error).code).toBeUndefined()
})
