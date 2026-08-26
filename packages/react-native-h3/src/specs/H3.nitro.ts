import type { HybridObject, UInt64 } from 'react-native-nitro-modules'

// A latitude and longitude in degrees. Nitrogen generates a C++ struct of the same name in
// `margelo::nitro::h3`, which is not H3's own `::LatLng`, and that one carries radians.
export interface LatLng {
  lat: number
  lng: number
}

// Local IJ hexagon coordinates. Nitrogen generates a C++ struct of the same name in
// `margelo::nitro::h3`, which is not H3's own `::CoordIJ`.
export interface CoordIJ {
  i: number
  j: number
}

// Internal binding surface; the public API in `src/` wraps these methods.
export interface H3 extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  // `bigint` without signedness is a nitrogen error, so cells are `UInt64`.
  latLngToCell(lat: number, lng: number, res: number): UInt64
  cellToLatLng(cell: UInt64): LatLng
  cellToBoundary(cell: UInt64): LatLng[]
  // three levels of nesting: polygons of loops of points, which nitrogen expands recursively.
  cellsToMultiPolygon(cells: ArrayBuffer): LatLng[][][]

  // typed arrays are not spec types; the wrapper views this `ArrayBuffer` as a `BigUint64Array` without copying.
  gridDisk(origin: UInt64, k: number): ArrayBuffer
  gridRing(origin: UInt64, k: number): ArrayBuffer
  gridRingUnsafe(origin: UInt64, k: number): ArrayBuffer
  // one buffer per ring, so nitrogen wraps the `ArrayBuffer` type in a `std::vector`.
  gridDiskDistances(origin: UInt64, k: number): ArrayBuffer[]
  gridPathCells(start: UInt64, end: UInt64): ArrayBuffer
  // C answers `int64_t`; a grid distance is far inside `2^53 - 1`, so the spec type is `number`.
  gridDistance(origin: UInt64, destination: UInt64): number
  cellToLocalIj(origin: UInt64, cell: UInt64): CoordIJ
  localIjToCell(origin: UInt64, i: number, j: number): UInt64

  degsToRads(degrees: number): number
  radsToDegs(radians: number): number

  isValidCell(cell: UInt64): boolean
  isValidIndex(index: UInt64): boolean
  isValidDirectedEdge(edge: UInt64): boolean
  isValidVertex(vertex: UInt64): boolean
  isPentagon(cell: UInt64): boolean
  isResClassIII(cell: UInt64): boolean
  getResolution(index: UInt64): number
  getBaseCellNumber(cell: UInt64): number
  getIndexDigit(cell: UInt64, digit: number): number
  // digits arrive as `number[]`, which nitrogen maps to `const std::vector<double>&`.
  constructCell(baseCellNumber: number, digits: number[], res: number): UInt64
  cellToString(cell: UInt64): string
  cellFromString(text: string): UInt64

  // the unit is part of the name, so no unit string crosses the bridge at call time.
  cellAreaKm2(cell: UInt64): number
  cellAreaM2(cell: UInt64): number
  cellAreaRads2(cell: UInt64): number
  // coordinates in degrees; the C functions take two `::LatLng` pointers in radians.
  greatCircleDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number
  greatCircleDistanceM(lat1: number, lng1: number, lat2: number, lng2: number): number
  greatCircleDistanceRads(lat1: number, lng1: number, lat2: number, lng2: number): number

  cellToParent(cell: UInt64, res: number): UInt64
  cellToCenterChild(cell: UInt64, res: number): UInt64
  cellToChildrenSize(cell: UInt64, res: number): number
  cellToChildPos(cell: UInt64, parentRes: number): number
  // the one H3 argument that is a plain `int64_t` rather than an index, so it crosses as a `number`.
  childPosToCell(childPos: number, parent: UInt64, childRes: number): UInt64
  cellToChildren(cell: UInt64, res: number): ArrayBuffer
  // a cell set in and a cell set out; both cross as `ArrayBuffer` and neither is copied.
  compactCells(cells: ArrayBuffer): ArrayBuffer
  uncompactCells(cells: ArrayBuffer, res: number): ArrayBuffer

  getHexagonAreaAvgKm2(res: number): number
  getHexagonAreaAvgM2(res: number): number
  getHexagonEdgeLengthAvgKm(res: number): number
  getHexagonEdgeLengthAvgM(res: number): number
  // C answers `int64_t`; every value fits a JavaScript number exactly, so the spec type is `number`.
  getNumCells(res: number): number
}
