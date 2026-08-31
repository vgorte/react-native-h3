<div align="center">
  <img src="img/logo.svg" alt="react-native-nitro-h3" width="132" height="132" />
  <h1>react-native-nitro-h3</h1>
  <p><b>Uber's H3 geospatial grid for React Native, powered by Nitro Modules for blazing fast performance.</b></p>
  <p>
    <a href="https://www.npmjs.com/package/react-native-nitro-h3"><img src="https://img.shields.io/npm/v/react-native-nitro-h3.svg" alt="npm version" /></a>
    <a href="https://github.com/vgorte/react-native-nitro-h3/actions/workflows/ci.yml"><img src="https://github.com/vgorte/react-native-nitro-h3/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/vgorte/react-native-nitro-h3/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg" alt="Platforms: iOS and Android" />
    <a href="https://github.com/uber/h3/releases/tag/v4.5.0"><img src="https://img.shields.io/badge/h3-v4.5.0-blue.svg" alt="Vendored H3 v4.5.0" /></a>
  </p>
</div>

`react-native-nitro-h3` brings the official H3 geospatial indexing system to React Native. It
addresses the globe as a hexagonal grid, assigning every cell a 64-bit integer.

Instead of relying on a JavaScript port or an Emscripten heap, this package vendors the **H3 C
library (v4.5.0)** and binds to it directly using **Nitro Modules**. The result? True
machine-code execution on iOS and Android for maximum performance.

> **Note:** *This library is heavily optimized for native mobile apps. There is no web
> implementation; if you are targeting the web, please use
> [h3-js](https://github.com/uber/h3-js).*

## ✨ Features

- 🔄 **Full API Parity:** Mirrors the 64 functions of `h3-js` 4.5.0 under the same names, plus four
  `Async` variants and `configure`. Backed by a rigorous parity test suite covering every
  resolution, pentagons, and poles.
- 🧮 **Batch API:** `latLngsToCells` and `cellsToLatLngs` index or read a whole typed array in a
  single native call, an additive surface `h3-js` does not offer.
- ⚡ **Zero Conversion Overhead:** Cell indexes are returned as `bigint` rather than hexadecimal
  strings, completely eliminating string-conversion bottlenecks on the hot path.
- 🚀 **Zero-Copy Architecture:** Cell sets are returned as `BigUint64Array`, a direct view onto the
  C++ buffer handed over to JavaScript without a single memory copy.
- ⏱️ **Sync by Default:** Designed for speed with synchronous calls, alongside async variants for
  the four specific operations heavy enough to drop frames.
- 🛡️ **Optional Cell Ceiling:** Off by default, so a call returns whatever you ask for. Set
  one and an oversized result throws a catchable `H3Error` instead of allocating.
- 🐛 **Native Error Handling:** Error messages are forwarded directly from the H3 C library
  (`describeH3Error`) and include the exact same numeric codes as `h3-js`.
- 🏗️ **Architecture Agnostic:** Full support for iOS and Android; the New Architecture is not
  required.

## 🚀 Benchmarks

While `h3-js` compiles the C library to JavaScript via Emscripten and relies on hexadecimal string
allocation, `react-native-nitro-h3` executes in pure machine code and hands over memory without a
single copy.

![react-native-nitro-h3 against h3-js, median milliseconds per workload](img/benchmark.svg)

The widest gap measured on an iPhone XS on 2026-08-31 is **807× on `compactCells`**, over a `k=20`
disk of 1,261 cells, with every measured result verified identical to `h3-js`'s. The Android
figures, measured on a Samsung Galaxy S23, are in
[docs/benchmark.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/benchmark.md)
beside these.

> **Methodology:** Measured on an iPhone XS (Apple A12, 2018) running iOS 18.7.9 in a Release build,
> React Native 0.87.0 with Hermes 250829098.0.16, against `h3-js` 4.5.0, on 2026-08-31: both
> libraries in the same app and the same Hermes instance, medians of 20 runs, three for
> `polygonToCells`, after one warm-up, every result compared for equivalence. The medians are
> transcribed from the device screen, so they carry no percentiles. Full data and method:
> [docs/benchmark.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/benchmark.md).

## 📦 Installation

`react-native-nitro-h3` requires `react-native-nitro-modules` (`^0.37.0`) as a peer dependency. You
must install it in your app so the build holds exactly one copy of the Nitro runtime.

### 1. Install packages

Choose your preferred package manager or framework:

**Using Bun**
```sh
bun add react-native-nitro-h3 react-native-nitro-modules
```
**Using Expo**
```sh
npx expo install react-native-nitro-h3 react-native-nitro-modules
```
*(You can also use `npm install` or `yarn add`.)*

### 2. Native setup

Depending on your project type, link the native code:

**Bare React Native (iOS only):**
```sh
cd ios && pod install
```
**Expo:**
```sh
npx expo prebuild
```
Expo Go cannot load native modules; `prebuild` produces the development build you run with
`npx expo run:ios` or `npx expo run:android`.

> **Compatibility:** Requires React Native 0.75+. The New Architecture is not required (React Native
> 0.75 to 0.81 may still run the Legacy Architecture). For minimum OS versions, see
> [Requirements](#️-requirements).

## 📖 Usage

```ts
import { latLngToCell, gridDisk, cellToString } from 'react-native-nitro-h3'

// 1. Get the H3 cell index for San Francisco at resolution 9
const cell = latLngToCell(37.7749, -122.4194, 9)

// 2. Get the immediate neighbours (k = 1)
const neighbours = gridDisk(cell, 1)

console.log(neighbours.length) // 7
console.log(cellToString(cell)) // '89283082803ffff'
```

### 🔢 Working with `bigint`

For maximum performance, cells are represented as `bigint`. They compare and sort as numbers, and a
cell set is a `BigUint64Array` whose `length` is the cell count: no padding entries, the holes H3
leaves around pentagons are removed before the buffer reaches JavaScript. `JSON.stringify` does not
accept `bigint`, so use `cellToString` and `cellFromString` at the very edges of your app, for
example when talking to a backend that expects hexadecimal strings.

> **Want to see more?** The included
> [example app](https://github.com/vgorte/react-native-nitro-h3/tree/main/apps/example) exercises every
> domain of the library and contains the complete benchmark screen.

## 🧵 Async Variants (Thread Offloading)

Four specific functions provide an async variant. Why only four? Because these are the only
operations heavy enough to cross Nitro's 50 ms rule of thumb, where a call starts costing visible
frames.

```ts
import { polygonToCellsAsync, type Ring } from 'react-native-nitro-h3'

const sanFrancisco: Ring[] = [
  [
    [37.8133, -122.409],
    [37.7198, -122.3545],
    [37.7076, -122.5123],
  ],
]

// Offload heavy calculations to a background thread
async function fillGrid(): Promise<BigUint64Array> {
  return await polygonToCellsAsync(sanFrancisco, 12)
}
```

**Available Async Functions:**

- `polygonToCellsAsync`
- `cellsToMultiPolygonAsync`
- `polygonToCellsExperimentalAsync`
- `uncompactCellsAsync`

> **⚡ Why is everything else synchronous?** A thread hop (context switch) often costs more time than
> the actual H3 C library call. Everything else is optimized to run synchronously by design.

> **🛡️ Buffer Safety:** An async variant safely copies any input cell set before work starts on the
> background thread. The buffer you pass in is immediately yours to reuse the moment the function
> returns, while yielding the exact same results as its synchronous sibling.

## 🧮 Batch API (Beyond h3-js)

Two additive functions run a scalar operation over a whole typed array in one native call, for the
workloads where per-call overhead dominates. They are not part of the `h3-js` parity surface.

```ts
import { cellsToLatLngs, latLngsToCells } from 'react-native-nitro-h3'

const points = [
  { lat: 37.7749, lng: -122.4194 },
  { lat: 37.8044, lng: -122.2712 },
]

// coordinates are interleaved [lat, lng] pairs, latitude first (GeoJSON is the other way round)
const coords = new Float64Array(points.length * 2)
points.forEach((point, i) => {
  coords[i * 2] = point.lat
  coords[i * 2 + 1] = point.lng
})

const cells = latLngsToCells(coords, 9) // BigUint64Array, one cell per pair
const centres = cellsToLatLngs(cells) // Float64Array, [lat, lng] per cell
```

![One batch call against the loop it replaces, 100,000 elements](img/benchmark-batch.svg)

The saving is the bridge crossings that no longer happen. On an iPhone XS, `cellsToLatLngs` reads
100,000 centres in 23.4 ms where this package's own `cellToLatLng` loop takes 112.2 ms.
`latLngsToCells` indexes 100,000 pairs in 54.3 ms against 96.0 ms for the loop, and that 1.77× is a
floor rather than the win: the loop repeats one coordinate where the batch call indexes 100,000
distinct ones. Same conditions as the Benchmarks section above, full data in
[docs/benchmark.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/benchmark.md).

### `latLngsToCells`

```ts
function latLngsToCells(coords: Float64Array, res: number): BigUint64Array
```

Indexes a whole coordinate set in one native call. `coords` is interleaved
`[lat0, lng0, lat1, lng1, ...]` in degrees, latitude first, the reverse of the GeoJSON order.
Returns one cell per pair, in input order.

- An odd `coords.length` throws an `H3Error` reading `A coordinate set must hold an even number of
  doubles`.
- A rejected pair throws an `H3Error` whose message carries its index, as in `coords[3]: ...`.
- A `res` outside `0` to `15` is rejected on the first pair, so the message reads
  `coords[0]: Resolution argument was outside of acceptable range (code: 4)`.
- An empty `coords` returns an empty `BigUint64Array`, and `res` is never judged.
- The Cell Ceiling below applies, counted in cells: one cell per pair.

### `cellsToLatLngs`

```ts
function cellsToLatLngs(cells: BigUint64Array): Float64Array
```

Reads the centres of a whole cell set in one native call. Returns interleaved
`[lat0, lng0, lat1, lng1, ...]` in degrees, latitude first again, two entries per cell, which is the
flat coordinate buffer circle layers and heatmaps consume.

- An invalid cell throws an `H3Error` whose message carries its index, such as
  `cells[1]: Cell argument was not valid (code: 5)`.
- An empty `cells` returns an empty `Float64Array`, and no element is validated.
- The Cell Ceiling below applies, counted in cells, and is checked before the first centre is read.

## 🛡️ The Cell Ceiling (Opt-In)

There is no cell limit until you set one: a call returns whatever you ask for, exactly as
`h3-js` does. Sizes grow fast, and a cell costs 8 bytes in the returned `BigUint64Array`.
`gridDisk(cell, k)` returns `1 + 3k(k+1)` cells, so `k` of 1,155 is 4,005,541 cells or 32 MB, and
`polygonToCells` over San Francisco at resolution 12 is 412,377.

A request keeps growing from there: `gridDisk(cell, 4000)` is 48,012,001 cells, 384 MB packed, and a
polygon covering a country at resolution 15 reports far more. On a mobile device an allocation at
that scale is not a slow call. It is a silent process kill that your JavaScript `try/catch` cannot
intercept. Set a **Cell Ceiling** and the request is refused before anything is allocated:

```ts
import { configure } from 'react-native-nitro-h3'

// 4,000,000 cells is exactly 32 MB at 8 bytes per cell
configure({ maxCellCount: 4_000_000 })
```

Every cell-producing function then queries the required size first and throws a catchable `H3Error`
when the answer is over the ceiling:

```text
The requested result of 4005541 cells exceeds the cell limit of 4000000 set with configure({ maxCellCount }). Raise or remove the limit to allow it.
```

`configure({ maxCellCount: Infinity })` removes a ceiling set earlier. The value must be a
positive integer or `Infinity`, and it applies to every sync and async cell-producing function from
the moment it is set.

> **💡 How it compares to h3-js:** `h3-js` offers no equivalent setting; it only bounds its
> WebAssembly allocation at a massive 2 GB. A heavy call there will just execute: `gridDisk(cell, 1155)`
> allocates all 4,005,541 cells,
> [measured on a desktop machine in docs/benchmark.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/benchmark.md#-the-cost-of-unbounded-requests-what-the-cell-ceiling-guards).

## 🚨 Error Handling

Every function in the library throws a dedicated `H3Error`. When a failure originates from the
native H3 library, the message is pulled directly from C++ (`describeH3Error`) and includes the
exact numeric code, matching `h3-js` 1:1.

```ts
import { H3Error, latLngToCell } from 'react-native-nitro-h3'

try {
  // 99 is an invalid resolution
  latLngToCell(37.7749, -122.4194, 99)
} catch (error) {
  if (error instanceof H3Error) {
    console.log(error.message) // 'Resolution argument was outside of acceptable range (code: 4)'
    console.log(error.code) // 4
  }
}
```

**Key Guarantees**

- **Native Codes:** Standard H3 errors append `(code: N)` to the message and expose the `.code`
  property.
- **Binding Exceptions:** Errors this package raises itself, before the call reaches the H3 C
  library (argument validation such as a non-integer resolution, or a breach of a configured Cell
  Ceiling), also throw `H3Error`, but leave the `.code` property `undefined`.
- **Async Parity:** Async variants throw the exact same errors and messages as their synchronous
  siblings.

## 📚 API Reference

The exported surface mirrors the 64 functions of `h3-js` 4.5.0 under the same names, complete with
rich JSDoc comments, plus the additive batch functions.

- 📖 **[Full API Documentation](https://github.com/vgorte/react-native-nitro-h3/blob/main/packages/react-native-nitro-h3/docs/api.md):**
  Generated directly from the TypeScript sources and grouped by domain. What your editor shows is
  exactly what you get.
- 🗺️ **[H3 C-Function Mapping](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/h3-function-table.md):**
  A table mapping every parity export to its H3 C library counterpart.

## 🔄 Migrating from h3-js

Because the function names match, migrating mostly comes down to handling high-performance `bigint`
types instead of strings.

| `h3-js` (Strings / Arrays) | `react-native-nitro-h3` (BigInt / TypedArrays) |
|---|---|
| `latLngToCell(…)` returns `'89283082803ffff'` | Returns `0x89283082803ffffn` (use `cellToString` and `cellFromString` at the edges) |
| `gridDisk` and friends return `string[]` | Returns `BigUint64Array` (call `Array.from()` only if strictly needed) |
| `cellArea(cell, 'km2')` | `cellAreaKm2(cell)` (same pattern for `edgeLength`, `greatCircleDistance`, `getHexagonAreaAvg`, `getHexagonEdgeLengthAvg`) |
| `polygonToCellsExperimental(…, 'containmentFull')` | Works exactly the same, including the `ContainmentMode` constants |
| `constructCell(base, digits, res)` | Retains the `h3-js` argument order (not the C library's) |
| `h3IndexToSplitLong`, `splitLongToH3Index` | Not provided (they only work around JavaScript's missing 64-bit integers) |

### 🚧 Strict Validation (Deliberate Divergences)

Because this library binds directly to C++, it is intentionally stricter than `h3-js`:

1. **Strict Types:** Arguments that are not integers are refused. `gridDisk(cell, 1.5)` throws here,
   while `h3-js` silently truncates it to `1`.
2. **Strict Validation:** Supplying an invalid cell, directed edge, or vertex throws an `H3Error` at
   the C++ boundary, where `h3-js` reads the bits and answers anyway. Nine functions have no error
   channel and are exempt, such as `isValidCell` or `getResolution`.
3. **Memory Guard:** Once you set a Cell Ceiling, requests exceeding it are refused with an
   `H3Error`, a setting no other H3 binding offers.
4. **Accurate Error Messages:** Messages come straight from the H3 C library's `describeH3Error`;
   two of the nineteen H3 texts have drifted in `h3-js`'s own table.

> **Verify it yourself:** Every deliberate divergence is listed with the `h3-js` answer beside this
> one, each proved by a test, in
> [docs/h3-js-divergences.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/packages/react-native-nitro-h3/docs/h3-js-divergences.md).

## ⚙️ Requirements

This package requires React Native 0.75+, `react-native-nitro-modules` (`^0.37.0`), and a C++20
compatible toolchain.

**Architecture Support:** The New Architecture is not required. On React Native 0.75 to 0.81 the
package also runs on the Legacy Architecture; from 0.82 React Native ships the New Architecture
only.

| Platform | Minimum Version | Notes |
|---|---|---|
| iOS | The deployment target React Native sets (`min_ios_version_supported`) | Requires Xcode 16.4 or newer |
| Android | `minSdk` 24 | `compileSdk` 36, NDK 27.1.12297006 |

## 🏷️ Versioning Strategy

The version of `react-native-nitro-h3` evolves independently of the upstream H3 C library.

Currently, the bundled H3 C library is pinned to **v4.5.0**. It is vendored inside `third_party/h3`
and updated via reviewable commits rather than git submodules. To verify exactly which C version a
specific release was built against, check the `third_party/h3/H3_VERSION` file included in the
published npm tarball.

## 🤝 Contributing

Contributions are heavily encouraged! Whether you're adding a missing feature, fixing a bug, or
improving the docs, we'd love your help.

- 🛠️ **[CONTRIBUTING.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/CONTRIBUTING.md):**
  Details on the workspace layout, test commands, and the exact 7 places you need to touch when
  adding a new H3 operation.
- 📦 **[docs/releasing.md](https://github.com/vgorte/react-native-nitro-h3/blob/main/docs/releasing.md):**
  Step-by-step instructions for the release process.

## ⚖️ License

The `react-native-nitro-h3` bindings are released under the **MIT License**.

The vendored H3 C sources (located in `third_party/h3/`) are released under the **Apache-2.0
License** and retain their original `LICENSE` and `NOTICE` files.
