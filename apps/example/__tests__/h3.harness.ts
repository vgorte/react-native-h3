import { gridDisk, H3Error, latLngToCell } from 'react-native-h3'
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

// H3 4.5 does not validate the origin of `gridDisk` (`algos.c:200`), so `maxGridDiskSize` is
// the only error this entry point can raise.
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
