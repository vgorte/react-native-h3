//
//  Internal.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/H3ErrorMapping.hpp"

extern "C" {
#include "h3api.h"
}

/**
 * Holds the guards the operations share. Header-only, and like the rest of `cpp/ops` free of Nitro,
 * so the host tests keep reaching the production code path.
 */
namespace h3ops::internal {

// `MAX_H3_RES` is private to the C library (`h3Index.c:137` reads it), so the ceiling is restated
// here rather than reached for through a private header.
inline constexpr int kMaxResolution = 15;

/**
 * Rejects a cell H3 would read anyway, with `E_CELL_INVALID`.
 *
 * Many H3 entry points reach `_h3ToFaceIjk`, which checks only the base cell range
 * (`h3Index.c:1120`), so a malformed index such as `1` otherwise yields an answer rather than an
 * error.
 */
inline void requireValidCell(uint64_t cell) {
  if (!::isValidCell(cell)) {
    h3core::throwOnError(E_CELL_INVALID);
  }
}

/**
 * Rejects a resolution outside `0` to `15`, with `E_RES_DOMAIN`.
 *
 * For operations whose own checks would otherwise run before H3 sees the resolution, so that a
 * nonsense resolution still reaches the caller in H3's wording.
 */
inline void requireResolution(int res) {
  if (res < 0 || res > kMaxResolution) {
    h3core::throwOnError(E_RES_DOMAIN);
  }
}

} // namespace h3ops::internal
