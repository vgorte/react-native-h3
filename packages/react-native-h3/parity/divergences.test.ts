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
import { callMany, skipWithoutProbe } from './probe'

const CELL = '89283082803ffff'

/** An index with directed edge mode bits and direction `0`, which no edge ever has. */
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
    expect(h3.cellArea('1', 'km2')).toBeGreaterThan(0)
    expect(h3.cellToLatLng('1')).toHaveLength(2)
    expect(h3.gridDisk('1', 1)).toHaveLength(6)
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
    expect(h3.vertexToLatLng(CELL)).toHaveLength(2)
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
    }
  })
})

describe.skipIf(skipWithoutProbe)('divergence: an argument that is not an integer', () => {
  test('a fractional argument is refused where h3-js truncates it', () => {
    const cases: [string, string, () => unknown][] = [
      [`gridDisk ${CELL} 1.5`, 'k must be an integer', () => h3.gridDisk(CELL, 1.5)],
      [
        `cellToParent ${CELL} 1.5`,
        'Resolution must be an integer between 0 and 15',
        () => h3.cellToParent(CELL, 1.5),
      ],
      [
        `cellToVertex ${CELL} 0.5`,
        'Vertex number must be an integer',
        () => h3.cellToVertex(CELL, 0.5),
      ],
      [
        'latLngToCell 0 0 1.5',
        'Resolution must be an integer between 0 and 15',
        () => h3.latLngToCell(0, 0, 1.5),
      ],
    ]
    for (const [request, message, produce] of cases) {
      expect(refusal(request), request).toBe(message)
      // our wording carries no `(code: N)`, because H3 never saw the argument
      expect(codeOf(message), request).toBeUndefined()
      // h3-js hands the fraction to emscripten, which truncates it and answers
      expect(produce(), request).toBeDefined()
    }
  })

  test('a fractional resolution is refused in our wording where h3-js reports E_RES_DOMAIN', () => {
    expect(refusal('getHexagonAreaAvgKm2 1.5')).toBe(
      'Resolution must be an integer between 0 and 15',
    )
    const theirs = h3jsRefusal(() => h3.getHexagonAreaAvg(1.5, 'km2'))
    expect(theirs).toBe('Resolution argument was outside of acceptable range (code: 4, value: 1.5)')
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

describe.skipIf(skipWithoutProbe)('divergence: fused multiply-add near a pole', () => {
  test('polar geometry agrees to the last bit at low resolutions and to 2 cm at 15', () => {
    // The arm64 build contracts a multiply and an add into one instruction and emscripten does not.
    // The inverse projection is ill-conditioned at a pole, so the last bit grows with resolution.
    const bounds: [number, number][] = [
      [0, 1e-12],
      [5, 1e-10],
      [10, 1e-8],
      [15, 5e-7],
    ]
    for (const [res, bound] of bounds) {
      const cell = h3.latLngToCell(90, 0, res)
      const ours = answer(`cellToBoundary ${cell}`) as number[][]
      const theirs = h3.cellToBoundary(cell)
      expect(ours.length, `res ${res}`).toBe(theirs.length)
      for (let i = 0; i < theirs.length; i++) {
        const a = ours[i] as number[]
        const b = theirs[i] as number[]
        expect(Math.abs((a[0] as number) - (b[0] as number)), `res ${res} lat`).toBeLessThan(bound)
        expect(Math.abs((a[1] as number) - (b[1] as number)), `res ${res} lng`).toBeLessThan(bound)
      }
    }
  })

  test('a resolution 15 edge length agrees to seven digits, not to the last bit', () => {
    const cell = h3.latLngToCell(37.7749, -122.4194, 15)
    const edge = h3.originToDirectedEdges(cell)[0] as string
    const ours = answer(`edgeLengthKm ${edge}`) as number
    const theirs = h3.edgeLength(edge, 'km')
    expect(Math.abs(ours - theirs)).toBeLessThan(Math.abs(theirs) * 1e-7)
  })
})

describe.skipIf(skipWithoutProbe)(
  'addition: the two functions h3-js has no counterpart for',
  () => {
    test('cellToString and cellFromString round-trip the h3-js form', () => {
      expect(answer(`cellToString ${CELL}`)).toBe(CELL)
      expect(answer(`cellFromString ${CELL}`)).toBe(CELL)
      expect(Object.keys(h3)).not.toContain('cellToString')
      expect(Object.keys(h3)).not.toContain('cellFromString')
    })
  },
)
