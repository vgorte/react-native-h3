# 📊 Performance Benchmarks

The README highlights four workloads and the widest measured speedup factor. This document serves as
the comprehensive deep dive. It details exactly what was measured, how the tests were conducted, the
exact hardware and software environment, and how you can reproduce these numbers yourself.

### 🗄️ Source of Truth & Reproducibility

Transparency is core to these benchmarks. The absolute source of truth for all data below is the raw
output file: `apps/example/benchmark.json`.

- The visual chart (`img/benchmark.svg`) is automatically rendered from this data by running
  `bun run benchmark:svg`.
- Every figure, median, and percentile in this document is read off that file; the chart is the only
  artefact generated from it. The run conditions under Test Environment & Conditions are the
  exception: they are recorded from the device during the run, because the payload does not carry
  them.

## 🔬 Methodology

To ensure apples-to-apples comparisons, both libraries (`react-native-h3` and `h3-js`) are imported
into the exact same Benchmark screen (`apps/example/src/BenchmarkScreen.tsx`). They run inside the
same app, the same Hermes instance, against the exact same inputs, just seconds apart. Nothing is
compared across different processes, machines, or days.

### 1. Execution Strictness

- **Release Builds Only:** A Debug build slows the native side several times over, so its numbers
  are not comparable. The screen reads `__DEV__` and records `Debug` or `Release` in the payload,
  and `bun run benchmark:svg` refuses a Debug payload.
- **Detailed Telemetry:** The payload records `measuredOn` metadata (platform, OS, React Native and
  Hermes versions, h3-js version, date, warm-up count, duration) written by the screen, not by hand.

### 2. The Measurement Loop

Each workload is timed using the following sequence:

- **Warm-up:** One untimed warm-up pass so neither library pays the initialisation cost of its first
  call.
- **Timed Passes:** 20 timed passes for most workloads. (Exceptions: `W3` and `W2d` get three
  passes, as a single `h3-js` run of either takes seconds; `W0` takes 1,000 passes of one call.)
- **Event Loop Yielding:** Between samples, the thread yields to the event loop. This prevents the
  app from freezing during minutes-long runs. The pause occurs strictly outside the timed windows.
  (Exception: `W0` yields every hundredth sample, because a macrotask costs more than the single
  call it would separate.)
- **Statistical Aggregation:** The published figure is the median (the upper of the two middle
  samples on an even count). The p95 (by nearest rank, the 19th sample out of 20), minimum, and
  maximum are recorded beside it. A `W0` sample is one call, so its median and p95 describe a single
  call rather than a pass.

### 3. Strict Equivalence Validation

Speed means nothing if the answer is wrong. Result equivalence is checked outside the timed loop,
from the warm-up value or a fresh untimed pass:

- **Cells:** Compared as sorted, lowercase hexadecimal strings (the only representation both
  libraries can be brought to without timing the conversion).
- **Coordinates and Boundaries:** Compared component by component with a tolerance of `1e-9`
  degrees.
- **Order:** Sorted for a set of cells, in order for `W10`, where the path is the answer.
- **Async Parity:** The async `W3` and `W8` rows have no `h3-js` counterpart, so their output is
  validated against the synchronous result of the same workload.

> **Note:** A run that fails validation is marked `RESULTS DIFFER FROM h3-js` in the screen's
> caption and must not be published.

### 4. Chart & Headline Rules

The widest factor in the published payload is `W4`'s 375.6×, and the README names it as what it is:
one figure, measured on one device on one day.

- **What the Number Means:** `W4` runs in 0.085 ms, where `h3-js` needs 31.9 ms for the same
  answer. At that scale `h3-js` spends almost all of its time marshalling the 1,261 cells of the
  disk across the Emscripten boundary as hexadecimal strings, rather than doing H3 work. That
  marshalling is the cost this package removes, so the row belongs in the chart, but it says more
  about the boundary than about `compactCells`.
- **Paired Bars:** `img/benchmark.svg` shows the four README workloads (`W1`, `W3`, `W4` and `W7`)
  as paired bars, `react-native-h3` above `h3-js`, each pair scaled linearly so the `h3-js` bar
  spans the full width. The remaining workloads are in the table below.
- **Where the Headline Comes From:** `bun run benchmark:svg` prints the widest factor of a payload
  as a `HEADLINE` line; the screen reports rows and their per-row factors and nothing else. Which
  factor deserves a headline is a judgement made when the numbers are published, not by the app that
  measures them.

### 5. The Workload Ids

The screen measures every id below, and the table under Detailed Results publishes all of them. The
README rests on four; the rest keep those four in context.

| Id | Workload |
|---|---|
| `W0` | `latLngToCell`, one call per sample over 1,000 distinct coordinates: the map tap, where no batch hides the cost of a single crossing |
| `W1` | `latLngToCell`, 100,000 calls per pass |
| `W2` | `gridDisk(k=20)`, 1,000 calls per pass |
| `W2a` to `W2d` | the same loop at `k` of 1, 5, 10 and 50, so the factor can be read against the work one call does |
| `W3` | `polygonToCells` over San Francisco at res 12, synchronous and async |
| `W4` | `compactCells` of a `k=20` disk |
| `W5` | `cellsToMultiPolygon` of a `k=20` disk |
| `W6` | `cellToLatLng`, 100,000 calls over the cells of a `k=20` disk |
| `W7` | `cellToBoundary`, 100,000 calls over the cells of a `k=20` disk |
| `W8` | `uncompactCells` of the compacted res 9 San Francisco polygon, synchronous and async |
| `W9` | `cellToChildren`, from a res 5 cell over San Francisco to res 10 |
| `W10` | `gridPathCells`, Berlin to Hamburg at res 9, 1,000 calls per pass |

`W8` sizes its result with `cellToChildrenSize` before the run and targets the highest resolution
that stays under the Cell Ceiling, so the row label names the resolution actually measured.

## 📈 Detailed Results

All timing figures represent the median execution time in milliseconds. The speedup factor is the
`h3-js` median divided by the `react-native-h3` median.

| Workload | react-native-h3 | h3-js | Speedup | p95 (RN) | p95 (JS) | Eq. | Detail |
|---|---:|---:|---:|---:|---:|:-:|---|
| **W0:** `latLngToCell` (per call) | **0.0038 ms** | 0.0292 ms | **7.7×** | 0.0053 ms | 0.0309 ms | ✅ | 1,000 distinct inputs, 0.0002 ms baseline subtracted |
| **W1:** `latLngToCell` (100k) | **76.3 ms** | 937.0 ms | **12.3×** | 76.5 ms | 945.7 ms | ✅ | Returns `89283082803ffff` |
| **W2:** `gridDisk(k=20)` (1,000×) | **22.1 ms** | 2,368.0 ms | **107.2×** | 29.8 ms | 2,507.0 ms | ✅ | 1,261 cells per call |
| **W2a:** `gridDisk(k=1)` (1,000×) | **2.0 ms** | 17.5 ms | **8.6×** | 2.6 ms | 20.4 ms | ✅ | 7 cells per call |
| **W2b:** `gridDisk(k=5)` (1,000×) | **4.4 ms** | 188.6 ms | **42.8×** | 5.7 ms | 189.9 ms | ✅ | 91 cells per call |
| **W2c:** `gridDisk(k=10)` (1,000×) | **9.7 ms** | 678.2 ms | **70.2×** | 12.6 ms | 681.8 ms | ✅ | 331 cells per call |
| **W2d:** `gridDisk(k=50)` (1,000×) | **149.0 ms** | 16,343.6 ms | **109.7×** | 150.1 ms | 16,348.7 ms | ✅ | 7,651 cells per call |
| **W3:** `polygonToCells` (SF, res 12) | **231.8 ms** | 31,179.7 ms | **134.5×** | 237.0 ms | 31,191.9 ms | ✅ | 412,377 cells |
| **W3:** `polygonToCellsAsync` (SF, res 12) | **262.5 ms** | n/a | n/a | 273.6 ms | n/a | ✅ | 412,377 cells |
| **W4:** `compactCells` (k=20 disk) | **0.085 ms** | 31.9 ms | **375.6×** | 0.111 ms | 34.8 ms | ✅ | 1,261 cells in, 163 cells out |
| **W5:** `cellsToMultiPolygon` (k=20 disk) | **1.9 ms** | 162.7 ms | **86.4×** | 2.0 ms | 164.2 ms | ✅ | 1 polygon |
| **W6:** `cellToLatLng` (100k) | **112.6 ms** | 698.3 ms | **6.2×** | 113.2 ms | 700.7 ms | ✅ | Over 1,261 distinct cells |
| **W7:** `cellToBoundary` (100k) | **346.6 ms** | 2,020.8 ms | **5.8×** | 347.3 ms | 2,572.2 ms | ✅ | Over 1,261 distinct cells |
| **W8:** `uncompactCells` (SF res 9 to res 12) | **3.3 ms** | 755.0 ms | **228.5×** | 3.6 ms | 836.2 ms | ✅ | 190 cells in, 410,914 cells out |
| **W8:** `uncompactCellsAsync` (SF res 9 to res 12) | **4.5 ms** | n/a | n/a | 5.6 ms | n/a | ✅ | 190 cells in, 410,914 cells out |
| **W9:** `cellToChildren` (res 5 to res 10) | **0.122 ms** | 29.5 ms | **241.2×** | 0.220 ms | 30.9 ms | ✅ | 16,807 children of `85283083fffffff` |
| **W10:** `gridPathCells` (Berlin to Hamburg, res 9, 1,000×) | **209.7 ms** | 7,374.1 ms | **35.2×** | 214.6 ms | 7,448.8 ms | ✅ | 914 cells per path |

> **📉 Rows Under 10 Milliseconds:** `W0`, `W2a` to `W2c`, `W4`, `W5`, `W8` and `W9` finish in under
> ten milliseconds on the native side, and every figure here is a single run. Repeating the run on
> the same device with the same build moved the factors of those rows by up to half; the rows in the
> hundreds of milliseconds moved considerably less. Read a factor as an order of magnitude, not as a
> constant.

> **🧵 The Cost of a Thread Hop:** `polygonToCellsAsync` has no `h3-js` counterpart. `h3-js` does
> not offer async variants, and timing its synchronous call as if it were async would skew the
> comparison. Instead, this row documents the cost of offloading work to a background thread: about
> 31 ms on the 232 ms `W3` call, and about 1.2 ms on the 3.3 ms `W8` call.

## 📋 Test Environment & Conditions

These benchmarks are hand-run on a physical phone in a Release build before a release. CI does not
produce these figures: an emulator on a shared runner says nothing about a phone.

- **Device:** Samsung Galaxy S23 (`SM-S911U1`), Qualcomm `kalama`
- **Platform:** Android 16, API 36
- **Build Type:** Release
- **React Native:** 0.87.0
- **JS Engine:** Hermes 250829098.0.16
- **Target:** `h3-js` 4.5.0 (the same H3 v4.5.0 C core this package vendors)
- **Date:** 2026-08-29
- **Duration:** 540.2 seconds (total run time)
- **Passes:** 1 warm-up pass, followed by 20 timed runs per workload (3 for the two `W3` rows and
  `W2d`, 1,000 single calls for `W0`)
- **Power:** charging over USB throughout, the screen on and the Benchmark tab in the foreground,
  nothing else touched on the device

Two conditions are worth naming because they shape the numbers above:

- **Thermal:** the phone entered the run at `Thermal Status: 0` after a 13-minute cooldown and
  crossed to `THERMAL_STATUS_LIGHT` 4 minutes 10 seconds in, where it stayed until the end. Roughly
  the second half of the run is therefore throttled, and the workloads are timed in the order the
  table lists them.
- **First workload:** `W0` runs first, on a phone that had been idle for those 13 minutes, and it
  times a single call rather than a pass. Both of its medians, the native one and the `h3-js` one,
  are single-sample figures measured from that state.

## 💥 The Cost of Unbounded Requests (What the Cell Ceiling Guards)

Neither library caps a request by default. `h3-js` bounds only its own WebAssembly allocation at
2 GB, building JavaScript arrays of hexadecimal strings on top of it without a bound, and it offers
no setting to change that. `react-native-h3` allocates whatever is asked for too, until
`configure({ maxCellCount })` sets a Cell Ceiling; from then on an oversized request is refused
before anything is allocated.

To show what an unbounded request costs, the numbers below come from hardware far larger than a
phone (Apple M5 Pro, 24 GB RAM, macOS 26.5.2, bun 1.3.14, from
`latLngToCell(37.7749, -122.4194, 9)`, measured 2026-08-28):

| Call | Cells | Packed Size | Wall Clock |
|---|---:|---:|---:|
| `gridDisk(cell, 2000)` | 12,006,001 | 96 MB | 1.14 s |
| `gridDisk(cell, 4000)` | 48,012,001 | 384 MB | 6.16 s |

**Context:** "Packed size" is the memory footprint if those cells were stored as 64-bit integers
(8 bytes each). As an array of hexadecimal strings in `h3-js` they cost considerably more, which is
where the wall-clock time is largely spent. `gridDisk(cell, 8000)` (192,024,001 cells) was not run:
the array of strings it builds forces even an M5 Pro into swap.

> **⚠️ The Mobile Reality:** A phone has neither that memory nor those seconds to spare, and the
> allocation happens inside the app's own heap. When it fails, the OS kills the process; no
> JavaScript `try/catch` sees it. That is exactly what a Cell Ceiling guards against:
> `react-native-h3` sizes every result up front, so a ceiling can refuse the request with a
> catchable `H3Error`.

## 🔄 Regenerating the Benchmarks

To reproduce these numbers yourself:

### 1. Build and Run

Build the example app in Release mode and open the Benchmark screen. Press **Run benchmark**. The
run takes about nine minutes on a Galaxy S23; the screen stays usable between samples, but each
`h3-js` `W3` pass blocks the JavaScript thread for roughly half a minute.

### 2. Extract the Payload

When finished, the screen prints a Markdown table to the log, then a caption naming the platform,
the build type and the versions, then the raw JSON payload.

Because the iOS unified log truncates a message at about a kilobyte, the payload is chunked into
lines of the form:

```text
BENCHMARK_JSON <i>/<total> |<chunk>|
```

The chunking does not depend on the platform, so an Android run prints the same lines to `logcat`.

**Note:** The `|` bars pin both edges of each chunk, because the log trims outer whitespace. Take
the text between the bars, in numerical order, and concatenate it with nothing in between.

### 3. Process and Validate

Save the concatenated result as `apps/example/benchmark.json` (pretty-printed with 2 spaces). Then
run:

```sh
bun run benchmark:svg
```

The script validates the JSON (and refuses a `Debug` payload), renders the paired-bar chart
(`img/benchmark.svg`), and prints the widest factor of the payload as a `HEADLINE` line.

### 4. Publish

Put that factor in the README's Benchmarks section, beside the device and the date, and update the
four published rows and the methodology note from the new JSON. Update this document's results table
and conditions from the same file.

> **🛑 Pre-Flight Check:** Before publishing, check the caption. If it says `Debug` or carries a
> `RESULTS DIFFER FROM h3-js` warning, the run is compromised and must not be published.
