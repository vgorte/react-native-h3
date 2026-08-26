//
//  CellSetCall.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <string>
#include <utility>

#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"

namespace h3shapes {

/**
 * Caps how many cells one call may allocate, at 4,000,000 cells or 32 MB.
 *
 * `maxPolygonToCellsSize` returns an `int64_t` with no upper bound of its own, and a large polygon
 * at resolution 15 reports a number that would exhaust device memory, where the process is killed
 * long before `std::bad_alloc` could reach the caller. Raising this later only admits more inputs,
 * whereas lowering it would break callers, so it starts conservative.
 */
inline constexpr int64_t kMaxCellCount = 4000000;

namespace detail {

/** Runs the size query, rejects an impossible or unaffordable answer, and allocates. */
template <typename SizeQuery> h3core::CellBuffer allocateFor(SizeQuery&& sizeQuery) {
  const int64_t size = sizeQuery();
  if (size < 0) {
    h3core::throwInvalidArgument("H3 reported a negative output size");
  }
  if (size > kMaxCellCount) {
    // not `E_MEMORY_ALLOC`'s wording: nothing has been allocated, so that would misdirect a reader
    const std::string message =
        "The requested result would exceed this binding's limit of " + std::to_string(kMaxCellCount) + " cells";
    h3core::throwInvalidArgument(message.c_str());
  }
  return h3core::CellBuffer(size);
}

} // namespace detail

/**
 * Allocates what `sizeQuery` reports, hands `fill` a zeroed buffer of exactly that capacity, and
 * removes the `H3_NULL` holes. `sizeQuery` is any callable returning `int64_t`, so a size function,
 * a formula such as `maxGridRingSize`, a constant from `BufferSizes.hpp` and a caller's own input
 * length all fit, and it is expected to throw on failure as `h3shapes::callWithOutParam` does.
 *
 * On any error the `CellBuffer` is destroyed while the exception unwinds, so a partial write such
 * as `gridRingUnsafe`'s on `E_PENTAGON` is discarded rather than read.
 */
template <typename SizeQuery, typename Fill> h3core::CellBuffer fillCompactedCells(SizeQuery&& sizeQuery, Fill&& fill) {
  h3core::CellBuffer buffer = detail::allocateFor(std::forward<SizeQuery>(sizeQuery));
  h3core::throwOnError(static_cast<uint32_t>(fill(buffer.data())));
  buffer.compact();
  return buffer;
}

/**
 * Fills as `fillCompactedCells` does but publishes the whole capacity as the count, for the
 * functions whose output size is documented as exact: `getRes0Cells`, `getPentagons`,
 * `cellToChildren`, `gridPathCells` and `uncompactCells`.
 *
 * Splitting these off is a safety property rather than an optimisation: were H3 ever to write an
 * `H3_NULL` into one of these outputs, compacting it away would silently shorten a result whose
 * length the caller is entitled to trust.
 */
template <typename SizeQuery, typename Fill> h3core::CellBuffer fillExactCells(SizeQuery&& sizeQuery, Fill&& fill) {
  h3core::CellBuffer buffer = detail::allocateFor(std::forward<SizeQuery>(sizeQuery));
  h3core::throwOnError(static_cast<uint32_t>(fill(buffer.data())));
  buffer.setCount(buffer.capacity());
  return buffer;
}

} // namespace h3shapes
