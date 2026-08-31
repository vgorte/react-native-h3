<div align="center">
  <img src="https://raw.githubusercontent.com/vgorte/react-native-nitro-h3/main/img/logo.svg" alt="react-native-nitro-h3" width="132" height="132" />
  <h1>react-native-nitro-h3</h1>
  <p><b>Fast H3 geospatial indexing for React Native, powered by Nitro Modules.</b></p>
  <p>
    <a href="https://www.npmjs.com/package/react-native-nitro-h3"><img src="https://img.shields.io/npm/v/react-native-nitro-h3.svg" alt="npm version" /></a>
    <a href="https://github.com/vgorte/react-native-nitro-h3/actions/workflows/ci.yml"><img src="https://github.com/vgorte/react-native-nitro-h3/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://github.com/vgorte/react-native-nitro-h3/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
    <img src="https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey.svg" alt="Platforms: iOS and Android" />
    <a href="https://github.com/uber/h3/releases/tag/v4.5.0"><img src="https://img.shields.io/badge/h3-v4.5.0-blue.svg" alt="Vendored H3 v4.5.0" /></a>
  </p>
</div>

`react-native-nitro-h3` brings [H3](https://h3geo.org/) to native iOS and Android applications. It vendors the H3 C library (v4.5.0) and calls it directly from native code instead of running it through JavaScript or WebAssembly.

The result is a native H3 binding designed for performance-sensitive React Native workloads.

> **Native mobile only.** For web applications, use [`h3-js`](https://github.com/uber/h3-js).

---

## ✨ Highlights

* 🚀 **Native execution**: H3 runs as compiled C/C++ on iOS and Android.
* ⚡ **High performance**: avoids hexadecimal string conversion on the JS/native boundary, repeated bridge crossings, and per-element copies.
* 🔢 **`bigint` cell indexes**: H3's 64-bit indexes stay numeric instead of being converted to hexadecimal strings.
* 📦 **Typed-array results**: cell sets use `BigUint64Array`; coordinate batches use `Float64Array`. A result crosses as one `ArrayBuffer` and is viewed in place.
* 🔄 **Batch APIs**: process complete coordinate or cell arrays in a single native call.
* 🧵 **Async variants**: move expensive operations to a background thread when appropriate.
* 🛡️ **Optional cell ceiling**: reject unexpectedly large result sets before allocation.
* ✅ **`h3-js` API parity**: 64 functions under the same names, with a short list of documented divergences.
* 🧩 **Legacy Architecture compatible**: the New Architecture is not required.

---

## ⚡ Performance

`react-native-nitro-h3` is designed to minimize the overhead between JavaScript and native code.

![react-native-nitro-h3 against h3-js, median milliseconds per workload](https://raw.githubusercontent.com/vgorte/react-native-nitro-h3/main/img/benchmark.svg)

In this iPhone XS benchmark, the largest measured difference was:

### **807× faster**

for `compactCells` on a `k=20` disk containing 1,261 cells.

All measured results were verified against `h3-js` 4.5.0 for equivalence.

| Operation | `react-native-nitro-h3` | `h3-js` | Factor |
| --------- | ----------------------: | ------: | -----: |
| `compactCells` (`k=20` disk) | 0.100 ms | 81.0 ms | 807× |
| `polygonToCells` (San Francisco, res 12) | 233.8 ms | 78,805.6 ms | 337× |
| `latLngsToCells` (100k pairs, batch) | 54.3 ms | 2,515.2 ms | 46× |
| `cellsToLatLngs` (100k cells, batch) | 23.4 ms | 1,313.6 ms | 56× |
| `latLngToCell` (100k calls) | 96.0 ms | 2,448.6 ms | 25× |

**Benchmark:** iPhone XS · Apple A12 · iOS 18.7.9 · Release build · React Native 0.87.0 · Hermes · 20-run median · 2026-08-31.

> ⚠️ Benchmark numbers are workload- and device-dependent. They are representative measurements, not guaranteed speedups.

👉 **[Full benchmark results & methodology](docs/benchmark.md)**

---

## 🚀 Installation

Install the package together with Nitro Modules:

```bash
bun add react-native-nitro-h3 react-native-nitro-modules
```

Or:

```bash
npm install react-native-nitro-h3 react-native-nitro-modules
```

For iOS:

```bash
cd ios && pod install
```

### Expo

```bash
npx expo install react-native-nitro-h3 react-native-nitro-modules
npx expo prebuild
```

Expo Go cannot load native modules. Use a development build with `npx expo run:ios` or `npx expo run:android`.

---

## 👇 Usage

```ts
import {
  latLngToCell,
  gridDisk,
  cellToString,
} from 'react-native-nitro-h3'

// H3 cell for San Francisco at resolution 9
const cell = latLngToCell(37.7749, -122.4194, 9)

// Get neighboring cells
const neighbours = gridDisk(cell, 1)

console.log(neighbours.length) // 7
console.log(cellToString(cell)) // "89283082803ffff"
```

---

## 🔢 BigInt & Typed Arrays

H3 indexes are represented as JavaScript `bigint` values:

```ts
const cell = latLngToCell(37.7749, -122.4194, 9)

console.log(cell)
// 0x89283082803ffffn
```

Cell collections use `BigUint64Array`:

```ts
const cells = gridDisk(cell, 10)

console.log(cells instanceof BigUint64Array) // true
```

This avoids converting every H3 index to and from a hexadecimal string on the hot path.

When a string representation is required, for example when communicating with a backend, convert only at the application boundary:

```ts
const hex = cellToString(cell)
const restored = cellFromString(hex)
```

> 💡 `JSON.stringify` does not support `bigint` directly.

---

## 📦 Batch API

Two additional APIs process complete typed arrays in a single native call:

```ts
import {
  latLngsToCells,
  cellsToLatLngs,
} from 'react-native-nitro-h3'

const coords = new Float64Array([
  37.7749, -122.4194,
  37.8044, -122.2712,
])

const cells = latLngsToCells(coords, 9)
// BigUint64Array

const centres = cellsToLatLngs(cells)
// Float64Array: [lat0, lng0, lat1, lng1, ...]
```

Coordinates use interleaved `[latitude, longitude]` pairs.

These APIs are additive and are not part of the `h3-js` compatibility surface. They are intended for workloads where repeatedly crossing the JS/native boundary would otherwise dominate execution time.

![One batch call against the loop it replaces, 100,000 elements](https://raw.githubusercontent.com/vgorte/react-native-nitro-h3/main/img/benchmark-batch.svg)

The saving is the bridge crossings that no longer happen. Same conditions as the Performance section above, full data in [docs/benchmark.md](docs/benchmark.md).

---

## 🧵 Async Variants

Most H3 operations are intentionally synchronous.

For small native calls, the cost of moving work to another thread can exceed the cost of the H3 operation itself.

Four expensive operations provide async variants:

```ts
import { polygonToCellsAsync, type Ring } from 'react-native-nitro-h3'

const sanFrancisco: Ring[] = [
  [
    [37.8133, -122.409],
    [37.7198, -122.3545],
    [37.7076, -122.5123],
  ],
]

const cells = await polygonToCellsAsync(sanFrancisco, 12)
```

Available async functions:

* `polygonToCellsAsync`
* `cellsToMultiPolygonAsync`
* `polygonToCellsExperimentalAsync`
* `uncompactCellsAsync`

Async operations preserve the behavior and error semantics of their synchronous counterparts.

---

## 🛡️ Memory Safety

Cell-producing H3 operations can return very large result sets.

For applications where unexpectedly large allocations should be rejected, configure an optional cell limit:

```ts
import { configure } from 'react-native-nitro-h3'

configure({
  maxCellCount: 4_000_000,
})
```

A request exceeding the configured limit throws a catchable `H3Error` before the result is allocated.

The limit is disabled by default to preserve `h3-js` behavior.

To remove a previously configured limit:

```ts
configure({
  maxCellCount: Infinity,
})
```

---

## ❌ Error Handling

All package-level errors are represented by `H3Error`.

```ts
import {
  H3Error,
  latLngToCell,
} from 'react-native-nitro-h3'

try {
  latLngToCell(37.7749, -122.4194, 99)
} catch (error) {
  if (error instanceof H3Error) {
    console.log(error.message)
    console.log(error.code)
  }
}
```

Errors originating from H3 preserve the numeric H3 error code. Validation performed by the binding itself uses the same `H3Error` type.

---

## ✅ API Compatibility

The package mirrors the **64-function `h3-js` 4.5.0 API** under the same names.

There are a few intentional differences:

| `h3-js`                                     | `react-native-nitro-h3`               |
| ------------------------------------------- | ------------------------------------- |
| Cell indexes are hexadecimal strings        | Cell indexes are `bigint`             |
| Cell collections are `string[]`             | Cell collections are `BigUint64Array` |
| `cellArea(cell, 'km2')`                     | `cellAreaKm2(cell)`                   |
| `h3IndexToSplitLong` / `splitLongToH3Index` | Not provided                          |
| Loose JavaScript argument coercion          | Strict native validation              |
| No cell allocation limit                    | Optional `maxCellCount`               |

👉 **[Full compatibility & divergence guide](docs/h3-js-divergences.md)**

---

## 🔄 Migrating from `h3-js`

Most migrations are straightforward because the function names remain the same.

The main change is that H3 indexes are numeric `bigint` values rather than strings:

```ts
// h3-js
const cell = latLngToCell(37.7749, -122.4194, 9)
// "89283082803ffff"

// react-native-nitro-h3
const cell = latLngToCell(37.7749, -122.4194, 9)
// 0x89283082803ffffn
```

Convert to strings only where required:

```ts
const stringCell = cellToString(cell)
const cellAgain = cellFromString(stringCell)
```

Likewise, APIs returning cell collections now return `BigUint64Array` instead of `string[]`.

👉 **[Compatibility and divergence guide](docs/h3-js-divergences.md)**

---

## 📚 Documentation

The links below point into the repository. On npm, browse them at
[github.com/vgorte/react-native-nitro-h3](https://github.com/vgorte/react-native-nitro-h3).

For package users:

* 🔬 **[API Documentation](packages/react-native-nitro-h3/docs/api.md):** API reference and TypeScript signatures
* 🔄 **[h3-js Divergences](docs/h3-js-divergences.md):** compatibility differences and the tests that prove them
* 🧮 **[Performance Guide](docs/performance.md):** batch reference, the cell ceiling, and threading in depth
* 📱 **[Example App](apps/example):** example application and benchmark screen

Evidence and reference:

* 📊 **[Benchmark Report](docs/benchmark.md):** methodology, devices, measurements and complete results
* 🔍 **[H3 Function Reference](docs/h3-function-table.md):** every parity export mapped to its H3 C counterpart

For contributors and maintainers:

* 🤝 **[Contributing](CONTRIBUTING.md):** development and contribution guide
* 📦 **[Releasing](docs/releasing.md):** release procedure

---

## 📱 Requirements

| Platform      | Requirement                    |
| ------------- | ------------------------------ |
| React Native  | **0.75+**                      |
| Nitro Modules | **0.37+**                      |
| C++           | C++20-compatible toolchain     |
| iOS           | React Native deployment target |
| Xcode         | **16.4+**                      |
| Android       | **minSdk 24**                  |
| Android SDK   | **compileSdk 36**              |
| Android NDK   | **27.1.12297006**              |

> 🧩 **The New Architecture is not required.**

React Native 0.75 to 0.81 can run the package on the Legacy Architecture. From React Native 0.82 onward, React Native ships with the New Architecture only.

---

## 🧬 H3 Versioning

`react-native-nitro-h3` versions independently from the upstream H3 C library.

The current release vendors **H3 4.5.0** directly in the repository rather than using a git submodule.

The exact bundled H3 version can be verified in:

```text
packages/react-native-nitro-h3/third_party/h3/H3_VERSION
```

---

## 🤝 Contributing

Contributions are welcome!

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for:

* development setup
* test commands
* adding new H3 operations
* native implementation details

---

## 📄 License

`react-native-nitro-h3` is released under the **MIT License**.

The vendored H3 C sources are released under the **Apache-2.0 License** and retain their original `LICENSE` and `NOTICE` files.
