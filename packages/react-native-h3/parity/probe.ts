import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Drives the host parity probe, a line-oriented executable over the Nitro-free operations layer.
 *
 * The probe runs the same code the HybridObject calls, so a difference this suite finds is a
 * difference in what ships. One request and one JSON response per line.
 */
export interface Probe {
  /** Sends one request and returns the parsed value, or throws with the reported message. */
  call(op: string, ...args: string[]): unknown
  /** Sends one request whose result is a single cell. */
  cell(op: string, ...args: string[]): string
  /** Sends one request whose result is a list of cells. */
  cells(op: string, ...args: string[]): string[]
  /** Returns every operation the probe knows. */
  ops(): string[]
  /** Releases the probe. Reserved: a request runs its own process, so there is nothing to close. */
  close(): void
}

// The header of `cpp/test/ParityProbe.cpp` carries the argument and result encodings.

const BUILD_INSTRUCTIONS =
  'The parity probe is not built. Run:\n' +
  '  cmake -S packages/react-native-h3/cpp/test -B build/host -DCMAKE_BUILD_TYPE=Release\n' +
  '  cmake --build build/host --target parity_probe -j\n' +
  'or set H3_PARITY_PROBE to the executable.'

/** Returns the probe executable, or `undefined` when it has not been built. */
export function findProbe(): string | undefined {
  const fromEnvironment = process.env.H3_PARITY_PROBE
  if (fromEnvironment != null && existsSync(fromEnvironment)) {
    return fromEnvironment
  }
  const conventional = join(import.meta.dir, '..', '..', '..', 'build', 'host', 'parity_probe')
  return existsSync(conventional) ? conventional : undefined
}

function probePath(): string {
  const executable = findProbe()
  if (executable === undefined) {
    throw new Error(BUILD_INSTRUCTIONS)
  }
  return executable
}

interface Response {
  ok?: unknown
  err?: string
}

/**
 * Whether a suite may skip because the probe is not built.
 *
 * CI sets `H3_PARITY_REQUIRED`, so a probe missing there fails the build instead of passing quietly.
 */
export const skipWithoutProbe = findProbe() === undefined && process.env.H3_PARITY_REQUIRED !== '1'

function run(executable: string, requests: string[]): Response[] {
  // bun 1.3.14: a repository-wide discovery walk leaves this stdio unusable, so run from the package
  const result = spawnSync(executable, {
    input: `${requests.join('\n')}\n`,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
  })
  if (result.error != null) {
    throw result.error
  }
  if (result.status !== 0) {
    throw new Error(`The parity probe exited with ${result.status}: ${result.stderr}`)
  }
  const lines = result.stdout.split('\n').filter((line) => line.length > 0)
  if (lines.length !== requests.length) {
    throw new Error(`The probe answered ${lines.length} of ${requests.length} requests`)
  }
  return lines.map((line) => JSON.parse(line) as Response)
}

/** Opens a probe over the built executable, and throws with build instructions when it is absent. */
export function openProbe(): Probe {
  const executable = probePath()

  function send(op: string, args: string[]): unknown {
    // `run` throws unless the count matches, so the one response is there
    const response = run(executable, [[op, ...args].join(' ')])[0] as Response
    if (response.err != null) {
      throw new Error(response.err)
    }
    return response.ok
  }

  return {
    call(op, ...args) {
      return send(op, args)
    },
    cell(op, ...args) {
      return send(op, args) as string
    },
    cells(op, ...args) {
      return send(op, args) as string[]
    },
    ops() {
      return send('__ops', []) as string[]
    },
    close() {
      // nothing to release: each request runs its own process
    },
  }
}

/**
 * Sends many requests in one process run and answers one entry per request.
 *
 * The comparison covers 122 base cells across 16 resolutions across dozens of operations, which is
 * far too many process spawns one at a time. A failed request answers an `Error` in place, so one
 * failure does not hide the rest.
 */
export function callMany(requests: string[]): (unknown | Error)[] {
  return run(probePath(), requests).map((response) =>
    response.err != null ? new Error(response.err) : response.ok,
  )
}
