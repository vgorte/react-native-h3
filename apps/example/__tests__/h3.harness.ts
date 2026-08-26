import {
  cellsToMultiPolygon,
  cellToBoundary,
  cellToLatLng,
  gridDisk,
  H3Error,
  latLngToCell,
} from 'react-native-h3'
import { expect, test } from 'react-native-harness'

const SAN_FRANCISCO_RES_9 = 0x89283082803ffffn
const PENTAGON_RES_1 = 0x81083ffffffffffn

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
  expect((thrown as H3Error).message).toBe('Resolution argument was outside of acceptable range')
})

test('an invalid cell is rejected by the C layer', () => {
  let thrown: unknown
  try {
    gridDisk(1n, 1)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  expect((thrown as H3Error).message).toBe('Cell argument was not valid')
})

test('a negative k is rejected by the C layer', () => {
  let thrown: unknown
  try {
    gridDisk(SAN_FRANCISCO_RES_9, -1)
  } catch (error) {
    thrown = error
  }
  expect(thrown).toBeInstanceOf(H3Error)
  expect((thrown as H3Error).message).toBe('Argument was outside of acceptable range')
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
