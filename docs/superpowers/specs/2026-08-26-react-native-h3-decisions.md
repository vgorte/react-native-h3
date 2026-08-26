# react-native-h3: design decisions so far

Status: **pre-design**. These are the inputs and locked decisions from the brainstorming session of
2026-08-26. The actual design document does not exist yet. Nothing has been implemented.

## Why this package exists

Uber's H3 is hexagonal hierarchical geospatial indexing. The only JS option, `h3-js`, is not a
binding: it is the C library transpiled to plain JavaScript by Emscripten. `dist/h3-js.js` is 539 KB
of generated code with an emulated linear-memory heap, and it represents every cell as a hex string
(`export type H3Index = string`) because JS numbers cannot hold 64 bits.

`react-native-h3` does not exist on npm under any name. `h3-js` does 1,186,543 downloads a week,
though most of that is server-side Node, so treat it as an upper bound on the RN audience rather than
as the audience.

Full gap research: `/Users/v/Projects/rn-gap-research/` (`SUMMARY.md`, `IDEAS.md`, `findings/`).

## Benchmark that justified building it

Measured 2026-08-26 on RN 0.87.0, New Architecture, Release build with Hermes bytecode, iPhone 17 Pro
simulator on iOS 26.5, host M5 Pro. Both implementations ran in the same app, same Hermes instance,
same run. Full report: `/Users/v/Projects/rn-gap-research/spike-h3-benchmark.md`.

| Workload | h3-js | native, hex strings | native, packed BigUint64Array |
|---|---|---|---|
| W1 `latLngToCell` x 100,000 | 890.9 ms | 39.0 ms (22.8x) | 31.4 ms bulk (28.4x) |
| W2 `gridDisk(k=20)` x 1,000 | 1,786.0 ms | 92.1 ms (19.4x) | 13.0 ms (**137.8x**) |
| W3 `polygonToCells`, SF, res 12, 412,459 cells | **22,903.8 ms** | 129.7 ms (176.6x) | **97.0 ms (236.2x)** |

Size ledger: removes about 297 KB of shipped Hermes bytecode, adds 51 KB of machine code.

Three conclusions that drive the design:

1. W3 carries the argument. 22.9 seconds to 97 ms is the difference between a feature being
   impossible on device and being instant.
2. W2 proves the API shape matters as much as the binding: returning `BigUint64Array` instead of hex
   strings is another **7.1x** on top of the native win, and that gap is entirely under our control.
   Do not mimic the `h3-js` string API in the core.
3. JSI per-call overhead is not the constraint on this engine. Even 100,000 individual host-function
   calls that each allocate a JS string beat `h3-js` by 22.8x, and bulking only adds 1.24x.

Correction to an earlier assumption, recorded so it is not repeated: the `utf-16le` Hermes crash
(h3-js issue #203, open since 2025-03-13) does **not** reproduce on stock RN 0.87. An in-app probe
printed `typeof TextDecoder === "undefined"`, so Hermes still has no TextDecoder and the Emscripten
guard short-circuits. The issue is latent, not fixed: any TextDecoder polyfill without utf-16le
support re-arms it. It is a footnote about the fragility of the Emscripten approach, not a headline.

Caveats the spike did not cover: simulator rather than a physical device, and the Android side was
never touched.

## Locked decisions

1. **Nitro Modules** as the foundation. Chosen because the measurement rewards exactly what Nitro
   does well, synchronous calls and zero-copy `ArrayBuffer`. Price: requires the New Architecture.
2. **Native-first API with a compat layer.** The core returns `bigint` for a single cell and
   `BigUint64Array` for cell sets. `cellToString` / `cellFromString` convert for display, JSON and
   server round-trips. A separate `react-native-h3/compat` entry point provides the `h3-js`
   signatures for people migrating.
3. **Full parity: 54 functions.** Everything `h3-js` exports except `h3IndexToSplitLong` and
   `splitLongToH3Index`, which exist only to work around the lack of 64-bit integers in JS and are
   made obsolete by `bigint`. Partial coverage would break the promise of the compat layer.
4. **No web implementation.** `index.web.ts` throws a clear error at import time pointing to `h3-js`,
   and the README says so near the top. Apps with a web target bridge the difference themselves.
5. **Package name: `react-native-h3`**, not `react-native-nitro-h3`. Verified free on npm on
   2026-08-26. Reasoning: the `react-native-nitro-*` prefix is, in practice, a disambiguator used
   where a non-Nitro incumbent already exists (nitro-fetch, nitro-sound, nitro-websockets,
   nitro-text-decoder, nitro-google-signin). There is no RN predecessor for H3 to disambiguate from,
   and Margelo's own canonical packages do not carry it (`react-native-mmkv` is Nitro-based since v3,
   `react-native-vision-camera` likewise, `react-native-fast-tflite` says "built with Nitro Modules"
   in its description but is not named for it). Nitro is an implementation choice, not a product
   feature, and a name that encodes it ages badly. The New Architecture requirement is communicated
   in the README header, in `peerDependencies`, and in a legible runtime error when Nitro is absent.

## Open, proposed but NOT yet approved

**How the 54 functions get bound.** Three options were put to the user:

- A: hand-written, function by function. Explicit, but repeats the dangerous parts (buffer sizing,
  error codes, memory ownership) 54 times.
- B: a full generator parsing `h3api.h`. The generator becomes the product; overkill for 54 stable
  functions.
- C (**proposed**): a shape-based binding table. The 54 functions fall into about eight recurring
  signature shapes; each shape gets exactly one C++ template that solves conversion, `H3Error`
  handling and result-buffer ownership once. Each function is then a declaration in a table.

  ```
  1  (lat, lng, res)      -> cell
  2  (cell)               -> cell
  3  (cell)               -> number | boolean
  4  (cell)               -> LatLng
  5  (cell)               -> LatLng[]            boundary
  6  (cell, k)            -> BigUint64Array      size via maxGridDiskSize
  7  (BigUint64Array)     -> BigUint64Array      size computed up front
  8  (polygon, res)       -> BigUint64Array      size via maxPolygonToCellsSize
  ```

The user had not answered this when the session ended.

## Design sections still to write

1. Package structure and build (monorepo layout, how the h3 C sources are vendored and pinned,
   CMake and Android prefab, XCFramework or source build on iOS, binary size budget).
2. Public TypeScript API and error behavior (`H3Error` carrying the numeric code, validation at the
   boundary, what `bigint` means for consumers, the `/compat` surface).
3. Test strategy (parity tests against `h3-js` as the oracle, the h3 C test vectors, pentagon edge
   cases, memory and leak checks, the benchmark as a regression gate).
4. CI and release mechanics (build matrix, New Architecture matrix, release-it, provenance).

## Process notes

- Follow the vendored Margelo skills in `.claude/skills/`: `api-design` for the public TypeScript
  shape first, then `build-nitro-modules` for Nitrogen specs, native implementation and publishing,
  with `cpp` for ownership and file boundaries. `swift` and `kotlin` were deliberately not vendored
  because this package is expected to be pure C++ over Nitro.
- The brainstorming skill's architectural path applies: present the design in sections, get approval
  per section, then write the real spec next to this file, then move to writing-plans. No code before
  a design is approved.
- Package name is settled, see locked decision 5.
- H3 upstream: Apache-2.0, uber/h3 pushed 2026-08-20, 6,490 stars. Match the license or document why
  not.
