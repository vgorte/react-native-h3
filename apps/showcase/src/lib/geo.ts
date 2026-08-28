import type { LngLat, LngLatBounds } from '@maplibre/maplibre-react-native'
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  LineString,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from 'geojson'
import type { LatLng, Ring } from 'react-native-h3'

const MIN_RING_POINTS = 3

/**
 * Converts MapLibre's `[lng, lat]` points into the `[lat, lng]` order `Ring` uses.
 *
 * @param points Points in MapLibre order, the first not repeated at the end.
 */
export function ringFromLngLat(points: readonly LngLat[]): Ring {
  return points.map(([lng, lat]): [number, number] => [lat, lng])
}

/** Names the two members of one MapLibre pair, so no screen destructures a `LngLat`. */
export function latLngFromLngLat(lngLat: LngLat): LatLng {
  const [lng, lat] = lngLat
  return { lat, lng }
}

/** Reports whether a ring has three distinct points, the least that encloses an area. */
export function hasThreeDistinctPoints(ring: Ring): boolean {
  const distinct = new Set(ring.map(([lat, lng]) => `${lat},${lng}`))
  return distinct.size >= MIN_RING_POINTS
}

/**
 * Returns the box a ring spans, in the `[west, south, east, north]` order MapLibre bounds use.
 *
 * @param ring A ring of at least one point, in H3's `[lat, lng]` order.
 */
export function boundsOfRing(ring: Ring): LngLatBounds {
  let west = Number.POSITIVE_INFINITY
  let south = Number.POSITIVE_INFINITY
  let east = Number.NEGATIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY
  for (const [lat, lng] of ring) {
    west = Math.min(west, lng)
    south = Math.min(south, lat)
    east = Math.max(east, lng)
    north = Math.max(north, lat)
  }
  return [west, south, east, north]
}

/**
 * Reports whether a point lies inside a ring, by counting the crossings of a ray east of it.
 *
 * The ring is treated as closed whether or not it repeats its first point, and a point exactly on
 * an edge falls on one side or the other, which is what keeps neighbouring rings from overlapping.
 *
 * @param point Either `{ lat, lng }` or the `[lat, lng]` pair a `Ring` holds.
 */
export function pointInRing(point: LatLng | [lat: number, lng: number], ring: Ring): boolean {
  const lat = Array.isArray(point) ? point[0] : point.lat
  const lng = Array.isArray(point) ? point[1] : point.lng

  let inside = false
  for (let i = 0; i < ring.length; i++) {
    const here = ring[i]
    const previous = ring[(i + ring.length - 1) % ring.length]
    const [hereLat, hereLng] = here
    const [previousLat, previousLng] = previous
    if (hereLat > lat === previousLat > lat) {
      continue
    }
    const crossing = ((previousLng - hereLng) * (lat - hereLat)) / (previousLat - hereLat) + hereLng
    if (lng < crossing) {
      inside = !inside
    }
  }
  return inside
}

function closedPositions(boundary: readonly LatLng[]): Position[] {
  const positions = boundary.map(({ lat, lng }): Position => [lng, lat])
  const first = positions[0]
  const last = positions[positions.length - 1]
  // GeoJSON repeats the first position; H3 boundaries leave it off
  if (first[0] !== last[0] || first[1] !== last[1]) {
    positions.push([...first])
  }
  return positions
}

/**
 * Builds a GeoJSON polygon from a cell boundary.
 *
 * @param boundary The boundary in H3's `{ lat, lng }` shape.
 * @param id The feature id, which MapLibre uses to diff the source.
 */
export function polygonFeature(
  boundary: readonly LatLng[],
  id: string,
  properties: GeoJsonProperties = null,
): Feature<Polygon> {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Polygon', coordinates: [closedPositions(boundary)] },
    properties,
  }
}

/** Builds a GeoJSON multipolygon from the loops `cellsToMultiPolygonAsync` returns. */
export function multiPolygonFeature(
  loops: readonly LatLng[][][],
  id: string,
): Feature<MultiPolygon> {
  return {
    type: 'Feature',
    id,
    geometry: {
      type: 'MultiPolygon',
      coordinates: loops.map((polygon) => polygon.map(closedPositions)),
    },
    properties: null,
  }
}

/** Builds a closed GeoJSON line from a ring, for drawing the path the user traced. */
export function lineFeature(ring: Ring, id: string): Feature<LineString> {
  const boundary = ring.map(([lat, lng]): LatLng => ({ lat, lng }))
  return {
    type: 'Feature',
    id,
    geometry: { type: 'LineString', coordinates: closedPositions(boundary) },
    properties: null,
  }
}

/**
 * Builds a GeoJSON point, which is how a marker reaches a `circle` layer.
 *
 * @param id The feature id, which the source press handler reads back.
 */
export function pointFeature(
  lat: number,
  lng: number,
  id: string,
  properties: GeoJsonProperties = null,
): Feature<Point> {
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties,
  }
}

/**
 * Returns the collection a source shows when there is nothing to draw.
 *
 * The geometry parameter defaults to any `Geometry`, so the result also seeds a narrower state such
 * as `FeatureCollection<Polygon>`.
 */
export function emptyFeatureCollection<G extends Geometry = Geometry>(): FeatureCollection<G> {
  return { type: 'FeatureCollection', features: [] }
}
