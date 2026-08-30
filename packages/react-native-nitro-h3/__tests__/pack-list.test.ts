import { describe, expect, test } from 'bun:test'
import { checkPackList, foreignModuleDeclarations } from '../../../scripts/check-pack'

describe('npm pack list', () => {
  test('carries every vendored C source', async () => {
    const files = await checkPackList()
    const sources = files.filter((file) => file.startsWith('third_party/h3/lib/'))
    expect(sources).toHaveLength(18)
  }, 30_000)

  test('carries the generated h3api.h rather than the template', async () => {
    const files = await checkPackList()
    expect(files).toContain('third_party/h3/include/h3api.h')
    expect(files).not.toContain('third_party/h3/include/h3api.h.in')
  }, 30_000)

  test('carries the generated nitro bindings, the podspec and the built types', async () => {
    const files = await checkPackList()
    expect(files).toContain('nitro.json')
    expect(files).toContain('NitroH3.podspec')
    expect(files).toContain('lib/index.d.ts')
    expect(files).toContain('nitrogen/generated/shared/c++/HybridH3Spec.hpp')
    expect(files).toContain('android/CMakeLists.txt')
  }, 30_000)

  test('carries the vendored version marker and the shipped docs', async () => {
    const files = await checkPackList()
    expect(files).toContain('third_party/h3/H3_VERSION')
    expect(files).toContain('docs/h3-js-divergences.md')
    expect(files).toContain('docs/api.md')
  }, 30_000)

  test('does not ship the tests or the host CMake project', async () => {
    const files = await checkPackList()
    expect(files.some((file) => file.startsWith('cpp/test/'))).toBe(false)
    expect(files.some((file) => file.startsWith('__tests__/'))).toBe(false)
  }, 30_000)

  test('flags a type declaration for a foreign module', () => {
    const dts = 'declare module "h3-js" {\n  export function latLngToCell(): string\n}\n'
    expect(foreignModuleDeclarations(dts, 'react-native-nitro-h3')).toEqual(['h3-js'])
  })

  test('accepts tsc output and a self-named module declaration', () => {
    expect(foreignModuleDeclarations('export declare const x: number\n', 'a')).toEqual([])
    expect(foreignModuleDeclarations('declare module "a" {}\n', 'a')).toEqual([])
  })
})
