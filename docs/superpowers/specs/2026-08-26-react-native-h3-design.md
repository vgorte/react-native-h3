# react-native-h3: design

Status: **approved design**. Written 2026-08-26, section by section, with approval per section.
Supersedes and amends `2026-08-26-react-native-h3-decisions.md`, which remains the record of why the
package exists and of the benchmark that justified it. Nothing is implemented yet. The next step is
an implementation plan, not code.

## 1. What changed since the pre-design document

Three of the five locked decisions survive unchanged. Two were amended, and both amendments came from
verifying claims against current sources rather than from a change of mind.

**Amended: no `/compat` entry point.** The pre-design document locked a second entry point mirroring
the `h3-js` named exports over hex strings. Dropped. There is no Nitro precedent for it, and the
comparison that motivated it does not hold: `fetch` is a global with one standardized signature, so
`react-native-nitro-fetch` replaces an incumbent in place and has nothing to be compatible *with* at
the import level. `h3-js` is a named-export library, so a compat surface would roughly double the
public API, drag hex strings back into an API whose entire measured advantage came from not using
them (the 7.1x in W2), and require its own parity suite to be worth the promise.

Consequence, recorded so it is not rediscovered: locked decision 3 justified full parity partly as
"partial coverage would break the promise of the compat layer." That justification is gone. Full
parity is kept on independent grounds. With the shape-based binding table, each additional function
is one row against a template that already exists, so parity is close to free, and a binding that
covers its library is easier to document and to trust than one with an arbitrary cut line.

**Amended: the New Architecture is not mandatory.** The pre-design document listed it as the price of
choosing Nitro. Nitro's own documentation contradicts this: Nitro is "either a Native Module (old
arch) or a Turbo Module (new arch)", and only Nitro *Views* require the New Architecture plus
RN 0.78. We build no views. The real requirement set is RN 0.75+, C++20, and the platform toolchain
floors in section 2. From RN 0.76 the New Architecture is the default anyway, so this is a mild
point, but the README must not claim a requirement that does not exist.

**Correction, not an amendment: `BigUint64Array` cannot appear in a Nitro spec.** See section 4. The
user-facing promise is unchanged; the spec-level type is not.

## 2. Verified foundations

Everything in this section was verified against live sources on 2026-08-26, not from memory.

| | |
|---|---|
| h3 C | v4.5.0, released 2026-05-21, Apache-2.0 |
| h3-js | 4.5.0, bundles exactly h3 C 4.5.0 |
| Nitro / nitrogen | 0.37.0 |
| react-native-harness | 1.4.1, Callstack, MIT |
| GoogleTest | 1.18.0 (requires C++17; we use C++20) |

h3 and h3-js are in lockstep, so there is one upstream version number to pin, not two.

**Toolchain floors.** Nitro requires RN 0.75+, Xcode 16.4+, Swift 5.9+, `compileSdkVersion` 34+,
NDK 27+. C++20 is not on Nitro's requirements page but is enforced by its build files: the podspec
sets `CLANG_CXX_LANGUAGE_STANDARD => "c++20"`, the Android `CMakeLists.txt` sets
`CMAKE_CXX_STANDARD 20`, and the generated `add_nitrogen_files(spec)` forces `c++20` into every
consumer podspec.

**Nitro type support, the parts this design depends on.**

- `UInt64` maps to `uint64_t` through `jsi::BigInt::fromUint64` / `asUint64`, with no signed
  intermediate. H3 indexes with bit 63 set round-trip losslessly. Bare `bigint` in a spec is a hard
  nitrogen error ("Using a bigint without specifying signedness is deprecated"), so specs import
  `UInt64` from `react-native-nitro-modules`. Since `UInt64 = bigint & { __unsignedTag?: never }`,
  the public surface can still say `bigint`.
- `ArrayBuffer` is supported and zero-copy. **Typed arrays are not spec types.** Nitrogen matches the
  symbol `ArrayBuffer` only, and the runtime error message says so explicitly: "Are you maybe passing
  a TypedArray (e.g. Uint8Array)? Try to pass its `.buffer` value."
- An `ArrayBuffer` created in C++ is **owning**; JS may hold it indefinitely, and Nitro reports its
  size to the VM via `setExternalMemoryPressure` so the GC accounts for it. An `ArrayBuffer` arriving
  **from** JS is borrowing (`isOwner() == false`), valid only for the duration of the synchronous
  call and only on the JS thread.
- Structs and arrays of structs are supported and **eagerly converted**. Nested arrays are recursive
  in nitrogen's `ArrayType`, so `LatLng[][][]` is expressible, though three-level nesting is not
  covered by Nitro's own test module and deserves an early smoke test.
- Synchronous spec methods are plain JSI host functions invoked inline. No dispatcher, no thread hop.

**H3 facts that shape the binding.**

- `typedef uint64_t H3Index`, `H3_NULL == 0`, `typedef uint32_t H3Error`, `E_SUCCESS == 0`, error
  codes 1 through 19 with `H3_ERROR_END == 20` as a sentinel.
- **Every `H3Index` array output in H3 is `H3_NULL`-padded and ragged.** This is not an edge case; it
  is the normal result of pentagons. `h3-js` silently filters the holes.
- Exactly one public function allocates memory H3 owns: `cellsToLinkedMultiPolygon`, freed by
  `destroyLinkedMultiPolygon`.
- `uber/h3`'s `CMakeLists.txt` gates its own tests behind `H3_IS_ROOT_PROJECT`, so vendoring pulls in
  no h3 tests, fuzzers, or CTest registration.

## 3. Package structure and build

### Layout

```
react-native-h3/
  packages/react-native-h3/
    src/                    public TS API (the product surface)
    src/specs/H3.nitro.ts   internal HybridObject spec
    cpp/                    binding implementation
    cpp/test/               host GoogleTest project
    third_party/h3/         vendored, pinned upstream C
    nitrogen/generated/     committed, shipped in the tarball
    ios/ + NitroH3.podspec
    android/CMakeLists.txt
  apps/example/             bare RN CLI app, includes a benchmark screen
  config/  scripts/  docs/
  .github/workflows/
```

Root stays a thin workspace. Shared config (`tsconfig`, Biome, `.clang-format`, `.editorconfig`)
lives in `config/` with minimal root files delegating to it.

The example app is **bare React Native**, not Expo, matching `nitro/example` and what
`create-nitro-module` generates. Every Margelo workflow and the Harness config keys
(`entryPoint`, `appRegistryComponentName`, `bundleId`) then transfer directly, and the
`repo-structure-and-workflow` skill asks for example apps to stay close to the official RN template.

Package manager is **bun** throughout, matching the reference implementations and the maintainer's
local toolchain.

### Vendoring: in-tree copy, not a submodule

A submodule is silently dangerous at publish time. `npm pack` takes what is on disk, so whether
`third_party/h3/` reaches the tarball depends on whether someone ran `git submodule update --init`.
An empty directory publishes without error and breaks at the consumer's native build.

Instead, `scripts/vendor-h3.ts`: fetch a tag, copy `src/h3lib/{lib,include}` plus `LICENSE` and
`NOTICE`, generate `h3api.h` from `h3api.h.in` (the only substitutions are the three version macros),
write the explicit source file list, and write an `H3_VERSION` file. Pinned to **v4.5.0**. Updates
become a reviewable commit rather than a state.

This also resolves the CocoaPods problem: `h3api.h` exists at vendor time, so neither the podspec nor
CMake needs a configure step.

### Android

`android/CMakeLists.txt` lists the h3 `.c` files directly. No `add_subdirectory`. `H3_IS_ROOT_PROJECT`
would make `add_subdirectory` safe, but direct listing keeps iOS and Android on an identical source
set and an identical pre-generated header, which removes a whole class of "works on one platform"
bugs. Then `include(.../NitroH3+autolinking.cmake)`, which is purely additive to our target.

### iOS

Extend `s.source_files` with the vendored h3 sources, set `HEADER_SEARCH_PATHS` in
`pod_target_xcconfig`, and call `add_nitrogen_files(s)` **last**. This ordering is not stylistic:
`add_nitrogen_files` reads `spec.attributes_hash` and merges, so anything assigned afterwards
clobbers Nitro's values, including `c++20`.

### C++ file boundaries

One primary type per file, per the `cpp` skill.

| File | Responsibility |
|---|---|
| `HybridH3.hpp/.cpp` | orchestration only; each method is one call into the shape table |
| `shapes/` | the binding templates, one per file |
| `H3ErrorMapping.hpp/.cpp` | `uint32_t` to thrown JS error; message from `describeH3Error` |
| `CellBuffer.hpp/.cpp` | allocate, fill, compact `H3_NULL` in place, hand out data + count + deleter |
| `GeoPolygonBuilder.hpp/.cpp` | RAII for the `GeoPolygon` input graph |
| `LinkedGeoPolygonReader.hpp/.cpp` | RAII plus traversal for the multipolygon output |
| `BufferSizes.hpp` | the three sizes that exist only in doc comments, as named constants |

**`CellBuffer`, `GeoPolygonBuilder` and `LinkedGeoPolygonReader` must not depend on Nitro.** They
operate on plain C++ types; `HybridH3` wraps their output in an `ArrayBuffer`. Every memory hazard in
the project lives in those three files, and keeping them Nitro-free is what makes them testable on
the host under sanitizers instead of only on a device. This is a load-bearing constraint, not a
preference.

### Nitro configuration

`cxxNamespace: ["h3"]`, `iosModuleName: "NitroH3"`, `androidCxxLibName: "NitroH3"`, autolinking as
`"all": { "language": "c++" }` (the schema restricts `"all"` to C++, which is exactly our case).

### License

**Apache-2.0**, matching upstream, with h3's `LICENSE` and `NOTICE` in the vendor directory. MIT would
be possible but would still require satisfying Apache's terms for the vendored portion, which is
effort without benefit.

## 4. Public API and error behavior

### One internal HybridObject, flat public functions

All functions are stateless and pure. There is no native resource, no lifecycle, nothing to own.
Splitting the HybridObject by domain would multiply `nitro.json` entries without a user ever seeing
it. So: one `H3` HybridObject, internal, and the public API is flat named exports.

```ts
import { latLngToCell, gridDisk, polygonToCells } from 'react-native-h3'
```

### The TypeScript layer does exactly one thing

It wraps `ArrayBuffer` into `BigUint64Array` and carries the JSDoc. No validation, no defaults, no
enum translation, no error reshaping; all of that lives in C++, because otherwise there would be two
truths. For functions without buffers the wrapper is a one-liner, deliberately: a uniform surface
with one place for documentation is worth more than saving forty pass-throughs.

The `api-design` skill normally forbids JS facades over public HybridObjects. This case falls under
its stated exception, because the HybridObject is an internal implementation detail rather than the
user-facing API. That boundary is explicit: the HybridObject is not exported and its spec types are
not part of the public surface.

### Types

- `bigint` for a single cell, `BigUint64Array` for cell sets. In the spec these are `UInt64` and
  `ArrayBuffer` respectively; the wrapper's `new BigUint64Array(buf)` is a view, not a copy.
- `LatLng[]` for boundaries. At most 10 points, so eager struct conversion is cheap here.
- `cellsToMultiPolygon` returns eagerly converted `LatLng[][][]` for now. If a large cell set makes
  that expensive in practice, switch to a flat coordinate buffer plus an offsets buffer. Do not
  pre-optimize it.

### Raggedness: always compact, exact length

C++ allocates the maximum buffer, fills it, removes `H3_NULL` in place, and wraps with the real
length. No copy; the cost is a linear scan plus some unused memory until the buffer is collected.
JS receives a `BigUint64Array` in which every entry is a real cell.

Rejected: passing the padded buffer through. Filtering 412,459 elements in JS would consume exactly
the advantage the benchmark demonstrated, and it moves work to the worse place. Also rejected:
reallocating to the exact size, which trades a linear scan for a multi-megabyte copy on the very path
that carries the package's main argument.

This semantic lives in exactly one place, `CellBuffer`.

### Units are split, not parameterized

`h3-js` has `cellArea(cell, 'km2')`. That costs a string conversion across the bridge on precisely the
paths this package exists for; against a C function in the ~50 ns range, a string parameter can double
the cost. So the API maps 1:1 onto C:

```
cellArea                -> cellAreaKm2, cellAreaM2, cellAreaRads2
edgeLength              -> edgeLengthKm, edgeLengthM, edgeLengthRads
greatCircleDistance     -> greatCircleDistanceKm, greatCircleDistanceM, greatCircleDistanceRads
getHexagonAreaAvg       -> getHexagonAreaAvgKm2, getHexagonAreaAvgM2
getHexagonEdgeLengthAvg -> getHexagonEdgeLengthAvgKm, getHexagonEdgeLengthAvgM
```

Side effect: `h3-js`'s synthetic `E_UNKNOWN_UNIT` (code 1000) disappears entirely, and the shape table
needs no unit-dispatch form. Five functions become thirteen, so the public surface is **62 functions**
plus `cellToString` and `cellFromString`.

### Polygon input

GeoJSON-shaped nested arrays, as in `h3-js`: an array of rings, each ring an array of `[lat, lng]`
pairs, first ring outer, the rest holes.

```ts
type Ring = [lat: number, lng: number][]
polygonToCells(rings: Ring[], res: number): BigUint64Array
```

C++ builds the `GeoPolygon` graph from this via RAII. A named struct with `{ lat, lng }` points would
read better but would multiply eager struct allocation on large polygons and would force callers
holding GeoJSON to reshape it first.

### Async variants

All 62 functions are synchronous; that is the point of the package. Four additionally get async
variants, chosen because they can measurably exceed Nitro's 50 ms rule of thumb:

```
polygonToCellsAsync
polygonToCellsExperimentalAsync
cellsToMultiPolygonAsync
uncompactCellsAsync
```

`polygonToCells` measured 97 ms for San Francisco at res 12, roughly six dropped frames on the
package's headline function. Every async variant must copy an inbound cell-set buffer before doing
work, because a buffer received from JS is borrowing and valid only for the synchronous call.

### Errors

```ts
class H3Error extends Error {
  readonly code: H3ErrorCode      // 'cell-invalid'
  readonly numericCode: number    // 5
}
```

`code` is a kebab-case string union, `numericCode` is H3's own number for cross-referencing upstream
documentation and for bug reports. Two fields for one value is a deliberate exception to the
single-source-of-truth rule; both are `readonly` and both are produced by one mapping function in
C++, so they cannot diverge. Messages come from `describeH3Error`, so upstream owns the wording rather
than a duplicated table.

The C type `H3Error` (`uint32_t`) never appears in the public TypeScript. `h3-js` uses the same name
for two different things; that is not repeated here.

### Validation

At the boundary, in C++, once. In particular every size query needs a ceiling:
`maxPolygonToCellsSize` will happily report a number for a large polygon at res 15 that exhausts
device memory. That must become a clean error, not an OOM.

## 5. The binding layer

Approach: **a shape-based binding table**. Roughly one C++ template per recurring signature shape,
each solving conversion, `H3Error` handling and result-buffer ownership once; each function is then a
declaration in a table.

The pre-design document estimated eight shapes. Verified against `h3api.h` at v4.5.0, the real
taxonomy is **14 shapes covering 44 of the 54 bound operations, plus 10 genuine one-offs**. Note that
"54" counts h3-js-level operations, not C functions: the five unit-dispatch operations are backed by
13 C functions, so the C-level total is higher. With
templates parameterized on argument tuple, out-param type and sentinel predicate, several shapes
merge, landing near **10 to 12 templates plus 10 hand-written functions**, so about 22 code paths
rather than 8.

This does not invalidate the approach. It still concentrates the three hazards (buffer sizing, error
handling, memory ownership) into a handful of places, and the one-offs were always going to be
hand-written. It does mean the table is not as thin as the sketch implied, and the implementation plan
must budget for that.

The estimate missed whole patterns: `(cell, int) -> cell` (`cellToParent`, `cellToCenterChild`,
`cellToVertex`), the `H3Error f(X, scalar *out)` family which is the most common form once
unit-suffixed variants are counted, `CoordIJ`, and the `LatLng`-pair-in / `double`-out distance
functions. It also split "size via `maxGridDiskSize`" and "size via `maxPolygonToCellsSize`" into two
shapes when they are one pattern that actually covers eight functions.

### Shapes

| Shape | Pattern | Members |
|---|---|---|
| S1 | `double f(double)` | `degsToRads`, `radsToDegs` |
| S2 | `int f(H3Index)`, no error | 8: `isValidCell`, `isValidIndex`, `isPentagon`, `isResClassIII`, `isValidDirectedEdge`, `isValidVertex`, `getResolution`, `getBaseCellNumber` |
| S3 | `int f(void)` | internal only: `res0CellCount`, `pentagonCount` |
| S4 | `H3Error f(H3Index, scalar *out)` | `cellArea*`, `edgeLength*` (6 C functions) |
| S5 | `H3Error f(int res, scalar *out)` | `getHexagonAreaAvg*`, `getHexagonEdgeLengthAvg*`, `getNumCells` |
| S6 | `H3Error f(H3Index, H3Index *out)` | `getDirectedEdgeOrigin`, `getDirectedEdgeDestination`, `reverseDirectedEdge` |
| S7 | `H3Error f(H3Index, int, H3Index *out)` | `cellToParent`, `cellToCenterChild`, `cellToVertex` |
| S8 | `H3Error f(H3Index, int, int\|int64_t *out)` | `cellToChildrenSize`, `cellToChildPos`, `getIndexDigit` |
| S9 | `H3Error f(H3Index, H3Index, T *out)` | `areNeighborCells`, `cellsToDirectedEdge`, `gridDistance` |
| S10 | `H3Error f(H3Index, LatLng *out)` | `cellToLatLng`, `vertexToLatLng` |
| S11 | `H3Error f(H3Index, CellBoundary *out)` | `cellToBoundary`, `directedEdgeToBoundary` |
| S12 | fixed-N `H3Index *out` | `directedEdgeToCells` (2), `originToDirectedEdges` (6), `cellToVertexes` (6), `getRes0Cells` (122), `getPentagons` (12) |
| S13 | size query then fill | 8: `gridDisk`, `cellToChildren`, `gridPathCells`, `polygonToCells`, `uncompactCells`, `getIcosahedronFaces`, `getRes0Cells`, `getPentagons` |
| S14 | formula-sized fill | `gridRing`, `gridRingUnsafe` |

S13 is the heart of the binding. It needs parameterizing on the argument tuple, the element type and
the sentinel predicate, since `getIcosahedronFaces` fills `int` with `-1` padding rather than
`H3Index` with `H3_NULL`.

`getRes0Cells` and `getPentagons` appear in both S12 and S13, and that overlap is real rather than a
mistake: their sizes are compile-time constants (122 and 12) from the two nullary counters, which is
the S12 property, but their fill-and-compact path is S13's. Implement them through S13 and take the
size from the counter rather than adding a third form.

S14 is a deliberate divergence: `h3-js` computes `k === 0 ? 1 : 6 * k` in JS rather than calling
`maxGridRingSize`, which does exist in C. We call the C function and fold S14 into S13.

### The ten one-offs

`gridDiskDistances` (two parallel out-params zipped into ragged per-ring buckets, with empty rings
pre-seeded), `compactCells` (output length equals the caller's own input length, no size function
anywhere), `uncompactCells` (five-argument work function carrying two lengths; the header notes the
size "always overestimates if in error"), `polygonToCellsExperimental` (the only function that takes
its own computed size back as an argument, plus a `ContainmentMode` flags value),
`cellsToMultiPolygon` (see below), `cellToLocalIj` and `localIjToCell` (`CoordIJ` plus a `mode`
argument pinned to 0), `latLngToCell` (`LatLng` struct input), `greatCircleDistance*` (two struct
inputs, `double` return, no error channel at all), and `constructCell` (variable-length `const int *`
input array whose length is implied by `res`).

### Named hazards

- **Three buffers have no size function and no hint in the signature**: `directedEdgeToCells` needs
  exactly 2, `originToDirectedEdges` and `cellToVertexes` exactly 6. The sizes exist only in doc
  comments. Getting one wrong is a silent heap overflow, not an `H3Error`. These go in
  `BufferSizes.hpp` as named constants with the header text quoted, never as inline literals.
- **`CellBoundary` alignment**: `numVerts` is an `int` but `verts` is `double`-aligned, so on every
  mainstream ABI `verts` starts at byte offset 8, not 4. Never compute the offset as `sizeof(int)`.
- **`LinkedGeoPolygon` ownership is split**: the caller owns the root node's storage, H3 owns every
  loop, every coordinate, and every sibling polygon node. `destroyLinkedMultiPolygon` must run on the
  error path too, since partial structure may already be linked. In C++ this is a stack root plus
  scope-exit, which is genuinely cleaner than what `h3-js` must do.
- **`GeoPolygon` input must outlive both calls**: the size query and the work call both read it. Free
  once, after both.
- **`gridRingUnsafe` fails mid-write**: on hitting a pentagon it returns `E_PENTAGON` having already
  partially written the buffer. The contents are then meaningless and must be discarded, not
  partially read.
- **Every size function except the two nullary counters can itself fail** with an `H3Error`.

## 6. Test strategy

Four levels, ordered by defect density.

### Host C++ tests under sanitizers

This deviates from the `repo-structure-and-workflow` skill, which says not to add standalone native
tests unless the library exposes a native target outside React Native or the behavior cannot be
validated through the RN API. **Both exceptions apply.** The Nitro-free C++ core is a standalone
native target, and heap overflows and leaks are invisible through the RN API: a test that receives
the correct result says nothing about whether 40 bytes past the buffer were read.

CMake project under `packages/react-native-h3/cpp/test/`, GoogleTest 1.18.0 via `FetchContent` with a
`find_package(GTest QUIET)` fast path, following the one clean precedent in the RN ecosystem,
`software-mansion/react-native-audio-api`. Two targets: `tests`, and `tests_asan` with
`-fsanitize=address,undefined -g -O1`.

No host TSan: the core is single-threaded by construction, and concurrency only appears at the Nitro
boundary, which the device tests cover.

Runs on `ubuntu-latest`, because LeakSanitizer is enabled by default there under `-fsanitize=address`
and **does not exist on macOS/arm64** (verified empirically: Apple clang prints "detect_leaks is not
supported on this platform" and aborts). Leak checking for `GeoPolygonBuilder` and
`LinkedGeoPolygonReader` therefore requires a Linux run, in CI or locally in Docker.

Coverage focus: the three sizes without size functions, `GeoPolygon` construction and teardown across
both calls, `LinkedGeoPolygon` ownership including the error path, `gridRingUnsafe`'s partial write,
and compaction edge cases (all `H3_NULL`, none, hole first, hole last).

### Parity against h3-js as a differential oracle

`bun test` on `ubuntu-latest`. h3-js 4.5.0 binds exactly h3 C 4.5.0, so it is a true oracle rather
than an approximation. Comparison goes through `cellToString`, since h3-js returns hex strings.

The input space is covered systematically, not hand-picked: all 122 res-0 cells, all resolutions 0
through 15, all 12 pentagons per resolution plus their immediate neighborhoods, antimeridian and pole
cases for `polygonToCells` and `cellsToMultiPolygon`, and seeded random lat/lng so a failure is
reproducible.

Pentagons are not an edge case here. They are the reason `H3_NULL` holes exist at all, and therefore
the main case for the compaction decision.

Two deliberate divergences from h3-js must be asserted as divergences rather than slip through as
bugs: our messages come from `describeH3Error` rather than h3-js's duplicated table, and our
`gridPathCells` checks the error code, which h3-js omits at that one call site.

**Upstream h3 fixtures are deliberately not used.** About 90 of the ~95 files in `tests/inputfiles/`
are self-consistency data generated by h3 itself, so not an independent oracle, and the ~13 genuinely
independent ones keep their expected values as string literals inside CMake fragments in a different
directory. Writing a parser for an ad-hoc format to obtain a weaker oracle than h3-js provides for
free would be work against ourselves.

### On-device tests

`react-native-harness` 1.4.1 via the official action, with the action tag pinned to the npm version.
This is the ecosystem default: `mrousavy/nitro`, `react-native-mmkv`, `react-native-fast-tflite` and
`react-native-nitro-fetch` all use it, and none of them has any native unit tests at all.

The suite is defined once and run through pluggable backends, following Nitro's own pattern
(`getTests.ts` plus `backends/harness.ts` and `backends/throwing.ts`), so the same tests run in the
example app and in CI.

Scope is deliberately narrow: only what exists solely on a device. Whether a `UInt64` with bit 63 set
arrives losslessly, whether a returned `ArrayBuffer` viewed as `BigUint64Array` has the compacted
length, whether an inbound buffer is actually copied by the async variants, and whether autolinking
resolves on both platforms. Roughly a dozen assertions, identical for all 62 functions. Repeating the
parity suite on device would buy runtime and no information.

One caveat the host tests cannot cover: the host build uses a different compiler and architecture, and
H3's geometry uses `double`. Architecture-specific floating-point drift is unlikely but not excluded,
so a small fixed vector set also runs on device against frozen expected values.

### Sanitizer matrix on device

Full Margelo matrix per PR: iOS Default, ASan, TSan; Android Default, ASan. This covers the Nitro and
JSI boundary that host tests cannot see, and it is free on a public repository.

### Benchmark

Not a gate. Benchmark-as-a-regression-gate does not exist as a practice anywhere in the RN ecosystem,
including at Meta; `github-action-benchmark` can gate but has no device story, and CodSpeed is
Linux-x86 only. What we do instead: a host-side C++ benchmark in the same CMake project, informational
and non-blocking, which catches the failure mode that matters (someone introduces a copy into the
zero-copy path). Device numbers stay a README table regenerated manually before releases.

## 7. CI and release

Repository is **public**, so standard runners including macOS are free and unlimited, which is what
makes the full sanitizer matrix affordable.

### Workflows

```
ci.yml              typecheck, build, bun specs, Biome
lint-cpp.yml        clang-format on cpp/**, vendored h3 excluded
nitrogen-drift.yml  bun specs && git diff --exit-code
cpp-tests.yml       ubuntu: tests + tests_asan
parity.yml          ubuntu: bun test against h3-js
harness-ios.yml     macos-latest, matrix Default/ASan/TSan
harness-android.yml ubuntu-latest, matrix Default/ASan
build-ios.yml       matrix static frameworks vs. not
build-android.yml   matrix min-sdk 24/26
```

`nitrogen-drift.yml` is five lines and catches an entire class of bug: committed generated files that
no longer match the spec.

**The two harness workflows are path-filtered**, following Margelo's pattern: they trigger only on
changes under `cpp/**`, `nitrogen/generated/**`, `ios/**`, `android/**`, the lockfiles, the podspecs
and the test files. A documentation or pure-JS change starts none of the five device jobs. The device
matrix is free on a public repository but not fast; the Harness documentation budgets up to 20
minutes per run including builds, and three of the five jobs are macOS.

**No binary size gate.** There is no established practice to copy: Emerge Tools' action is officially
deprecated, `diffuse` ships no action, `bloaty`'s last tag is from 2020, and a search across
`mrousavy/*` and `software-mansion/*` workflows returned zero size steps. The 51 KB from the
measurement stays a README figure.

### Declared floors

Two decisions that are easy to conflate but are independent: which runner CI uses is internal and
affects nobody outside the repo; which floor the package declares is a compatibility promise to
users.

**Xcode: declare 16.4, build on `macos-26`.** This is exactly what Margelo does. They build on
`macOS-26` with Xcode 26.x and still declare Nitro's 16.4; they do not raise the floor, they simply
do not verify it. Raising ours to 26 would make `react-native-h3` stricter than Nitro *and* stricter
than React Native, whose `min_xcode_version_supported` is `'16.1'`, for a codebase that is pure C++20
plus vendored C. Apple clang in Xcode 16.4 supports C++20 fully, so there is no technical basis for a
higher floor. Building on `macos-26` keeps CI aligned with the maintainer's local Xcode 26.6 and
avoids `macos-15`, the next deprecation candidate after `macos-14`.

Recorded honestly: **16.4 is therefore declared but not verified.** That is a deliberate blind spot,
and it is the same one Nitro has. Nothing anywhere is machine-readable here; Nitro's `package.json`
has `engines: null` and the podspec only inherits `min_ios_version_supported` and sets `c++20`.

**iOS deployment target: inherit `min_ios_version_supported` from React Native** (currently 15.1)
rather than pinning our own number that would silently go stale across RN upgrades.

**Android `minSdk`: 24**, with the build matrix covering 24 and 26. This is the floor that actually
affects users, more than the Xcode version does, and pure C++20 gives no reason to go higher.

Note for local development: Margelo pins Java 17 in all workflows. The maintainer's machine has
Java 21. If Gradle misbehaves, that is the first suspect.

### Release

The monorepo pattern from the `build-nitro-modules` skill. `packages/react-native-h3` carries
`release-it` with `npm.publish: true`, `git: false`, `github.release: false`. The root has
`scripts/release.sh`, which releases the package and then runs root `release-it` with
`npm.publish: false`, owning the commit, tag, changelog and GitHub release, with
`requireCleanWorkingDir: false`. Changelog via `@release-it/conventional-changelog` with preset
`conventionalcommits`; `@release-it/bumper` keeps `apps/example/package.json` in step. The
`after:bump` hook refreshes and stages `bun.lock` and `apps/example/ios/Podfile.lock`.

One command: `bun release`. npm provenance via GitHub OIDC (`id-token: write`,
`npm publish --provenance`).

No Husky, commitlint or lint-staged. Validation belongs in CI. Default branch `main`, feature branches
with an early draft PR, squash merge.

### Packaging

The `files` field must include `third_party/h3` and `nitrogen/generated`. If the vendored C sources
are missing from the tarball, publishing succeeds and the failure appears at the consumer's native
build. A `prepack` check verifies that `h3api.h` and the `.c` files are in the pack list.

## 8. Non-goals

- No web implementation. `index.web.ts` throws at import time pointing to `h3-js`, and the README says
  so near the top.
- No `/compat` entry point. See section 1.
- No `h3IndexToSplitLong` / `splitLongToH3Index`. They exist only to work around the lack of 64-bit
  integers in JS and have no C counterpart at all.
- No binary size gate, no benchmark gate. See sections 6 and 7.

## 9. Open items for the implementation plan

These are known and deliberately deferred, not forgotten.

1. The full 54-row function table mapping each h3-js name to its C function, shape, size source and
   sentinel. Must be regenerated from `h3api.h` at v4.5.0 during planning rather than transcribed.
2. Whether `LatLng[][][]` for `cellsToMultiPolygon` needs the flat-buffer-plus-offsets representation.
   Decide by measurement, not up front. Three-level nesting is unproven in Nitro's own test module and
   needs an early smoke test.
3. The exact ceiling values for size-query validation, and what error they raise.
4. Whether `bigint` boxing cost on the single-cell path is significant enough to matter. Nitro's own
   benchmarks measure `double` round-trips, not BigInt. Measure before reacting.
