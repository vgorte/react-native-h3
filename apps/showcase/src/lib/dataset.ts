import { pointInRing } from './geo'
import { GERMANY_RING } from './germany'

/** Counts the coordinates in the generated sample. */
export const POINT_COUNT = 100_000

const SEED = 0x5f3759df

/** Names the share of the sample scattered over the country, drawn after everything else. */
export const SCATTER_SHARE = 0.005

// the rest of the sample goes to the city clusters
const CORRIDOR_SHARE = 0.1

// share of one city's points that goes into its halo rather than its core
const HALO_SHARE = 0.35

/** Bounds every drawn coordinate, Germany's bounding box in degrees. */
export const BOUNDS = { west: 5.866, south: 47.27, east: 15.042, north: 55.058 }

// latitude spread of a city core in degrees, about four kilometres
const CORE_SIGMA = 0.035

// latitude spread of the largest city's halo in degrees, about thirty-five kilometres
const HALO_SIGMA = 0.32

// latitude spread of a corridor in degrees, about seven kilometres
const CORRIDOR_SIGMA = 0.06

// a ring enclosing nothing would otherwise hang the generator
const MAX_REJECTED_DRAWS = 1_000

// `weight` is population in thousands; it splits the clustered points
const BERLIN = { lat: 52.52, lng: 13.405, weight: 3880 }
const HAMBURG = { lat: 53.5511, lng: 9.9937, weight: 1910 }
const MUENCHEN = { lat: 48.1351, lng: 11.582, weight: 1510 }
const KOELN = { lat: 50.9375, lng: 6.9603, weight: 1090 }
const FRANKFURT = { lat: 50.1109, lng: 8.6821, weight: 780 }
const STUTTGART = { lat: 48.7758, lng: 9.1829, weight: 630 }
const DUESSELDORF = { lat: 51.2277, lng: 6.7735, weight: 630 }
const LEIPZIG = { lat: 51.3397, lng: 12.3731, weight: 620 }
const DORTMUND = { lat: 51.5136, lng: 7.4653, weight: 590 }
const BREMEN = { lat: 53.0793, lng: 8.8017, weight: 570 }
const DRESDEN = { lat: 51.0504, lng: 13.7373, weight: 570 }
const NUERNBERG = { lat: 49.4521, lng: 11.0767, weight: 540 }

/** Holds the cities the clusters are drawn around, the largest first. */
export const CITIES = [
  BERLIN,
  HAMBURG,
  MUENCHEN,
  KOELN,
  FRANKFURT,
  STUTTGART,
  DUESSELDORF,
  LEIPZIG,
  DORTMUND,
  BREMEN,
  DRESDEN,
  NUERNBERG,
]

// the axes along which the country's traffic runs between the big clusters
const CORRIDORS = [
  [HAMBURG, BERLIN],
  [BERLIN, LEIPZIG],
  [LEIPZIG, NUERNBERG],
  [NUERNBERG, MUENCHEN],
  [FRANKFURT, KOELN],
  [FRANKFURT, STUTTGART],
]

/** Returns a mulberry32 generator, chosen because it is short enough to read and stable forever. */
function random(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Draws one standard normal sample from two uniform ones. */
function gaussian(next: () => number): number {
  const u = Math.max(next(), Number.MIN_VALUE)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/** Scales a longitude spread against a latitude one, so a round cluster stays round. */
function longitudeScale(lat: number): number {
  return 1 / Math.cos((lat * Math.PI) / 180)
}

/**
 * Generates the sample as interleaved `lat, lng` doubles.
 *
 * Every point belongs to a city core, to the wide halo around it, to one of the corridors between
 * the big cities or to the thin scatter over the rest of the country. The seed is fixed, so every
 * run and every platform sees the same sample.
 *
 * @throws {@linkcode Error} if the ring rejects `MAX_REJECTED_DRAWS` draws in a row.
 */
function generate(): Float64Array {
  const next = random(SEED)
  const points = new Float64Array(POINT_COUNT * 2)
  const scatterCount = Math.round(POINT_COUNT * SCATTER_SHARE)
  const corridorCount = Math.round(POINT_COUNT * CORRIDOR_SHARE)
  const clusteredCount = POINT_COUNT - scatterCount - corridorCount
  const totalWeight = CITIES.reduce((sum, city) => sum + city.weight, 0)
  const maxWeight = Math.max(...CITIES.map((city) => city.weight))

  let at = 0
  // every draw is tested against the border, and one that falls outside is taken again
  const place = (draw: () => [number, number]): void => {
    let point = draw()
    let streak = 0
    while (!pointInRing(point, GERMANY_RING)) {
      streak++
      if (streak >= MAX_REJECTED_DRAWS) {
        throw new Error(`${MAX_REJECTED_DRAWS} draws in a row fell outside GERMANY_RING`)
      }
      point = draw()
    }
    points[at++] = point[0]
    points[at++] = point[1]
  }

  let assigned = 0
  for (const [index, city] of CITIES.entries()) {
    // the last city absorbs the rounding remainder so the total is exact
    const share =
      index === CITIES.length - 1
        ? clusteredCount - assigned
        : Math.round((clusteredCount * city.weight) / totalWeight)
    assigned += share
    const scale = longitudeScale(city.lat)
    // the square root keeps halo density even across cities
    const haloSigma = HALO_SIGMA * Math.sqrt(city.weight / maxWeight)
    const haloShare = Math.round(share * HALO_SHARE)
    for (let i = 0; i < share; i++) {
      const sigma = i < haloShare ? haloSigma : CORE_SIGMA
      place(() => [
        clamp(city.lat + gaussian(next) * sigma, BOUNDS.south, BOUNDS.north),
        clamp(city.lng + gaussian(next) * sigma * scale, BOUNDS.west, BOUNDS.east),
      ])
    }
  }

  let laid = 0
  for (const [index, [from, to]] of CORRIDORS.entries()) {
    const share =
      index === CORRIDORS.length - 1
        ? corridorCount - laid
        : Math.round(corridorCount / CORRIDORS.length)
    laid += share
    for (let i = 0; i < share; i++) {
      place(() => {
        const along = next()
        const lat = from.lat + (to.lat - from.lat) * along
        const lng = from.lng + (to.lng - from.lng) * along
        const scale = longitudeScale(lat)
        return [
          clamp(lat + gaussian(next) * CORRIDOR_SIGMA, BOUNDS.south, BOUNDS.north),
          clamp(lng + gaussian(next) * CORRIDOR_SIGMA * scale, BOUNDS.west, BOUNDS.east),
        ]
      })
    }
  }

  for (let i = 0; i < scatterCount; i++) {
    place(() => [
      BOUNDS.south + next() * (BOUNDS.north - BOUNDS.south),
      BOUNDS.west + next() * (BOUNDS.east - BOUNDS.west),
    ])
  }

  return points
}

let cached: Promise<Float64Array> | null = null

/**
 * Returns the coordinate sample as interleaved `lat, lng` doubles.
 *
 * The sample is generated on the first call and kept, so a screen may call this on every mount.
 */
export function loadPoints(): Promise<Float64Array> {
  cached ??= Promise.resolve(generate())
  return cached
}
