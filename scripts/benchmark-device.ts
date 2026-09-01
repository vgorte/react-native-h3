/**
 * Runs the example app's benchmark on a connected device and writes the payload it logged.
 *
 * The results live only in the screen's React state, so nothing may relaunch the app once a run has
 * started. Everything that touches the app therefore happens up front: the automation runner is
 * installed and log capture is started before the first tap, and the payload is read out of the
 * captured log rather than off the screen.
 *
 * Usage:
 *   bun run benchmark:device --platform ios --udid <udid> --out <file>
 *   bun run benchmark:device --platform android --serial <serial> --out <file>
 *
 *   --app <id>              bundle id or package name, defaults to the example app
 *   --timeout-minutes <n>   ceiling for the whole run, default 45
 *   --publish               allow `--out apps/example/benchmark.json`, the published payload
 */

import { readFileSync, rmSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { BenchmarkPayload, BenchmarkRow } from './benchmark-payload'
import { validatePayload } from './benchmark-payload'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLISHED = join(ROOT, 'apps', 'example', 'benchmark.json')

// the same ids `scripts/build-device-release.sh` builds and installs
const IOS_BUNDLE_ID = 'org.reactjs.native.example.H3Example'
const ANDROID_PACKAGE = 'com.h3example'

// the runner build reads these from the environment; a free personal team cannot use the defaults
const IOS_RUNNER_VARS = [
  'AGENT_DEVICE_IOS_TEAM_ID',
  'AGENT_DEVICE_IOS_RUNNER_APP_BUNDLE_ID',
  'AGENT_DEVICE_IOS_RUNNER_TEST_BUNDLE_ID',
]

// `BenchmarkScreen.logPayload` pins both chunk edges with a bar, because the log trims whitespace
const CHUNK_LINE = /BENCHMARK_JSON (\d+)\/(\d+) \|(.*)\|/
const FAILURE_MARKER = 'benchmark run failed'
const CAPTION_TAIL = 's total.'

const POLL_MS = 5_000
const PROGRESS_MS = 60_000
// the failure path logs its partial payload after the message, so the chunks get a grace window
const FAILURE_GRACE_MS = 60_000

interface Options {
  platform: 'ios' | 'android'
  device: string
  app: string
  out: string
  timeoutMinutes: number
  publish: boolean
  session: string
}

interface Outcome {
  ok: boolean
  data: Record<string, unknown>
  message: string
}

/** The `BENCHMARK_JSON` lines of one payload, keyed by their one-based index. */
export interface Chunks {
  total: number
  parts: Map<number, string>
}

function usage(message: string): never {
  console.error(`benchmark-device: ${message}`)
  console.error('Usage: bun run benchmark:device --platform ios|android')
  console.error('       --udid <udid> | --serial <serial> --out <file>')
  console.error('       [--app <id>] [--timeout-minutes <n>] [--publish]')
  process.exit(1)
}

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>()
  let publish = false
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] as string
    if (arg === '--publish') {
      publish = true
      continue
    }
    if (!arg.startsWith('--')) {
      usage(`unexpected argument \`${arg}\``)
    }
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      usage(`\`${arg}\` needs a value`)
    }
    flags.set(arg.slice(2), value)
    index += 1
  }

  const platform = flags.get('platform')
  if (platform !== 'ios' && platform !== 'android') {
    usage('`--platform` must be `ios` or `android`')
  }
  const device = flags.get(platform === 'ios' ? 'udid' : 'serial')
  if (device === undefined) {
    usage(platform === 'ios' ? '`--udid` is required on ios' : '`--serial` is required on android')
  }
  const out = flags.get('out')
  if (out === undefined) {
    usage('`--out` is required')
  }
  const timeoutMinutes = Number(flags.get('timeout-minutes') ?? '45')
  if (!Number.isFinite(timeoutMinutes) || timeoutMinutes <= 0) {
    usage('`--timeout-minutes` must be a positive number')
  }
  const resolved = resolve(out)
  if (resolved === PUBLISHED && !publish) {
    usage(
      `\`${resolved}\` is the published payload; pass \`--publish\` to overwrite it, or write the ` +
        'run somewhere else and copy it in once the numbers have been reviewed',
    )
  }
  return {
    platform,
    device,
    app: flags.get('app') ?? (platform === 'ios' ? IOS_BUNDLE_ID : ANDROID_PACKAGE),
    out: resolved,
    timeoutMinutes,
    publish,
    // unique per invocation: a session named for the device alone could be closed by any other
    // invocation, and closing the session ends the runner, which terminates the app mid-run
    session: `h3bench-${platform}-${Date.now().toString(36)}`,
  }
}

function target(options: Options): string[] {
  return [
    '--session',
    options.session,
    '--platform',
    options.platform,
    options.platform === 'ios' ? '--udid' : '--serial',
    options.device,
  ]
}

function agentDevice(args: string[]): Outcome {
  const spawned = Bun.spawnSync(['agent-device', ...args, '--json'])
  const stdout = spawned.stdout.toString()
  const stderr = spawned.stderr.toString()
  let parsed: { success?: boolean; data?: unknown; error?: Record<string, unknown> }
  try {
    parsed = JSON.parse(stdout)
  } catch {
    const text = (stderr || stdout).trim()
    return { ok: false, data: {}, message: text === '' ? 'no output' : text }
  }
  const error = parsed.error
  const hint = error?.hint
  return {
    ok: parsed.success === true,
    data: (parsed.data ?? {}) as Record<string, unknown>,
    message:
      error == null
        ? ''
        : `${String(error.code)}: ${String(error.message)}${hint == null ? '' : ` ${String(hint)}`}`,
  }
}

function step(label: string): void {
  console.log(label)
}

/** Returns the pids of the running `agent-device` daemons, or `undefined` when `pgrep` fails. */
function daemonPids(): number[] | undefined {
  try {
    const spawned = Bun.spawnSync(['pgrep', '-f', 'internal/daemon'])
    // `pgrep` exits 1 when nothing matches, which is not an error here
    if (spawned.exitCode !== 0 && spawned.exitCode !== 1) {
      return undefined
    }
    return spawned.stdout
      .toString()
      .split('\n')
      .map((line) => Number(line.trim()))
      .filter((pid) => Number.isInteger(pid) && pid > 0)
  } catch {
    return undefined
  }
}

/** Returns the runner variables missing from the environment of `pid`, or `undefined` on failure. */
function daemonMissingVars(pid: number): string[] | undefined {
  try {
    // `ps eww` prints the command line followed by the process environment as `NAME=value` pairs
    const spawned = Bun.spawnSync(['ps', 'eww', '-p', String(pid)])
    if (spawned.exitCode !== 0) {
      return undefined
    }
    const environment = spawned.stdout.toString()
    return IOS_RUNNER_VARS.filter((name) => !environment.includes(`${name}=`))
  } catch {
    return undefined
  }
}

/**
 * Throws when an `agent-device` daemon is already running without the runner variables.
 *
 * The daemon builds the XCTest runner with its own environment, and it outlives the call that
 * spawned it, so the script's own variables never reach a daemon that started without them.
 */
function checkDaemonEnvironment(): void {
  const pids = daemonPids()
  if (pids === undefined) {
    console.warn('  note: could not check the agent-device daemon environment; continuing')
    return
  }
  for (const pid of pids) {
    const missing = daemonMissingVars(pid)
    if (missing === undefined) {
      console.warn(`  note: could not read the environment of daemon ${pid}; continuing`)
      continue
    }
    if (missing.length > 0) {
      throw new Error(
        `The agent-device daemon (pid ${pid}) was started without ${missing.join(', ')}. The ` +
          'runner build happens inside the daemon, so it would fall back to ids this team cannot ' +
          `sign. Stop it with \`kill ${pid}\` and rerun; the next agent-device call respawns it ` +
          'with the current environment.',
      )
    }
  }
}

function preflight(options: Options): void {
  if (options.platform === 'ios') {
    const missing = IOS_RUNNER_VARS.filter((name) => (process.env[name] ?? '') === '')
    if (missing.length > 0) {
      throw new Error(
        `The physical-iOS automation runner needs ${missing.join(', ')} in the environment. A free ` +
          'personal team cannot register the default runner ids, and the runner build reads these ' +
          'from `process.env`; the reference values are in `.mcp.json`.',
      )
    }
    // before `agent-device devices`, because that call spawns a daemon when none is running
    checkDaemonEnvironment()
  }

  const listed = agentDevice(['devices'])
  if (!listed.ok) {
    throw new Error(`\`agent-device devices\` failed. ${listed.message}`)
  }
  const devices = (listed.data.devices ?? []) as { id?: string; name?: string; kind?: string }[]
  if (!devices.some((device) => device.id === options.device)) {
    const known = devices
      .filter((device) => device.kind === 'device')
      .map((device) => `${String(device.id)} (${String(device.name)})`)
    throw new Error(
      `\`${options.device}\` is not connected. Connected devices: ${known.join(', ') || 'none'}.`,
    )
  }

  const apps = agentDevice(['apps', ...target(options)])
  if (!apps.ok) {
    console.warn(`  note: could not list installed apps (${apps.message}); continuing`)
    return
  }
  // `agent-device apps` prints either the bare id or `Name (id)`
  const installed = (apps.data.apps ?? []) as string[]
  const carries = (entry: string): boolean =>
    entry === options.app || entry.endsWith(`(${options.app})`)
  if (installed.length > 0 && !installed.some(carries)) {
    throw new Error(
      `\`${options.app}\` is not installed on \`${options.device}\`. Build and install it with ` +
        `\`scripts/build-device-release.sh ${options.platform} ${options.device}\`.`,
    )
  }
}

/** Returns the chunks of the last payload in `log`, ignoring every other line it carries. */
export function collectChunks(log: string): Chunks | undefined {
  let current: Chunks | undefined
  for (const line of log.split('\n')) {
    const match = CHUNK_LINE.exec(line)
    if (match === null) {
      continue
    }
    const index = Number(match[1])
    const total = Number(match[2])
    // a second run appends a second payload, and the last one is the one that was asked for
    if (index === 1 || current === undefined || current.total !== total) {
      current = { total, parts: new Map() }
    }
    current.parts.set(index, match[3] as string)
  }
  return current
}

/** Reports whether every index from `1` to `total` arrived, which is what makes a payload readable. */
export function isComplete(chunks: Chunks | undefined): chunks is Chunks {
  if (chunks === undefined) {
    return false
  }
  for (let index = 1; index <= chunks.total; index += 1) {
    if (!chunks.parts.has(index)) {
      return false
    }
  }
  return true
}

/** Concatenates the chunks in index order, with nothing between them, back into the payload text. */
export function joinChunks(chunks: Chunks): string {
  const parts: string[] = []
  for (let index = 1; index <= chunks.total; index += 1) {
    parts.push(chunks.parts.get(index) as string)
  }
  return parts.join('')
}

async function readLog(path: string): Promise<string> {
  const file = Bun.file(path)
  return (await file.exists()) ? await file.text() : ''
}

async function awaitPayload(logPath: string, timeoutMinutes: number): Promise<Chunks> {
  const startedAt = Date.now()
  const deadline = startedAt + timeoutMinutes * 60_000
  let announcedAt = startedAt
  let failedAt: number | undefined
  while (Date.now() < deadline) {
    const log = await readLog(logPath)
    const chunks = collectChunks(log)
    const seen = chunks === undefined ? 0 : chunks.parts.size
    if (isComplete(chunks)) {
      return chunks
    }
    if (log.includes(FAILURE_MARKER)) {
      failedAt ??= Date.now()
      if (Date.now() - failedAt > FAILURE_GRACE_MS) {
        throw new Error(`The benchmark screen reported a failed run. See ${logPath}.`)
      }
    }
    if (Date.now() - announcedAt >= PROGRESS_MS) {
      announcedAt = Date.now()
      const minutes = Math.round((Date.now() - startedAt) / 60_000)
      step(`  running, ${minutes} min elapsed, ${seen} payload chunks so far`)
    }
    await Bun.sleep(POLL_MS)
  }
  throw new Error(
    `No complete payload within ${timeoutMinutes} minutes. The app is untouched and its results ` +
      `may still be on screen; do not relaunch it. See ${logPath}.`,
  )
}

function iosDeviceName(udid: string): string | undefined {
  const out = join(tmpdir(), `h3-devicectl-${process.pid}.json`)
  try {
    const spawned = Bun.spawnSync([
      'xcrun',
      'devicectl',
      'device',
      'info',
      'details',
      '--device',
      udid,
      '--json-output',
      out,
    ])
    if (spawned.exitCode !== 0) {
      return undefined
    }
    const parsed = JSON.parse(readFileSync(out, 'utf8')) as {
      result?: { hardwareProperties?: { marketingName?: string; productType?: string } }
    }
    const hardware = parsed.result?.hardwareProperties
    if (hardware?.marketingName == null || hardware.productType == null) {
      return undefined
    }
    return `${hardware.marketingName} (${hardware.productType})`
  } catch {
    return undefined
  } finally {
    rmSync(out, { force: true })
  }
}

function androidProperty(serial: string, name: string): string | undefined {
  const spawned = Bun.spawnSync(['adb', '-s', serial, 'shell', 'getprop', name])
  if (spawned.exitCode !== 0) {
    return undefined
  }
  const value = spawned.stdout.toString().trim()
  return value === '' ? undefined : value
}

function androidDeviceName(serial: string): string | undefined {
  const manufacturer = androidProperty(serial, 'ro.product.manufacturer')
  const model = androidProperty(serial, 'ro.product.model')
  return manufacturer === undefined || model === undefined ? undefined : `${manufacturer} ${model}`
}

function hostDeviceName(options: Options): string | undefined {
  return options.platform === 'ios'
    ? iosDeviceName(options.device)
    : androidDeviceName(options.device)
}

function factorOf(row: BenchmarkRow): number | undefined {
  if (row.referenceMillis === null || row.millis <= 0) {
    return undefined
  }
  return row.factor ?? row.referenceMillis / row.millis
}

function widestFactor(rows: BenchmarkRow[]): string {
  let best: { workload: string; factor: number } | undefined
  for (const row of rows) {
    const factor = factorOf(row)
    if (factor !== undefined && (best === undefined || factor > best.factor)) {
      best = { workload: row.workload, factor }
    }
  }
  return best === undefined
    ? 'none, no row carries an h3-js reference'
    : `${best.factor.toFixed(best.factor < 10 ? 1 : 0)}× (${best.workload})`
}

function summarise(payload: BenchmarkPayload, out: string, logOut: string): void {
  const equivalent = payload.rows.filter((row) => row.equivalent === true).length
  const duration = payload.measuredOn.durationSeconds
  console.log('')
  console.log(`Rows          ${payload.rows.length}, ${equivalent} equivalent to h3-js`)
  console.log(`Measured on   ${payload.measuredOn.device ?? payload.measuredOn.platform}`)
  console.log(`Duration      ${duration === undefined ? 'not recorded' : `${duration} s`}`)
  console.log(`Widest factor ${widestFactor(payload.rows)}`)
  console.log(`Payload       ${out}`)
  console.log(`Log           ${logOut}`)
}

function outputPaths(out: string): { log: string; screenshot: string } {
  const stem = join(dirname(out), basename(out, extname(out)))
  return { log: `${stem}.device.log`, screenshot: `${stem}.failure.png` }
}

async function run(options: Options): Promise<void> {
  const paths = outputPaths(options.out)
  await mkdir(dirname(options.out), { recursive: true })
  let logPath: string | undefined

  preflight(options)

  // `--relaunch` puts the app on its first tab, where `Benchmark` names the tab and nothing else
  step(`Opening ${options.app} on ${options.device}`)
  const opened = agentDevice([
    'open',
    options.app,
    '--foreground',
    '--relaunch',
    ...target(options),
  ])
  if (!opened.ok) {
    throw new Error(`\`agent-device open\` failed. ${opened.message}`)
  }

  try {
    // on a physical iOS device this relaunches the app through `devicectl --console`, the only
    // route its log output takes to the host, so it belongs before the run and never after it
    step('Starting log capture')
    const capture = agentDevice(['logs', 'clear', '--restart', ...target(options)])
    if (!capture.ok) {
      throw new Error(`\`agent-device logs clear --restart\` failed. ${capture.message}`)
    }
    const located = agentDevice(['logs', 'path', ...target(options)])
    if (!located.ok || typeof located.data.path !== 'string') {
      throw new Error(`\`agent-device logs path\` returned no path. ${located.message}`)
    }
    logPath = located.data.path

    step('Opening the Benchmark tab')
    const ready = agentDevice(['wait', 'text', 'Benchmark', '60000', ...target(options)])
    if (!ready.ok) {
      throw new Error(`The app did not come up. ${ready.message}`)
    }
    const tab = agentDevice(['press', 'text="Benchmark"', '--settle', ...target(options)])
    if (!tab.ok) {
      throw new Error(`Could not reach the Benchmark tab. ${tab.message}`)
    }

    // no `--settle` on the press: the run holds the JavaScript thread for the next several minutes,
    // and waiting for a quiet UI would spend accessibility captures on a screen that is busy
    step('Pressing Run benchmark')
    const button = agentDevice(['wait', 'text', 'Run benchmark', '30000', ...target(options)])
    if (!button.ok) {
      throw new Error(`The Benchmark tab did not open. ${button.message}`)
    }
    const start = agentDevice(['press', 'text="Run benchmark"', ...target(options)])
    if (!start.ok) {
      throw new Error(`Could not start the run. ${start.message}`)
    }

    step(`Waiting for the payload, up to ${options.timeoutMinutes} minutes`)
    const chunks = await awaitPayload(logPath, options.timeoutMinutes)

    const confirmed = agentDevice(['wait', 'text', CAPTION_TAIL, '60000', ...target(options)])
    if (!confirmed.ok) {
      console.warn(`  note: the finished caption was not on screen (${confirmed.message})`)
    }
    agentDevice(['logs', 'stop', ...target(options)])
    await writeFile(paths.log, await readLog(logPath), 'utf8')

    const payload = validatePayload(JSON.parse(joinChunks(chunks)), options.out)
    // the screen reads a model on Android only, so iOS gets its name from the host
    payload.measuredOn.device ??= hostDeviceName(options)
    await writeFile(options.out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
    summarise(payload, options.out, paths.log)
  } catch (error) {
    if (logPath !== undefined) {
      await writeFile(paths.log, await readLog(logPath), 'utf8')
      console.error(`  captured log: ${paths.log}`)
    }
    // a screenshot, never a relaunch: an unfinished run's results exist only in React state
    agentDevice(['screenshot', paths.screenshot, ...target(options)])
    console.error(`  screenshot: ${paths.screenshot}`)
    throw error
  } finally {
    agentDevice(['close', '--session', options.session])
  }
}

if (import.meta.main) {
  try {
    await run(parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
