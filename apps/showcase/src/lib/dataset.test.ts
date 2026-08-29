import { describe, expect, test } from 'bun:test'
import { BOUNDS, CITIES, loadPoints, POINT_COUNT, SCATTER_SHARE } from './dataset'
import { pointInRing } from './geo'
import { GERMANY_RING } from './germany'

// the generator appends the scatter after the clusters and the corridors
const FIRST_SCATTERED = POINT_COUNT * (1 - SCATTER_SHARE)

// the box a city core has to fall inside to read as a city rather than as a region
const CORE_LAT_RADIUS = 0.1
const CORE_LNG_RADIUS = 0.16

/** Folds the sample's bytes with FNV-1a, so any change to the generator changes the digest. */
function digest(points: Float64Array): string {
  const bytes = new Uint8Array(points.buffer, points.byteOffset, points.byteLength)
  let value = 0x811c9dc5
  for (const byte of bytes) {
    value ^= byte
    value = Math.imul(value, 0x01000193) >>> 0
  }
  return value.toString(16)
}

function pointAt(points: Float64Array, index: number): [number, number] {
  return [points[index * 2], points[index * 2 + 1]]
}

const points = await loadPoints()

describe('loadPoints', () => {
  test('generates a hundred thousand interleaved pairs', () => {
    expect(POINT_COUNT).toBe(100_000)
    expect(points.length).toBe(POINT_COUNT * 2)
  })

  test('generates the sample once and keeps it', async () => {
    expect(await loadPoints()).toBe(points)
  })

  test('draws the scattered remainder inside GERMANY_RING', () => {
    for (let index = FIRST_SCATTERED; index < POINT_COUNT; index++) {
      expect(pointInRing(pointAt(points, index), GERMANY_RING)).toBe(true)
    }
  })

  test('keeps the clusters and the corridors inside GERMANY_RING as well', () => {
    for (let index = 0; index < POINT_COUNT; index += 100) {
      expect(pointInRing(pointAt(points, index), GERMANY_RING)).toBe(true)
    }
  })

  test('stays inside the bounding box', () => {
    for (let index = 0; index < POINT_COUNT; index += 37) {
      const [lat, lng] = pointAt(points, index)
      expect(lat).toBeGreaterThanOrEqual(BOUNDS.south)
      expect(lat).toBeLessThanOrEqual(BOUNDS.north)
      expect(lng).toBeGreaterThanOrEqual(BOUNDS.west)
      expect(lng).toBeLessThanOrEqual(BOUNDS.east)
    }
  })

  test('holds a core tight enough to read as a city', () => {
    const [berlin] = CITIES
    let inside = 0
    for (let index = 0; index < POINT_COUNT; index++) {
      const [lat, lng] = pointAt(points, index)
      const near =
        Math.abs(lat - berlin.lat) < CORE_LAT_RADIUS && Math.abs(lng - berlin.lng) < CORE_LNG_RADIUS
      if (near) inside++
    }
    // the largest city takes about a sixth of the sample, and its core is the bulk of that
    expect(inside).toBeGreaterThan(POINT_COUNT / 10)
  })

  test('holds the seed, the cities and their weights', () => {
    const opening = [0, 1, 2].map((index) =>
      pointAt(points, index).map((degrees) => degrees.toFixed(5)),
    )
    expect(opening).toEqual([
      ['52.71313', '13.84419'],
      ['52.40825', '13.96262'],
      ['52.46150', '12.84701'],
    ])
    expect(digest(points)).toBe('ffa47391')
  })
})
