import h3 from 'h3-js'
import type { LatLng, Ring } from 'react-native-h3'
import {
  cellsToMultiPolygon,
  cellToBoundary,
  cellToChildren,
  cellToChildrenSize,
  cellToLatLng,
  compactCells,
  gridDisk,
  gridPathCells,
  latLngToCell,
  polygonToCells,
  polygonToCellsAsync,
  uncompactCells,
  uncompactCellsAsync,
} from 'react-native-h3'

const SAN_FRANCISCO = { lat: 37.7749, lng: -122.4194 }
const BERLIN = { lat: 52.52, lng: 13.405 }
const HAMBURG = { lat: 53.5511, lng: 9.9937 }

// the polygon of the measurement that justified the package: San Francisco, res 12, 412,377 cells
const SAN_FRANCISCO_POLYGON: Ring[] = [
  [
    [37.81331899998324, -122.40898669999721],
    [37.71980619999785, -122.35447369999936],
    [37.70761319999757, -122.5123436999984],
    [37.78358719999717, -122.5247187000022],
    [37.815157199999845, -122.4798767000009],
  ],
]

const RUNS = 20
// one pass of these workloads costs `h3-js` seconds, so they get far fewer runs
const RUNS_SLOW = 3
const CALLS = 100_000
const CALLS_PER_RUN = 1_000
const DISK_K = 20
const EPSILON = 1e-9

// one sample is one call here, and a call is the map tap a user waits for
const SINGLE_CALLS = 1_000
const SINGLE_CALL_STEP = 0.001
const SINGLE_CALL_COLUMNS = 40
// a macrotask between two single calls would cost more than the calls themselves
const SINGLE_CALL_YIELD = 100

// the k series shows how the factor moves with the work one call does; k=20 stays `W2`
const DISK_SERIES = [
  { id: 'W2a', k: 1, runs: RUNS },
  { id: 'W2b', k: 5, runs: RUNS },
  { id: 'W2c', k: 10, runs: RUNS },
  // 7,651 cells per call, so a thousand `h3-js` calls run into seconds
  { id: 'W2d', k: 50, runs: RUNS_SLOW },
]

const UNCOMPACT_RES = 12
const CHILDREN_PARENT_RES = 5
const CHILDREN_RES = 10
const PATH_RES = 9
// the package's default cell ceiling, which `configure({ maxCellCount })` would move
const CELL_CEILING = 4_000_000

export interface Stats {
  median: number
  p95: number
  min: number
  max: number
}

export interface Row {
  workload: string
  runs: number
  millis: number
  referenceMillis: number | undefined
  stats: Stats
  referenceStats: Stats | undefined
  equivalent: boolean
  detail: string
}

function now(): number {
  const performanceApi = (globalThis as { performance?: { now(): number } }).performance
  if (performanceApi != null) {
    return performanceApi.now()
  }
  return Date.now()
}

function statsOf(samples: number[]): Stats {
  const sorted = [...samples].sort((a, b) => a - b)
  const last = sorted.length - 1
  // the median takes the upper of the two middle samples on an even count
  const median = sorted[Math.min(last, Math.floor(0.5 * sorted.length))] as number
  // nearest rank, so `p95` is the nineteenth of 20 samples, not the maximum
  const rank = Math.min(last, Math.max(0, Math.ceil(0.95 * sorted.length) - 1))
  return {
    median,
    p95: sorted[rank] as number,
    min: sorted[0] as number,
    max: sorted[last] as number,
  }
}

interface Timed<T> {
  value: T
  stats: Stats
}

// warm-up untimed; its value feeds the equivalence check
// a pause outside every `now()` window caps the longest freeze at one run
async function timeRuns<T>(
  signal: RunSignal,
  runs: number,
  body: () => T,
): Promise<Timed<T> | undefined> {
  const value = body()
  if (await pause(signal)) {
    return undefined
  }
  const samples: number[] = []
  for (let index = 0; index < runs; index++) {
    const start = now()
    body()
    samples.push(now() - start)
    if (await pause(signal)) {
      return undefined
    }
  }
  return { value, stats: statsOf(samples) }
}

async function timeRunsAsync<T>(
  signal: RunSignal,
  runs: number,
  body: () => Promise<T>,
): Promise<Timed<T> | undefined> {
  const value = await body()
  if (await pause(signal)) {
    return undefined
  }
  const samples: number[] = []
  for (let index = 0; index < runs; index++) {
    const start = now()
    await body()
    samples.push(now() - start)
    if (await pause(signal)) {
      return undefined
    }
  }
  return { value, stats: statsOf(samples) }
}

// one call per sample, so the stats describe a single call and not a batch
async function timeCalls<T>(
  signal: RunSignal,
  calls: number,
  body: (index: number) => T,
): Promise<Timed<T> | undefined> {
  let value = body(0)
  for (let index = 1; index < calls; index++) {
    value = body(index)
  }
  if (await pause(signal)) {
    return undefined
  }
  const samples: number[] = []
  for (let index = 0; index < calls; index++) {
    const start = now()
    value = body(index)
    samples.push(now() - start)
    if (index % SINGLE_CALL_YIELD === SINGLE_CALL_YIELD - 1 && (await pause(signal))) {
      return undefined
    }
  }
  return { value, stats: statsOf(samples) }
}

function sortedHex(cells: BigUint64Array): string[] {
  const hex = new Array<string>(cells.length)
  for (let index = 0; index < cells.length; index++) {
    hex[index] = (cells[index] as bigint).toString(16)
  }
  return hex.sort()
}

function sameStrings(subject: string[], reference: string[]): boolean {
  return subject.length === reference.length && subject.every((cell, i) => cell === reference[i])
}

function sameCells(subject: BigUint64Array, reference: string[]): boolean {
  if (subject.length !== reference.length) {
    return false
  }
  return sameStrings(sortedHex(subject), reference.map((cell) => cell.toLowerCase()).sort())
}

// a path is ordered, so its equivalence check must not sort
function sameCellsInOrder(subject: BigUint64Array, reference: string[]): boolean {
  if (subject.length !== reference.length) {
    return false
  }
  return reference.every(
    (cell, index) => (subject[index] as bigint).toString(16) === cell.toLowerCase(),
  )
}

function sameLatLng(subject: LatLng, reference: number[]): boolean {
  return (
    Math.abs(subject.lat - (reference[0] as number)) < EPSILON &&
    Math.abs(subject.lng - (reference[1] as number)) < EPSILON
  )
}

function sameBoundary(subject: LatLng[], reference: number[][]): boolean {
  return (
    subject.length === reference.length &&
    subject.every((point, index) => sameLatLng(point, reference[index] as number[]))
  )
}

function samePolygons(subject: LatLng[][][], reference: number[][][][]): boolean {
  return (
    subject.length === reference.length &&
    subject.every((polygon, p) => {
      const other = reference[p] as number[][][]
      return (
        polygon.length === other.length &&
        polygon.every((loop, l) => sameBoundary(loop, other[l] as number[][]))
      )
    })
  )
}

// carries the request to abandon a run to the sample and workload boundaries
export interface RunSignal {
  cancelled: boolean
}

// a macrotask between samples lets queued presses through and reports whether the run is unwanted
async function pause(signal: RunSignal): Promise<boolean> {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve()
    }, 0)
  })
  return signal.cancelled
}

function toRow(
  workload: string,
  runs: number,
  stats: Stats,
  referenceStats: Stats | undefined,
  equivalent: boolean,
  detail: string,
): Row {
  return {
    workload,
    runs,
    millis: stats.median,
    referenceMillis: referenceStats?.median,
    stats,
    referenceStats,
    equivalent,
    detail,
  }
}

// a grid of distinct coordinates over San Francisco, so no call repeats an input
function singleCallInputs(): LatLng[] {
  const inputs = new Array<LatLng>(SINGLE_CALLS)
  for (let index = 0; index < SINGLE_CALLS; index++) {
    inputs[index] = {
      lat: SAN_FRANCISCO.lat + (index % SINGLE_CALL_COLUMNS) * SINGLE_CALL_STEP,
      lng: SAN_FRANCISCO.lng + Math.floor(index / SINGLE_CALL_COLUMNS) * SINGLE_CALL_STEP,
    }
  }
  return inputs
}

// the ceiling rejects an oversized result before the work starts, so the row drops a resolution
// instead of throwing
function fittingResolution(cells: BigUint64Array, target: number): number {
  for (let res = target; res > 0; res--) {
    let size = 0
    for (let index = 0; index < cells.length; index++) {
      size += cellToChildrenSize(cells[index] as bigint, res)
    }
    if (size <= CELL_CEILING) {
      return res
    }
  }
  return 0
}

export async function runBenchmark(
  signal: RunSignal,
): Promise<{ rows: Row[]; seconds: number } | undefined> {
  const started = now()
  const origin = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
  const disk = gridDisk(origin, DISK_K)
  // `h3-js` stays in its own hexadecimal-string world; converting either side would time the conversion
  const referenceOrigin = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
  const referenceDisk = h3.gridDisk(referenceOrigin, DISK_K)
  const cells = Array.from(disk)
  const rows: Row[] = []

  const singleInputs = singleCallInputs()
  const w0 = await timeCalls(signal, SINGLE_CALLS, (index) => {
    const input = singleInputs[index] as LatLng
    return latLngToCell(input.lat, input.lng, 9)
  })
  if (w0 == null) {
    return undefined
  }
  const w0Reference = await timeCalls(signal, SINGLE_CALLS, (index) => {
    const input = singleInputs[index] as LatLng
    return h3.latLngToCell(input.lat, input.lng, 9)
  })
  if (w0Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W0 latLngToCell, one call per sample',
      SINGLE_CALLS,
      w0.stats,
      w0Reference.stats,
      singleInputs.every(
        (input) =>
          latLngToCell(input.lat, input.lng, 9).toString(16) ===
          h3.latLngToCell(input.lat, input.lng, 9).toLowerCase(),
      ),
      `${SINGLE_CALLS} distinct inputs, median and p95 per call`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w1 = await timeRuns(signal, RUNS, () => {
    let last = 0n
    for (let i = 0; i < CALLS; i++) {
      last = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
    }
    return last
  })
  if (w1 == null) {
    return undefined
  }
  const w1Reference = await timeRuns(signal, RUNS, () => {
    let last = ''
    for (let i = 0; i < CALLS; i++) {
      last = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
    }
    return last
  })
  if (w1Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W1 latLngToCell x 100,000',
      RUNS,
      w1.stats,
      w1Reference.stats,
      w1.value.toString(16) === w1Reference.value.toLowerCase(),
      w1.value.toString(16),
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w2 = await timeRuns(signal, RUNS, () => {
    let last = disk
    for (let i = 0; i < CALLS_PER_RUN; i++) {
      last = gridDisk(origin, DISK_K)
    }
    return last
  })
  if (w2 == null) {
    return undefined
  }
  const w2Reference = await timeRuns(signal, RUNS, () => {
    let last = referenceDisk
    for (let i = 0; i < CALLS_PER_RUN; i++) {
      last = h3.gridDisk(referenceOrigin, DISK_K)
    }
    return last
  })
  if (w2Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W2 gridDisk(k=20) x 1,000',
      RUNS,
      w2.stats,
      w2Reference.stats,
      sameCells(w2.value, w2Reference.value),
      `${w2.value.length} cells per call`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  for (const series of DISK_SERIES) {
    const own = await timeRuns(signal, series.runs, () => {
      let last = disk
      for (let i = 0; i < CALLS_PER_RUN; i++) {
        last = gridDisk(origin, series.k)
      }
      return last
    })
    if (own == null) {
      return undefined
    }
    const reference = await timeRuns(signal, series.runs, () => {
      let last = referenceDisk
      for (let i = 0; i < CALLS_PER_RUN; i++) {
        last = h3.gridDisk(referenceOrigin, series.k)
      }
      return last
    })
    if (reference == null) {
      return undefined
    }
    rows.push(
      toRow(
        `${series.id} gridDisk(k=${series.k}) x 1,000`,
        series.runs,
        own.stats,
        reference.stats,
        sameCells(own.value, reference.value),
        `${own.value.length} cells per call`,
      ),
    )

    if (await pause(signal)) {
      return undefined
    }
  }

  const w3 = await timeRuns(signal, RUNS_SLOW, () => polygonToCells(SAN_FRANCISCO_POLYGON, 12))
  if (w3 == null) {
    return undefined
  }
  const w3Reference = await timeRuns(signal, RUNS_SLOW, () =>
    h3.polygonToCells(SAN_FRANCISCO_POLYGON, 12),
  )
  if (w3Reference == null) {
    return undefined
  }
  const w3Hex = sortedHex(w3.value)
  rows.push(
    toRow(
      'W3 polygonToCells, SF, res 12',
      RUNS_SLOW,
      w3.stats,
      w3Reference.stats,
      sameCells(w3.value, w3Reference.value),
      `${w3.value.length} cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w3Async = await timeRunsAsync(signal, RUNS_SLOW, () =>
    polygonToCellsAsync(SAN_FRANCISCO_POLYGON, 12),
  )
  if (w3Async == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W3 polygonToCellsAsync, SF, res 12',
      RUNS_SLOW,
      w3Async.stats,
      undefined,
      sameStrings(sortedHex(w3Async.value), w3Hex),
      `${w3Async.value.length} cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w4 = await timeRuns(signal, RUNS, () => compactCells(disk))
  if (w4 == null) {
    return undefined
  }
  const w4Reference = await timeRuns(signal, RUNS, () => h3.compactCells(referenceDisk))
  if (w4Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W4 compactCells of a k=20 disk',
      RUNS,
      w4.stats,
      w4Reference.stats,
      sameCells(w4.value, w4Reference.value),
      `${w4.value.length} cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w5 = await timeRuns(signal, RUNS, () => cellsToMultiPolygon(disk))
  if (w5 == null) {
    return undefined
  }
  const w5Reference = await timeRuns(signal, RUNS, () => h3.cellsToMultiPolygon(referenceDisk))
  if (w5Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W5 cellsToMultiPolygon of a k=20 disk',
      RUNS,
      w5.stats,
      w5Reference.stats,
      samePolygons(w5.value, w5Reference.value),
      `${w5.value.length} polygons`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w6 = await timeRuns(signal, RUNS, () => {
    let last: LatLng = { lat: 0, lng: 0 }
    for (let i = 0; i < CALLS; i++) {
      last = cellToLatLng(cells[i % cells.length] as bigint)
    }
    return last
  })
  if (w6 == null) {
    return undefined
  }
  const w6Reference = await timeRuns(signal, RUNS, () => {
    let last: number[] = []
    for (let i = 0; i < CALLS; i++) {
      last = h3.cellToLatLng(referenceDisk[i % referenceDisk.length] as string)
    }
    return last
  })
  if (w6Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W6 cellToLatLng x 100,000',
      RUNS,
      w6.stats,
      w6Reference.stats,
      cells.length === referenceDisk.length &&
        cells.every((cell, index) =>
          sameLatLng(cellToLatLng(cell), h3.cellToLatLng(referenceDisk[index] as string)),
        ),
      `${CALLS} calls over ${cells.length} distinct cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w7 = await timeRuns(signal, RUNS, () => {
    let last: LatLng[] = []
    for (let i = 0; i < CALLS; i++) {
      last = cellToBoundary(cells[i % cells.length] as bigint)
    }
    return last
  })
  if (w7 == null) {
    return undefined
  }
  const w7Reference = await timeRuns(signal, RUNS, () => {
    let last: number[][] = []
    for (let i = 0; i < CALLS; i++) {
      last = h3.cellToBoundary(referenceDisk[i % referenceDisk.length] as string)
    }
    return last
  })
  if (w7Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      'W7 cellToBoundary x 100,000',
      RUNS,
      w7.stats,
      w7Reference.stats,
      cells.length === referenceDisk.length &&
        cells.every((cell, index) =>
          sameBoundary(cellToBoundary(cell), h3.cellToBoundary(referenceDisk[index] as string)),
        ),
      `${CALLS} calls over ${cells.length} distinct cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  // compacting the res 9 polygon is the input, not the measurement, so it stays outside the runs
  const compacted = compactCells(polygonToCells(SAN_FRANCISCO_POLYGON, 9))
  const referenceCompacted = h3.compactCells(h3.polygonToCells(SAN_FRANCISCO_POLYGON, 9))
  const uncompactRes = fittingResolution(compacted, UNCOMPACT_RES)
  const w8 = await timeRuns(signal, RUNS, () => uncompactCells(compacted, uncompactRes))
  if (w8 == null) {
    return undefined
  }
  const w8Reference = await timeRuns(signal, RUNS, () =>
    h3.uncompactCells(referenceCompacted, uncompactRes),
  )
  if (w8Reference == null) {
    return undefined
  }
  const w8Hex = sortedHex(w8.value)
  rows.push(
    toRow(
      `W8 uncompactCells, SF res 9 compacted, to res ${uncompactRes}`,
      RUNS,
      w8.stats,
      w8Reference.stats,
      sameCells(w8.value, w8Reference.value),
      `${compacted.length} cells in, ${w8.value.length} cells out`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w8Async = await timeRunsAsync(signal, RUNS, () =>
    uncompactCellsAsync(compacted, uncompactRes),
  )
  if (w8Async == null) {
    return undefined
  }
  rows.push(
    toRow(
      `W8 uncompactCellsAsync, SF res 9 compacted, to res ${uncompactRes}`,
      RUNS,
      w8Async.stats,
      undefined,
      sameStrings(sortedHex(w8Async.value), w8Hex),
      `${compacted.length} cells in, ${w8Async.value.length} cells out`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const parent = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, CHILDREN_PARENT_RES)
  const referenceParent = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, CHILDREN_PARENT_RES)
  const w9 = await timeRuns(signal, RUNS, () => cellToChildren(parent, CHILDREN_RES))
  if (w9 == null) {
    return undefined
  }
  const w9Reference = await timeRuns(signal, RUNS, () =>
    h3.cellToChildren(referenceParent, CHILDREN_RES),
  )
  if (w9Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      `W9 cellToChildren, res ${CHILDREN_PARENT_RES} to res ${CHILDREN_RES}`,
      RUNS,
      w9.stats,
      w9Reference.stats,
      sameCells(w9.value, w9Reference.value),
      `${w9.value.length} children of ${parent.toString(16)}`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const berlin = latLngToCell(BERLIN.lat, BERLIN.lng, PATH_RES)
  const hamburg = latLngToCell(HAMBURG.lat, HAMBURG.lng, PATH_RES)
  const referenceBerlin = h3.latLngToCell(BERLIN.lat, BERLIN.lng, PATH_RES)
  const referenceHamburg = h3.latLngToCell(HAMBURG.lat, HAMBURG.lng, PATH_RES)
  const w10 = await timeRuns(signal, RUNS, () => {
    let last: BigUint64Array = new BigUint64Array(0)
    for (let i = 0; i < CALLS_PER_RUN; i++) {
      last = gridPathCells(berlin, hamburg)
    }
    return last
  })
  if (w10 == null) {
    return undefined
  }
  const w10Reference = await timeRuns(signal, RUNS, () => {
    let last: string[] = []
    for (let i = 0; i < CALLS_PER_RUN; i++) {
      last = h3.gridPathCells(referenceBerlin, referenceHamburg)
    }
    return last
  })
  if (w10Reference == null) {
    return undefined
  }
  rows.push(
    toRow(
      `W10 gridPathCells, Berlin to Hamburg, res ${PATH_RES} x 1,000`,
      RUNS,
      w10.stats,
      w10Reference.stats,
      sameCellsInOrder(w10.value, w10Reference.value),
      `${w10.value.length} cells per path`,
    ),
  )

  return { rows, seconds: (now() - started) / 1000 }
}
