/** A latitude and longitude in degrees. */
export interface LatLng {
  lat: number
  lng: number
}

/** Local IJ hexagon coordinates. Each axis is spaced 120 degrees apart. */
export interface CoordIJ {
  i: number
  j: number
}

/** A closed ring of `[latitude, longitude]` pairs in degrees. The first point is not repeated. */
export type Ring = [lat: number, lng: number][]

/**
 * Containment modes for `polygonToCellsExperimental`, matching H3's `ContainmentMode` enum values.
 *
 * `h3-js` passes these as strings. This package uses the numbers, because a string argument across
 * the bridge costs a conversion on exactly the paths this package exists to make fast.
 */
export const ContainmentMode = Object.freeze({
  /** The cell centre is contained in the shape. */
  center: 0,
  /** The cell is fully contained in the shape. */
  full: 1,
  /** The cell overlaps the shape at any point. */
  overlapping: 2,
  /** The cell's bounding box overlaps the shape. */
  overlappingBbox: 3,
} as const)

export type ContainmentModeValue = (typeof ContainmentMode)[keyof typeof ContainmentMode]
