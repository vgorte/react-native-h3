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
 * These numbers cross the bridge as they are; h3-js's names work too, at the cost of a lookup on a
 * path this package exists to make fast.
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

/** Holds one of the numeric {@linkcode ContainmentMode} values. */
export type ContainmentModeValue = (typeof ContainmentMode)[keyof typeof ContainmentMode]

/** Names a containment mode the way h3-js's `POLYGON_TO_CELLS_FLAGS` does. */
export type ContainmentModeName =
  | 'containmentCenter'
  | 'containmentFull'
  | 'containmentOverlapping'
  | 'containmentOverlappingBbox'

/**
 * Maps each h3-js containment mode name to its {@linkcode ContainmentMode} value.
 *
 * Not part of the public surface: it exists so `polygonToCellsExperimental` accepts h3-js's
 * strings. An unknown name is left to the native layer, which rejects it.
 */
export const CONTAINMENT_MODE_BY_NAME: Readonly<Record<ContainmentModeName, ContainmentModeValue>> =
  Object.freeze({
    containmentCenter: ContainmentMode.center,
    containmentFull: ContainmentMode.full,
    containmentOverlapping: ContainmentMode.overlapping,
    containmentOverlappingBbox: ContainmentMode.overlappingBbox,
  })
