# Divergences from h3-js 4.5.0

h3-js 4.5.0 bundles exactly the H3 C library this package vendors, so it is an oracle rather than an
approximation, and `parity/` compares the two over all 122 resolution 0 cells, all sixteen
resolutions, all 192 pentagons with their neighbourhoods, the poles, the antimeridian and seeded
random coordinates. Every row below is proved by a test in `parity/divergences.test.ts`; everything
not listed here is identical.

## Input this package refuses and h3-js answers

| Input class | This package | h3-js | Why |
| --- | --- | --- | --- |
| An invalid cell index, to any operation but the nine exemptions | throws `E_CELL_INVALID` (code 5) | reads the bits and answers: `cellArea('1', 'km2')` is `4106166.33`, `gridDisk('1', 1)` is six cells | H3 checks only the base cell range on most paths (`h3Index.c:1120`), so a malformed index yields a plausible answer rather than an error. Validating once at the boundary is what makes the rest of the binding able to trust its input. |
| An invalid directed edge, such as one whose direction bits are `0` | throws `E_DIR_EDGE_INVALID` (code 6) | `getDirectedEdgeOrigin` answers with a cell | Every reader in `directedEdge.c` goes through `getDirectedEdgeOrigin`, which checks the mode bits and nothing else (`directedEdge.c:157`). |
| An invalid vertex, such as a cell index | throws `E_VERTEX_INVALID` (code 8) | `vertexToLatLng` answers with a coordinate | `vertexToLatLng` clears the mode bits of whatever it is handed and measures the result (`vertex.c:326`). |
| A `k`, resolution, vertex number or child position that is not an integer | throws this package's own wording, with no `code`: `k must be an integer`, `Resolution must be an integer between 0 and 15`, `Vertex number must be an integer` | truncates and answers: `gridDisk(cell, 1.5)` is the `k` of 1 disk | emscripten's argument marshalling truncates the double. A silently different answer is worse than a refusal. |
| A resolution that is not an integer, where h3-js validates in JavaScript (`getHexagonAreaAvg*`, `getHexagonEdgeLengthAvg*`, `getNumCells`) | throws `Resolution must be an integer between 0 and 15`, with no `code` | throws `E_RES_DOMAIN` (code 4) with `, value: 1.5` appended | H3 never sees the argument, so there is no H3 error to report. |
| A polygon point that is not a `[lat, lng]` pair | throws `Not a point: 0` | throws `E_FAILED` (code 1) | Naming the malformed point is more useful than a generic failure. |
| A polygon coordinate that is not finite | throws `Polygon coordinates must be finite numbers` | throws `E_FAILED` (code 1) | As above. |
| A request for more than 4,000,000 cells, such as `gridDisk(cell, 1155)` | throws `The requested result would exceed this binding's limit of 4000000 cells`, with no `code` | allocates all 4,005,541 | A phone has less memory than a browser tab, and the allocation happens in the app's own heap. |
| `compactCells` over a set with an invalid member | throws `E_CELL_INVALID` (code 5) | throws `E_RES_MISMATCH` (code 12), because H3 reads the invalid member as another resolution | The boundary check runs before H3 sees the set. |
| `uncompactCells` over a set with an invalid member | throws `E_CELL_INVALID` (code 5) | throws `E_MEMORY_BOUNDS` (code 14) after sizing the output from the invalid member, an allocation that leaves its emscripten heap unusable for the rest of the process | As above. |
| `constructCell` with a digit count that is not the resolution | throws `constructCell needs exactly res digits`, with no `code` | throws `E_DIGIT_DOMAIN` (code 18) with `, value: 3` | H3 never sees the digit count, so it cannot report on it. |

The nine exemptions have no error channel and answer for any input, exactly as h3-js does:
`isValidCell`, `isValidIndex`, `isPentagon`, `isResClassIII`, `isValidDirectedEdge`,
`isValidVertex`, `getResolution`, `getBaseCellNumber` and `cellToString`. `getResolution` answers
`-1` for an index that is not a valid cell, which is what h3-js answers too.

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
does not. Nothing rounds differently in the ordinary case, and the measured spread over the whole
corpus is at the last bit.

| Measurement | Agreement | Why |
| --- | --- | --- |
| Cell centres, boundaries and vertexes away from a pole | `5.7e-14` degrees | the last bit of a double |
| Cell areas, great circle distances, the resolution averages | `4.6e-13` relative | as above |
| Cell boundaries within a degree of a pole | `2.8e-14` degrees at resolution 0, growing to `1.8e-7` degrees at resolution 15, two centimetres on a cell half a metre across | the inverse projection is ill-conditioned at a pole, so the contracted multiply-add moves the result by more than a bit. Building with `-ffp-contract=off` brings the whole corpus back to `2.8e-14`. |
| `edgeLengthKm`, `edgeLengthM`, `edgeLengthRads` | `1.4e-8` relative at resolution 15, `3.4e-15` at resolution 0 | an edge half a metre long is the difference of two coordinates that agree to fourteen digits, so the same contraction shows up in the eighth digit |

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
