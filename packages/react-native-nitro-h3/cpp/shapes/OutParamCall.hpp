//
//  OutParamCall.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/H3ErrorMapping.hpp"

namespace h3shapes {

/**
 * Calls any H3 function of the form `H3Error f(Args..., Out* out)` and returns the out-param by
 * value, so no call site can forget that even a size query is fallible. `Out` is unconstrained on
 * purpose: `double`, `int`, `int64_t`, `H3Index` and the aggregates `LatLng`, `CellBoundary` and
 * `CoordIJ` all work, because the body does not vary with any of them.
 *
 * Stays free of Nitro so it can run in the host test target under AddressSanitizer.
 */
template <typename Out, typename Fn, typename... Args> Out callWithOutParam(Fn fn, Args... args) {
  Out out{};
  // passing `&out` leaves `CellBoundary`'s alignment to the compiler, never to an offset
  h3core::throwOnError(static_cast<uint32_t>(fn(args..., &out)));
  return out;
}

} // namespace h3shapes
