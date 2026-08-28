# 📊 Performance Benchmarks

The README highlights the three most critical workloads and the headline speedup factor. This
document serves as the comprehensive deep dive. It details exactly what was measured, how the tests
were conducted, the exact hardware and software environment, and how you can reproduce these numbers
yourself.

### 🗄️ Source of Truth & Reproducibility

Transparency is core to these benchmarks. The absolute source of truth for all data below is the raw
output file: `apps/example/benchmark.json`.

- The visual chart (`img/benchmark.svg`) is automatically rendered from this data by running
  `bun run benchmark:svg`.
- Every figure, median, and percentile in this document is read off that file; the chart is the only
  artefact generated from it.

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
- **Timed Passes:** 20 timed passes for most workloads. (Exception: `W3` gets three passes, as a
  single `h3-js` run takes about 20 seconds.)
- **Event Loop Yielding:** Between samples, the thread yields to the event loop. This prevents the
  app from freezing during minutes-long runs. The pause occurs strictly outside the timed windows.
- **Statistical Aggregation:** The published figure is the median (the upper of the two middle
  samples on an even count). The p95 (by nearest rank, the 19th sample out of 20), minimum, and
  maximum are recorded beside it.

### 3. Strict Equivalence Validation

Speed means nothing if the answer is wrong. Result equivalence is checked outside the timed loop
using the value from the warm-up pass:

- **Cells:** Compared as sorted, lowercase hexadecimal strings (the only representation both
  libraries can be brought to without timing the conversion).
- **Coordinates and Boundaries:** Compared component by component with a tolerance of `1e-9`
  degrees.
- **Async Parity:** The async `W3` row has no `h3-js` counterpart, so its output is validated
  against the synchronous `W3` result.

> **Note:** A run that fails validation is marked `RESULTS DIFFER FROM h3-js` in the screen's
> caption and must not be published.

### 4. Chart & Headline Rules

Workload `W4` shows a 1,464× speedup. It (and `W5`) are excluded from the headline factor on
purpose.

- **The 1-Millisecond Floor:** `W4` executes in 0.014 ms and `W5` in 0.358 ms. At sub-millisecond
  scales, `h3-js` spends almost all its time marshalling 1,261 cells across the Emscripten boundary
  as hexadecimal strings, rather than doing H3 work.
- **Headline Integrity:** The headline speedup (260×) is the largest factor above the 1 ms floor
  (`W3`'s 269×), rounded down to the nearest ten.
- **Paired Bars:** `img/benchmark.svg` shows the three README workloads as paired bars,
  `react-native-h3` above `h3-js`, each pair scaled linearly so the `h3-js` bar spans the full
  width. The remaining workloads are in the table below.

## 📈 Detailed Results

All timing figures represent the median execution time in milliseconds. The speedup factor is the
`h3-js` median divided by the `react-native-h3` median.

| Workload | react-native-h3 | h3-js | Speedup | p95 (RN) | p95 (JS) | Eq. | Detail |
|---|---:|---:|---:|---:|---:|:-:|---|
| **W1:** `latLngToCell` (100k) | **33.0 ms** | 700.5 ms | **21×** | 33.1 ms | 718.0 ms | ✅ | Returns `89283082803ffff` |
| **W2:** `gridDisk(k=20)` (1,000×) | **12.2 ms** | 1,613.5 ms | **132×** | 12.9 ms | 1,636.2 ms | ✅ | 1,261 cells per call |
| **W3:** `polygonToCells` (SF, res 12) | **76.1 ms** | 20,444.3 ms | **269×** | 76.9 ms | 20,467.3 ms | ✅ | 412,377 cells |
| **W3:** `polygonToCellsAsync` (SF, res 12) | **78.6 ms** | n/a | n/a | 84.0 ms | n/a | ✅ | 412,377 cells |
| **W4:** `compactCells` (k=20 disk) | **0.014 ms** | 20.3 ms | **1,464×** | 0.018 ms | 20.8 ms | ✅ | 163 cells |
| **W5:** `cellsToMultiPolygon` (k=20 disk) | **0.358 ms** | 103.8 ms | **290×** | 0.387 ms | 111.3 ms | ✅ | 1 polygon |
| **W6:** `cellToLatLng` (100k) | **33.2 ms** | 405.1 ms | **12×** | 33.3 ms | 417.3 ms | ✅ | Over 1,261 distinct cells |
| **W7:** `cellToBoundary` (100k) | **110.3 ms** | 1,138.6 ms | **10×** | 111.2 ms | 1,151.0 ms | ✅ | Over 1,261 distinct cells |

> **🧵 The Cost of a Thread Hop:** `polygonToCellsAsync` has no `h3-js` counterpart. `h3-js` does
> not offer async variants, and timing its synchronous call as if it were async would skew the
> comparison. Instead, this row documents the cost of offloading work to a background thread: on a
> 76 ms call, the thread hop costs about 2.4 ms.

## 📋 Test Environment & Conditions

These benchmarks are hand-run on a Release build before a release. CI does not produce these
figures: an emulator on a shared runner says nothing about a phone.

- **Platform:** iOS 26.5
- **Build Type:** Release
- **React Native:** 0.87.0
- **JS Engine:** Hermes 250829098.0.16
- **Target:** `h3-js` 4.5.0 (the same H3 v4.5.0 C core this package vendors)
- **Date:** 2026-08-28
- **Duration:** 171.1 seconds (total run time)
- **Passes:** 1 warm-up pass, followed by 20 timed runs per workload (3 for the two `W3` rows)

## 💥 The Cost of Unbounded Requests (Why the Cell Ceiling Exists)

The Cell Ceiling this package applies has no counterpart in `h3-js`. `h3-js` bounds only its own
WebAssembly allocation at 2 GB, building JavaScript arrays of hexadecimal strings on top of it
without a bound.

To show what an unbounded request costs, we ran the following on hardware far larger than a phone
(Apple M5 Pro, 24 GB RAM, macOS 26.5.2, bun 1.3.14, from `latLngToCell(37.7749, -122.4194, 9)`,
measured 2026-08-28):

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
> JavaScript `try/catch` sees it. That is exactly why `react-native-h3` sizes every result up front
> and enforces a Cell Ceiling.

## 🔄 Regenerating the Benchmarks

To reproduce these numbers yourself:

### 1. Build and Run

Build the example app in Release mode and open the Benchmark screen. Press **Run benchmark**. The
run takes about three minutes; the screen stays usable between samples, but each `h3-js` `W3` pass
blocks the JavaScript thread for roughly 20 seconds.

### 2. Extract the Payload

When finished, the screen prints a Markdown table to the log, then a caption naming the platform,
the build type and the versions, then the raw JSON payload.

Because the iOS unified log truncates a message at about a kilobyte, the payload is chunked into
lines of the form:

```text
BENCHMARK_JSON <i>/<total> |<chunk>|
```

**Note:** The `|` bars pin both edges of each chunk, because the log trims outer whitespace. Take
the text between the bars, in numerical order, and concatenate it with nothing in between.

### 3. Process and Validate

Save the concatenated result as `apps/example/benchmark.json` (pretty-printed with 2 spaces). Then
run:

```sh
bun run benchmark:svg
```

The script validates the JSON (and refuses a `Debug` payload), renders the paired-bar chart
(`img/benchmark.svg`), and prints the final `HEADLINE` speedup factor.

### 4. Publish

Put the headline in the README's Benchmarks section and update the three published rows and the
methodology note from the new JSON. Update this document's results table and conditions from the
same file.

> **🛑 Pre-Flight Check:** Before publishing, check the caption. If it says `Debug` or carries a
> `RESULTS DIFFER FROM h3-js` warning, the run is compromised and must not be published.
