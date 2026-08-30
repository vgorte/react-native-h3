import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const VENDOR = join(import.meta.dir, '..', 'third_party', 'h3')

describe('vendored h3', () => {
  test('is pinned to the version the design locks', () => {
    expect(readFileSync(join(VENDOR, 'H3_VERSION'), 'utf8').trim()).toBe('4.5.0')
  })

  test('ships the upstream licence and notice', () => {
    expect(existsSync(join(VENDOR, 'LICENSE'))).toBe(true)
    expect(existsSync(join(VENDOR, 'NOTICE'))).toBe(true)
  })

  test('ships all 18 C sources', () => {
    const sources = readdirSync(join(VENDOR, 'lib'))
      .filter((f) => f.endsWith('.c'))
      .sort()
    expect(sources).toHaveLength(18)
    expect(sources).toContain('polyfill.c')
    expect(sources).toContain('cellsToMultiPoly.c')
  })

  test('sources.json matches what is on disk', () => {
    const listed: string[] = JSON.parse(readFileSync(join(VENDOR, 'sources.json'), 'utf8')).sources
    const onDisk = readdirSync(join(VENDOR, 'lib'))
      .filter((f) => f.endsWith('.c'))
      .map((f) => `lib/${f}`)
      .sort()
    expect(listed.slice().sort()).toEqual(onDisk)
  })

  test('h3api.h is generated, not the .in template', () => {
    const header = readFileSync(join(VENDOR, 'include', 'h3api.h'), 'utf8')
    expect(header).not.toMatch(/@H3_VERSION_(MAJOR|MINOR|PATCH)@/)
    expect(header).toContain('#define H3_VERSION_MAJOR 4')
    expect(header).toContain('#define H3_VERSION_MINOR 5')
    expect(header).toContain('#define H3_VERSION_PATCH 0')
    expect(existsSync(join(VENDOR, 'include', 'h3api.h.in'))).toBe(false)
  })

  test('ships the internal headers the C sources include', () => {
    for (const header of ['h3Index.h', 'faceijk.h', 'polyfill.h', 'alloc.h', 'constants.h']) {
      expect(existsSync(join(VENDOR, 'include', header))).toBe(true)
    }
  })
})
