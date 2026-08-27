import h3 from 'h3-js'

/** Lists every resolution the H3 hierarchy has. */
export const RESOLUTIONS = Array.from({ length: 16 }, (_, res) => res)

/** Lists all 122 resolution 0 cells, as h3-js hexadecimal strings. */
export const RES0_CELLS: string[] = h3.getRes0Cells()

/** Lists the twelve pentagons at each resolution, as a flat list of 192 cells. */
export const PENTAGONS: string[] = RESOLUTIONS.flatMap((res) => h3.getPentagons(res))

/**
 * Lists every pentagon at resolutions 0 to 5 together with its immediate neighbourhood.
 *
 * Pentagons are not an edge case here: they are the reason `H3_NULL` holes exist at all, and
 * therefore the main case for the compaction this package does natively.
 */
export const PENTAGON_NEIGHBOURHOODS: string[] = Array.from(
  new Set(
    [0, 1, 2, 3, 4, 5].flatMap((res) =>
      h3.getPentagons(res).flatMap((cell) => h3.gridDisk(cell, 1)),
    ),
  ),
)

/**
 * Returns a deterministic pseudo-random generator, so a failing case is reproducible from its seed.
 *
 * mulberry32, chosen because it is four lines and has no dependencies.
 */
function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Coordinate {
  lat: number
  lng: number
}

/** Returns `count` reproducible coordinates over the whole globe. */
export function randomCoordinates(seed: number, count: number): Coordinate[] {
  const random = mulberry32(seed)
  return Array.from({ length: count }, () => ({
    lat: random() * 180 - 90,
    lng: random() * 360 - 180,
  }))
}

/**
 * Seeds every random case, so a failure reproduces from this number alone.
 *
 * Change it only to widen coverage, never to make a test pass.
 */
export const SEED = 0x5eed

/** Lists the coordinates that sit exactly on the poles and the antimeridian. */
export const EXTREME_COORDINATES: Coordinate[] = [
  { lat: 90, lng: 0 },
  { lat: -90, lng: 0 },
  { lat: 90, lng: 180 },
  { lat: -90, lng: -180 },
  { lat: 0, lng: 180 },
  { lat: 0, lng: -180 },
  { lat: 0, lng: 0 },
  { lat: 89.9999, lng: 179.9999 },
  { lat: -89.9999, lng: -179.9999 },
]

export interface PolygonCase {
  name: string
  rings: [number, number][][]
  resolutions: number[]
}

/** Lists the polygons chosen for the cases that break naive implementations. */
export const POLYGONS: PolygonCase[] = [
  {
    name: 'San Francisco triangle',
    rings: [
      [
        [37.813318999983238, -122.40898669999721],
        [37.71980619999785, -122.35447369999936],
        [37.815157199999845, -122.4798767000009],
      ],
    ],
    resolutions: [5, 7, 9],
  },
  {
    name: 'rectangle with a hole',
    rings: [
      [
        [37.85, -122.5],
        [37.85, -122.35],
        [37.7, -122.35],
        [37.7, -122.5],
      ],
      [
        [37.8, -122.45],
        [37.8, -122.4],
        [37.75, -122.4],
        [37.75, -122.45],
      ],
    ],
    resolutions: [7, 8],
  },
  {
    name: 'crossing the antimeridian',
    rings: [
      [
        [10, 179],
        [10, -179],
        [-10, -179],
        [-10, 179],
      ],
    ],
    resolutions: [2, 3],
  },
  {
    name: 'touching the antimeridian from the west',
    rings: [
      [
        [10, 175],
        [10, 179],
        [-10, 179],
        [-10, 175],
      ],
    ],
    resolutions: [2, 3],
  },
  {
    name: 'near the north pole',
    rings: [
      [
        [89.5, -10],
        [89.5, 10],
        [88.5, 10],
        [88.5, -10],
      ],
    ],
    resolutions: [4, 5, 6],
  },
  {
    name: 'near the south pole',
    rings: [
      [
        [-88.5, -10],
        [-88.5, 10],
        [-89.5, 10],
        [-89.5, -10],
      ],
    ],
    resolutions: [4, 5, 6],
  },
]

/**
 * Names the h3-js containment flags in the order of the mode numbers this package takes.
 *
 * The two agree on that order, so the index is the mode number the probe is given.
 */
export const CONTAINMENT_MODES = [
  'containmentCenter',
  'containmentFull',
  'containmentOverlapping',
  'containmentOverlappingBbox',
] as const

/** Encodes a polygon in the probe's ring syntax. */
export function encodeRings(rings: [number, number][][]): string {
  if (rings.length === 0) {
    return '-'
  }
  return rings.map((ring) => ring.map(([lat, lng]) => `${lat},${lng}`).join(';')).join('|')
}

/** Encodes a cell list in the probe's syntax. */
export function encodeCells(cells: string[]): string {
  return cells.length === 0 ? '-' : cells.join(',')
}
