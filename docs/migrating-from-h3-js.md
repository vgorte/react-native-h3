# 🔄 Migrating from h3-js

> **Audience: `h3-js` users moving an app to `react-native-nitro-h3`.** The 64 `h3-js` 4.5.0
> functions keep their names. What changes is the shape of a cell and of a cell set, and this page
> shows each change as a before and after. The exhaustive, test-backed list of every divergence is
> [Divergences from h3-js 4.5.0](./h3-js-divergences.md).

## Cell indexes are `bigint`

The main change is that H3 indexes are numeric `bigint` values rather than strings:

```ts
// h3-js
const cell = latLngToCell(37.7749, -122.4194, 9)
// "89283082803ffff"

// react-native-nitro-h3
const cell = latLngToCell(37.7749, -122.4194, 9)
// 0x89283082803ffffn
```

A `bigint` cannot be passed to `JSON.stringify` and does not compare equal to a string. Convert at
the application boundary, not on the hot path:

```ts
import { cellFromString, cellToString } from 'react-native-nitro-h3'

const hex = cellToString(cell) // "89283082803ffff"
const restored = cellFromString(hex) // 0x89283082803ffffn
```

## Cell sets are `BigUint64Array`

```ts
// h3-js
const ring: string[] = gridDisk('89283082803ffff', 1)
ring.map((cell) => cellToLatLng(cell))

// react-native-nitro-h3
const ring: BigUint64Array = gridDisk(0x89283082803ffffn, 1)
Array.from(ring, (cell) => cellToLatLng(cell))
```

A `BigUint64Array` has `length`, indexing and iteration, but no `map` that returns an array of
objects. Use `Array.from` with a mapping function, or loop with `for...of`.

## Unit suffixes replace unit arguments

```ts
// h3-js
cellArea(cell, 'km2')
edgeLength(edge, 'm')

// react-native-nitro-h3
cellAreaKm2(cell)
edgeLengthM(edge)
```

Units are separate functions such as `cellAreaKm2` rather than a string argument, so the
`E_UNKNOWN_UNIT` error of `h3-js` is one this package cannot raise.

## Strict validation

The package throws an `H3Error` for a `k`, resolution, vertex number or child position that is not
an integer, where `h3-js` truncates the value and answers. `cellToParent(cell, 1.5)` throws
`Resolution must be an integer between 0 and 15` here, where `h3-js` answers the resolution 1
parent.

## What has no `h3-js` counterpart

- `latLngsToCells` and `cellsToLatLngs` index or read a whole typed array in one native call, see
  [Typed arrays and batch calls](./concepts/typed-arrays-and-batch.md).
- `configure({ maxCellCount })` sets an optional cell ceiling, see
  [Errors and memory safety](./concepts/errors-and-memory-safety.md).
- `h3IndexToSplitLong` and `splitLongToH3Index` are not provided: a `bigint` already carries all 64
  bits.

## Every other difference

[Divergences from h3-js 4.5.0](./h3-js-divergences.md) lists every deliberate difference with the
`h3-js` answer beside it, each proved by a test in `parity/divergences.test.ts`.
