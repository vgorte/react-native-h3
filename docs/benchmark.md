# Benchmark

The README publishes three rows and one headline factor. This document holds the rest: what was
measured, how, on what, and how to produce the numbers again.

`apps/example/benchmark.json` is the source of truth. The chart in `img/benchmark.svg` is rendered
from it by `bun run benchmark:svg`, and every figure below is read off the same file.

## Methodology

The example app has a Benchmark screen, `apps/example/src/BenchmarkScreen.tsx`. It imports both
`react-native-h3` and `h3-js`, so the two run inside the same app, the same Hermes instance and the
same run, over the same inputs, seconds apart. Nothing is compared across processes, machines or
days.

Each workload is timed like this:

- One untimed warm-up pass, so neither side pays for its first call.
- `N` timed passes: 20 for every workload except `W3`, which gets three, because a single
  `polygonToCells` over San Francisco costs h3-js roughly 20 seconds.
- The median of those passes is the published figure. The p95, the minimum and the maximum are
  recorded beside it. The median takes the upper of the two middle samples on an even count, and the
  p95 is by nearest rank, so on 20 samples it is the nineteenth, not the maximum.

Result equivalence is checked outside the timed loop, on the value the untimed warm-up pass
returned, so the check never enters a measurement. Cells are compared as sorted lowercase
hexadecimal strings, which is the only representation both libraries can be brought to without
timing the conversion; coordinates and boundaries are compared component by component with a
tolerance of `1e-9` degrees. The async `W3` row has no h3-js counterpart, so it is compared against
the synchronous row's own result instead. A row that fails its check is marked in the screen's
caption in capitals, and such a run must not be published.

Only a Release build counts. A Debug build is several times slower for the native side and its
numbers are not comparable with the h3-js column measured beside them. The screen reads `__DEV__`
and records `Debug` or `Release` in the payload, so a Debug run cannot be mistaken for a real one
after the fact.

`measuredOn` records the platform, the OS version, the build type, the React Native version, the
Hermes version, the h3-js version, the date, the number of warm-up runs, and how long the whole run
took in seconds. It is written by the screen, not by hand.

Two rows are excluded from the chart's headline rule. `W4` finishes in 0.014 ms and `W5` in
0.358 ms, both under the rule's one millisecond floor. At that scale the factor no longer measures
the work: h3-js spends nearly all of it marshalling a 1,261 cell input and its output across the
emscripten boundary as hexadecimal strings, so `W4`'s 1,464× says more about string conversion than
about `compactCells`. The headline is taken from the largest factor among the rows above the floor,
rounded down to the nearest ten, which is why it reads 260× and not 269×.

Bar length in `img/benchmark.svg` is logarithmic. The fastest workload is over a hundred times the
factor of the slowest, and on a linear axis everything below the top bar collapses into a stub.

## Results

Every figure is a median in milliseconds. `Speedup` is the `h3-js` median divided by the `react-native-h3` median.

| Workload | react-native-h3 | h3-js | Speedup | p95, react-native-h3 | p95, h3-js | Equivalent | Detail |
|---|---:|---:|---:|---:|---:|:-:|---|
| W1 `latLngToCell` x 100,000 | 33.0 ms | 700.5 ms | 21× | 33.1 ms | 718.0 ms | yes | `89283082803ffff` |
| W2 `gridDisk(k=20)` x 1,000 | 12.2 ms | 1,613.5 ms | 132× | 12.9 ms | 1,636.2 ms | yes | 1,261 cells per call |
| W3 `polygonToCells`, SF, res 12 | 76.1 ms | 20,444.3 ms | 269× | 76.9 ms | 20,467.3 ms | yes | 412,377 cells |
| W3 `polygonToCellsAsync`, SF, res 12 | 78.6 ms | n/a | n/a | 84.0 ms | n/a | yes | 412,377 cells |
| W4 `compactCells` of a k=20 disk | 0.014 ms | 20.3 ms | 1,464× | 0.018 ms | 20.8 ms | yes | 163 cells |
| W5 `cellsToMultiPolygon` of a k=20 disk | 0.358 ms | 103.8 ms | 290× | 0.387 ms | 111.3 ms | yes | 1 polygon |
| W6 `cellToLatLng` x 100,000 | 33.2 ms | 405.1 ms | 12× | 33.3 ms | 417.3 ms | yes | 100,000 calls over 1,261 distinct cells |
| W7 `cellToBoundary` x 100,000 | 110.3 ms | 1,138.6 ms | 10× | 111.2 ms | 1,151.0 ms | yes | 100,000 calls over 1,261 distinct cells |

`polygonToCellsAsync` has no h3-js counterpart: h3-js has no async variant, and timing its
synchronous call as if it were one would compare different things. The row is here to show what the
thread hop costs, which is 2.4 ms on a 76 ms call.

### Conditions

- Platform: iOS 26.5
- Build: Release
- React Native 0.87.0, Hermes 250829098.0.16
- h3-js 4.5.0, the same H3 C version this package vendors, v4.5.0
- Date: 2026-08-28
- One warm-up pass, then 20 timed runs per workload, three for the two `W3` rows
- Whole run: 171.1 seconds

CI does not produce these figures. They come from a hand-run Release build and are refreshed before
a release.

## Regenerating

1. Build the example app in Release and open the Benchmark screen. The run takes about three
   minutes and the app is unresponsive throughout, because h3-js alone needs roughly 20 seconds for
   each of its `W3` passes.
2. Press `Run benchmark`. When it finishes, the screen prints a Markdown table with the columns
   `Workload | react-native-h3 | h3-js | Equivalent | Result`, then a caption naming the platform,
   the build type and the versions, and then the payload.
3. Collect the payload from the log. It arrives as lines of the form
   `BENCHMARK_JSON <i>/<total> |<chunk>|`, because the iOS unified log truncates a message at about
   a kilobyte. The bars pin both edges of each chunk: the log trims outer whitespace, so without
   them a chunk could lose characters. Take the text between the bars, in the order the numbering
   gives, and concatenate it with nothing in between.
4. Save the result as `apps/example/benchmark.json`, pretty-printed with two spaces.
5. Run `bun run benchmark:svg`. It validates the JSON, rewrites `img/benchmark.svg`, and prints one
   line beginning `HEADLINE`.
6. Put that headline in the README's Benchmark section and update the three published rows and the
   provenance sentence from the new JSON. Update this document's table and conditions from the same
   file.

Check the caption before publishing anything: if it says `Debug` or carries a
`RESULTS DIFFER FROM h3-js` warning, the run is not publishable.
