# react-native-h3

Fast H3 geospatial indexing for React Native, powered by [Nitro Modules](https://nitro.margelo.com).
The H3 C library is vendored at v4.5.0 and compiled into the app, so calls run natively on iOS and
Android without a JavaScript port. This package is MIT licensed. The vendored H3 library is
Apache-2.0; its LICENSE and NOTICE files ship under `third_party/h3/`.

There is no web implementation. On web, use [h3-js](https://github.com/uber/h3-js).

## Why

h3-js is not a binding. It is this same C library compiled to JavaScript by Emscripten, running on
an emulated heap, and it represents every cell as a hexadecimal string because a JavaScript number
cannot hold 64 bits. It works, and on a phone it is slow enough to change what you can build.

![react-native-h3 against h3-js, speedup per workload](https://raw.githubusercontent.com/vgorte/react-native-h3/main/img/benchmark.svg)

### Up to 260× faster than h3-js

`polygonToCells` over San Francisco at resolution 12, 412,377 cells, with the result verified
identical to h3-js's.

| Workload | react-native-h3 | h3-js | Speedup |
|---|---:|---:|---:|
| `latLngToCell` x 100,000 | 33.0 ms | 700.5 ms | 21× |
| `polygonToCells`, San Francisco, res 12, 412,377 cells | 76.1 ms | 20,444.3 ms | 269× |
| `cellToBoundary` x 100,000 | 110.3 ms | 1,138.6 ms | 10× |

Measured on iOS 26.5 in a Release build, React Native 0.87.0 with Hermes 250829098.0.16, against
h3-js 4.5.0, on 2026-08-28. Both implementations ran in the same app and the same Hermes instance,
in the same run; every figure is the median of 20 runs, three for `polygonToCells`, after one
warm-up, and every result was compared against h3-js's for equivalence.

Full results and methodology:
[docs/benchmark.md](https://github.com/vgorte/react-native-h3/blob/main/docs/benchmark.md).

A cell set comes back as a packed `BigUint64Array` rather than 412,377 hexadecimal strings, which is
why this package does not mimic h3-js's string API.

Size ledger: about 297 KB less shipped Hermes bytecode, about 51 KB more machine code.

## Requirements

- React Native 0.75 or newer
- iOS: Xcode 16.4 or newer; the deployment target is inherited from React Native rather than pinned
- Android: `minSdk` 24, `compileSdk` 36, NDK 27 or newer
- A C++20 toolchain, which the above already imply

**The New Architecture is not required.** Nitro compiles as a Native Module on the old architecture
and as a Turbo Module on the new one; only Nitro Views need the New Architecture, and this package
has none. From React Native 0.76 the New Architecture is the default anyway, so most projects are on
it regardless.

## Install

```sh
bun add react-native-h3 react-native-nitro-modules
cd ios && pod install
```

`react-native-nitro-modules` is a peer dependency: install it in your app so there is exactly one
copy of the Nitro runtime in the build.

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

Cells are `bigint`, so they compare, sort and serialise as numbers rather than strings. Use
`cellToString` and `cellFromString` at the edges where the familiar hexadecimal form is wanted, for
JSON, for a server, or for display.

A cell set is a `BigUint64Array` view over the buffer C++ produced, handed across without a copy. It
contains only real cells: H3 pads its output with holes around pentagons, and those are removed
natively before the buffer crosses, so `.length` is the true count.

## Async variants

Four functions have an async variant, because these are the four that can exceed the 50 ms budget
that costs you frames:

```ts
import {
  cellsToMultiPolygonAsync,
  polygonToCellsAsync,
  polygonToCellsExperimentalAsync,
  uncompactCellsAsync,
} from 'react-native-h3'

const cells = await polygonToCellsAsync(rings, 12)
```

Everything else is synchronous by design: a thread hop costs more than the call it would defer.

An async variant copies any cell set you hand it before any work starts, so the buffer you passed is
yours to reuse or overwrite the moment the call returns. The four take and return exactly what their
synchronous siblings do, including `polygonToCellsExperimentalAsync`, which accepts either a
`ContainmentMode` constant or the h3-js name.

## The cell ceiling

A request whose result would exceed 4,000,000 cells is refused before anything is allocated:

```
The requested result of 4005541 cells exceeds the cell limit of 4000000, which guards against exhausting device memory. Raise it with configure({ maxCellCount })
```

H3 allocates nothing itself. Every cell-producing function first asks a size query how large the
answer will be, and then writes into a buffer the caller provides. On a server an oversize result is
a slow call. On a phone it is a process kill, and not one JavaScript can catch: the allocation fails
inside the app's own heap, so there is no exception for a `catch` to receive and no stack to unwind.
The ceiling turns that into an `H3Error` you can handle.

The number is not arbitrary. 4,000,000 cells is 32 MB at eight bytes a cell, allocated once in C++
and handed to JavaScript as the `BigUint64Array`'s backing store without a copy; an async variant
that copies an inbound set holds two such blocks for the length of the call. `gridDisk(cell, 1155)`
is 4,005,541 cells, so `k = 1155` is where the ceiling first bites.

h3-js has no equivalent. It bounds only its own wasm allocation, at 2 GB, and builds the JavaScript
array of hexadecimal strings on top of that without a bound, which on a desktop browser is
survivable and measurable:

| Call | Cells | Packed size | Wall clock |
|---|---:|---:|---:|
| `gridDisk(cell, 2000)` | 12,006,001 | 96 MB | 1.2 s |
| `gridDisk(cell, 4000)` | 48,012,001 | 384 MB | 12 s |
| `gridDisk(cell, 8000)` | 192,024,001 | 1.5 GB | 5 min 16 s |

Measured 2026-08-27 with h3-js 4.5.0 on a desktop machine. "Packed size" is what those cells cost as
64-bit integers; as an array of hexadecimal strings they cost considerably more. A phone has neither
the memory nor the five minutes.

The ceiling is a default, not a law. `configure` raises it, lowers it, or switches it off:

```ts
import { configure } from 'react-native-h3'

configure({ maxCellCount: 20_000_000 })
configure({ maxCellCount: Infinity }) // no ceiling; the memory is yours to manage
```

The value applies to every cell-producing function, synchronous and async alike, from the moment it
is set. It must be a positive integer or `Infinity`; anything else throws an `H3Error` saying so.

## Errors

Every function throws `H3Error`, an `Error` carrying a `message` and, when H3 itself reported the
failure, its numeric `code`. The wording comes from H3's own `describeH3Error`, so it matches the
upstream documentation, and the code is repeated at the end of the message as `(code: N)`, exactly as
h3-js does.

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

The few checks this binding makes before calling H3, on argument types and on the result size, carry
their own wording and no `code`, because upstream has no code for them:

```ts
latLngToCell(37.7749, -122.4194, 9.5)
// H3Error: Resolution must be an integer between 0 and 15, `code` is `undefined`
```

An async variant carries the same message as its synchronous sibling, so the two are interchangeable
apart from the `await`.

## API

Every exported function is documented in
[docs/api.md](https://github.com/vgorte/react-native-h3/blob/main/packages/react-native-h3/docs/api.md),
grouped by domain and generated from the TypeScript sources, so the reference and the JSDoc your
editor shows are the same text and cannot drift.

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
   whose length is not the resolution, and any request for more cells than the ceiling allows, which
   is a limit no other H3 binding imposes; see [The cell ceiling](#the-cell-ceiling).
3. Error messages come from H3's own `describeH3Error`, so they match the upstream documentation
   rather than h3-js's separate table. Errors are instances of `H3Error` and carry a `message` and
   a `code`, with the code repeated in the message as `(code: 5)`. Where both sides report the same
   H3 failure the code is the same, and so is the text for seventeen of the nineteen H3 codes.
   Where this package validates first, it reports H3's code for the condition it found, or none at
   all when H3 has no code for it, and h3-js may reach a different failure further in.

[docs/h3-js-divergences.md](https://github.com/vgorte/react-native-h3/blob/main/packages/react-native-h3/docs/h3-js-divergences.md)
lists every case with the h3-js answer beside ours, including the two message texts h3-js has let
drift from H3's, the wording of a rejected containment mode, and how far the arithmetic moves near a
pole and at the finest resolutions.

**`h3IndexToSplitLong` and `splitLongToH3Index` do not exist.** They work around JavaScript's lack
of 64-bit integers in an emscripten build and have no counterpart in the C library.

## Versioning

The package version is independent of the H3 version it carries. The bundled H3 C library is pinned
to an upstream tag, currently **v4.5.0**, vendored in tree under `third_party/h3` and updated by a
reviewable commit rather than a submodule. `third_party/h3/H3_VERSION` ships inside the tarball and
names the exact C version a release was built from.

## Contributing

```sh
bun install
bun run lint
bun run typecheck
bun run build
bun test
```

The host C++ tests and the h3-js parity suite build outside the app and are not run by `bun test`:

```sh
cmake -S packages/react-native-h3/cpp/test -B build/host -DCMAKE_BUILD_TYPE=Release
cmake --build build/host --target tests -j
./build/host/tests

cmake -S packages/react-native-h3/cpp/test -B build/parity -DCMAKE_BUILD_TYPE=Release
cmake --build build/parity --target parity_probe -j
H3_PARITY_PROBE="$PWD/build/parity/parity_probe" bun run --cwd packages/react-native-h3 parity
```

The parity suite drives a host executable over the same Nitro-free operations layer the app calls,
and compares it against h3-js 4.5.0 over every resolution 0 cell, all sixteen resolutions, all 192
pentagons, the poles and the antimeridian. A difference it finds is a difference in what ships.

Release process:
[docs/releasing.md](https://github.com/vgorte/react-native-h3/blob/main/docs/releasing.md).

### Adding an operation

Every operation crosses seven places, in this order. Each one has a reason to exist, and skipping any
of them fails a gate rather than merely leaving a gap.

1. **`cpp/ops/<Domain>.{hpp,cpp}`** holds the computation as a plain C++ function. Nothing in
   `cpp/ops/`, `cpp/core/` or `cpp/shapes/` may include a Nitro header: that is what lets the
   operation be tested on the host under AddressSanitizer, and what makes it safe to run on a worker
   thread. Validation belongs here, once, at the boundary.
2. **`cpp/test/<Domain>OpsTest.cpp`**, registered in `cpp/test/CMakeLists.txt` under `TEST_SOURCES`
   so both the `tests` and `tests_asan` targets pick it up.
3. **`src/specs/H3.nitro.ts`** declares the method, then `bun run specs` regenerates
   `nitrogen/generated/**`, which is committed.
4. **`cpp/HybridH3.{hpp,cpp}`** implements the generated pure virtual: convert the Nitro arguments,
   call the `h3ops::` function, convert the result back. No computation here.
5. **`src/<domain>.ts`** wraps the call with its JSDoc and `rethrowAsH3Error`, and `src/index.ts`
   re-exports it in alphabetical order.
6. **`__tests__/exports.test.ts`** asserts the exported surface exactly, name by name and by count,
   against the repository's `docs/h3-function-table.md`. Both files gain the new name.
7. **`parity/corpus.ts`** and `cpp/test/ParityProbe.cpp` add the operation to the h3-js comparison,
   unless it has no h3-js counterpart, in which case `docs/h3-js-divergences.md` says why.

## License

MIT. The vendored H3 C sources are Apache-2.0 and keep their own `LICENSE` and `NOTICE` under
`third_party/h3/`.
