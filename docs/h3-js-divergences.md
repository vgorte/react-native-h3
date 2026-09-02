# Divergences from h3-js 4.5.0

> 📖 This guide documents the intentional differences between
> `react-native-nitro-h3` and `h3-js` 4.5.0, with migration guidance
> for existing `h3-js` users.

Test paths below are relative to `packages/react-native-nitro-h3/`.

h3-js 4.5.0 bundles exactly the H3 C library this package vendors, so it is an oracle rather than an
approximation, and `parity/` compares the two over all 122 resolution 0 cells, all sixteen
resolutions, all 192 pentagons with their neighbourhoods, the poles, the antimeridian and seeded
random coordinates. Every row and section below is proved by a test in
`parity/divergences.test.ts`, which asserts both sides; the two type-surface rows are proved there
for h3-js at run time and for this package by `tsc`, because the probe the suite drives speaks JSON.
The additive batch section leans on `parity/batches.test.ts` as well, which is where the two calls are
compared with h3-js element for element. Everything not listed here is identical.

## Input this package refuses and h3-js answers

| Input class | This package | h3-js | Why |
| --- | --- | --- | --- |
| An invalid cell index, to any operation taking one but the nine exemptions | throws `E_CELL_INVALID` (code 5) | reads the bits and answers: `cellArea('1', 'km2')` is `4106166.33`, `gridDisk('1', 1)` is six cells | H3 checks only the base cell range on most paths (`h3Index.c:1120`), so a malformed index yields a plausible answer rather than an error. Validating once at the boundary is what makes the rest of the binding able to trust its input. |
| An invalid directed edge, such as one whose direction bits are `0` | throws `E_DIR_EDGE_INVALID` (code 6) | `getDirectedEdgeOrigin` answers with a cell | Every reader in `directedEdge.c` goes through `getDirectedEdgeOrigin`, which checks the mode bits and nothing else (`directedEdge.c:157`). |
| An invalid vertex, such as a cell index | throws `E_VERTEX_INVALID` (code 8) | `vertexToLatLng` answers with a coordinate | `vertexToLatLng` clears the mode bits of whatever it is handed and measures the result (`vertex.c:326`). |
| A `k`, resolution, vertex number or child position that is not an integer | throws this package's own wording, with no `code`: `k must be an integer`, `Resolution must be an integer between 0 and 15`, `Vertex number must be an integer`, `Child position must be an integer` | truncates and answers: `gridDisk(cell, 1.5)` is the `k` of 1 disk, `cellToParent(cell, 1.5)` is the resolution 1 parent, `cellToVertex(cell, 0.5)` is vertex `0`, `childPosToCell(1.5, cell, 10)` is child `1` | emscripten's argument marshalling truncates the double. A silently different answer is worse than a refusal. |
| A resolution that is not an integer, where h3-js validates in JavaScript (`getHexagonAreaAvg*`, `getHexagonEdgeLengthAvg*`, `getNumCells`) | throws `Resolution must be an integer between 0 and 15`, with no `code` | throws `E_RES_DOMAIN` (code 4) with `, value: 1.5` appended | H3 never sees the argument, so there is no H3 error to report. |
| A polygon point that is not a `[lat, lng]` pair | throws `Each polygon point must be a [latitude, longitude] pair` | throws `E_FAILED` (code 1) | Saying what a point has to be is more useful than a generic failure. |
| A polygon coordinate that is not finite | throws `Polygon coordinates must be finite numbers` | throws `E_FAILED` (code 1) | As above. |
| A polygon coordinate outside the globe | throws `Polygon coordinates must be within [-90, 90] latitude and [-180, 180] longitude`, with no `code` | normalises and answers: `polygonToCells([[[91, 0], [0, 0], [1, 1]]], 3)` is 41 cells | H3 builds a polygon's bounding box from raw vertex extrema with no range check (`polygonAlgos.h:176`), so one vertex off the globe engulfs it: the experimental fill then scans the whole cell hierarchy, measured at about 36 seconds for a five-point ring on an Apple M-series host at `-O3`. Rejecting rather than wrapping keeps a ring across the antimeridian where it was drawn. |
| `compactCells` over a set with an invalid member | throws `E_CELL_INVALID` (code 5) | throws `E_RES_MISMATCH` (code 12), because H3 reads the invalid member as another resolution | The boundary check runs before H3 sees the set. |
| `uncompactCells` over a set with an invalid member | throws `E_CELL_INVALID` (code 5) | throws `E_MEMORY_BOUNDS` (code 14) after sizing the output from the invalid member, an allocation that leaves its emscripten heap unusable for the rest of the process | As above. |
| `constructCell` with a digit count that is not the resolution | throws `constructCell needs exactly res digits`, with no `code` | throws `E_DIGIT_DOMAIN` (code 18) with `, value: 3` | H3 never sees the digit count, so it cannot report on it. |

The nine exemptions have no error channel and answer for any input, exactly as h3-js does:
`isValidCell`, `isValidIndex`, `isPentagon`, `isResClassIII`, `isValidDirectedEdge`,
`isValidVertex`, `getResolution`, `getBaseCellNumber` and `cellToString`. `getResolution` answers
`-1` for an index that is not a valid cell, which is what h3-js answers too. `cellFromString` takes
text rather than a cell index, so it converts whatever parses and leaves the verdict to the
operation the result is passed to.

## The optional cell ceiling

`configure({ maxCellCount })` caps how many cells one call may allocate. Nothing is capped until a
call sets a ceiling, so by default a request is answered at whatever size H3 reports, as h3-js
answers it. With a ceiling of 4,000,000 in force, `gridDisk(cell, 1155)` throws
`The requested result of 4005541 cells exceeds the cell limit of 4000000 set with configure({ maxCellCount }). Raise or remove the limit to allow it.`
with no `code`, where h3-js allocates all 4,005,541 cells and has no such control. Every
cell-producing call sizes its result before allocating anything, which is what makes the refusal
possible at all.

## The additive batch calls

`latLngsToCells` and `cellsToLatLngs` run a scalar operation over a whole typed array in one native
call. h3-js exports neither, so they are additive rather than a difference in behaviour: element for
element they answer what a `latLngToCell` or `cellToLatLng` loop answers, which `parity/batches.test.ts`
proves over the corpus. `parity/divergences.test.ts` asserts that h3-js has neither export, so the day
it grows one this section fails rather than ages.

| Case | This package | h3-js |
| --- | --- | --- |
| `latLngsToCells` | takes a `Float64Array` of interleaved `[lat, lng]` pairs and answers one `BigUint64Array`, one cell per pair | no counterpart |
| `cellsToLatLngs` | takes a `BigUint64Array` of cells and answers one interleaved `Float64Array`, two doubles per cell | no counterpart |

An invalid element is refused the way every other input is, with the index in the message
(`cells[1]: Cell argument was not valid (code: 5)`), and the optional cell ceiling applies to both,
counted in cells.

## Wording

| Case | This package | h3-js | Why |
| --- | --- | --- | --- |
| Every H3 failure | `<describeH3Error text> (code: N)` | the same text and code, with `, value: X` appended where h3-js validated the argument itself | Both read the same table for 17 of the 19 codes. |
| `E_DIGIT_DOMAIN` (code 18) | `Child digits invalid` | `Child indexing digits invalid` | h3-js keeps a copy of the message table and this entry no longer matches `describeH3Error`. |
| `E_DELETED_DIGIT` (code 19) | `Deleted subsequence indicates invalid index` | `Child indexing digits refer to a deleted subsequence` | As above. |
| `E_OPTION_INVALID` (code 15) | `Mode or flags argument was not valid (code: 15)` | `Unknown error (code: 15, value: 4)` | h3-js rejects an unknown containment mode in JavaScript, from a second table that has no entry for 15. The code is the same on both sides. |

## Arithmetic

Both sides run the same C source, so a difference here is the compiler's, not the algorithm's. The
host and device builds are arm64 and contract a multiply and an add into one instruction; emscripten
does not. That shows only where the arithmetic is ill-conditioned: near a pole, and on a cell small
enough that a length or an area is the difference of near-equal terms. Every figure below is the
worst case measured over the corpus, and each is asserted at two to four times itself.

| Measurement | Agreement | Why |
| --- | --- | --- |
| Cell centres, boundaries and vertexes away from a pole, at every resolution | `5.7e-14` degrees | the last bit of a double |
| Great circle distances | `2.0e-15` relative | the haversine runs on the arguments themselves, so there is nothing to amplify |
| `getHexagonAreaAvg*`, `getHexagonEdgeLengthAvg*`, `degsToRads` | bit-identical | one lookup in a compiled-in table, or one multiply |
| `radsToDegs` | `1.6e-16` relative | one multiply by a constant whose last bit differs |
| Cell areas up to resolution 6 | `4.6e-13` relative | the last bit of a double |
| Cell areas at resolution 15 | `3.0e-9` relative, worst at the pentagon `8f0800000000000` | at half a metre across the area is a difference of near-equal terms, so the contraction reaches the ninth digit |
| `edgeLengthKm`, `edgeLengthM`, `edgeLengthRads` | `3.4e-15` relative at resolution 0, `1.4e-8` at resolution 15, worst at `14f0800000000000` | an edge half a metre long is the difference of two coordinates that agree to fourteen digits, so the contraction reaches the eighth digit |
| Cell boundaries within a degree of a pole | `2.84e-14` degrees at resolution 0, `1.46e-11` at 5, `5.89e-10` at 10, `1.82e-7` at 15, two centimetres on a cell half a metre across | the inverse projection is ill-conditioned at a pole, so the contracted multiply-add moves the result by more than a bit. Building with `-ffp-contract=off` brings the whole corpus back to `2.84e-14`. |

## Shape and surface

These are the differences a migration notices first. `README.md` explains each one.

| Case | This package | h3-js |
| --- | --- | --- |
| A cell | `bigint` | hexadecimal `string` |
| A cell set | `BigUint64Array` | `string[]` |
| Units | separate functions (`cellAreaKm2`) | a string argument (`cellArea(cell, 'km2')`), and an `E_UNKNOWN_UNIT` this package cannot raise |
| `polygonToCellsExperimental` flags | a `ContainmentMode` number, or the h3-js name | the name only |
| `constructCell` | `(baseCellNumber, digits, res)`, h3-js's order rather than the C library's | `(baseCellNumber, digits, res)` |
| `cellToString`, `cellFromString` | convert between `bigint` and hexadecimal | no counterpart: h3-js cells already are strings |
| `h3IndexToSplitLong`, `splitLongToH3Index` | no counterpart | work around the lack of 64-bit integers in an emscripten build |

The containment mode number and the h3-js name are proved to cover the same cells. The name form
the wrapper also takes is the device harness's to prove, because the probe takes the number.
