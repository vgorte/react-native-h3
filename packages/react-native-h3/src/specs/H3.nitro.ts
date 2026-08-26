import type { HybridObject, UInt64 } from 'react-native-nitro-modules'

// Internal binding surface; the public API in `src/` wraps these methods.
export interface H3 extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  // `bigint` without signedness is a nitrogen error, so cells are `UInt64`.
  latLngToCell(lat: number, lng: number, res: number): UInt64
  // typed arrays are not spec types; the wrapper views this `ArrayBuffer` as a `BigUint64Array` without copying.
  gridDisk(origin: UInt64, k: number): ArrayBuffer
}
