/**
 * Vendors the upstream H3 C library into `packages/react-native-h3/third_party/h3`.
 *
 * A git submodule is silently dangerous at publish time: `npm pack` takes what is on disk, and an
 * uninitialised submodule publishes an empty directory without error, breaking the consumer's
 * native build. Copying in-tree makes an upstream bump a reviewable commit instead of a repository
 * state.
 *
 * Usage:
 *   bun run scripts/vendor-h3.ts           rewrite the vendor directory from H3_TAG
 *   bun run scripts/vendor-h3.ts --check   fail if the vendor directory differs from H3_TAG
 */

import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const H3_TAG = 'v4.5.0'
const H3_TARBALL = `https://github.com/uber/h3/archive/refs/tags/${H3_TAG}.tar.gz`

const HERE = dirname(fileURLToPath(import.meta.url))
const VENDOR = join(HERE, '..', 'packages', 'react-native-h3', 'third_party', 'h3')

async function download(into: string): Promise<string> {
  const response = await fetch(H3_TARBALL)
  if (!response.ok) {
    throw new Error(`Failed to download ${H3_TARBALL}: ${response.status} ${response.statusText}`)
  }
  const archive = join(into, 'h3.tar.gz')
  await writeFile(archive, Buffer.from(await response.arrayBuffer()))
  const untar = Bun.spawnSync(['tar', '-xzf', archive, '-C', into])
  if (untar.exitCode !== 0) {
    throw new Error(`tar failed: ${untar.stderr.toString()}`)
  }
  const entries = await readdir(into, { withFileTypes: true })
  const root = entries.find((e) => e.isDirectory() && e.name.startsWith('h3-'))
  if (root == null) {
    throw new Error(`No h3-* directory in the extracted archive`)
  }
  return join(into, root.name)
}

/** Substitutes `h3api.h.in`'s three version macros; CMake is not needed to resolve them. */
function substituteVersion(template: string, version: string): string {
  const parts = version.trim().split('.')
  const [major, minor, patch] = parts
  if (parts.length !== 3 || major == null || minor == null || patch == null) {
    throw new Error(`Unexpected VERSION contents: ${version}`)
  }
  const header = template
    .replaceAll('@H3_VERSION_MAJOR@', major)
    .replaceAll('@H3_VERSION_MINOR@', minor)
    .replaceAll('@H3_VERSION_PATCH@', patch)
  if (/@H3_[A-Z_]+@/.test(header)) {
    throw new Error('h3api.h.in contains substitutions this script does not know about')
  }
  return header
}

async function buildVendorTree(source: string, target: string): Promise<void> {
  await rm(target, { recursive: true, force: true })
  await mkdir(join(target, 'lib'), { recursive: true })
  await mkdir(join(target, 'include'), { recursive: true })

  const libSource = join(source, 'src', 'h3lib', 'lib')
  const includeSource = join(source, 'src', 'h3lib', 'include')

  const sources: string[] = []
  for (const file of (await readdir(libSource)).sort()) {
    if (!file.endsWith('.c')) continue
    await cp(join(libSource, file), join(target, 'lib', file))
    sources.push(`lib/${file}`)
  }
  if (sources.length === 0) {
    throw new Error('No C sources found upstream; the layout changed')
  }

  for (const file of (await readdir(includeSource)).sort()) {
    if (!file.endsWith('.h')) continue
    await cp(join(includeSource, file), join(target, 'include', file))
  }

  const version = await readFile(join(source, 'VERSION'), 'utf8')
  const template = await readFile(join(includeSource, 'h3api.h.in'), 'utf8')
  await writeFile(join(target, 'include', 'h3api.h'), substituteVersion(template, version))

  await cp(join(source, 'LICENSE'), join(target, 'LICENSE'))
  await cp(join(source, 'NOTICE'), join(target, 'NOTICE'))
  await writeFile(join(target, 'H3_VERSION'), `${version.trim()}\n`)
  await writeFile(
    join(target, 'sources.json'),
    `${JSON.stringify({ tag: H3_TAG, version: version.trim(), sources }, null, 2)}\n`,
  )
  await writeFile(
    join(target, 'README.md'),
    [
      '# Vendored H3',
      '',
      `Upstream: https://github.com/uber/h3 at \`${H3_TAG}\`, Apache-2.0.`,
      '',
      'Do not edit these files by hand. Regenerate with `bun run vendor:h3` from the repository root.',
      'The only file that is not a verbatim copy is `include/h3api.h`, which is generated from',
      "upstream's `h3api.h.in` by substituting the three version macros.",
      '',
    ].join('\n'),
  )
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check')
  const scratch = await mkdtemp(join(tmpdir(), 'vendor-h3-'))
  try {
    const source = await download(scratch)
    const target = check ? join(scratch, 'expected') : VENDOR
    await buildVendorTree(source, target)

    if (check) {
      if (!existsSync(VENDOR)) {
        throw new Error('third_party/h3 does not exist; run `bun run vendor:h3`')
      }
      const diff = Bun.spawnSync(['diff', '-r', '--exclude=README.md', VENDOR, target])
      if (diff.exitCode !== 0) {
        process.stderr.write(diff.stdout.toString())
        throw new Error(`third_party/h3 differs from upstream ${H3_TAG}; run \`bun run vendor:h3\``)
      }
      process.stdout.write(`third_party/h3 matches upstream ${H3_TAG}\n`)
    } else {
      process.stdout.write(`Vendored h3 ${H3_TAG} into ${VENDOR}\n`)
    }
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

await main()
