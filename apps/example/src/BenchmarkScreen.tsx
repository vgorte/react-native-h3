import h3 from 'h3-js'
import React from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { LatLng, Ring } from 'react-native-h3'
import {
  cellsToMultiPolygon,
  cellToBoundary,
  cellToLatLng,
  compactCells,
  gridDisk,
  latLngToCell,
  polygonToCells,
  polygonToCellsAsync,
} from 'react-native-h3'

const SAN_FRANCISCO = { lat: 37.7749, lng: -122.4194 }

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
// one `polygonToCells` costs `h3-js` over twenty seconds, so W3 gets far fewer runs
const RUNS_W3 = 3
const CALLS = 100_000
const DISK_K = 20
const EPSILON = 1e-9
// the unified log on iOS truncates a message at about a kilobyte
const CHUNK = 700

interface Stats {
  median: number
  p95: number
  min: number
  max: number
}

interface Row {
  workload: string
  runs: number
  millis: number
  referenceMillis: number | undefined
  stats: Stats
  referenceStats: Stats | undefined
  equivalent: boolean
  detail: string
}

interface Payload {
  rows: {
    workload: string
    runs: number
    millis: number
    referenceMillis: number | null
    equivalent: boolean
    stats: { millis: Stats; referenceMillis: Stats | null }
    detail: string
  }[]
  measuredOn: {
    platform: string
    osVersion: string
    build: string
    reactNative: string
    hermes: string
    h3js: string
    date: string
    warmupRuns: number
    durationSeconds: number
  }
}

// Metro defines `__DEV__` as a global; reading it off `globalThis` needs no ambient declaration,
// which this app's empty `types` list (`tsconfig.json`) would not provide.
function isDebugBuild(): boolean {
  return (globalThis as { __DEV__?: boolean }).__DEV__ === true
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

// the warm-up pass is untimed; its result is what the equivalence check and the detail read
function timeRuns<T>(runs: number, body: () => T): Timed<T> {
  const value = body()
  const samples: number[] = []
  for (let index = 0; index < runs; index++) {
    const start = now()
    body()
    samples.push(now() - start)
  }
  return { value, stats: statsOf(samples) }
}

async function timeRunsAsync<T>(runs: number, body: () => Promise<T>): Promise<Timed<T>> {
  const value = await body()
  const samples: number[] = []
  for (let index = 0; index < runs; index++) {
    const start = now()
    await body()
    samples.push(now() - start)
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

/**
 * Carries the request to abandon a run to the workload boundaries.
 */
interface RunSignal {
  cancelled: boolean
}

// The workloads are one uninterrupted block of synchronous JavaScript, so nothing the app has drawn,
// the tab bar included, can react while a run is on. A macrotask between them lets the queued
// presses through and gives the screen a chance to say the run is no longer wanted.
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

async function runBenchmark(
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

  const w1 = timeRuns(RUNS, () => {
    let last = 0n
    for (let i = 0; i < CALLS; i++) {
      last = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
    }
    return last
  })
  const w1Reference = timeRuns(RUNS, () => {
    let last = ''
    for (let i = 0; i < CALLS; i++) {
      last = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
    }
    return last
  })
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

  const w2 = timeRuns(RUNS, () => {
    let last = disk
    for (let i = 0; i < 1_000; i++) {
      last = gridDisk(origin, DISK_K)
    }
    return last
  })
  const w2Reference = timeRuns(RUNS, () => {
    let last = referenceDisk
    for (let i = 0; i < 1_000; i++) {
      last = h3.gridDisk(referenceOrigin, DISK_K)
    }
    return last
  })
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

  const w3 = timeRuns(RUNS_W3, () => polygonToCells(SAN_FRANCISCO_POLYGON, 12))
  const w3Reference = timeRuns(RUNS_W3, () => h3.polygonToCells(SAN_FRANCISCO_POLYGON, 12))
  const w3Hex = sortedHex(w3.value)
  rows.push(
    toRow(
      'W3 polygonToCells, SF, res 12',
      RUNS_W3,
      w3.stats,
      w3Reference.stats,
      sameCells(w3.value, w3Reference.value),
      `${w3.value.length} cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w3Async = await timeRunsAsync(RUNS_W3, () => polygonToCellsAsync(SAN_FRANCISCO_POLYGON, 12))
  rows.push(
    toRow(
      'W3 polygonToCellsAsync, SF, res 12',
      RUNS_W3,
      w3Async.stats,
      undefined,
      sameStrings(sortedHex(w3Async.value), w3Hex),
      `${w3Async.value.length} cells`,
    ),
  )

  if (await pause(signal)) {
    return undefined
  }

  const w4 = timeRuns(RUNS, () => compactCells(disk))
  const w4Reference = timeRuns(RUNS, () => h3.compactCells(referenceDisk))
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

  const w5 = timeRuns(RUNS, () => cellsToMultiPolygon(disk))
  const w5Reference = timeRuns(RUNS, () => h3.cellsToMultiPolygon(referenceDisk))
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

  const w6 = timeRuns(RUNS, () => {
    let last: LatLng = { lat: 0, lng: 0 }
    for (let i = 0; i < CALLS; i++) {
      last = cellToLatLng(cells[i % cells.length] as bigint)
    }
    return last
  })
  const w6Reference = timeRuns(RUNS, () => {
    let last: number[] = []
    for (let i = 0; i < CALLS; i++) {
      last = h3.cellToLatLng(referenceDisk[i % referenceDisk.length] as string)
    }
    return last
  })
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

  const w7 = timeRuns(RUNS, () => {
    let last: LatLng[] = []
    for (let i = 0; i < CALLS; i++) {
      last = cellToBoundary(cells[i % cells.length] as bigint)
    }
    return last
  })
  const w7Reference = timeRuns(RUNS, () => {
    let last: number[][] = []
    for (let i = 0; i < CALLS; i++) {
      last = h3.cellToBoundary(referenceDisk[i % referenceDisk.length] as string)
    }
    return last
  })
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

  return { rows, seconds: (now() - started) / 1000 }
}

function reactNativeVersion(): string {
  const { major, minor, patch } = Platform.constants.reactNativeVersion
  return `${major}.${minor}.${patch}`
}

function hermesVersion(): string {
  const hermes = (
    globalThis as { HermesInternal?: { getRuntimeProperties?(): Record<string, string> } }
  ).HermesInternal
  return hermes?.getRuntimeProperties?.()['OSS Release Version'] ?? 'unknown'
}

function formatMillis(millis: number): string {
  return millis < 1 ? millis.toFixed(3) : millis.toFixed(1)
}

function caption(rows: Row[], seconds: number): string {
  const build = isDebugBuild() ? 'Debug, not usable' : 'Release'
  const differing = rows.filter((row) => !row.equivalent).map((row) => row.workload)
  const warning =
    differing.length === 0 ? '' : ` RESULTS DIFFER FROM h3-js: ${differing.join(', ')}.`
  return (
    `Measured on ${Platform.OS} ${String(Platform.Version)}, ${build}, ` +
    `react-native ${reactNativeVersion()}, Hermes ${hermesVersion()}, against h3-js 4.5.0; ` +
    `median of ${RUNS} runs (${RUNS_W3} for W3) after one warm-up, ${seconds.toFixed(0)} s total.` +
    warning
  )
}

function toMarkdown(rows: Row[], seconds: number): string {
  const header =
    '| Workload | react-native-h3 | h3-js | Equivalent | Result |\n|---|---:|---:|:-:|---|'
  const body = rows
    .map((row) => {
      const reference =
        row.referenceMillis == null ? 'n/a' : `${formatMillis(row.referenceMillis)} ms`
      const equivalent = row.equivalent ? 'yes' : 'no'
      return `| ${row.workload} | ${formatMillis(row.millis)} ms | ${reference} | ${equivalent} | ${row.detail} |`
    })
    .join('\n')
  return `${header}\n${body}\n\n${caption(rows, seconds)}`
}

// `null`, not `undefined`: `JSON.stringify` would drop the key entirely
function toPayload(rows: Row[], seconds: number): Payload {
  return {
    rows: rows.map((row) => ({
      workload: row.workload,
      runs: row.runs,
      millis: row.millis,
      referenceMillis: row.referenceMillis ?? null,
      equivalent: row.equivalent,
      stats: { millis: row.stats, referenceMillis: row.referenceStats ?? null },
      detail: row.detail,
    })),
    measuredOn: {
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      build: isDebugBuild() ? 'Debug' : 'Release',
      reactNative: reactNativeVersion(),
      hermes: hermesVersion(),
      h3js: '4.5.0',
      date: new Date().toISOString().slice(0, 10),
      warmupRuns: 1,
      durationSeconds: Number(seconds.toFixed(1)),
    },
  }
}

// `os_log` trims a line's outer whitespace and rewrites a backslash, so neither a raw nor a quoted
// chunk survives intact; the bars pin both edges.
function logPayload(payload: Payload): void {
  const text = JSON.stringify(payload)
  const total = Math.ceil(text.length / CHUNK)
  for (let index = 0; index < total; index++) {
    const chunk = text.slice(index * CHUNK, (index + 1) * CHUNK)
    console.log(`BENCHMARK_JSON ${index + 1}/${total} |${chunk}|`)
  }
}

/**
 * Renders the benchmark behind the README's table, timing each workload against `h3-js` in the same
 * engine and the same run.
 *
 * Only a Release build says anything: a Debug build is several times slower, and the caption records
 * which one produced the numbers.
 */
export function BenchmarkScreen(): React.JSX.Element {
  const [result, setResult] = React.useState<{ rows: Row[]; seconds: number } | undefined>(
    undefined,
  )
  const [running, setRunning] = React.useState(false)
  const signal = React.useRef<RunSignal | undefined>(undefined)

  // leaving the tab abandons the run, so the thread goes back to the app instead of finishing
  // measurements nothing will read
  React.useEffect(() => {
    return () => {
      if (signal.current != null) {
        signal.current.cancelled = true
      }
    }
  }, [])

  const run = React.useCallback(() => {
    const current: RunSignal = { cancelled: false }
    signal.current = current
    setRunning(true)
    setResult(undefined)
    // a frame, so the spinner paints before the first workload takes the thread
    requestAnimationFrame(() => {
      void runBenchmark(current)
        .then((measured) => {
          if (measured == null) {
            return
          }
          setResult(measured)
          console.log(toMarkdown(measured.rows, measured.seconds))
          logPayload(toPayload(measured.rows, measured.seconds))
        })
        .finally(() => {
          setRunning(false)
        })
    })
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Benchmark</Text>
      <Text style={styles.note}>
        Run this in a Release build. Numbers from a Debug build must not go in the README. The run
        takes several minutes and the app only answers between workloads: h3-js alone needs roughly
        23 seconds for every one of its W3 passes. Leaving this tab abandons the run.
      </Text>
      <Pressable style={styles.button} onPress={run} disabled={running}>
        <Text style={styles.buttonLabel}>{running ? 'Running' : 'Run benchmark'}</Text>
      </Pressable>
      {running ? <ActivityIndicator style={styles.spinner} /> : undefined}
      {result == null ? undefined : (
        <View style={styles.results}>
          {result.rows.map((row) => (
            <Text key={row.workload} style={styles.line}>
              {`${row.workload}: ${formatMillis(row.millis)} ms (${row.detail})`}
            </Text>
          ))}
          <Text style={styles.markdown}>{toMarkdown(result.rows, result.seconds)}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 8 },
  note: { fontSize: 13, marginBottom: 16 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1f6feb',
  },
  buttonLabel: { color: 'white', fontSize: 16, textAlign: 'center' },
  spinner: { marginTop: 16 },
  results: { marginTop: 20, gap: 4 },
  line: { fontFamily: 'Courier', fontSize: 13 },
  markdown: { fontFamily: 'Courier', fontSize: 11, marginTop: 16 },
})
