# 🧮 Performance Guide

> **Audience: package users.** This page carries the detail the README summarises: the exact
> contract of the batch calls, how the optional cell ceiling is sized, and what the async variants
> cost. Measured figures live in [benchmark.md](benchmark.md); this page explains the behaviour
> behind them.

## 📦 When a Batch Call Pays

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
