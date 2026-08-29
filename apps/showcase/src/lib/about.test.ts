import { expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { BASEMAP_ATTRIBUTION, H3_VERSION } from './about'

const PACKAGE = resolve(import.meta.dir, '../../../../packages/react-native-h3')

const BASEMAP = resolve(import.meta.dir, '../ui/Basemap.tsx')

test('the shown H3 version matches the vendored sources', async () => {
  const vendored = await Bun.file(`${PACKAGE}/third_party/h3/H3_VERSION`).text()
  expect(H3_VERSION).toBe(vendored.trim())
})

test('the shown attribution credits the tile source the map loads', async () => {
  const source = await Bun.file(BASEMAP).text()
  expect(source).toContain('https://tiles.openfreemap.org/styles/')
  for (const party of ['OpenFreeMap', 'OpenMapTiles', 'OpenStreetMap']) {
    expect(BASEMAP_ATTRIBUTION).toContain(party)
  }
})
