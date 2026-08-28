import { describe, expect, test } from 'bun:test'
import type { Ring } from 'react-native-h3'
import {
  boundsOfRing,
  emptyFeatureCollection,
  hasThreeDistinctPoints,
  latLngFromLngLat,
  lineFeature,
  multiPolygonFeature,
  pointFeature,
  pointInRing,
  polygonFeature,
  ringFromLngLat,
} from './geo'
import { GERMANY_RING } from './germany'

describe('ringFromLngLat', () => {
  test('swaps MapLibre order into H3 order', () => {
    expect(ringFromLngLat([[13.405, 52.52]])).toEqual([[52.52, 13.405]])
  })

  test('keeps the point order', () => {
    const ring = ringFromLngLat([
      [13.0, 52.0],
      [13.1, 52.0],
      [13.1, 52.1],
    ])
    expect(ring).toEqual([
      [52.0, 13.0],
      [52.0, 13.1],
      [52.1, 13.1],
    ])
  })
})

describe('latLngFromLngLat', () => {
  test('names the two members of a MapLibre pair', () => {
    expect(latLngFromLngLat([13.405, 52.52])).toEqual({ lat: 52.52, lng: 13.405 })
  })
})

describe('hasThreeDistinctPoints', () => {
  test('rejects fewer than three distinct points', () => {
    expect(
      hasThreeDistinctPoints([
        [52.0, 13.0],
        [52.0, 13.0],
        [52.0, 13.0],
      ]),
    ).toBe(false)
  })

  test('accepts three distinct points', () => {
    expect(
      hasThreeDistinctPoints([
        [52.0, 13.0],
        [52.0, 13.1],
        [52.1, 13.1],
      ]),
    ).toBe(true)
  })
})

describe('polygonFeature', () => {
  test('emits lng/lat positions and closes the ring', () => {
    const feature = polygonFeature(
      [
        { lat: 52.0, lng: 13.0 },
        { lat: 52.0, lng: 13.1 },
        { lat: 52.1, lng: 13.1 },
      ],
      '8928308280fffff',
    )
    expect(feature.id).toBe('8928308280fffff')
    expect(feature.geometry.coordinates[0]).toEqual([
      [13.0, 52.0],
      [13.1, 52.0],
      [13.1, 52.1],
      [13.0, 52.0],
    ])
  })

  test('does not close a ring that is already closed', () => {
    const feature = polygonFeature(
      [
        { lat: 52.0, lng: 13.0 },
        { lat: 52.0, lng: 13.1 },
        { lat: 52.1, lng: 13.1 },
        { lat: 52.0, lng: 13.0 },
      ],
      'a',
    )
    expect(feature.geometry.coordinates[0]).toHaveLength(4)
  })

  test('carries properties through', () => {
    const feature = polygonFeature(
      [
        { lat: 52.0, lng: 13.0 },
        { lat: 52.0, lng: 13.1 },
        { lat: 52.1, lng: 13.1 },
        { lat: 52.0, lng: 13.0 },
      ],
      'a',
      { count: 7 },
    )
    expect(feature.properties).toEqual({ count: 7 })
  })
})

describe('multiPolygonFeature', () => {
  test('closes every ring of every polygon', () => {
    const feature = multiPolygonFeature(
      [
        [
          [
            { lat: 0, lng: 0 },
            { lat: 0, lng: 1 },
            { lat: 1, lng: 1 },
          ],
        ],
      ],
      'outline',
    )
    expect(feature.geometry.type).toBe('MultiPolygon')
    expect(feature.geometry.coordinates[0][0]).toHaveLength(4)
  })
})

describe('lineFeature', () => {
  test('emits a closed lng/lat line', () => {
    const feature = lineFeature(
      [
        [52.0, 13.0],
        [52.0, 13.1],
      ],
      'path',
    )
    expect(feature.geometry.coordinates).toEqual([
      [13.0, 52.0],
      [13.1, 52.0],
      [13.0, 52.0],
    ])
  })
})

describe('pointFeature', () => {
  test('emits a lng/lat position under the given id', () => {
    const feature = pointFeature(52.52, 13.405, 'm1')
    expect(feature.id).toBe('m1')
    expect(feature.geometry.coordinates).toEqual([13.405, 52.52])
  })

  test('carries properties through', () => {
    expect(pointFeature(1, 2, 'm2', { id: 'm2' }).properties).toEqual({ id: 'm2' })
  })
})

describe('emptyFeatureCollection', () => {
  test('has no features', () => {
    expect(emptyFeatureCollection().features).toEqual([])
  })
})

describe('boundsOfRing', () => {
  test('spans the ring in west, south, east, north order', () => {
    expect(
      boundsOfRing([
        [52.0, 13.1],
        [52.4, 13.0],
        [52.2, 13.7],
      ]),
    ).toEqual([13.0, 52.0, 13.7, 52.4])
  })

  test('collapses onto a single point', () => {
    expect(boundsOfRing([[52.52, 13.405]])).toEqual([13.405, 52.52, 13.405, 52.52])
  })

  test('spans Germany from the Alps to the Baltic coast', () => {
    const [west, south, east, north] = boundsOfRing(GERMANY_RING)
    expect(south).toBeLessThan(47.6)
    expect(north).toBeGreaterThan(54.8)
    expect(west).toBeLessThan(6.2)
    expect(east).toBeGreaterThan(14.9)
  })
})

describe('pointInRing', () => {
  const square: Ring = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ]

  test('accepts a point inside the square', () => {
    expect(pointInRing([5, 5], square)).toBe(true)
  })

  test('rejects a point outside the square', () => {
    expect(pointInRing([5, 15], square)).toBe(false)
    expect(pointInRing([-1, 5], square)).toBe(false)
  })

  test('takes the point as a LatLng too', () => {
    expect(pointInRing({ lat: 5, lng: 5 }, square)).toBe(true)
    expect(pointInRing({ lat: 20, lng: 20 }, square)).toBe(false)
  })

  test('counts a corner vertex as inside', () => {
    // a vertex lands on one side only, so rings never overlap
    expect(pointInRing([0, 0], square)).toBe(true)
  })

  test('rejects a ring that encloses nothing', () => {
    expect(
      pointInRing(
        [5, 5],
        [
          [0, 0],
          [0, 10],
        ],
      ),
    ).toBe(false)
  })

  test('places Berlin inside Germany and Prague outside it', () => {
    expect(pointInRing([52.52, 13.405], GERMANY_RING)).toBe(true)
    expect(pointInRing([50.0755, 14.4378], GERMANY_RING)).toBe(false)
  })
})
