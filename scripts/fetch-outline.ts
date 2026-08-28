/**
 * Fetches one administrative outline from the BKG's VG250 web feature service.
 *
 * The largest ring of the requested land polygon is simplified and written as a TypeScript module,
 * so the app carries the outline in its bundle instead of calling the service at runtime.
 *
 * Usage, one line per outline the app bundles:
 *   bun run scripts/fetch-outline.ts --name Deutschland --layer sta \
 *     --export GERMANY_RING --out apps/showcase/src/lib/germany.ts --tolerance 0.025
 *   bun run scripts/fetch-outline.ts --name Berlin --layer lan \
 *     --export BERLIN_RING --out apps/showcase/src/lib/berlin.ts --tolerance 0.007
 */

import { writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')

const SERVICE = 'https://sgx.geodatenzentrum.de/wfs_vg250'
const DATA_SOURCES =
  'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf'

// `gf` separates a unit's land polygon from its coastal water ones; only `4` is land.
const LAND = 4

// degrees of latitude, about 2.8 kilometres, roughly one pixel at country zoom
const DEFAULT_TOLERANCE = 0.025

// longitude degrees are shorter than latitude ones; Germany's middle is the useful ratio
const LNG_SCALE = Math.cos((51.2 * Math.PI) / 180)

type Point = [lat: number, lng: number]

interface Feature {
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null
}

function requestUrl(name: string, layer: string): string {
  const url = new URL(SERVICE)
  url.searchParams.set('SERVICE', 'WFS')
  url.searchParams.set('VERSION', '2.0.0')
  url.searchParams.set('REQUEST', 'GetFeature')
  url.searchParams.set('TYPENAMES', `vg250:vg250_${layer}`)
  url.searchParams.set('CQL_FILTER', `gen='${name}' AND gf=${LAND}`)
  url.searchParams.set('OUTPUTFORMAT', 'application/json')
  url.searchParams.set('SRSNAME', 'EPSG:4326')
  return url.toString()
}

/** Returns every outer ring of a polygon or multipolygon, in `[lat, lng]` order. */
function outerRings(feature: Feature): Point[][] {
  const geometry = feature.geometry
  if (geometry === null) {
    return []
  }
  const polygons = (
    geometry.type === 'MultiPolygon'
      ? (geometry.coordinates as number[][][][])
      : [geometry.coordinates as number[][][]]
  ).flatMap((polygon) => (polygon[0] === undefined ? [] : [polygon[0]]))
  return polygons.map((ring) =>
    ring.flatMap((position): Point[] => {
      const [lng, lat] = position
      return lng === undefined || lat === undefined ? [] : [[lat, lng]]
    }),
  )
}

/** Measures a point's distance from the segment `start` to `end`, longitude scaled to latitude. */
function distanceToSegment(point: Point, start: Point, end: Point): number {
  const px = (point[1] - start[1]) * LNG_SCALE
  const py = point[0] - start[0]
  const ex = (end[1] - start[1]) * LNG_SCALE
  const ey = end[0] - start[0]
  const lengthSquared = ex * ex + ey * ey
  // a closed ring starts and ends on the same point, which is no segment at all
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, (px * ex + py * ey) / lengthSquared))
  const dx = px - t * ex
  const dy = py - t * ey
  return Math.sqrt(dx * dx + dy * dy)
}

/** Thins a polyline with Douglas-Peucker, keeping every vertex further out than `tolerance`. */
function simplify(points: Point[], tolerance: number): Point[] {
  const first = points[0]
  const last = points[points.length - 1]
  if (points.length < 3 || first === undefined || last === undefined) {
    return [...points]
  }

  let furthest = 0
  let distance = 0
  for (let i = 1; i < points.length - 1; i++) {
    const candidate = points[i]
    if (candidate === undefined) {
      continue
    }
    const gap = distanceToSegment(candidate, first, last)
    if (gap > distance) {
      furthest = i
      distance = gap
    }
  }

  if (distance <= tolerance) {
    return [first, last]
  }
  const left = simplify(points.slice(0, furthest + 1), tolerance)
  const right = simplify(points.slice(furthest), tolerance)
  return [...left.slice(0, -1), ...right]
}

/** Drops the closing vertex a source ring repeats, which a `Ring` leaves off. */
function open(ring: Point[]): Point[] {
  const first = ring[0]
  const last = ring[ring.length - 1]
  const closed =
    first !== undefined && last !== undefined && first[0] === last[0] && first[1] === last[1]
  return closed ? ring.slice(0, -1) : ring
}

/** Rounds to about one metre and drops the trailing zeros `toFixed` leaves behind. */
function degrees(value: number): string {
  return String(Number(value.toFixed(5)))
}

function module(
  name: string,
  exported: string,
  layer: string,
  ring: Point[],
  loops: number,
): string {
  const vertices = ring.map(([lat, lng]) => `  [${degrees(lat)}, ${degrees(lng)}],`).join('\n')
  const provenance =
    loops === 1
      ? 'The polygon has one loop, which the ring follows in full.'
      : `The ring is the largest of that polygon's ${loops} loops, ` +
        'so islands and exclaves lie outside it.'
  return `import type { Ring } from 'react-native-h3'

/**
 * Outlines the VG250 land polygon of \`${name}\`, simplified to ${ring.length} vertices.
 *
 * ${provenance}
 * Written by \`scripts/fetch-outline.ts\`, not by hand.
 *
 * @see ${SERVICE} \`vg250:vg250_${layer}\`, \`gen='${name}' AND gf=${LAND}\`
 * @see ${DATA_SOURCES}
 * © BKG 2026 dl-de/by-2-0
 */
export const ${exported}: Ring = [
${vertices}
]
`
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      name: { type: 'string' },
      layer: { type: 'string', default: 'lan' },
      export: { type: 'string' },
      out: { type: 'string' },
      tolerance: { type: 'string', default: String(DEFAULT_TOLERANCE) },
    },
  })

  const { name, layer, export: exported, out } = values
  if (name === undefined || exported === undefined || out === undefined) {
    process.stderr.write('Usage: --name <gen> [--layer <sta|lan>] --export <NAME> --out <path>\n')
    process.exit(1)
  }
  const tolerance = Number(values.tolerance)
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    process.stderr.write(`--tolerance must be a positive number, got ${values.tolerance}\n`)
    process.exit(1)
  }

  const response = await fetch(requestUrl(name, layer))
  if (!response.ok) {
    throw new Error(`${SERVICE} answered ${response.status} ${response.statusText}`)
  }
  const collection = (await response.json()) as { features?: Feature[] }
  const rings = (collection.features ?? []).flatMap(outerRings)
  const largest = rings.reduce<Point[]>(
    (best, ring) => (ring.length > best.length ? ring : best),
    [],
  )
  if (largest.length === 0) {
    throw new Error(`No land polygon for gen='${name}' in vg250_${layer}`)
  }

  const ring = open(simplify(largest, tolerance))
  const target = join(ROOT, out)
  await writeFile(target, module(name, exported, layer, ring, rings.length))
  console.log(
    `Wrote ${exported} to ${relative(ROOT, target)}: ` +
      `${ring.length} of ${largest.length} vertices at tolerance ${tolerance}.`,
  )
}

await main()
