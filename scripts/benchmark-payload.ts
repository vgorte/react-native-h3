/**
 * Validates the payload the example app's Benchmark screen logs, the one `benchmark-svg.mjs`
 * renders and `benchmark-device.ts` captures off a device.
 *
 * Both entry points share this module so a payload that renders a chart is exactly a payload a
 * device run accepts, and a `Debug` build is refused in one place.
 */

/** One measured workload, as the screen writes it into the payload. */
export interface BenchmarkRow {
  workload: string
  runs: number
  millis: number
  referenceMillis: number | null
  equivalent?: boolean
  detail: string
  // only a transcribed payload carries a factor; a measured one is recomputed from the medians
  factor?: number
}

/** The run's provenance block, written by the screen rather than by hand. */
export interface BenchmarkMeasuredOn {
  platform: string
  device?: string
  osVersion: string
  build: string
  reactNative: string
  hermes?: string
  h3js: string
  date: string
  warmupRuns: number
  durationSeconds?: number
}

/** A complete benchmark payload: the rows, and the conditions they were measured under. */
export interface BenchmarkPayload {
  rows: BenchmarkRow[]
  measuredOn: BenchmarkMeasuredOn
  source?: string
}

/** Throws the validation error for `field`, naming `source` so a reader knows which payload failed. */
export function failPayload(source: string, field: string, expectation: string): never {
  throw new Error(`${source}: \`${field}\` ${expectation}`)
}

function requireString(source: string, value: unknown, field: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    failPayload(source, field, 'must be a non-empty string')
  }
}

/** Returns `payload` once every field a chart or a published table reads is present and sane. */
export function validatePayload(payload: unknown, source: string): BenchmarkPayload {
  if (payload == null || typeof payload !== 'object') {
    failPayload(source, 'payload', 'must be an object')
  }
  const root = payload as Record<string, unknown>
  const rows = root.rows
  if (!Array.isArray(rows) || rows.length === 0) {
    failPayload(source, 'rows', 'must be a non-empty array')
  }
  rows.forEach((entry: unknown, index: number) => {
    const at = `rows[${index}]`
    if (entry == null || typeof entry !== 'object') {
      failPayload(source, at, 'must be an object')
    }
    const row = entry as Record<string, unknown>
    requireString(source, row.workload, `${at}.workload`)
    requireString(source, row.detail, `${at}.detail`)
    if (!Number.isInteger(row.runs) || (row.runs as number) <= 0) {
      failPayload(source, `${at}.runs`, 'must be an integer greater than 0')
    }
    // a zero median is real, below clock resolution; `toBars` skips it
    if (!Number.isFinite(row.millis) || (row.millis as number) < 0) {
      failPayload(source, `${at}.millis`, 'must be a finite number of 0 or more')
    }
    const reference = row.referenceMillis
    if (reference !== null && (typeof reference !== 'number' || !Number.isFinite(reference))) {
      failPayload(source, `${at}.referenceMillis`, 'must be a finite number or null')
    }
    // optional, and only a transcribed payload carries it; see the header comment
    const factor = row.factor
    if (factor != null && (!Number.isFinite(factor) || (factor as number) <= 0)) {
      failPayload(source, `${at}.factor`, 'must be a finite number greater than 0, or absent')
    }
  })
  if (root.source !== undefined) {
    requireString(source, root.source, 'source')
  }
  const measuredOn = root.measuredOn
  if (measuredOn == null || typeof measuredOn !== 'object') {
    failPayload(source, 'measuredOn', 'must be an object')
  }
  const conditions = measuredOn as Record<string, unknown>
  for (const field of ['platform', 'osVersion', 'build', 'reactNative', 'h3js', 'date']) {
    requireString(source, conditions[field], `measuredOn.${field}`)
  }
  // the screen only reads a model on Android, so a payload without one stays valid
  if (conditions.device !== undefined) {
    requireString(source, conditions.device, 'measuredOn.device')
  }
  if (!Number.isInteger(conditions.warmupRuns) || (conditions.warmupRuns as number) < 0) {
    failPayload(source, 'measuredOn.warmupRuns', 'must be an integer of 0 or more')
  }
  // a Debug build is several times slower on the native side, so its factors are not comparable
  if ((conditions.build as string).startsWith('Debug')) {
    failPayload(
      source,
      'measuredOn.build',
      'is `Debug`: a Debug build is several times slower on the native side and its numbers must ' +
        'not be published, re-run the benchmark screen in a Release build',
    )
  }
  return payload as BenchmarkPayload
}
