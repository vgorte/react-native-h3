import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { DEFAULT_MAX_CELL_COUNT, H3_VERSION } from './about'

const PACKAGE = resolve(import.meta.dir, '../../../../packages/react-native-h3')

test('the shown H3 version matches the vendored sources', async () => {
  const vendored = await Bun.file(`${PACKAGE}/third_party/h3/H3_VERSION`).text()
  expect(H3_VERSION).toBe(vendored.trim())
})

test('the shown cell ceiling matches the package default', async () => {
  const source = await Bun.file(`${PACKAGE}/src/configure.ts`).text()
  const documented = source.match(/Defaults to `([\d_]+)` cells/)?.[1]
  expect(documented).toBeDefined()
  expect(DEFAULT_MAX_CELL_COUNT).toBe(Number(documented?.replaceAll('_', '')))
})
