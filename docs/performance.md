# 🧮 Performance Guide

> **Audience: package users.** This page carries the detail the README summarises: the exact
> contract of the batch calls, how the optional cell ceiling is sized, and what the async variants
> cost. Measured figures live in [benchmark.md](benchmark.md); this page explains the behaviour
> behind them.

## 📦 The Batch API in Detail

`latLngsToCells` and `cellsToLatLngs` run a scalar operation over a whole typed array in one native
call, for the workloads where per-call overhead dominates. They are not part of the `h3-js` parity
surface: `h3-js` exports no counterpart, which
[h3-js-divergences.md](h3-js-divergences.md#the-additive-batch-calls) records and a test asserts.

The saving is the crossing, not a faster inner loop. Host measurements put the native work of a
batch call within about 2 % of the native work of the loop it replaces, so what disappears is the
per-element boundary crossing.

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
- The cell ceiling below applies, counted in cells: one cell per pair.

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
- The cell ceiling below applies, counted in cells, and is checked before the first centre is read.

### When a Batch Call Pays

100,000 elements is a favourable size by construction. Below a few hundred, one crossing plus a
typed-array allocation is a larger share of the total, and that crossover is unmeasured. Building
the input `Float64Array` is not timed on either side either, so a caller who assembles one from
JavaScript objects pays for that on top. The measured rows are `W11` and `W12` in
[benchmark.md](benchmark.md).

## 🛡️ The Cell Ceiling in Detail

There is no cell limit until you set one: a call returns whatever you ask for, exactly as `h3-js`
does. Sizes grow fast, and a cell costs 8 bytes in the returned `BigUint64Array`.
`gridDisk(cell, k)` returns `1 + 3k(k+1)` cells, so `k` of 1,155 is 4,005,541 cells or 32 MB, and
`polygonToCells` over San Francisco at resolution 12 is 412,377.

A request keeps growing from there: `gridDisk(cell, 4000)` is 48,012,001 cells, 384 MB packed, and a
polygon covering a country at resolution 15 reports far more. On a mobile device an allocation at
that scale is not a slow call. It is a silent process kill that your JavaScript `try/catch` cannot
intercept. Set a cell ceiling and the request is refused before anything is allocated:

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

`configure({ maxCellCount: Infinity })` removes a ceiling set earlier. The value must be a positive
integer or `Infinity`, and it applies to every sync and async cell-producing function from the
moment it is set.

### How It Compares to h3-js

`h3-js` offers no equivalent setting; it only bounds its WebAssembly allocation at a massive 2 GB. A
heavy call there will just execute: `gridDisk(cell, 1155)` allocates all 4,005,541 cells,
[measured on a desktop machine in benchmark.md](benchmark.md#the-cost-of-unbounded-requests-what-the-cell-ceiling-guards).

## 🧵 Threading and the Async Variants

Four functions provide an async variant: `polygonToCellsAsync`, `cellsToMultiPolygonAsync`,
`polygonToCellsExperimentalAsync` and `uncompactCellsAsync`. Those are the only operations heavy
enough to cross Nitro's 50 ms rule of thumb, where a call starts costing visible frames.

Everything else is synchronous by design. A thread hop (context switch) often costs more time than
the H3 C library call it was meant to move off the main thread.

**Buffer safety.** An async variant copies any input cell set before work starts on the background
thread. The buffer you pass in is yours to reuse the moment the function returns, and the result is
identical to the one its synchronous sibling produces.

**Error parity.** Async variants throw the same errors, with the same messages and the same numeric
codes, as their synchronous siblings.

**What the hop costs.** On the iPhone XS, `polygonToCellsAsync` adds about 11 ms to the 234 ms
`polygonToCells` call, while `uncompactCellsAsync` is indistinguishable from its synchronous sibling
at 3.8 ms. On the Galaxy S23 the same hop costs about 68 ms on a 176 ms call, and 1.4 ms on a 3.5 ms
one. The rows are `W3` and `W8` in [benchmark.md](benchmark.md).

## 🚨 Error Handling in Detail

Every function throws a dedicated `H3Error`. When a failure originates from the native H3 library,
the message is pulled directly from C++ (`describeH3Error`) and includes the exact numeric code,
matching `h3-js` 1:1.

- **Native codes.** Standard H3 errors append `(code: N)` to the message and expose the `.code`
  property.
- **Binding exceptions.** Errors this package raises itself, before the call reaches the H3 C
  library (argument validation such as a non-integer resolution, or a breach of a configured cell
  ceiling), also throw `H3Error`, but leave the `.code` property `undefined`.
- **Async parity.** Async variants throw the exact same errors and messages as their synchronous
  siblings.

Every deliberate divergence from `h3-js`, including the strict validation this package applies at
the C++ boundary, is listed with the `h3-js` answer beside it and proved by a test in
[h3-js-divergences.md](h3-js-divergences.md).
