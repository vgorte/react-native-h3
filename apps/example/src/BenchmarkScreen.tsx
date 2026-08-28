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
import type { Ring } from 'react-native-h3'
import {
  cellsToMultiPolygon,
  compactCells,
  gridDisk,
  latLngToCell,
  polygonToCells,
  polygonToCellsAsync,
} from 'react-native-h3'

const SAN_FRANCISCO = { lat: 37.7749, lng: -122.4194 }

// the polygon of the measurement that justified the package: San Francisco, res 12, 412,459 cells
const SAN_FRANCISCO_POLYGON: Ring[] = [
  [
    [37.81331899998324, -122.40898669999721],
    [37.71980619999785, -122.35447369999936],
    [37.70761319999757, -122.5123436999984],
    [37.78358719999717, -122.5247187000022],
    [37.815157199999845, -122.4798767000009],
  ],
]

interface Row {
  workload: string
  millis: number
  referenceMillis: number | undefined
  detail: string
}

interface Payload {
  rows: {
    workload: string
    millis: number
    referenceMillis: number | null
    detail: string
  }[]
  measuredOn: {
    platform: string
    osVersion: string
    build: string
    h3js: string
    date: string
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

function measure(workload: string, subject: () => string, reference: () => string): Row {
  const start = now()
  const detail = subject()
  const millis = now() - start

  const referenceStart = now()
  reference()
  const referenceMillis = now() - referenceStart

  return { workload, millis, referenceMillis, detail }
}

// `h3-js` has no asynchronous form, so a row measured this way has no reference column.
async function measureAsync(workload: string, subject: () => Promise<string>): Promise<Row> {
  const start = now()
  const detail = await subject()
  return { workload, millis: now() - start, referenceMillis: undefined, detail }
}

async function runBenchmark(): Promise<Row[]> {
  const origin = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
  const disk = gridDisk(origin, 20)
  // `h3-js` stays in its own hexadecimal-string world; converting either side would time the conversion
  const referenceOrigin = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
  const referenceDisk = h3.gridDisk(referenceOrigin, 20)

  return [
    measure(
      'W1 latLngToCell x 100,000',
      () => {
        let last = 0n
        for (let i = 0; i < 100_000; i++) {
          last = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
        }
        return last.toString(16)
      },
      () => {
        let last = ''
        for (let i = 0; i < 100_000; i++) {
          last = h3.latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
        }
        return last
      },
    ),
    measure(
      'W2 gridDisk(k=20) x 1,000',
      () => {
        let total = 0
        for (let i = 0; i < 1_000; i++) {
          total += gridDisk(origin, 20).length
        }
        return `${total / 1_000} cells per call`
      },
      () => {
        let total = 0
        for (let i = 0; i < 1_000; i++) {
          total += h3.gridDisk(referenceOrigin, 20).length
        }
        return `${total / 1_000} cells per call`
      },
    ),
    measure(
      'W3 polygonToCells, SF, res 12',
      () => `${polygonToCells(SAN_FRANCISCO_POLYGON, 12).length} cells`,
      () => `${h3.polygonToCells(SAN_FRANCISCO_POLYGON, 12).length} cells`,
    ),
    await measureAsync(
      'W3 polygonToCellsAsync, SF, res 12',
      async () => `${(await polygonToCellsAsync(SAN_FRANCISCO_POLYGON, 12)).length} cells`,
    ),
    measure(
      'W4 compactCells of a k=20 disk',
      () => `${compactCells(disk).length} cells`,
      () => `${h3.compactCells(referenceDisk).length} cells`,
    ),
    measure(
      'W5 cellsToMultiPolygon of a k=20 disk',
      () => `${cellsToMultiPolygon(disk).length} polygons`,
      () => `${h3.cellsToMultiPolygon(referenceDisk).length} polygons`,
    ),
  ]
}

function caption(): string {
  const build = isDebugBuild() ? 'Debug, not usable' : 'Release'
  return `Measured on ${Platform.OS} ${String(Platform.Version)}, ${build}, against h3-js 4.5.0.`
}

function toMarkdown(rows: Row[]): string {
  const header = '| Workload | react-native-h3 | h3-js | Result |\n|---|---:|---:|---|'
  const body = rows
    .map((row) => {
      const reference = row.referenceMillis == null ? 'n/a' : `${row.referenceMillis.toFixed(1)} ms`
      return `| ${row.workload} | ${row.millis.toFixed(1)} ms | ${reference} | ${row.detail} |`
    })
    .join('\n')
  return `${header}\n${body}\n\n${caption()}`
}

// `scripts/benchmark-svg.mjs` reads this shape from `apps/example/benchmark.json`; a row without a
// reference carries `null` rather than being dropped by `JSON.stringify`.
function toPayload(rows: Row[]): Payload {
  return {
    rows: rows.map((row) => ({
      workload: row.workload,
      millis: row.millis,
      referenceMillis: row.referenceMillis ?? null,
      detail: row.detail,
    })),
    measuredOn: {
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      build: isDebugBuild() ? 'Debug' : 'Release',
      h3js: '4.5.0',
      date: new Date().toISOString().slice(0, 10),
    },
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
  const [rows, setRows] = React.useState<Row[] | undefined>(undefined)
  const [running, setRunning] = React.useState(false)

  const run = React.useCallback(() => {
    setRunning(true)
    setRows(undefined)
    // a frame, so the spinner paints before the synchronous workloads block the thread
    requestAnimationFrame(() => {
      void runBenchmark().then((result) => {
        setRows(result)
        setRunning(false)
        console.log(toMarkdown(result))
        console.log(`BENCHMARK_JSON ${JSON.stringify(toPayload(result))}`)
      })
    })
  }, [])

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Benchmark</Text>
      <Text style={styles.note}>
        Run this in a Release build. Numbers from a Debug build must not go in the README. The run
        takes about half a minute: h3-js needs roughly 23 seconds for W3 on its own, and the app is
        unresponsive while it does.
      </Text>
      <Pressable style={styles.button} onPress={run} disabled={running}>
        <Text style={styles.buttonLabel}>{running ? 'Running' : 'Run benchmark'}</Text>
      </Pressable>
      {running ? <ActivityIndicator style={styles.spinner} /> : undefined}
      {rows == null ? undefined : (
        <View style={styles.results}>
          {rows.map((row) => (
            <Text key={row.workload} style={styles.line}>
              {`${row.workload}: ${row.millis.toFixed(1)} ms (${row.detail})`}
            </Text>
          ))}
          <Text style={styles.markdown}>{toMarkdown(rows)}</Text>
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
