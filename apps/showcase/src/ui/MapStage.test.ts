import { expect, test } from 'bun:test'
import { resolve } from 'node:path'

const STAGE = resolve(import.meta.dir, 'MapStage.tsx')

const SCREENS = resolve(import.meta.dir, '../screens')

const SCREEN_FILES = ['GeofenceScreen.tsx', 'HeatmapScreen.tsx', 'CoverageScreen.tsx']

test('the stage mounts every slot a screen fills', async () => {
  const source = await Bun.file(STAGE).text()
  for (const slot of ['<Basemap', '{children}', '{overlay}', '{controls}', '<HudCard {...hud}']) {
    expect(source).toContain(slot)
  }
})

test('no screen builds the map, the controls or the split for itself', async () => {
  for (const screen of SCREEN_FILES) {
    const source = await Bun.file(`${SCREENS}/${screen}`).text()
    expect(source).toContain('<MapStage')
    expect(source).not.toContain('<Basemap')
    expect(source).not.toContain('<ThumbStack')
    expect(source).not.toContain('function hudSplit')
  }
})
