import { describe, expect, mock, test } from 'bun:test'

// The HybridObject cannot exist off-device, and `src/native.ts` creates it at module scope. Mocking
// here, before the barrel is imported inside the tests, is what lets the export surface be checked.
mock.module('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => new Proxy({}, { get: () => () => undefined }),
  },
}))

/** Every public function this package exports, as listed in `docs/h3-function-table.md`. */
const EXPECTED_FUNCTIONS = [
  'areNeighborCells',
  'cellAreaKm2',
  'cellAreaM2',
  'cellAreaRads2',
  'cellFromString',
  'cellToBoundary',
  'cellToCenterChild',
  'cellToChildPos',
  'cellToChildren',
  'cellToChildrenSize',
  'cellToLatLng',
  'cellToLocalIj',
  'cellToParent',
  'cellToString',
  'cellToVertex',
  'cellToVertexes',
  'cellsToDirectedEdge',
  'cellsToMultiPolygon',
  'childPosToCell',
  'compactCells',
  'constructCell',
  'degsToRads',
  'directedEdgeToBoundary',
  'directedEdgeToCells',
  'edgeLengthKm',
  'edgeLengthM',
  'edgeLengthRads',
  'getBaseCellNumber',
  'getDirectedEdgeDestination',
  'getDirectedEdgeOrigin',
  'getHexagonAreaAvgKm2',
  'getHexagonAreaAvgM2',
  'getHexagonEdgeLengthAvgKm',
  'getHexagonEdgeLengthAvgM',
  'getIcosahedronFaces',
  'getIndexDigit',
  'getNumCells',
  'getPentagons',
  'getRes0Cells',
  'getResolution',
  'greatCircleDistanceKm',
  'greatCircleDistanceM',
  'greatCircleDistanceRads',
  'gridDisk',
  'gridDiskDistances',
  'gridDistance',
  'gridPathCells',
  'gridRing',
  'gridRingUnsafe',
  'isPentagon',
  'isResClassIII',
  'isValidCell',
  'isValidDirectedEdge',
  'isValidIndex',
  'isValidVertex',
  'latLngToCell',
  'localIjToCell',
  'originToDirectedEdges',
  'polygonToCells',
  'polygonToCellsExperimental',
  'radsToDegs',
  'reverseDirectedEdge',
  'uncompactCells',
  'vertexToLatLng',
] as const

describe('public API', () => {
  test('exports all 64 functions the function table lists', async () => {
    const h3 = await import('../src/index')
    expect(EXPECTED_FUNCTIONS).toHaveLength(64)
    for (const name of EXPECTED_FUNCTIONS) {
      expect(typeof (h3 as Record<string, unknown>)[name]).toBe('function')
    }
  })

  test('exports nothing beyond those functions plus H3Error and ContainmentMode', async () => {
    const h3 = await import('../src/index')
    const allowed = new Set<string>([...EXPECTED_FUNCTIONS, 'H3Error', 'ContainmentMode'])
    for (const name of Object.keys(h3)) {
      expect(allowed.has(name)).toBe(true)
    }
    // the type-only exports are erased, so the barrel holds exactly the allowed names
    expect(Object.keys(h3)).toHaveLength(allowed.size)
  })

  test('does not export the HybridObject', async () => {
    const h3 = await import('../src/index')
    expect(Object.keys(h3)).not.toContain('native')
  })
})
