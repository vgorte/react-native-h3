import { describe, expect, test } from 'bun:test'
import h3 from 'h3-js'
import {
  PENTAGON_NEIGHBOURHOODS,
  PENTAGONS,
  RES0_CELLS,
  RESOLUTIONS,
  randomCoordinates,
  SEED,
} from './corpus'
import { callMany, skipWithoutProbe } from './probe'

/**
 * Bounds how far a cell area may sit from h3-js's, relative.
 *
 * Both sides run the same C source, but the arm64 build contracts a multiply and an add into one
 * instruction and emscripten does not. Measured over this corpus: `4.58e-13`.
 */
const AREA_TOLERANCE = 1e-12

/**
 * Bounds how far a great circle distance may sit from h3-js's, relative.
 *
 * The haversine runs on the arguments themselves rather than on a projected coordinate, so the
 * contracted multiply-add barely shows. Measured over this corpus: `2.02e-15`.
 */
const DISTANCE_TOLERANCE = 1e-14

/**
 * Bounds how far a radian to degree conversion may sit from h3-js's, relative.
 *
 * One multiply by a compiled-in constant, and the two constants differ in their last bit. Measured
 * `1.57e-16` here, one unit in the last place, and `divergences.test.ts` holds the same bound.
 */
const CONVERSION_TOLERANCE = 1e-15

/** Compares this package's answer to h3-js's for every input, reporting every mismatch rather than the first. */
function compare<T>(
  requests: string[],
  inputs: string[],
  expected: T[],
  compareOne: (ours: unknown, theirs: T) => boolean,
): void {
  const answers = callMany(requests)
  const mismatches: string[] = []
  for (let i = 0; i < answers.length; i++) {
    const ours = answers[i]
    const theirs = expected[i] as T
    if (ours instanceof Error) {
      mismatches.push(`${inputs[i]}: threw "${ours.message}", h3-js gave ${String(theirs)}`)
      continue
    }
    if (!compareOne(ours, theirs)) {
      mismatches.push(`${inputs[i]}: ours ${String(ours)}, h3-js ${String(theirs)}`)
    }
  }
  expect(mismatches).toEqual([])
}

/** Renders what h3-js did, answer or refusal alike, so both can be compared as one string. */
function outcome(produce: () => unknown): string {
  try {
    return `ok ${JSON.stringify(produce())}`
  } catch (error) {
    return `threw ${(error as Error).message}`
  }
}

/** Compares outcomes, so an operation that refuses some of its inputs is covered on both paths. */
function compareOutcomes(requests: string[], inputs: string[], expected: string[]): void {
  const answers = callMany(requests)
  const mismatches: string[] = []
  for (let i = 0; i < answers.length; i++) {
    const ours = answers[i]
    const rendered = ours instanceof Error ? `threw ${ours.message}` : `ok ${JSON.stringify(ours)}`
    if (rendered !== expected[i]) {
      mismatches.push(`${inputs[i]}: ours ${rendered}, h3-js ${expected[i]}`)
    }
  }
  expect(mismatches).toEqual([])
}

const exactly = (ours: unknown, theirs: unknown) => ours === theirs

/** Builds a comparison that admits a relative distance, and nothing else. */
function within(tolerance: number) {
  return (ours: unknown, theirs: unknown) =>
    typeof ours === 'number' &&
    typeof theirs === 'number' &&
    Math.abs(ours - theirs) <= Math.abs(theirs) * tolerance
}

describe.skipIf(skipWithoutProbe)('parity: indexing', () => {
  test('latLngToCell over 2000 seeded coordinates', () => {
    const coordinates = randomCoordinates(SEED, 2000)
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const { lat, lng } of coordinates) {
      const res = Math.abs(Math.round(lat * 1000)) % 16
      requests.push(`latLngToCell ${lat} ${lng} ${res}`)
      inputs.push(`latLngToCell(${lat}, ${lng}, ${res})`)
      expected.push(h3.latLngToCell(lat, lng, res))
    }
    compare(requests, inputs, expected, exactly)
  })

  test('latLngToCell at every resolution for a fixed point', () => {
    compare(
      RESOLUTIONS.map((res) => `latLngToCell 37.7749 -122.4194 ${res}`),
      RESOLUTIONS.map((res) => `latLngToCell(sf, ${res})`),
      RESOLUTIONS.map((res) => h3.latLngToCell(37.7749, -122.4194, res)),
      exactly,
    )
  })

  test('cellToLatLng over every base cell and pentagon neighbourhood', () => {
    const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]
    const answers = callMany(cells.map((cell) => `cellToLatLng ${cell}`))
    for (let i = 0; i < cells.length; i++) {
      const ours = answers[i] as [number, number]
      const theirs = h3.cellToLatLng(cells[i] as string)
      expect(ours[0]).toBeCloseTo(theirs[0], 12)
      expect(ours[1]).toBeCloseTo(theirs[1], 12)
    }
  })
})

describe.skipIf(skipWithoutProbe)('parity: inspection', () => {
  const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]
  const edges = PENTAGONS.flatMap((cell) => h3.originToDirectedEdges(cell))
  const vertexes = PENTAGONS.flatMap((cell) => h3.cellToVertexes(cell))

  for (const op of [
    'isValidCell',
    'isPentagon',
    'isResClassIII',
    'getBaseCellNumber',
    'getResolution',
  ] as const) {
    test(`${op} over every base cell and pentagon neighbourhood`, () => {
      compare(
        cells.map((cell) => `${op} ${cell}`),
        cells.map((cell) => `${op}(${cell})`),
        cells.map((cell) => h3[op](cell)),
        exactly,
      )
    })
  }

  for (const op of ['isValidIndex', 'isValidDirectedEdge', 'isValidVertex'] as const) {
    test(`${op} over cells, directed edges and vertexes alike`, () => {
      const indexes = [...cells, ...edges, ...vertexes]
      compare(
        indexes.map((index) => `${op} ${index}`),
        indexes.map((index) => `${op}(${index})`),
        indexes.map((index) => h3[op](index)),
        exactly,
      )
    })
  }

  test('cellToString and cellFromString round-trip h3-js hexadecimal', () => {
    const cells = [...RES0_CELLS, ...PENTAGONS]
    compare(
      cells.map((cell) => `cellToString ${cell}`),
      cells.map((cell) => `cellToString(${cell})`),
      cells,
      exactly,
    )
    compare(
      cells.map((cell) => `cellFromString ${cell}`),
      cells.map((cell) => `cellFromString(${cell})`),
      cells,
      exactly,
    )
  })

  test('getIndexDigit over every pentagon neighbourhood at every digit', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: number[] = []
    for (const cell of PENTAGON_NEIGHBOURHOODS) {
      for (let digit = 1; digit <= 15; digit++) {
        requests.push(`getIndexDigit ${cell} ${digit}`)
        inputs.push(`getIndexDigit(${cell}, ${digit})`)
        expected.push(h3.getIndexDigit(cell, digit))
      }
    }
    compare(requests, inputs, expected, exactly)
  })

  test('constructCell rebuilds every pentagon from its own digits', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of PENTAGONS) {
      const res = h3.getResolution(cell)
      const digits = Array.from({ length: res }, (_, i) => h3.getIndexDigit(cell, i + 1))
      const base = h3.getBaseCellNumber(cell)
      const encoded = digits.length === 0 ? '-' : digits.join(',')
      requests.push(`constructCell ${base} ${encoded} ${res}`)
      inputs.push(`constructCell(${base}, [${digits.join(',')}], ${res})`)
      expected.push(h3.constructCell(base, digits, res))
    }
    compare(requests, inputs, expected, exactly)
  })
})

describe.skipIf(skipWithoutProbe)('parity: measurement', () => {
  const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]

  for (const [op, unit] of [
    ['cellAreaKm2', 'km2'],
    ['cellAreaM2', 'm2'],
    ['cellAreaRads2', 'rads2'],
  ] as const) {
    test(`${op} matches cellArea(cell, '${unit}')`, () => {
      compare(
        cells.map((cell) => `${op} ${cell}`),
        cells.map((cell) => `${op}(${cell})`),
        cells.map((cell) => h3.cellArea(cell, unit)),
        within(AREA_TOLERANCE),
      )
    })
  }

  // the four resolution averages read a compiled-in table on both sides, so they agree bit for bit
  for (const [op, unit] of [
    ['getHexagonAreaAvgKm2', 'km2'],
    ['getHexagonAreaAvgM2', 'm2'],
  ] as const) {
    test(`${op} matches getHexagonAreaAvg(res, '${unit}') bit for bit`, () => {
      compare(
        RESOLUTIONS.map((res) => `${op} ${res}`),
        RESOLUTIONS.map((res) => `${op}(${res})`),
        RESOLUTIONS.map((res) => h3.getHexagonAreaAvg(res, unit)),
        exactly,
      )
    })
  }

  for (const [op, unit] of [
    ['getHexagonEdgeLengthAvgKm', 'km'],
    ['getHexagonEdgeLengthAvgM', 'm'],
  ] as const) {
    test(`${op} matches getHexagonEdgeLengthAvg(res, '${unit}') bit for bit`, () => {
      compare(
        RESOLUTIONS.map((res) => `${op} ${res}`),
        RESOLUTIONS.map((res) => `${op}(${res})`),
        RESOLUTIONS.map((res) => h3.getHexagonEdgeLengthAvg(res, unit)),
        exactly,
      )
    })
  }

  test('getNumCells at every resolution', () => {
    compare(
      RESOLUTIONS.map((res) => `getNumCells ${res}`),
      RESOLUTIONS.map((res) => `getNumCells(${res})`),
      RESOLUTIONS.map((res) => h3.getNumCells(res)),
      exactly,
    )
  })

  test('greatCircleDistance over 500 seeded coordinate pairs, in every unit', () => {
    const points = randomCoordinates(SEED + 1, 1000)
    for (const [op, unit] of [
      ['greatCircleDistanceKm', 'km'],
      ['greatCircleDistanceM', 'm'],
      ['greatCircleDistanceRads', 'rads'],
    ] as const) {
      const requests: string[] = []
      const inputs: string[] = []
      const expected: number[] = []
      for (let i = 0; i + 1 < points.length; i += 2) {
        const a = points[i] as { lat: number; lng: number }
        const b = points[i + 1] as { lat: number; lng: number }
        requests.push(`${op} ${a.lat} ${a.lng} ${b.lat} ${b.lng}`)
        inputs.push(`${op}(${a.lat}, ${a.lng}, ${b.lat}, ${b.lng})`)
        expected.push(h3.greatCircleDistance([a.lat, a.lng], [b.lat, b.lng], unit))
      }
      compare(requests, inputs, expected, within(DISTANCE_TOLERANCE))
    }
  })

  test('degsToRads and radsToDegs over the whole circle', () => {
    const degrees = [-360, -180, -90, -1, -0.5, 0, 0.5, 1, 90, 180, 359.9999, 360]
    // `degsToRads` agrees bit for bit; only the reverse constant differs in its last bit
    compare(
      degrees.map((value) => `degsToRads ${value}`),
      degrees.map((value) => `degsToRads(${value})`),
      degrees.map((value) => h3.degsToRads(value)),
      exactly,
    )
    const radians = degrees.map((value) => value / 57)
    compare(
      radians.map((value) => `radsToDegs ${value}`),
      radians.map((value) => `radsToDegs(${value})`),
      radians.map((value) => h3.radsToDegs(value)),
      within(CONVERSION_TOLERANCE),
    )
  })
})

describe.skipIf(skipWithoutProbe)('parity: scalar counters', () => {
  const cells = [...RES0_CELLS, ...PENTAGONS]

  test('cellToChildrenSize down to three deeper resolutions and to 15', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: number[] = []
    for (const cell of cells) {
      const res = h3.getResolution(cell)
      for (const target of [res, Math.min(res + 3, 15), 15]) {
        requests.push(`cellToChildrenSize ${cell} ${target}`)
        inputs.push(`cellToChildrenSize(${cell}, ${target})`)
        expected.push(h3.cellToChildrenSize(cell, target))
      }
    }
    compare(requests, inputs, expected, exactly)
  })

  test('cellToChildPos over every pentagon against every ancestor', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: number[] = []
    for (const cell of PENTAGONS) {
      for (let parentRes = 0; parentRes <= h3.getResolution(cell); parentRes++) {
        requests.push(`cellToChildPos ${cell} ${parentRes}`)
        inputs.push(`cellToChildPos(${cell}, ${parentRes})`)
        expected.push(h3.cellToChildPos(cell, parentRes))
      }
    }
    compare(requests, inputs, expected, exactly)
  })

  test('gridDistance agrees, including where the local coordinate system gives out', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const origin of PENTAGON_NEIGHBOURHOODS.slice(0, 120)) {
      for (const cell of h3.gridDisk(origin, 2)) {
        requests.push(`gridDistance ${origin} ${cell}`)
        inputs.push(`gridDistance(${origin}, ${cell})`)
        expected.push(outcome(() => h3.gridDistance(origin, cell)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('areNeighborCells agrees, including where it refuses', () => {
    // a cell is not its own neighbour, and both sides refuse with the same `E_NOT_NEIGHBORS` text
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const origin of PENTAGON_NEIGHBOURHOODS.slice(0, 120)) {
      for (const cell of h3.gridDisk(origin, 2)) {
        requests.push(`areNeighborCells ${origin} ${cell}`)
        inputs.push(`areNeighborCells(${origin}, ${cell})`)
        expected.push(outcome(() => h3.areNeighborCells(origin, cell)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })
})
