# react-native-h3

Fast H3 geospatial indexing for React Native, powered by [Nitro Modules](https://nitro.margelo.com).
The H3 C library is vendored at v4.5.0 and compiled into the app, so calls run natively on iOS and
Android without a JavaScript port. This package is MIT licensed. The vendored H3 library is
Apache-2.0; its LICENSE and NOTICE files ship under `third_party/h3/`.

There is no web implementation. On web, use [h3-js](https://github.com/uber/h3-js).

## Install

```sh
bun add react-native-h3 react-native-nitro-modules
```

## Usage

```ts
import { gridDisk, H3Error, latLngToCell } from 'react-native-h3'

const cell = latLngToCell(37.7749, -122.4194, 9)
const neighbours = gridDisk(cell, 1)
try {
  latLngToCell(37.7749, -122.4194, 42)
} catch (error) {
  if (error instanceof H3Error) console.warn(error.message)
}
```

## Migrating from h3-js

The function names match h3-js, so most code changes only in what a cell *is*.

**Cells are `bigint`, not `string`.** `latLngToCell(37.7749, -122.4194, 9)` returns
`0x89283082803ffffn`, not `"89283082803ffff"`. Use `cellToString` and `cellFromString` at the
edges of your program, for example when reading or writing JSON, and keep `bigint` everywhere else.
That is where the speed comes from.

**Cell sets are `BigUint64Array`, not `string[]`.** `gridDisk`, `polygonToCells`, `cellToChildren`
and the rest return a typed array that is a view onto memory the native side allocated. Iterate it
as usual; call `Array.from` only if you genuinely need an array.

**Units are separate functions, not a string argument.** `cellArea(cell, 'km2')` becomes
`cellAreaKm2(cell)`. The same applies to `edgeLength`, `greatCircleDistance`, `getHexagonAreaAvg`
and `getHexagonEdgeLengthAvg`. h3-js's `E_UNKNOWN_UNIT` therefore has no counterpart here.

**`polygonToCellsExperimental` takes either form of `flags`.** The exported `ContainmentMode`
constants (`ContainmentMode.center`, `.full`, `.overlapping`, `.overlappingBbox`) and h3-js's names
(`'containmentCenter'`, `'containmentFull'`, `'containmentOverlapping'`,
`'containmentOverlappingBbox'`) both work. The constants are what this package recommends: a name
costs a lookup on a path that exists to be fast.

**Three behaviours differ deliberately.**

1. `constructCell(baseCellNumber, digits, res)` keeps h3-js's argument order rather than the C
   library's `(res, baseCellNumber, digits)`.
2. Error messages come from H3's own `describeH3Error`, so they match the upstream documentation
   rather than h3-js's separate table. Errors are instances of `H3Error` and carry a `message` and
   a `code` exactly as h3-js does, with the code repeated in the message as `(code: 5)`. Failures
   this package reports itself, such as a resolution that is not an integer, have no H3 counterpart
   and so carry no `code`.
3. An invalid cell, directed edge or vertex raises an `H3Error` worded by H3 itself
   (`E_CELL_INVALID`, `E_DIR_EDGE_INVALID`, `E_VERTEX_INVALID`) where h3-js returns an undefined
   value. Validation happens once, at the boundary, in C++.
   `getResolution`, `getBaseCellNumber` and the `is*` predicates are the exception: they have no
   error channel and answer for any input. So is `cellToString`, which formats any index.

**`h3IndexToSplitLong` and `splitLongToH3Index` do not exist.** They work around JavaScript's lack
of 64-bit integers in an emscripten build and have no counterpart in the C library.

The full documentation follows with the first release.
