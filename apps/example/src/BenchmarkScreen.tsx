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

// the warm-up pass is untimed; its result is what the equivalence check and the detail read.
// A pause outside every `now()` window keeps the longest freeze at one run instead of all of them.
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

// carries the request to abandon a run to the sample and workload boundaries
interface RunSignal {
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
    for (let i = 0; i < 1_000; i++) {
      last = gridDisk(origin, DISK_K)
    }
    return last
  })
  if (w2 == null) {
    return undefined
  }
  const w2Reference = await timeRuns(signal, RUNS, () => {
    let last = referenceDisk
    for (let i = 0; i < 1_000; i++) {
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

  const w3 = await timeRuns(signal, RUNS_W3, () => polygonToCells(SAN_FRANCISCO_POLYGON, 12))
  if (w3 == null) {
    return undefined
  }
  const w3Reference = await timeRuns(signal, RUNS_W3, () =>
    h3.polygonToCells(SAN_FRANCISCO_POLYGON, 12),
  )
  if (w3Reference == null) {
    return undefined
  }
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

  const w3Async = await timeRunsAsync(signal, RUNS_W3, () =>
    polygonToCellsAsync(SAN_FRANCISCO_POLYGON, 12),
  )
  if (w3Async == null) {
    return undefined
  }
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

// a missing reference and an unmeasurable own time both mean no factor, as in the SVG script
function factorOf(row: Row): number | undefined {
  if (row.referenceMillis == null || row.millis <= 0) {
    return undefined
  }
  return row.referenceMillis / row.millis
}

function formatFactor(factor: number): string {
  return factor >= 10 ? factor.toFixed(0) : factor.toFixed(1)
}

// the rule `scripts/benchmark-svg.mjs` applies to the chart: a row under a millisecond of
// `react-native-h3` time measures `h3-js` string marshalling rather than the work, so the headline
// skips it, takes the widest remaining factor and rounds down to a ten
const HEADLINE_MIN_MILLIS = 1

function headlineFactor(rows: Row[]): number | undefined {
  const factors = rows
    .filter((row) => row.millis >= HEADLINE_MIN_MILLIS)
    .map(factorOf)
    .filter((factor): factor is number => factor != null)
  if (factors.length === 0) {
    return undefined
  }
  return Math.floor(Math.max(...factors) / 10) * 10
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

function Measure({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.measure}>
      <Text style={styles.measureLabel}>{label}</Text>
      <Text style={styles.measureValue}>{value}</Text>
    </View>
  )
}

function WorkloadCard({ row }: { row: Row }): React.JSX.Element {
  const factor = factorOf(row)
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.workload}>{row.workload}</Text>
        <Text style={row.equivalent ? styles.equivalent : styles.differs}>
          {row.equivalent ? 'yes' : 'no'}
        </Text>
      </View>
      <View style={styles.measures}>
        <Measure label="react-native-h3" value={`${formatMillis(row.millis)} ms`} />
        <Measure
          label="h3-js"
          value={row.referenceMillis == null ? 'n/a' : `${formatMillis(row.referenceMillis)} ms`}
        />
        <View style={styles.measure}>
          <Text style={styles.measureLabel}>factor</Text>
          <Text style={styles.factor}>{factor == null ? 'n/a' : `${formatFactor(factor)}×`}</Text>
        </View>
      </View>
      <Text style={styles.detail}>{row.detail}</Text>
    </View>
  )
}

function Results({ rows, seconds }: { rows: Row[]; seconds: number }): React.JSX.Element {
  const headline = headlineFactor(rows)
  return (
    <View style={styles.results}>
      <View style={styles.summary}>
        <Text style={styles.summaryFactor}>
          {headline == null ? 'no factor measured' : `up to ${headline}× faster than h3-js`}
        </Text>
        <Text
          style={styles.summaryMeta}
        >{`${rows.length} workloads, ${seconds.toFixed(0)} s`}</Text>
      </View>
      {rows.map((row) => (
        <WorkloadCard key={row.workload} row={row} />
      ))}
      <Text style={styles.caption}>{caption(rows, seconds)}</Text>
    </View>
  )
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
          // an abandoned run must not touch the state of a screen that is gone
          if (!current.cancelled) {
            setRunning(false)
          }
        })
    })
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Benchmark</Text>
      <Text style={styles.note}>
        Run this in a Release build. Numbers from a Debug build must not go in the README. The run
        takes several minutes and the app only answers between measurements: one h3-js W3 pass alone
        needs roughly 23 seconds. Leaving this tab abandons the run.
      </Text>
      <Pressable style={styles.button} onPress={run} disabled={running}>
        <Text style={styles.buttonLabel}>{running ? 'Running' : 'Run benchmark'}</Text>
      </Pressable>
      {running ? <ActivityIndicator style={styles.spinner} /> : undefined}
      {result == null ? undefined : <Results rows={result.rows} seconds={result.seconds} />}
    </ScrollView>
  )
}

const HIGHLIGHT = '#1a7f37'
const MUTED = '#6b6b6b'

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
  results: { marginTop: 20, gap: 10 },
  summary: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryFactor: { fontSize: 17, fontWeight: '700', color: HIGHLIGHT },
  summaryMeta: { fontSize: 13, color: MUTED },
  card: { borderWidth: 1, borderColor: '#e4e4e4', borderRadius: 10, padding: 12, gap: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  workload: { flex: 1, fontSize: 14, fontWeight: '600' },
  equivalent: { fontSize: 13, fontWeight: '700', color: HIGHLIGHT },
  differs: { fontSize: 13, fontWeight: '700', color: '#b3261e' },
  measures: { flexDirection: 'row', gap: 12 },
  measure: { flex: 1, gap: 2 },
  measureLabel: { fontSize: 11, color: MUTED },
  measureValue: { fontSize: 15, fontVariant: ['tabular-nums'] },
  factor: { fontSize: 15, fontWeight: '700', color: HIGHLIGHT, fontVariant: ['tabular-nums'] },
  detail: { fontSize: 12, color: MUTED },
  caption: { fontSize: 11, lineHeight: 16, color: MUTED, marginTop: 6 },
})
