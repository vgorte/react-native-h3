/**
 * Pins every difference from h3-js that is meant, so none can slip through as a bug.
 *
 * The comparison runs through the probe, whose answers are JSON, so cells are hexadecimal strings
 * and cell sets are arrays. The `bigint`, `BigUint64Array` and `LatLng` shapes of the public API
 * are not under test here, and neither are the h3-js containment mode names the wrapper also takes.
 */

import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import h3 from 'h3-js'
import type * as api from '../src/index'
import {
  EXTREME_COORDINATES,
  PENTAGON_NEIGHBOURHOODS,
  PENTAGONS,
  RES0_CELLS,
  RESOLUTIONS,
} from './corpus'
import { callMany, skipWithoutProbe } from './probe'

/** Fails to compile unless its argument is `true`, which is how a type-level row is proved. */
type Expect<T extends true> = T

/** Answers `true` only when the two types are the same in both directions. */
type IsExactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

// the probe speaks JSON, so `tsc` is what proves this package's half of the two shape rows; the
// h3-js half is asserted at run time in `divergence: the shape of the public surface`.
export type CellIsABigint = Expect<IsExactly<ReturnType<typeof api.latLngToCell>, bigint>>
export type CellSetIsATypedArray = Expect<
  IsExactly<ReturnType<typeof api.gridDisk>, BigUint64Array>
>

const CELL = '89283082803ffff'

/** Carries directed edge mode bits and direction `0`, which no real edge ever has. */
const EDGE_WITH_NO_DIRECTION = '109283082803ffff'

/** Returns the probe's answer, or the `Error` it reported. */
function ask(request: string): unknown {
  return callMany([request])[0]
}

/** Returns the probe's answer, failing the test if the probe refused instead. */
function answer(request: string): unknown {
  const value = ask(request)
  expect(value, `${request} was refused`).not.toBeInstanceOf(Error)
  return value
}

/** Returns the message the probe refused with, failing the test if it answered instead. */
function refusal(request: string): string {
  const value = ask(request)
  expect(value, `${request} was answered`).toBeInstanceOf(Error)
  return (value as Error).message
}

/** Returns the message h3-js threw, failing the test if it answered instead. */
function h3jsRefusal(produce: () => unknown): string {
  try {
    produce()
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('h3-js answered where a refusal was expected')
}

/** Returns the H3 error code a message carries in its `(code: N)` suffix. */
function codeOf(message: string): number | undefined {
  const match = /\(code: (\d+)[,)]/.exec(message)
  return match === null ? undefined : Number(match[1])
}

/** Removes the `, value: X` h3-js appends where it validated the argument itself. */
function withoutValue(message: string): string {
  return message.replace(/, value: [^)]*\)/, ')')
}

/**
 * Runs one h3-js expression in a fresh process and returns what it printed.
 *
 * `uncompactCells` over an unvalidated member sizes its output from a nonsense index and asks
 * emscripten for the memory, which leaves the module unusable for the rest of the process.
 */
function askH3JsInAFreshProcess(expression: string): string {
  const source =
    "import h3 from 'h3-js'\n" +
    `try { console.log('ok ' + JSON.stringify(${expression})) }\n` +
    "catch (error) { console.log('threw ' + error.message) }"
  const result = spawnSync('bun', ['-e', source], {
    cwd: join(import.meta.dir, '..'),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(`h3-js could not be asked: ${result.stderr}`)
  }
  return result.stdout.trim()
}

describe.skipIf(skipWithoutProbe)('divergence: an invalid index is refused, not read', () => {
  test('an invalid cell earns E_CELL_INVALID where h3-js reads it anyway', () => {
    for (const request of [
      `cellAreaKm2 1`,
      `cellToBoundary 1`,
      `cellToLatLng 1`,
      `gridDisk 1 1`,
      `cellToChildren 1 2`,
    ]) {
      const message = refusal(request)
      expect(message, request).toBe('Cell argument was not valid (code: 5)')
    }
    // h3-js runs the same C code without the guard, so it answers with whatever the bits mean
    expect(h3.cellArea('1', 'km2')).toBe(4106166.3344638464)
    expect(h3.cellToLatLng('1')).toEqual([79.24239850975904, 38.0234070079698])
    expect(h3.gridDisk('1', 1)).toEqual([
      '1000000000001',
      '200000000001',
      '400000000001',
      '600000000001',
      '800000000001',
      'a00000000001',
    ])
  })

  test('an invalid directed edge earns E_DIR_EDGE_INVALID where h3-js reads it anyway', () => {
    expect(h3.isValidDirectedEdge(EDGE_WITH_NO_DIRECTION)).toBe(false)
    expect(refusal(`getDirectedEdgeOrigin ${EDGE_WITH_NO_DIRECTION}`)).toBe(
      'Directed edge argument was not valid (code: 6)',
    )
    expect(h3.getDirectedEdgeOrigin(EDGE_WITH_NO_DIRECTION)).toBe(CELL)
  })

  test('an invalid vertex earns E_VERTEX_INVALID where h3-js reads it anyway', () => {
    expect(h3.isValidVertex(CELL)).toBe(false)
    expect(refusal(`vertexToLatLng ${CELL}`)).toBe('Vertex argument was not valid (code: 8)')
    expect(h3.vertexToLatLng(CELL)).toEqual([37.7720104773324, -122.41701147197293])
  })

  test('the nine exemptions answer for any input, and agree with h3-js', () => {
    const indexes = ['1', '0', 'ffffffffffffffff', EDGE_WITH_NO_DIRECTION, CELL]
    for (const op of [
      'isValidCell',
      'isValidIndex',
      'isPentagon',
      'isResClassIII',
      'isValidDirectedEdge',
      'isValidVertex',
      'getResolution',
      'getBaseCellNumber',
    ] as const) {
      for (const index of indexes) {
        expect(answer(`${op} ${index}`), `${op}(${index})`).toBe(h3[op](index))
      }
    }
    // `cellToString` is the ninth, and formats any index; h3-js has no counterpart to compare
    for (const index of indexes) {
      expect(answer(`cellToString ${index}`)).toBe(index)
      // `cellFromString` takes text rather than a cell index, so it converts whatever parses
      expect(answer(`cellFromString ${index}`)).toBe(index)
    }
  })
})

describe.skipIf(skipWithoutProbe)('divergence: an argument that is not an integer', () => {
  test('a fractional argument is refused where h3-js truncates it', () => {
    // the fourth element is the answer truncation gives h3-js, so a change of h3-js's mind shows up
    const cases: [string, string, () => unknown, unknown][] = [
      [
        `gridDisk ${CELL} 1.5`,
        'k must be an integer',
        () => h3.gridDisk(CELL, 1.5),
        h3.gridDisk(CELL, 1),
      ],
      [
        `cellToParent ${CELL} 1.5`,
        'Resolution must be an integer between 0 and 15',
        () => h3.cellToParent(CELL, 1.5),
        '81283ffffffffff',
      ],
      [
        `cellToVertex ${CELL} 0.5`,
        'Vertex number must be an integer',
        () => h3.cellToVertex(CELL, 0.5),
        '209283082803ffff',
      ],
      [
        'latLngToCell 0 0 1.5',
        'Resolution must be an integer between 0 and 15',
        () => h3.latLngToCell(0, 0, 1.5),
        '81757ffffffffff',
      ],
      [
        `childPosToCell 1.5 ${CELL} 10`,
        'Child position must be an integer',
        () => h3.childPosToCell(1.5, CELL, 10),
        '8a283082800ffff',
      ],
    ]
    for (const [request, message, produce, truncated] of cases) {
      expect(refusal(request), request).toBe(message)
      // this package's wording carries no `(code: N)`, because H3 never saw the argument
      expect(codeOf(message), request).toBeUndefined()
      expect(produce(), request).toEqual(truncated)
    }
  })

  test('a fractional resolution is refused in our wording where h3-js reports E_RES_DOMAIN', () => {
    const cases: [string, () => unknown][] = [
      ['getHexagonAreaAvgKm2 1.5', () => h3.getHexagonAreaAvg(1.5, 'km2')],
      ['getHexagonEdgeLengthAvgKm 1.5', () => h3.getHexagonEdgeLengthAvg(1.5, 'km')],
      ['getNumCells 1.5', () => h3.getNumCells(1.5)],
    ]
    for (const [request, produce] of cases) {
      expect(refusal(request), request).toBe('Resolution must be an integer between 0 and 15')
      expect(h3jsRefusal(produce), request).toBe(
        'Resolution argument was outside of acceptable range (code: 4, value: 1.5)',
      )
    }
  })
})

describe.skipIf(skipWithoutProbe)('divergence: the cell ceiling', () => {
  test('a request above four million cells is refused where h3-js allocates it', () => {
    // `3 * 1155 * 1156 + 1` is 4,005,541 cells, the first `k` past the ceiling
    expect(refusal(`gridDisk ${CELL} 1155`)).toBe(
      "The requested result would exceed this binding's limit of 4000000 cells",
    )
    expect(h3.gridDisk(CELL, 1155)).toHaveLength(4005541)
  })
})

describe.skipIf(skipWithoutProbe)('divergence: a malformed polygon', () => {
  test('a point that is not a pair is named, where h3-js reports E_FAILED', () => {
    expect(refusal('polygonToCells 0,0;0;1,1 3')).toBe('Not a point: 0')
    const theirs = h3jsRefusal(() =>
      h3.polygonToCells([[[0, 0], [0] as unknown as [number, number], [1, 1]]], 3),
    )
    expect(theirs).toBe('The operation failed but a more specific error is not available (code: 1)')
  })

  test('a coordinate that is not finite is named, where h3-js reports E_FAILED', () => {
    expect(refusal('polygonToCells 0,0;nan,1;1,1 3')).toBe(
      'Polygon coordinates must be finite numbers',
    )
    const theirs = h3jsRefusal(() =>
      h3.polygonToCells(
        [
          [
            [0, 0],
            [Number.NaN, 1],
            [1, 1],
          ],
        ],
        3,
      ),
    )
    expect(theirs).toBe('The operation failed but a more specific error is not available (code: 1)')
  })
})

describe.skipIf(skipWithoutProbe)('parity: error codes and wording', () => {
  test('a failure from H3 carries the same code and the same text as h3-js', () => {
    const cases: [string, () => unknown][] = [
      ['latLngToCell 0 0 42', () => h3.latLngToCell(0, 0, 42)],
      [`cellToChildren ${CELL} 20`, () => h3.cellToChildren(CELL, 20)],
      [`cellToParent ${CELL} 12`, () => h3.cellToParent(CELL, 12)],
      [`gridPathCells ${CELL} 85283083fffffff`, () => h3.gridPathCells(CELL, '85283083fffffff')],
      [
        'gridDistance 8009fffffffffff 8075fffffffffff',
        () => h3.gridDistance('8009fffffffffff', '8075fffffffffff'),
      ],
      [
        'cellToLocalIj 8009fffffffffff 8075fffffffffff',
        () => h3.cellToLocalIj('8009fffffffffff', '8075fffffffffff'),
      ],
      ['edgeLengthKm 1', () => h3.edgeLength('1', 'km')],
      ['directedEdgeToCells 1', () => h3.directedEdgeToCells('1')],
      [`cellToVertex ${CELL} 7`, () => h3.cellToVertex(CELL, 7)],
      ['getHexagonAreaAvgKm2 16', () => h3.getHexagonAreaAvg(16, 'km2')],
      ['getNumCells 16', () => h3.getNumCells(16)],
      [`getIndexDigit ${CELL} 0`, () => h3.getIndexDigit(CELL, 0)],
      [`childPosToCell 100000 ${CELL} 10`, () => h3.childPosToCell(100000, CELL, 10)],
      [`uncompactCells ${CELL} 5`, () => h3.uncompactCells([CELL], 5)],
      ['constructCell 200 - 0', () => h3.constructCell(200, [], 0)],
    ]
    for (const [request, produce] of cases) {
      const ours = refusal(request)
      const theirs = h3jsRefusal(produce)
      expect(withoutValue(theirs), request).toBe(ours)
      expect(codeOf(ours), request).toBe(codeOf(theirs) as number)
    }
  })

  test('E_OPTION_INVALID keeps its code but not h3-js wording', () => {
    // h3-js rejects an unknown containment mode in JavaScript, from a table that has no entry 15
    const ours = refusal('polygonToCellsExperimental 0,0;0,1;1,1 3 4')
    const theirs = h3jsRefusal(() =>
      h3.polygonToCellsExperimental(
        [
          [
            [0, 0],
            [0, 1],
            [1, 1],
          ],
        ],
        3,
        4 as unknown as 'containmentCenter',
      ),
    )
    expect(ours).toBe('Mode or flags argument was not valid (code: 15)')
    expect(theirs).toBe('Unknown error (code: 15, value: 4)')
    expect(codeOf(ours)).toBe(codeOf(theirs) as number)
  })

  test('the two codes whose h3-js wording has drifted from describeH3Error', () => {
    // h3-js keeps its own copy of the message table, and these two entries no longer match H3's
    const digitDomain = refusal('constructCell 20 7 1')
    expect(digitDomain).toBe('Child digits invalid (code: 18)')
    expect(h3jsRefusal(() => h3.constructCell(20, [7], 1))).toBe(
      'Child indexing digits invalid (code: 18)',
    )

    const deletedDigit = refusal('constructCell 4 1 1')
    expect(deletedDigit).toBe('Deleted subsequence indicates invalid index (code: 19)')
    expect(h3jsRefusal(() => h3.constructCell(4, [1], 1))).toBe(
      'Child indexing digits refer to a deleted subsequence (code: 19)',
    )
  })

  test('a digit count that does not match the resolution is refused in our own wording', () => {
    expect(refusal('constructCell 20 1,2,3 5')).toBe('constructCell needs exactly res digits')
    expect(h3jsRefusal(() => h3.constructCell(20, [1, 2, 3], 5))).toBe(
      'Child indexing digits invalid (code: 18, value: 3)',
    )
  })
})

describe.skipIf(skipWithoutProbe)('parity: where a divergence would be easy to assume', () => {
  test('getResolution answers -1 for an invalid index, exactly as h3-js does', () => {
    for (const index of ['ffffffffffffffff', '0', '1']) {
      expect(answer(`getResolution ${index}`), index).toBe(-1)
      expect(h3.getResolution(index), index).toBe(-1)
    }
  })

  test('constructCell keeps the h3-js argument order rather than the C order', () => {
    // h3-js: `constructCell(baseCellNumber, digits, res)`. C: `constructCell(res, baseCellNumber,
    // digits)`. Matching h3-js means a caller migrating does not have to transpose.
    const digits = Array.from({ length: 9 }, (_, i) => h3.getIndexDigit(CELL, i + 1))
    expect(answer(`constructCell 20 ${digits.join(',')} 9`)).toBe(CELL)
    expect(h3.constructCell(20, digits, 9)).toBe(CELL)
    // the C order would be `(9, digits, 20)`, and 20 is not a resolution
    expect(refusal(`constructCell 9 ${digits.join(',')} 20`)).toBe(
      'Resolution argument was outside of acceptable range (code: 4)',
    )
  })

  test('a containment mode number covers the same cells as the h3-js flag name', () => {
    const rings = '37.813319,-122.408987;37.719806,-122.354474;37.815157,-122.479877'
    const polygon: [number, number][][] = [
      [
        [37.813319, -122.408987],
        [37.719806, -122.354474],
        [37.815157, -122.479877],
      ],
    ]
    const flags = [
      'containmentCenter',
      'containmentFull',
      'containmentOverlapping',
      'containmentOverlappingBbox',
    ] as const
    for (const [mode, flag] of flags.entries()) {
      expect(answer(`polygonToCellsExperimental ${rings} 7 ${mode}`), flag).toEqual(
        h3.polygonToCellsExperimental(polygon, 7, flag),
      )
    }
  })

  test('compactCells refuses an invalid member with a different code, and ignores 0 alike', () => {
    const ours = refusal(`compactCells ${CELL},1`)
    const theirs = h3jsRefusal(() => h3.compactCells([CELL, '1']))
    expect(ours).toBe('Cell argument was not valid (code: 5)')
    // h3-js lets the invalid member through to H3, which reads it as another resolution
    expect(theirs).toBe('Cell arguments had incompatible resolutions (code: 12)')

    expect(answer(`compactCells ${CELL},0`)).toEqual(h3.compactCells([CELL, '0']))
  })

  test('uncompactCells refuses an invalid member with a different code, and ignores 0 alike', () => {
    expect(refusal(`uncompactCells ${CELL},1 10`)).toBe('Cell argument was not valid (code: 5)')
    expect(askH3JsInAFreshProcess(`h3.uncompactCells(['${CELL}', '1'], 10)`)).toBe(
      'threw Bounds of provided memory were insufficient (code: 14)',
    )

    expect(answer(`uncompactCells ${CELL},0 10`)).toEqual(h3.uncompactCells([CELL, '0'], 10))
  })
})

describe.skipIf(skipWithoutProbe)('parity: arithmetic away from a pole', () => {
  test('cell centres, boundaries and vertexes agree to 5.7e-14 degrees', () => {
    // measured `5.68e-14` over this corpus, and the bound is three times that
    const bound = 2e-13
    const cells = [...RES0_CELLS, ...PENTAGONS]
    const centres = callMany(cells.map((cell) => `cellToLatLng ${cell}`))
    const boundaries = callMany(cells.map((cell) => `cellToBoundary ${cell}`))
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i] as string
      const centre = centres[i] as [number, number]
      const theirCentre = h3.cellToLatLng(cell)
      expect(Math.abs(centre[0] - theirCentre[0]), `cellToLatLng(${cell})`).toBeLessThan(bound)
      expect(Math.abs(centre[1] - theirCentre[1]), `cellToLatLng(${cell})`).toBeLessThan(bound)
      const ring = boundaries[i] as number[][]
      const theirRing = h3.cellToBoundary(cell)
      for (let v = 0; v < theirRing.length; v++) {
        const a = ring[v] as number[]
        const b = theirRing[v] as number[]
        expect(Math.abs((a[0] as number) - (b[0] as number)), `${cell}[${v}]`).toBeLessThan(bound)
        expect(Math.abs((a[1] as number) - (b[1] as number)), `${cell}[${v}]`).toBeLessThan(bound)
      }
    }
    const vertexes = PENTAGONS.flatMap((cell) => h3.cellToVertexes(cell))
    const answers = callMany(vertexes.map((vertex) => `vertexToLatLng ${vertex}`))
    for (let i = 0; i < vertexes.length; i++) {
      const ours = answers[i] as [number, number]
      const theirs = h3.vertexToLatLng(vertexes[i] as string)
      expect(Math.abs(ours[0] - theirs[0]), `vertexToLatLng(${vertexes[i]})`).toBeLessThan(bound)
      expect(Math.abs(ours[1] - theirs[1]), `vertexToLatLng(${vertexes[i]})`).toBeLessThan(bound)
    }
  })

  test('cell areas agree to 4.6e-13 relative and the resolution averages bit for bit', () => {
    // measured `4.58e-13` over this corpus, which reaches resolution 6, and the bound is twice that
    const bound = 1e-12
    const cells = [...RES0_CELLS, ...PENTAGON_NEIGHBOURHOODS]
    const answers = callMany(cells.map((cell) => `cellAreaKm2 ${cell}`))
    for (let i = 0; i < cells.length; i++) {
      const theirs = h3.cellArea(cells[i] as string, 'km2')
      expect(Math.abs((answers[i] as number) - theirs) / theirs, `${cells[i]}`).toBeLessThan(bound)
    }
    for (const res of RESOLUTIONS) {
      expect(answer(`getHexagonAreaAvgKm2 ${res}`)).toBe(h3.getHexagonAreaAvg(res, 'km2'))
      expect(answer(`getHexagonEdgeLengthAvgKm ${res}`)).toBe(h3.getHexagonEdgeLengthAvg(res, 'km'))
    }
  })

  test('great circle distances agree to 2.0e-15 relative, and degsToRads bit for bit', () => {
    // the haversine runs on the arguments themselves, so there is nothing for the contraction to
    // amplify. Measured `2.02e-15` over the seeded pairs, and the bound is five times that.
    const pairs: [number, number, number, number][] = [
      [0, 0, 90, 0],
      [37.7749, -122.4194, 51.5074, -0.1278],
      [-89.9999, -179.9999, 89.9999, 179.9999],
      [10, 179, -10, -179],
    ]
    for (const [aLat, aLng, bLat, bLng] of pairs) {
      const ours = answer(`greatCircleDistanceKm ${aLat} ${aLng} ${bLat} ${bLng}`) as number
      const theirs = h3.greatCircleDistance([aLat, aLng], [bLat, bLng], 'km')
      expect(Math.abs(ours - theirs), `${aLat},${aLng}`).toBeLessThan(Math.abs(theirs) * 1e-14)
    }
    // `degsToRads` is one multiply and agrees exactly; the reverse constant differs in its last
    // bit, so `radsToDegs` carries the `1e-15` of `scalars.test.ts`, six times its `1.57e-16`
    for (const degrees of [-180, -1, 0, 1, 90, 180]) {
      expect(answer(`degsToRads ${degrees}`), `${degrees}`).toBe(h3.degsToRads(degrees))
      const radians = degrees / 57
      const ours = answer(`radsToDegs ${radians}`) as number
      const theirs = h3.radsToDegs(radians)
      expect(Math.abs(ours - theirs), `${radians}`).toBeLessThanOrEqual(Math.abs(theirs) * 1e-15)
    }
  })
})

describe.skipIf(skipWithoutProbe)('divergence: fused multiply-add near a pole', () => {
  test('polar geometry moves further from h3-js with every resolution', () => {
    // The arm64 build contracts a multiply and an add into one instruction and emscripten does not.
    // The inverse projection is ill-conditioned at a pole, so the last bit grows with resolution.
    // Each bound is between two and four times the worst case measured over `EXTREME_COORDINATES`,
    // which is the corpus `docs/h3-js-divergences.md` publishes: `2.84e-14` degrees at resolution 0,
    // `1.46e-11` at 5, `5.89e-10` at 10 and `1.82e-7` at 15.
    const bounds: [number, number][] = [
      [0, 8e-14],
      [5, 5e-11],
      [10, 2e-9],
      [15, 5e-7],
    ]
    for (const [res, bound] of bounds) {
      const cells = Array.from(
        new Set(EXTREME_COORDINATES.map(({ lat, lng }) => h3.latLngToCell(lat, lng, res))),
      )
      const answers = callMany(cells.map((cell) => `cellToBoundary ${cell}`))
      for (let c = 0; c < cells.length; c++) {
        const label = `res ${res} ${cells[c]}`
        const ours = answers[c] as number[][]
        const theirs = h3.cellToBoundary(cells[c] as string)
        expect(ours.length, label).toBe(theirs.length)
        for (let i = 0; i < theirs.length; i++) {
          const a = ours[i] as number[]
          const b = theirs[i] as number[]
          expect(Math.abs((a[0] as number) - (b[0] as number)), `${label} lat`).toBeLessThan(bound)
          expect(Math.abs((a[1] as number) - (b[1] as number)), `${label} lng`).toBeLessThan(bound)
        }
      }
    }
  })

  test('the worst resolution 15 edge length agrees to eight digits, not to the last bit', () => {
    // this edge is where the whole pentagon corpus disagrees most, at `1.38e-8` relative
    const edge = '14f0800000000000'
    const ours = answer(`edgeLengthKm ${edge}`) as number
    const theirs = h3.edgeLength(edge, 'km')
    expect(Math.abs(ours - theirs)).toBeLessThan(Math.abs(theirs) * 4e-8)
  })

  test('a resolution 15 pentagon area agrees to nine digits, not to the last bit', () => {
    // the same cancellation: at half a metre across, the area is a difference of near-equal terms.
    // Measured `3.01e-9` relative over every pentagon, worst here; the bound is three times that.
    const cell = '8f0800000000000'
    const ours = answer(`cellAreaKm2 ${cell}`) as number
    const theirs = h3.cellArea(cell, 'km2')
    expect(Math.abs(ours - theirs)).toBeLessThan(Math.abs(theirs) * 1e-8)
  })
})

describe.skipIf(skipWithoutProbe)('divergence: the shape of the public surface', () => {
  test('units are separate functions here and a string argument in h3-js', () => {
    const ops = answer('__ops') as string[]
    expect(ops).toContain('cellAreaKm2')
    expect(ops).not.toContain('cellArea')
    expect(Object.keys(h3)).toContain('cellArea')
    expect(Object.keys(h3)).not.toContain('cellAreaKm2')
    // h3-js can therefore raise an error over the unit itself, and this package has no such channel
    expect(h3jsRefusal(() => h3.cellArea(CELL, 'furlongs' as 'km2'))).toBe(
      'Unknown unit (code: 1000, value: furlongs)',
    )
  })

  test('the two split-long helpers exist in h3-js and nowhere here', () => {
    // they work around the lack of 64-bit integers in an emscripten build
    const ops = answer('__ops') as string[]
    for (const name of ['h3IndexToSplitLong', 'splitLongToH3Index']) {
      expect(Object.keys(h3)).toContain(name)
      expect(ops).not.toContain(name)
    }
  })

  test('cellToString and cellFromString exist here and nowhere in h3-js', () => {
    expect(answer(`cellToString ${CELL}`)).toBe(CELL)
    expect(answer(`cellFromString ${CELL}`)).toBe(CELL)
    expect(Object.keys(h3)).not.toContain('cellToString')
    expect(Object.keys(h3)).not.toContain('cellFromString')
  })

  test('a cell is a string in h3-js, where the type assertions above make it a bigint', () => {
    expect(typeof h3.latLngToCell(37.7749, -122.4194, 9)).toBe('string')
    const disk = h3.gridDisk(CELL, 1)
    expect(Array.isArray(disk)).toBe(true)
    expect(typeof (disk[0] as string)).toBe('string')
  })
})
