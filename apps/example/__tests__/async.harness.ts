import {
  cellsToMultiPolygon,
  cellsToMultiPolygonAsync,
  compactCells,
  gridDisk,
  H3Error,
  latLngToCell,
  polygonToCells,
  polygonToCellsAsync,
  uncompactCells,
  uncompactCellsAsync,
} from 'react-native-h3'
import { describe, expect, test } from 'react-native-harness'

const SAN_FRANCISCO_BOX: [lat: number, lng: number][][] = [
  [
    [37.8, -122.45],
    [37.8, -122.39],
    [37.74, -122.39],
    [37.74, -122.45],
  ],
]

// a view whose byte length is not a multiple of 8, which no `BigUint64Array` can be
const MALFORMED_CELL_SET = {
  byteOffset: 0,
  byteLength: 3,
  buffer: new ArrayBuffer(3),
} as unknown as BigUint64Array

describe('async variants', () => {
  test('polygonToCellsAsync agrees with the synchronous call', async () => {
    const sync = polygonToCells(SAN_FRANCISCO_BOX, 9)
    const fromPromise = await polygonToCellsAsync(SAN_FRANCISCO_BOX, 9)

    expect(fromPromise).toBeInstanceOf(BigUint64Array)
    // h3-js `polygonToCells(box, 9)` has 321 cells
    expect(fromPromise.length).toBe(321)
    expect(Array.from(fromPromise)).toEqual(Array.from(sync))
  })

  test('the returned buffer is compacted, with no holes', async () => {
    const cells = await polygonToCellsAsync(SAN_FRANCISCO_BOX, 9)
    expect(cells.byteLength).toBe(cells.length * 8)
    for (const cell of cells) {
      expect(cell).not.toBe(0n)
    }
  })

  test('the inbound buffer is copied, so the caller may overwrite it immediately', async () => {
    const origin = latLngToCell(37.7749, -122.4194, 5)
    const compacted = compactCells(gridDisk(origin, 3))
    const oracle = uncompactCells(new BigUint64Array(compacted), 5)

    const promise = uncompactCellsAsync(compacted, 5)
    // without the native copy the worker reads these zeroes and rejects with `E_CELL_INVALID`
    compacted.fill(0n)
    const result = await promise

    expect(result.length).toBe(37)
    expect(Array.from(result)).toEqual(Array.from(oracle))
  })

  test('cellsToMultiPolygonAsync agrees with the synchronous call and copies its input', async () => {
    const origin = latLngToCell(37.7749, -122.4194, 9)
    const disk = gridDisk(origin, 1)
    const oracle = cellsToMultiPolygon(new BigUint64Array(disk))

    const promise = cellsToMultiPolygonAsync(disk)
    disk.fill(0n)
    const result = await promise

    expect(result.length).toBe(oracle.length)
    expect(result[0]?.length).toBe(oracle[0]?.length)
    expect(result[0]?.[0]?.length).toBe(18)
  })

  test('an empty cell set answers what the synchronous call answers', async () => {
    // the native copy hands the worker a zero-length buffer where the synchronous path sees `nullptr`
    const empty = new BigUint64Array(0)

    expect(await cellsToMultiPolygonAsync(empty)).toEqual(cellsToMultiPolygon(empty))
    expect(Array.from(await uncompactCellsAsync(empty, 5))).toEqual(
      Array.from(uncompactCells(empty, 5)),
    )
  })

  test('a malformed cell set rejects rather than throwing synchronously', async () => {
    for (const call of [
      () => cellsToMultiPolygonAsync(MALFORMED_CELL_SET),
      () => uncompactCellsAsync(MALFORMED_CELL_SET, 5),
    ]) {
      const promise = call()
      expect(typeof promise.then).toBe('function')

      let thrown: unknown
      try {
        await promise
      } catch (error) {
        thrown = error
      }
      expect(thrown).toBeInstanceOf(H3Error)
      expect((thrown as H3Error).message).toBe("A cell set's byte length must be a multiple of 8")
    }
  })

  test('a failure rejects rather than throwing synchronously', async () => {
    // the call itself must return a promise; only awaiting it may fail
    const promise = polygonToCellsAsync(SAN_FRANCISCO_BOX, 99)
    expect(typeof promise.then).toBe('function')

    let thrown: unknown
    try {
      await promise
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(H3Error)
    expect((thrown as H3Error).message).toBe(
      'Resolution argument was outside of acceptable range (code: 4)',
    )
    expect((thrown as H3Error).code).toBe(4)
    // the two paths must not be distinguishable by their wording
    expect(() => polygonToCells(SAN_FRANCISCO_BOX, 99)).toThrow(
      'Resolution argument was outside of acceptable range (code: 4)',
    )
  })

  test('the result is delivered on a later tick, never on the calling one', async () => {
    let settled = false
    const promise = polygonToCellsAsync(SAN_FRANCISCO_BOX, 11).then((cells) => {
      settled = true
      return cells
    })
    expect(settled).toBe(false)
    expect((await promise).length).toBe(15761)
    expect(settled).toBe(true)
  })
})
