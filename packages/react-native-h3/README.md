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

**`constructCell(baseCellNumber, digits, res)` takes h3-js's argument order**, not the C library's
`(res, baseCellNumber, digits)`, so nothing has to be transposed on the way over.

**Three behaviours differ deliberately.**

1. An invalid cell, directed edge or vertex raises an `H3Error` worded by H3 itself
   (`E_CELL_INVALID`, `E_DIR_EDGE_INVALID`, `E_VERTEX_INVALID`) where h3-js passes it to H3
   unchecked, which answers with whatever the bits mean or fails with a different code. Validation
   happens once, at the boundary, in C++. Nine functions are the exception, because they have no
   error channel and answer for any input: `isValidCell`, `isValidIndex`, `isPentagon`,
   `isResClassIII`, `isValidDirectedEdge`, `isValidVertex`, `getResolution`, `getBaseCellNumber`
   and `cellToString`.
2. An argument that is not an integer is refused where h3-js truncates it: `gridDisk(cell, 1.5)`
   throws here and returns the `k` of 1 disk there. So are a malformed polygon point, a digit list
   whose length is not the resolution, and any request for more than 4,000,000 cells, which a phone
   cannot afford to allocate.
3. Error messages come from H3's own `describeH3Error`, so they match the upstream documentation
   rather than h3-js's separate table. Errors are instances of `H3Error` and carry a `message` and
   a `code`, with the code repeated in the message as `(code: 5)`. Where both sides report the same
   H3 failure the code is the same, and so is the text for seventeen of the nineteen H3 codes.
   Where this package validates first, it reports H3's code for the condition it found, or none at
   all when H3 has no code for it, and h3-js may reach a different failure further in.

[docs/h3-js-divergences.md](docs/h3-js-divergences.md) lists every case with the h3-js answer beside
ours, including the two message texts h3-js has let drift from H3's, the wording of a rejected
containment mode, and how far the arithmetic moves near a pole and at the finest resolutions.

**`h3IndexToSplitLong` and `splitLongToH3Index` do not exist.** They work around JavaScript's lack
of 64-bit integers in an emscripten build and have no counterpart in the C library.

The full documentation follows with the first release.
