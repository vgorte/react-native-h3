import type { LngLatBounds } from '@maplibre/maplibre-react-native'

/** Lowest zoom MapLibre holds, the whole world across one screen. */
export const MIN_ZOOM = 0

/** Highest zoom MapLibre holds, past the last tile any style ships. */
export const MAX_ZOOM = 22

/** Lowest resolution the automatic mode picks, one cell per few hundred square kilometres. */
export const AUTO_RESOLUTION_MIN = 5

/** Highest resolution the automatic mode picks, roughly a city block. */
export const AUTO_RESOLUTION_MAX = 11

// below this the whole country fits on screen
const COUNTRY_ZOOM = 8

// from this zoom on the ladder steps one resolution per zoom level
const LADDER_ZOOM = 10

// the two flat bands below the ladder cost one resolution each
const LADDER_RESOLUTION = AUTO_RESOLUTION_MIN + 2

// one degree of latitude is about 111 km everywhere on the ellipsoid
const KM_PER_DEGREE_LATITUDE = 111

// a hexagon's corner-to-corner width is twice its edge
const EDGES_PER_DIAMETER = 2

// keeps the longitude factor finite; the app never leaves Germany anyway
const MIN_LATITUDE_COSINE = 0.01

/**
 * Maps a map zoom level onto the H3 resolution that keeps cells about a finger wide.
 *
 * Germany fills the screen at zoom 6 and one city from zoom 10, so the bands are chosen against
 * that basemap rather than against a global one.
 */
export function zoomToResolution(zoom: number): number {
  if (zoom < COUNTRY_ZOOM) return AUTO_RESOLUTION_MIN
  if (zoom < LADDER_ZOOM) return AUTO_RESOLUTION_MIN + 1
  const stepped = LADDER_RESOLUTION + Math.floor(zoom) - LADDER_ZOOM
  return Math.min(stepped, AUTO_RESOLUTION_MAX)
}

/**
 * Steps a zoom level by whole levels and holds it inside the range MapLibre draws.
 *
 * @param step The levels to add, negative to zoom out.
 */
export function steppedZoom(zoom: number, step: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + step))
}

/** Reports whether a coordinate lies inside a `[west, south, east, north]` box. */
export function inBounds(lat: number, lng: number, bounds: LngLatBounds): boolean {
  const [west, south, east, north] = bounds
  return lng >= west && lng <= east && lat >= south && lat <= north
}

/**
 * Grows a bounds box by one cell diameter on every side.
 *
 * A cell whose centre sits just outside the viewport still covers part of it, so a viewport filter
 * that tests centres has to widen the box by the width of one cell first.
 *
 * @param edgeKm The average edge length of a cell at the resolution in play, in kilometres.
 */
export function padBoundsByCell(bounds: LngLatBounds, edgeKm: number): LngLatBounds {
  const [west, south, east, north] = bounds
  const latitudeDegrees = (edgeKm * EDGES_PER_DIAMETER) / KM_PER_DEGREE_LATITUDE
  const centreLatitude = (south + north) / 2
  const cosine = Math.cos((centreLatitude * Math.PI) / 180)
  const longitudeDegrees = latitudeDegrees / Math.max(Math.abs(cosine), MIN_LATITUDE_COSINE)
  return [
    west - longitudeDegrees,
    south - latitudeDegrees,
    east + longitudeDegrees,
    north + latitudeDegrees,
  ]
}
