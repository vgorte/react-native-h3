import { describe, expect, test } from 'bun:test'
import h3 from 'h3-js'
import {
  CONTAINMENT_MODES,
  EXTREME_COORDINATES,
  encodeCells,
  encodeRings,
  PENTAGONS,
  POLYGONS,
  RES0_CELLS,
  RESOLUTIONS,
} from './corpus'
import { callMany, skipWithoutProbe } from './probe'

/**
 * Bounds how many degrees a coordinate may sit from h3-js's, away from a pole.
 *
 * Measured over this corpus: `5.68e-14`, which `divergences.test.ts` pins at its own bound.
 */
const COORDINATE_DIGITS = 11

/**
 * Bounds how many degrees a coordinate may sit from h3-js's within a degree of a pole.
 *
 * The inverse projection is ill-conditioned there, so the fused multiply-add the arm64 build
 * contracts and emscripten does not moves a resolution 15 vertex by up to `1.8e-7` degrees, two
 * centimetres on a cell half a metre across. `divergences.test.ts` pins each resolution separately.
 */
const POLAR_COORDINATE_DIGITS = 6

/** Compares nested coordinate arrays to within the digits double arithmetic guarantees. */
function expectCoordinatesClose(
  ours: unknown,
  theirs: number[][],
  label: string,
  digits = COORDINATE_DIGITS,
): void {
  const oursPoints = ours as number[][]
  expect(oursPoints.length, `${label}: point count`).toBe(theirs.length)
  for (let i = 0; i < theirs.length; i++) {
    const theirsPoint = theirs[i] as number[]
    const oursPoint = oursPoints[i] as number[]
    expect(oursPoint[0] as number, `${label}[${i}].lat`).toBeCloseTo(
      theirsPoint[0] as number,
      digits,
    )
    expect(oursPoint[1] as number, `${label}[${i}].lng`).toBeCloseTo(
      theirsPoint[1] as number,
      digits,
    )
  }
}

describe.skipIf(skipWithoutProbe)('parity: boundaries', () => {
  test('cellToBoundary over every base cell and every pentagon', () => {
    const cells = [...RES0_CELLS, ...PENTAGONS]
    const answers = callMany(cells.map((cell) => `cellToBoundary ${cell}`))
    for (let i = 0; i < cells.length; i++) {
      expectCoordinatesClose(
        answers[i],
        h3.cellToBoundary(cells[i] as string),
        `cellToBoundary(${cells[i]})`,
      )
    }
  })

  test('directedEdgeToBoundary over every edge of every base cell', () => {
    const edges = RES0_CELLS.flatMap((cell) => h3.originToDirectedEdges(cell))
    const answers = callMany(edges.map((edge) => `directedEdgeToBoundary ${edge}`))
    for (let i = 0; i < edges.length; i++) {
      expectCoordinatesClose(
        answers[i],
        h3.directedEdgeToBoundary(edges[i] as string),
        `directedEdgeToBoundary(${edges[i]})`,
      )
    }
  })

  test('vertexToLatLng over every vertex of every pentagon', () => {
    const vertexes = PENTAGONS.flatMap((cell) => h3.cellToVertexes(cell))
    const answers = callMany(vertexes.map((vertex) => `vertexToLatLng ${vertex}`))
    for (let i = 0; i < vertexes.length; i++) {
      const theirs = h3.vertexToLatLng(vertexes[i] as string)
      const ours = answers[i] as number[]
      expect(ours[0] as number).toBeCloseTo(theirs[0], COORDINATE_DIGITS)
      expect(ours[1] as number).toBeCloseTo(theirs[1], COORDINATE_DIGITS)
    }
  })
})

describe.skipIf(skipWithoutProbe)('parity: polygons', () => {
  test('polygonToCells over every polygon at every listed resolution', () => {
    const requests: string[] = []
    const labels: string[] = []
    const expected: string[][] = []
    for (const polygon of POLYGONS) {
      for (const res of polygon.resolutions) {
        requests.push(`polygonToCells ${encodeRings(polygon.rings)} ${res}`)
        labels.push(`polygonToCells(${polygon.name}, ${res})`)
        expected.push(h3.polygonToCells(polygon.rings, res))
      }
    }
    const answers = callMany(requests)
    for (let i = 0; i < answers.length; i++) {
      expect(answers[i], labels[i]).toEqual(expected[i] as string[])
    }
  })

  for (const [mode, flag] of CONTAINMENT_MODES.entries()) {
    test(`polygonToCellsExperimental with containment mode ${mode}, h3-js '${flag}'`, () => {
      const requests: string[] = []
      const labels: string[] = []
      const expected: string[][] = []
      for (const polygon of POLYGONS) {
        for (const res of polygon.resolutions) {
          requests.push(`polygonToCellsExperimental ${encodeRings(polygon.rings)} ${res} ${mode}`)
          labels.push(`polygonToCellsExperimental(${polygon.name}, ${res}, ${mode})`)
          expected.push(h3.polygonToCellsExperimental(polygon.rings, res, flag))
        }
      }
      const answers = callMany(requests)
      for (let i = 0; i < answers.length; i++) {
        expect(answers[i], labels[i]).toEqual(expected[i] as string[])
      }
    })
  }

  test('an empty polygon covers nothing on either side', () => {
    const [ours] = callMany(['polygonToCells - 7'])
    expect(ours).toEqual(h3.polygonToCells([], 7))
  })
})

describe.skipIf(skipWithoutProbe)('parity: multipolygons', () => {
  test('cellsToMultiPolygon over the disk around every pentagon', () => {
    for (const cell of PENTAGONS.slice(0, 60)) {
      const disk = h3.gridDisk(cell, 1)
      const [ours] = callMany([`cellsToMultiPolygon ${encodeCells(disk)}`])
      const theirs = h3.cellsToMultiPolygon(disk)
      expect(ours).not.toBeInstanceOf(Error)
      const oursPolygons = ours as number[][][][]
      expect(oursPolygons.length, `polygon count for ${cell}`).toBe(theirs.length)
      for (let p = 0; p < theirs.length; p++) {
        const theirsPolygon = theirs[p] as number[][][]
        const oursPolygon = oursPolygons[p] as number[][][]
        expect(oursPolygon.length, `loop count for ${cell}`).toBe(theirsPolygon.length)
        for (let l = 0; l < theirsPolygon.length; l++) {
          expectCoordinatesClose(
            oursPolygon[l],
            theirsPolygon[l] as number[][],
            `cellsToMultiPolygon(${cell})[${p}][${l}]`,
          )
        }
      }
    }
  })

  test('cellsToMultiPolygon across the antimeridian and at both poles', () => {
    const regions: [string, [number, number][][], number][] = [
      [
        'antimeridian',
        [
          [
            [10, 175],
            [10, 179],
            [-10, 179],
            [-10, 175],
          ],
        ],
        3,
      ],
      [
        'north pole',
        [
          [
            [89.5, -10],
            [89.5, 10],
            [88.5, 10],
            [88.5, -10],
          ],
        ],
        6,
      ],
      [
        'south pole',
        [
          [
            [-88.5, -10],
            [-88.5, 10],
            [-89.5, 10],
            [-89.5, -10],
          ],
        ],
        6,
      ],
    ]
    for (const [name, rings, res] of regions) {
      const cells = h3.polygonToCells(rings, res)
      const [ours] = callMany([`cellsToMultiPolygon ${encodeCells(cells)}`])
      const theirs = h3.cellsToMultiPolygon(cells)
      const oursPolygons = ours as number[][][][]
      expect(oursPolygons.length, `${name}: polygon count`).toBe(theirs.length)
      for (let p = 0; p < theirs.length; p++) {
        const theirsPolygon = theirs[p] as number[][][]
        const oursPolygon = oursPolygons[p] as number[][][]
        expect(oursPolygon.length, `${name}: loop count`).toBe(theirsPolygon.length)
        for (let l = 0; l < theirsPolygon.length; l++) {
          expectCoordinatesClose(
            oursPolygon[l],
            theirsPolygon[l] as number[][],
            `cellsToMultiPolygon(${name})[${p}][${l}]`,
          )
        }
      }
    }
  })

  test('an empty cell set makes no polygon on either side', () => {
    const [ours] = callMany(['cellsToMultiPolygon -'])
    expect(ours).toEqual(h3.cellsToMultiPolygon([]))
  })
})

describe.skipIf(skipWithoutProbe)('parity: extreme coordinates', () => {
  test('latLngToCell at the poles and on the antimeridian, at every resolution', () => {
    const requests: string[] = []
    const labels: string[] = []
    const expected: string[] = []
    for (const { lat, lng } of EXTREME_COORDINATES) {
      for (const res of RESOLUTIONS) {
        requests.push(`latLngToCell ${lat} ${lng} ${res}`)
        labels.push(`latLngToCell(${lat}, ${lng}, ${res})`)
        expected.push(h3.latLngToCell(lat, lng, res))
      }
    }
    const answers = callMany(requests)
    for (let i = 0; i < answers.length; i++) {
      expect(answers[i], labels[i]).toBe(expected[i] as string)
    }
  })

  test('the cells at the poles and on the antimeridian have h3-js boundaries', () => {
    const cells = EXTREME_COORDINATES.flatMap(({ lat, lng }) =>
      [0, 5, 10, 15].map((res) => h3.latLngToCell(lat, lng, res)),
    )
    const answers = callMany(cells.map((cell) => `cellToBoundary ${cell}`))
    for (let i = 0; i < cells.length; i++) {
      expectCoordinatesClose(
        answers[i],
        h3.cellToBoundary(cells[i] as string),
        `cellToBoundary(${cells[i]})`,
        POLAR_COORDINATE_DIGITS,
      )
    }
  })

  test('longitude 180 and -180 name the same cell', () => {
    const [east, west] = callMany(['latLngToCell 0 180 5', 'latLngToCell 0 -180 5'])
    expect(east).toBe(west)
    expect(east).toBe(h3.latLngToCell(0, 180, 5))
  })
})
