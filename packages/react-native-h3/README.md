<div align="center">
  <img src="https://raw.githubusercontent.com/vgorte/react-native-h3/main/img/logo.svg" alt="react-native-h3" width="132" height="132" />
  <h1>react-native-h3</h1>
  <p><b>Uber's H3 geospatial grid for React Native, bound to the C library instead of a JavaScript port.</b></p>
  <p>
    <a href="https://www.npmjs.com/package/react-native-h3"><img src="https://img.shields.io/npm/v/react-native-h3.svg" alt="npm version" /></a>
    <a href="https://github.com/vgorte/react-native-h3/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
    <a href="https://github.com/vgorte/react-native-h3/actions/workflows/ci.yml"><img src="https://github.com/vgorte/react-native-h3/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg" alt="Platforms: iOS and Android" />
  </p>
</div>

H3 indexes the globe as a hexagonal grid, addressing every cell with a 64-bit integer. This package
vendors the H3 C library at v4.5.0 and calls it through
[Nitro Modules](https://nitro.margelo.com), so the work happens in machine code on iOS and Android
rather than on an Emscripten heap. There is no web implementation; on web, use
[h3-js](https://github.com/uber/h3-js).

## Features

- **Full API parity with `h3-js` 4.5.0**, all 69 functions, under the same names where `h3-js` has
  one, checked by a parity suite over every resolution 0 cell, all sixteen resolutions, all 192
  pentagons and the poles.
- **Cell indexes are `bigint`**, not hexadecimal strings, so nothing converts on the hot path.
- **Cell sets are `BigUint64Array`**, a view onto the buffer C++ produced, handed over without a copy.
- **Synchronous by default**, with async variants for the four calls that can drop frames.
- **A cell ceiling**, so a result too large for the device raises `H3Error` instead of killing the
  process.
- **Errors worded by H3 itself**, from `describeH3Error`, carrying the same numeric code `h3-js`
  reports.
- **iOS and Android**, and the New Architecture is not required.
- **MIT licensed**, with the vendored H3 sources under their own Apache-2.0 license.

## Benchmark

`h3-js` is the same C library compiled to JavaScript by Emscripten, running on an emulated heap and
representing every cell as a hexadecimal string. It works, and on a phone it is slow enough to
change what you can build.

![react-native-h3 against h3-js, speedup per workload](https://raw.githubusercontent.com/vgorte/react-native-h3/main/img/benchmark.svg)

**Up to 260× faster than `h3-js`**, on `polygonToCells` over San Francisco at resolution 12,
412,377 cells, with the result verified identical to `h3-js`'s.

| Workload | react-native-h3 | h3-js | Speedup |
|---|---:|---:|---:|
| `latLngToCell` x 100,000 | 33.0 ms | 700.5 ms | 21× |
| `polygonToCells`, San Francisco, res 12 | 76.1 ms | 20,444.3 ms | 269× |
| `cellToBoundary` x 100,000 | 110.3 ms | 1,138.6 ms | 10× |

Measured on iOS 26.5 in a Release build, React Native 0.87.0 with Hermes 250829098.0.16, against
`h3-js` 4.5.0, on 2026-08-28: both libraries in the same app and the same Hermes instance, medians
of 20 runs, three for `polygonToCells`, after one warm-up, every result compared for equivalence.
Full data and method:
[docs/benchmark.md](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md).

## Installation

```sh
bun add react-native-h3 react-native-nitro-modules
cd ios && pod install
```

```sh
npx expo install react-native-h3 react-native-nitro-modules
npx expo prebuild
```

`react-native-nitro-modules` is a peer dependency at `^0.37.0`: install it in your app so the build
holds exactly one copy of the Nitro runtime. The package needs React Native 0.75 or newer and builds
on the old architecture as well as the New Architecture. Platform floors are under
[Requirements](#requirements).

## Usage

```ts
import { cellToString, gridDisk, latLngToCell } from 'react-native-h3'

const cell = latLngToCell(37.7749, -122.4194, 9)
const neighbours = gridDisk(cell, 1)

console.log(cellToString(cell)) // '89283082803ffff'
console.log(neighbours.length) // 7
```

Cells are `bigint`, so they compare, sort and serialise as numbers; use `cellToString` and
`cellFromString` at the edges where the hexadecimal form is wanted. A cell set holds only real
cells, because the holes H3 pads its output with around pentagons are removed natively before the
buffer crosses. The
[example app](https://github.com/vgorte/react-native-h3/tree/main/apps/example) exercises every
domain and carries the benchmark screen.

## Async variants

Four functions have an async variant, because these four can exceed the 50 ms budget that costs you
frames:

```ts
import { polygonToCellsAsync, type Ring } from 'react-native-h3'

const sanFrancisco: Ring[] = [
  [
    [37.8133, -122.409],
    [37.7198, -122.3545],
    [37.7076, -122.5123],
  ],
]

async function fill(): Promise<BigUint64Array> {
  return polygonToCellsAsync(sanFrancisco, 12)
}
```

`cellsToMultiPolygonAsync`, `polygonToCellsExperimentalAsync` and `uncompactCellsAsync` have the
same shape. Everything else is synchronous by design: a thread hop costs more than the call it would
defer. An async variant copies any cell set you hand it before any work starts, so the buffer you
passed is yours to reuse the moment the call returns, and it answers exactly as its synchronous
sibling does.

## The cell ceiling

A request whose result would exceed 4,000,000 cells is refused before anything is allocated:

```text
The requested result of 4005541 cells exceeds the cell limit of 4000000, which guards against exhausting device memory. Raise it with configure({ maxCellCount })
```

H3 allocates nothing itself: every cell-producing function asks a size query how large the answer
will be, then writes into a buffer the caller provides. On a server an oversize result is a slow
call. On a phone it is a process kill that JavaScript cannot catch, because the allocation fails
inside the app's own heap, so there is no exception for a `catch` to receive. The ceiling turns that
into an `H3Error` you can handle. `h3-js` has no equivalent: it bounds only its own wasm allocation,
at 2 GB, and `gridDisk(cell, 1155)` allocates all 4,005,541 cells there. What that costs on a
desktop machine is measured in
[docs/benchmark.md](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md#what-an-unbounded-request-costs-h3-js).

4,000,000 cells is 32 MB at eight bytes a cell, allocated once in C++ and handed to JavaScript as
the `BigUint64Array`'s backing store without a copy; an async variant that copies an inbound set
holds two such buffers for the length of the call. The ceiling is a default, not a law:

```ts
import { configure } from 'react-native-h3'

configure({ maxCellCount: 20_000_000 })
configure({ maxCellCount: Infinity }) // no ceiling; the memory is yours to manage
```

The value applies to every cell-producing function, synchronous and async alike, from the moment it
is set. It must be a positive integer or `Infinity`; anything else throws an `H3Error` saying so.

## Errors

Every function throws `H3Error`, an `Error` carrying a `message` and, when H3 itself reported the
failure, its numeric `code`. The wording comes from H3's own `describeH3Error`, and the code is
repeated at the end of the message as `(code: N)`, exactly as `h3-js` does.

```ts
import { H3Error, latLngToCell } from 'react-native-h3'

try {
  latLngToCell(37.7749, -122.4194, 99)
} catch (error) {
  if (error instanceof H3Error) {
    console.log(error.message) // 'Resolution argument was outside of acceptable range (code: 4)'
    console.log(error.code) // 4
  }
}
```

The checks this binding makes before calling H3, on argument types and on the result size, carry
their own wording and no `code`, because upstream has no code for them:
`latLngToCell(37.7749, -122.4194, 9.5)` throws
`Resolution must be an integer between 0 and 15` with `code` left `undefined`. An async variant
carries the same message as its synchronous sibling.

## API

The exported surface mirrors `h3-js` 4.5.0 function for function.
[docs/api.md](https://github.com/vgorte/react-native-h3/blob/main/packages/react-native-h3/docs/api.md)
documents every export, grouped by domain and generated from the TypeScript sources, so it cannot
drift from the JSDoc your editor shows.
[docs/h3-function-table.md](https://github.com/vgorte/react-native-h3/blob/main/docs/h3-function-table.md)
maps each function to its H3 C counterpart.

## Migrating from h3-js

The function names match, so most code changes only in what a cell *is*.

| `h3-js` | react-native-h3 |
|---|---|
| `latLngToCell(37.7749, -122.4194, 9)` returns `'89283082803ffff'` | returns `0x89283082803ffffn`; `cellToString` and `cellFromString` convert at the edges |
| `gridDisk` and friends return `string[]` | they return a `BigUint64Array`; call `Array.from` only if you need an array |
| `cellArea(cell, 'km2')` | `cellAreaKm2(cell)`, and likewise for `edgeLength`, `greatCircleDistance`, `getHexagonAreaAvg` and `getHexagonEdgeLengthAvg` |
| `polygonToCellsExperimental(rings, res, 'containmentFull')` | the same names work, and so do the `ContainmentMode` constants |
| `constructCell(baseCellNumber, digits, res)` | the same argument order, not the C library's |
| `h3IndexToSplitLong`, `splitLongToH3Index` | absent: they work around JavaScript's missing 64-bit integers |

Three behaviours differ deliberately.

1. An invalid cell, directed edge or vertex raises an `H3Error` where `h3-js` reads the bits and
   answers anyway. Validation happens once, at the boundary, in C++. Nine functions are exempt
   because they have no error channel: `isValidCell`, `isValidIndex`, `isPentagon`, `isResClassIII`,
   `isValidDirectedEdge`, `isValidVertex`, `getResolution`, `getBaseCellNumber` and `cellToString`.
2. An argument that is not an integer is refused where `h3-js` truncates it: `gridDisk(cell, 1.5)`
   throws here and returns the `k` of 1 disk there. So is a request for more cells than
   [the cell ceiling](#the-cell-ceiling) allows, which is a limit no other H3 binding imposes.
3. Messages come from H3's `describeH3Error` rather than `h3-js`'s own table, which has let two of
   the nineteen H3 texts drift.

[docs/h3-js-divergences.md](https://github.com/vgorte/react-native-h3/blob/main/packages/react-native-h3/docs/h3-js-divergences.md)
lists every case with the `h3-js` answer beside this one, each proved by a test.

## Requirements

| Platform | Minimum | Notes |
|---|---|---|
| iOS | the deployment target React Native asks for, through `min_ios_version_supported` | Xcode 16.4 or newer |
| Android | `minSdk` 24 | `compileSdk` 36, NDK 27.1.12297006 |

React Native 0.75 or newer, `react-native-nitro-modules` `^0.37.0`, and a C++20 toolchain, which the
versions above already imply. The New Architecture is not required: Nitro compiles as a Native
Module on the old architecture and as a Turbo Module on the new one, and only Nitro Views need the
New Architecture, which this package has none of.

## Versioning

The package version is independent of the H3 version it carries. The bundled H3 C library is pinned
to an upstream tag, currently v4.5.0, vendored under `third_party/h3` and updated by a reviewable
commit rather than a submodule. `third_party/h3/H3_VERSION` ships inside the tarball and names the
exact C version a release was built from.

## Contributing

The workspace layout, the test commands and the seven places a new operation touches are in
[CONTRIBUTING.md](https://github.com/vgorte/react-native-h3/blob/main/CONTRIBUTING.md). The release
process is in
[docs/releasing.md](https://github.com/vgorte/react-native-h3/blob/main/docs/releasing.md).

## License

MIT. The vendored H3 C sources are Apache-2.0 and keep their own `LICENSE` and `NOTICE` under
`third_party/h3/`.
