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

/**
 * Rejects a cell H3 would read anyway, with `E_CELL_INVALID`.
 *
 * Most H3 functions check only the base cell range (`h3Index.c:1120`), so a malformed index such as
 * `1` otherwise yields an answer rather than an error.
 */
inline void requireValidCell(uint64_t cell) {
  if (!::isValidCell(cell)) {
    h3core::throwOnError(E_CELL_INVALID);
  }
}

} // namespace h3ops::internal
