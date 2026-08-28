import type { LngLat } from '@maplibre/maplibre-react-native'
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
