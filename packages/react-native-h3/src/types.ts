/** Represents a latitude and longitude in degrees. */
export interface LatLng {
  lat: number
  lng: number
}

/** Represents local IJ hexagon coordinates, whose axes are spaced 120 degrees apart. */
export interface CoordIJ {
  i: number
  j: number
}

/** Represents a ring of `[latitude, longitude]` pairs in degrees, whose first point is not repeated at the end. */
export type Ring = [lat: number, lng: number][]

/**
 * Names the containment modes of `polygonToCellsExperimental`, matching H3's `ContainmentMode`
 * values.
 *
 * `h3-js` passes these as strings. This package uses the numbers, because a string argument across
 * the bridge costs a conversion on exactly the paths this package exists to make fast.
 */
export const ContainmentMode = Object.freeze({
  /** Requires the cell centre to be contained in the shape. */
  center: 0,
  /** Requires the cell to be fully contained in the shape. */
  full: 1,
  /** Requires the cell to overlap the shape at any point. */
  overlapping: 2,
  /** Requires the cell's bounding box to overlap the shape. */
  overlappingBbox: 3,
} as const)

export type ContainmentModeValue = (typeof ContainmentMode)[keyof typeof ContainmentMode]
