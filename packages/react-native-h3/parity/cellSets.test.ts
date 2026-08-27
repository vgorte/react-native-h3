import { describe, expect, test } from 'bun:test'
import h3 from 'h3-js'
import { encodeCells, PENTAGON_NEIGHBOURHOODS, PENTAGONS, RES0_CELLS, RESOLUTIONS } from './corpus'
import { callMany, skipWithoutProbe } from './probe'

/**
 * Bounds how far an edge length may sit from h3-js's, relative.
 *
 * A resolution 15 edge is half a metre long, so subtracting its two endpoints cancels about eight
 * digits, and that turns the multiply-add the arm64 build contracts and emscripten does not into
 * the eighth digit. Measured over this corpus: `1.38e-8`, at `edgeLengthKm(14f0800000000000)`.
 */
const LENGTH_TOLERANCE = 4e-8

/** Renders what h3-js did, answer or refusal alike, so both can be compared as one string. */
function outcome(produce: () => unknown): string {
  try {
    return `ok ${JSON.stringify(produce())}`
  } catch (error) {
    return `threw ${(error as Error).message}`
  }
}

/**
 * Compares list-returning operations, order and refusals included.
 *
 * Order matters: h3-js filters `H3_NULL` out of the padded buffer and this package compacts it out
 * natively, but both preserve the order H3 wrote, so an order difference would be a real bug.
 */
function compareOutcomes(requests: string[], inputs: string[], expected: string[]): void {
  const answers = callMany(requests)
  const mismatches: string[] = []
  for (let i = 0; i < answers.length; i++) {
    const ours = answers[i]
    const rendered = ours instanceof Error ? `threw ${ours.message}` : `ok ${JSON.stringify(ours)}`
    const theirs = expected[i] as string
    if (rendered !== theirs) {
      mismatches.push(`${inputs[i]}: ours ${rendered.slice(0, 120)}, h3-js ${theirs.slice(0, 120)}`)
    }
  }
  expect(mismatches).toEqual([])
}

describe.skipIf(skipWithoutProbe)('parity: traversal', () => {
  test('gridDisk over every base cell for k of 0 to 3', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of RES0_CELLS) {
      for (const k of [0, 1, 2, 3]) {
        requests.push(`gridDisk ${cell} ${k}`)
        inputs.push(`gridDisk(${cell}, ${k})`)
        expected.push(outcome(() => h3.gridDisk(cell, k)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('gridDisk over every pentagon at every resolution', () => {
    compareOutcomes(
      PENTAGONS.map((cell) => `gridDisk ${cell} 2`),
      PENTAGONS.map((cell) => `gridDisk(${cell}, 2)`),
      PENTAGONS.map((cell) => outcome(() => h3.gridDisk(cell, 2))),
    )
  })

  for (const op of ['gridRing', 'gridRingUnsafe'] as const) {
    test(`${op} over every base cell and every pentagon`, () => {
      const cells = [...RES0_CELLS, ...PENTAGONS]
      const requests: string[] = []
      const inputs: string[] = []
      const expected: string[] = []
      for (const cell of cells) {
        for (const k of [0, 1, 2]) {
          requests.push(`${op} ${cell} ${k}`)
          inputs.push(`${op}(${cell}, ${k})`)
          expected.push(outcome(() => h3[op](cell, k)))
        }
      }
      compareOutcomes(requests, inputs, expected)
    })
  }

  test('gridDiskDistances buckets identically over pentagon neighbourhoods', () => {
    const cells = PENTAGON_NEIGHBOURHOODS.slice(0, 200)
    compareOutcomes(
      cells.map((cell) => `gridDiskDistances ${cell} 2`),
      cells.map((cell) => `gridDiskDistances(${cell}, 2)`),
      cells.map((cell) => outcome(() => h3.gridDiskDistances(cell, 2))),
    )
  })

  test('gridPathCells over pentagon neighbourhoods', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of PENTAGON_NEIGHBOURHOODS.slice(0, 120)) {
      for (const target of h3.gridDisk(cell, 2)) {
        requests.push(`gridPathCells ${cell} ${target}`)
        inputs.push(`gridPathCells(${cell}, ${target})`)
        expected.push(outcome(() => h3.gridPathCells(cell, target)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('cellToLocalIj and localIjToCell over pentagon neighbourhoods', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const origin of PENTAGON_NEIGHBOURHOODS.slice(0, 120)) {
      for (const cell of h3.gridDisk(origin, 2)) {
        requests.push(`cellToLocalIj ${origin} ${cell}`)
        inputs.push(`cellToLocalIj(${origin}, ${cell})`)
        expected.push(outcome(() => h3.cellToLocalIj(origin, cell)))
      }
      const anchor = h3.cellToLocalIj(origin, origin)
      for (const i of [anchor.i - 1, anchor.i, anchor.i + 1]) {
        for (const j of [anchor.j - 1, anchor.j, anchor.j + 1]) {
          requests.push(`localIjToCell ${origin} ${i} ${j}`)
          inputs.push(`localIjToCell(${origin}, {i: ${i}, j: ${j}})`)
          expected.push(outcome(() => h3.localIjToCell(origin, { i, j })))
        }
      }
    }
    compareOutcomes(requests, inputs, expected)
  })
})

describe.skipIf(skipWithoutProbe)('parity: hierarchy', () => {
  test('cellToChildren over every base cell down two resolutions', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of RES0_CELLS) {
      for (const res of [0, 1, 2]) {
        requests.push(`cellToChildren ${cell} ${res}`)
        inputs.push(`cellToChildren(${cell}, ${res})`)
        expected.push(outcome(() => h3.cellToChildren(cell, res)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('cellToParent over every pentagon against every ancestor resolution', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of PENTAGONS) {
      for (let res = 0; res <= h3.getResolution(cell); res++) {
        requests.push(`cellToParent ${cell} ${res}`)
        inputs.push(`cellToParent(${cell}, ${res})`)
        expected.push(outcome(() => h3.cellToParent(cell, res)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('cellToCenterChild over every base cell and pentagon', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of [...RES0_CELLS, ...PENTAGONS]) {
      const res = h3.getResolution(cell)
      for (const target of [res, Math.min(res + 3, 15), 15]) {
        requests.push(`cellToCenterChild ${cell} ${target}`)
        inputs.push(`cellToCenterChild(${cell}, ${target})`)
        expected.push(outcome(() => h3.cellToCenterChild(cell, target)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('childPosToCell inverts cellToChildPos over every pentagon', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of PENTAGONS) {
      const res = h3.getResolution(cell)
      for (let parentRes = 0; parentRes < res; parentRes++) {
        const position = h3.cellToChildPos(cell, parentRes)
        const parent = h3.cellToParent(cell, parentRes)
        requests.push(`childPosToCell ${position} ${parent} ${res}`)
        inputs.push(`childPosToCell(${position}, ${parent}, ${res})`)
        expected.push(outcome(() => h3.childPosToCell(position, parent, res)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('compactCells over the disk around every pentagon neighbourhood', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of PENTAGON_NEIGHBOURHOODS.slice(0, 120)) {
      const disk = h3.gridDisk(cell, 2)
      requests.push(`compactCells ${encodeCells(disk)}`)
      inputs.push(`compactCells(gridDisk(${cell}, 2))`)
      expected.push(outcome(() => h3.compactCells(disk)))
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('uncompactCells over every base cell to resolutions 0 to 2', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of RES0_CELLS) {
      for (const res of [0, 1, 2]) {
        requests.push(`uncompactCells ${cell} ${res}`)
        inputs.push(`uncompactCells([${cell}], ${res})`)
        expected.push(outcome(() => h3.uncompactCells([cell], res)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('compactCells and uncompactCells round-trip a mixed-resolution set', () => {
    const cells = PENTAGONS.filter((cell) => h3.getResolution(cell) === 5).flatMap((cell) =>
      h3.cellToChildren(cell, 7),
    )
    const compacted = h3.compactCells(cells)
    compareOutcomes(
      [`compactCells ${encodeCells(cells)}`, `uncompactCells ${encodeCells(compacted)} 7`],
      ['compactCells(pentagon children)', 'uncompactCells(compacted, 7)'],
      [outcome(() => compacted), outcome(() => h3.uncompactCells(compacted, 7))],
    )
  })
})

describe.skipIf(skipWithoutProbe)('parity: fixed lists', () => {
  test('getRes0Cells is the same list in the same order', () => {
    compareOutcomes(['getRes0Cells'], ['getRes0Cells()'], [outcome(() => h3.getRes0Cells())])
  })

  test('getPentagons at every resolution', () => {
    compareOutcomes(
      RESOLUTIONS.map((res) => `getPentagons ${res}`),
      RESOLUTIONS.map((res) => `getPentagons(${res})`),
      RESOLUTIONS.map((res) => outcome(() => h3.getPentagons(res))),
    )
  })

  test('getIcosahedronFaces over every base cell and pentagon', () => {
    const cells = [...RES0_CELLS, ...PENTAGONS]
    compareOutcomes(
      cells.map((cell) => `getIcosahedronFaces ${cell}`),
      cells.map((cell) => `getIcosahedronFaces(${cell})`),
      cells.map((cell) => outcome(() => h3.getIcosahedronFaces(cell))),
    )
  })
})

describe.skipIf(skipWithoutProbe)('parity: edges and vertexes', () => {
  const cells = PENTAGON_NEIGHBOURHOODS.slice(0, 200)
  const edges = PENTAGONS.flatMap((cell) => h3.originToDirectedEdges(cell))

  test('originToDirectedEdges over pentagon neighbourhoods', () => {
    compareOutcomes(
      cells.map((cell) => `originToDirectedEdges ${cell}`),
      cells.map((cell) => `originToDirectedEdges(${cell})`),
      cells.map((cell) => outcome(() => h3.originToDirectedEdges(cell))),
    )
  })

  test('cellsToDirectedEdge over every neighbour of every pentagon neighbourhood', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of cells) {
      for (const other of h3.gridDisk(cell, 1)) {
        requests.push(`cellsToDirectedEdge ${cell} ${other}`)
        inputs.push(`cellsToDirectedEdge(${cell}, ${other})`)
        expected.push(outcome(() => h3.cellsToDirectedEdge(cell, other)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  for (const op of [
    'getDirectedEdgeOrigin',
    'getDirectedEdgeDestination',
    'reverseDirectedEdge',
    'directedEdgeToCells',
  ] as const) {
    test(`${op} over every edge of every pentagon`, () => {
      compareOutcomes(
        edges.map((edge) => `${op} ${edge}`),
        edges.map((edge) => `${op}(${edge})`),
        edges.map((edge) => outcome(() => h3[op](edge))),
      )
    })
  }

  test('cellToVertexes over pentagon neighbourhoods', () => {
    compareOutcomes(
      cells.map((cell) => `cellToVertexes ${cell}`),
      cells.map((cell) => `cellToVertexes(${cell})`),
      cells.map((cell) => outcome(() => h3.cellToVertexes(cell))),
    )
  })

  test('cellToVertex over every vertex number, valid and out of range', () => {
    const requests: string[] = []
    const inputs: string[] = []
    const expected: string[] = []
    for (const cell of cells) {
      for (const number of [0, 1, 2, 3, 4, 5, 6]) {
        requests.push(`cellToVertex ${cell} ${number}`)
        inputs.push(`cellToVertex(${cell}, ${number})`)
        expected.push(outcome(() => h3.cellToVertex(cell, number)))
      }
    }
    compareOutcomes(requests, inputs, expected)
  })

  test('edgeLength splits by unit over every edge of every pentagon', () => {
    for (const [op, unit] of [
      ['edgeLengthKm', 'km'],
      ['edgeLengthM', 'm'],
      ['edgeLengthRads', 'rads'],
    ] as const) {
      const answers = callMany(edges.map((edge) => `${op} ${edge}`))
      const mismatches: string[] = []
      for (let i = 0; i < edges.length; i++) {
        const ours = answers[i]
        const theirs = h3.edgeLength(edges[i] as string, unit)
        if (
          typeof ours !== 'number' ||
          Math.abs(ours - theirs) > Math.abs(theirs) * LENGTH_TOLERANCE
        ) {
          mismatches.push(`${op}(${edges[i]}): ours ${String(ours)}, h3-js ${theirs}`)
        }
      }
      expect(mismatches).toEqual([])
    }
  })
})
