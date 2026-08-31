/**
 * Verifies that everything a consumer's native build needs is actually in the npm tarball.
 *
 * The failure this prevents is silent: a missing vendored source publishes without error and
 * surfaces as a compiler error in someone else's project. The `cpp` entries in `files` cover only
 * `.hpp` and `.cpp`, which is why `third_party/h3` carries entries of its own.
 *
 * Usage:
 *   bun run scripts/check-pack.ts   (also runs as the package's `prepack` script)
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const PACKAGE = join(HERE, '..', 'packages', 'react-native-nitro-h3')

const ALWAYS_REQUIRED = [
  'package.json',
  'README.md',
  'LICENSE',
  'nitro.json',
  'NitroH3.podspec',
  'lib/index.js',
  'lib/index.d.ts',
  // one anchor per `cpp` entry in `files`, which are separate globs and directories
  'cpp/HybridH3.cpp',
  'cpp/HybridH3.hpp',
  'cpp/core/CellBuffer.hpp',
  'cpp/ops/Indexing.cpp',
  'cpp/shapes/CellSetCall.hpp',
  'android/CMakeLists.txt',
  'android/build.gradle',
  'android/gradle.properties',
  'nitrogen/generated/shared/c++/HybridH3Spec.hpp',
  'docs/api.md',
  'third_party/h3/include/h3api.h',
  'third_party/h3/LICENSE',
  'third_party/h3/NOTICE',
  'third_party/h3/H3_VERSION',
  'third_party/h3/sources.json',
]

/** Returns the names of `declare module` blocks in `dts` that target a package other than `ownName`. */
export function foreignModuleDeclarations(dts: string, ownName: string): string[] {
  const names = [...dts.matchAll(/^\s*declare\s+module\s+(['"])([^'"]+)\1/gm)].map(
    (match) => match[2] as string,
  )
  return names.filter((name) => name !== ownName)
}

let cached: Promise<string[]> | undefined

/** Returns every path `npm` would put in the tarball, and throws if a required one is absent. */
export function checkPackList(): Promise<string[]> {
  // one `npm pack` per process; the five tests would otherwise pay for five
  cached ??= computePackList()
  return cached
}

async function computePackList(): Promise<string[]> {
  // `--ignore-scripts` is what keeps this from recursing when it runs as `prepack`
  const packed = Bun.spawnSync(['npm', 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: PACKAGE,
  })
  if (packed.exitCode !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${packed.stderr.toString()}`)
  }

  const parsed = JSON.parse(packed.stdout.toString()) as Array<{ files: Array<{ path: string }> }>
  const first = parsed[0]
  if (first == null) {
    throw new Error('npm pack --dry-run --json returned no tarball entry')
  }
  const files = first.files.map((file) => file.path)

  const sources: string[] = JSON.parse(
    await readFile(join(PACKAGE, 'third_party', 'h3', 'sources.json'), 'utf8'),
  ).sources.map((source: string) => `third_party/h3/${source}`)

  const missing = [...ALWAYS_REQUIRED, ...sources].filter((required) => !files.includes(required))
  if (missing.length > 0) {
    throw new Error(
      `The npm tarball is missing ${missing.length} required file(s). A missing vendored source ` +
        `publishes without error and fails at the consumer's native build.\n  ${missing.join('\n  ')}`,
    )
  }

  // a fork shipped `declare module "h3-js"` and overrode the real package's types everywhere
  const ownName = JSON.parse(await readFile(join(PACKAGE, 'package.json'), 'utf8')).name as string
  const declarations = await Promise.all(
    files
      .filter((file) => file.endsWith('.d.ts'))
      .map(async (file) => ({
        file,
        foreign: foreignModuleDeclarations(await readFile(join(PACKAGE, file), 'utf8'), ownName),
      })),
  )
  const offending = declarations.filter(({ foreign }) => foreign.length > 0)
  if (offending.length > 0) {
    throw new Error(
      'The npm tarball contains type declarations for foreign modules. A packed ' +
        "`declare module` overrides the named package's types in every consumer.\n  " +
        offending.map(({ file, foreign }) => `${file}: ${foreign.join(', ')}`).join('\n  '),
    )
  }

  return files
}

if (import.meta.main) {
  const files = await checkPackList()
  process.stdout.write(`Pack list OK: ${files.length} files\n`)
}
