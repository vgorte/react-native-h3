import type { HybridObject, UInt64 } from 'react-native-nitro-modules'

// A latitude and longitude in degrees. Nitrogen generates a C++ struct of the same name in
// `margelo::nitro::h3`, which is not H3's own `::LatLng`, and that one carries radians.
export interface LatLng {
  lat: number
  lng: number
}

// Internal binding surface; the public API in `src/` wraps these methods.
export interface H3 extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  // `bigint` without signedness is a nitrogen error, so cells are `UInt64`.
  latLngToCell(lat: number, lng: number, res: number): UInt64
  // typed arrays are not spec types; the wrapper views this `ArrayBuffer` as a `BigUint64Array` without copying.
  gridDisk(origin: UInt64, k: number): ArrayBuffer

  cellToLatLng(cell: UInt64): LatLng
  cellToBoundary(cell: UInt64): LatLng[]
  // three levels of nesting: polygons of loops of points, which nitrogen expands recursively.
  cellsToMultiPolygon(cells: ArrayBuffer): LatLng[][][]
}
