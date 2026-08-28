/**
 * Generates the showcase app's bundled coordinate sample.
 *
 * The points cluster around twelve German cities in proportion to their size, with a tenth spread
 * uniformly inside Germany's outline, so the heatmap shows a country zoomed out and a city zoomed
 * in. Re-running the script must produce the same bytes.
 *
 * Usage:
 *   bun run scripts/generate-showcase-points.ts           rewrite the asset
 *   bun run scripts/generate-showcase-points.ts --check   fail if the committed asset differs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pointInRing } from '../apps/showcase/src/lib/geo'
import { GERMANY_RING } from '../apps/showcase/src/lib/germany'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const TARGET = join(ROOT, 'apps', 'showcase', 'assets', 'points-de.bin')

const POINT_COUNT = 100_000
const NOISE_SHARE = 0.1
const SEED = 0x5f3759df

// Germany's bounding box in degrees, west, south, east, north.
const BOUNDS = { west: 5.866, south: 47.27, east: 15.042, north: 55.058 }

// Latitude spread of a city cluster in degrees, about five kilometres.
const CLUSTER_SIGMA = 0.045

// a ring enclosing nothing would otherwise hang the generator
const MAX_REJECTED_DRAWS = 1_000

// `weight` is population in thousands; it only splits the clustered points
const CITIES = [
  { name: 'Berlin', lat: 52.52, lng: 13.405, weight: 3880 },
  { name: 'Hamburg', lat: 53.5511, lng: 9.9937, weight: 1910 },
  { name: 'Muenchen', lat: 48.1351, lng: 11.582, weight: 1510 },
  { name: 'Koeln', lat: 50.9375, lng: 6.9603, weight: 1090 },
  { name: 'Frankfurt', lat: 50.1109, lng: 8.6821, weight: 780 },
  { name: 'Stuttgart', lat: 48.7758, lng: 9.1829, weight: 630 },
  { name: 'Duesseldorf', lat: 51.2277, lng: 6.7735, weight: 630 },
  { name: 'Leipzig', lat: 51.3397, lng: 12.3731, weight: 620 },
  { name: 'Dortmund', lat: 51.5136, lng: 7.4653, weight: 590 },
  { name: 'Bremen', lat: 53.0793, lng: 8.8017, weight: 570 },
  { name: 'Dresden', lat: 51.0504, lng: 13.7373, weight: 570 },
  { name: 'Nuernberg', lat: 49.4521, lng: 11.0767, weight: 540 },
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

interface Sample {
  points: Float64Array
  rejected: number
}

function generate(): Sample {
  const next = random(SEED)
  const points = new Float64Array(POINT_COUNT * 2)
  const noiseCount = Math.round(POINT_COUNT * NOISE_SHARE)
  const clusteredCount = POINT_COUNT - noiseCount
  const totalWeight = CITIES.reduce((sum, city) => sum + city.weight, 0)

  let at = 0
  let assigned = 0
  for (const [index, city] of CITIES.entries()) {
    // the last city absorbs the rounding remainder so the total is exact
    const share =
      index === CITIES.length - 1
        ? clusteredCount - assigned
        : Math.round((clusteredCount * city.weight) / totalWeight)
    assigned += share
    // longitude degrees shrink with latitude, so clusters stay round
    const lngSigma = CLUSTER_SIGMA / Math.cos((city.lat * Math.PI) / 180)
    for (let i = 0; i < share; i++) {
      points[at++] = clamp(city.lat + gaussian(next) * CLUSTER_SIGMA, BOUNDS.south, BOUNDS.north)
      points[at++] = clamp(city.lng + gaussian(next) * lngSigma, BOUNDS.west, BOUNDS.east)
    }
  }

  const drawNoise = (): [number, number] => [
    BOUNDS.south + next() * (BOUNDS.north - BOUNDS.south),
    BOUNDS.west + next() * (BOUNDS.east - BOUNDS.west),
  ]

  // the box holds sea and neighbours, so outside draws are redrawn
  let rejected = 0
  for (let i = 0; i < noiseCount; i++) {
    let noise = drawNoise()
    let streak = 0
    while (!pointInRing(noise, GERMANY_RING)) {
      rejected++
      streak++
      if (streak >= MAX_REJECTED_DRAWS) {
        throw new Error(`${MAX_REJECTED_DRAWS} draws in a row fell outside GERMANY_RING`)
      }
      noise = drawNoise()
    }
    points[at++] = noise[0]
    points[at++] = noise[1]
  }

  return { points, rejected }
}

async function main(): Promise<void> {
  const { points, rejected } = generate()
  const bytes = Buffer.from(points.buffer, points.byteOffset, points.byteLength)

  if (process.argv.includes('--check')) {
    const committed = await readFile(TARGET)
    if (!committed.equals(bytes)) {
      process.stderr.write('apps/showcase/assets/points-de.bin is stale; run the generator\n')
      process.exit(1)
    }
    process.stdout.write(`${POINT_COUNT} points match the generator\n`)
    return
  }

  await writeFile(TARGET, bytes)
  console.log(`Wrote ${POINT_COUNT} points (${bytes.length} bytes) to ${TARGET}.`)
  console.log(`Redrew ${rejected} noise samples that fell outside GERMANY_RING.`)
}

await main()
