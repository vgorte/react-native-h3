//
//  BufferSizes.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstddef>
#include <cstdint>

namespace h3core {

/**
 * Pins the four H3 output buffer sizes that have no size function and no hint in their signature.
 * Passing an undersized buffer to any of them is a silent heap overflow, not an `H3Error`, so none
 * of the numbers below are ever written as inline literals at a call site; each is instead pinned
 * by a canary test in `cpp/test/BufferSizesTest.cpp` that asserts the count H3 actually writes.
 *
 * Verified against uber/h3 `v4.5.0` (commit `1b536c34`).
 */

/**
 * Pins the required capacity for `originToDirectedEdges(H3Index origin, H3Index *edges)`.
 *
 * The public header states the number only in prose, in the function's `@brief`
 * (`h3api.h.in:759-762`): "Returns the 6 (or 5 for pentagons) edges associated with the H3Index".
 * A pentagon still fills all six slots, since `directedEdge.c:243` writes `H3_NULL` into slot `0`
 * rather than leaving it untouched.
 */
inline constexpr int64_t kOriginToDirectedEdgesSize = 6;

/**
 * Pins the required capacity for `cellToVertexes(H3Index origin, H3Index *vertexes)`.
 *
 * Not stated in the public header at all; the only place in the C library that gives the number
 * is the implementation, `vertex.c:298`: "Array to hold vertex output. Must have length >= 6." A
 * pentagon fills all six slots too, writing `H3_NULL` into the sixth at `vertex.c:306`.
 */
inline constexpr int64_t kCellToVertexesSize = 6;

/**
 * Pins the required capacity for `directedEdgeToCells(H3Index edge, H3Index *originDestination)`.
 *
 * Documented nowhere in the C library: both the public header (`h3api.h.in:748-751`) and the
 * implementation (`directedEdge.c:208-213`) describe the output only as an "origin, destination
 * pair". The value is inferable from the implementation writing exactly `originDestination[0]`
 * and `originDestination[1]`, and from h3-js's `const count = 2` (`h3core.js:1463`).
 */
inline constexpr int64_t kDirectedEdgeToCellsSize = 2;

/**
 * Pins the required buffer size for `h3ToString(H3Index h, char *str, size_t sz)`.
 *
 * Neither the header (`h3api.h.in:561-562`) nor the implementation (`h3Index.c:190-195`) states a
 * required size, only "Size of the buffer `str`". A `uint64_t` in lowercase hexadecimal is at most
 * sixteen characters, so seventeen bytes including the NUL terminator.
 */
inline constexpr std::size_t kH3ToStringBufferSize = 17;

} // namespace h3core
