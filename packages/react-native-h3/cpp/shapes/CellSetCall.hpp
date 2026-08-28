//
//  CellSetCall.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <atomic>
#include <cstdint>
#include <string>
#include <utility>

#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"

namespace h3shapes {

/**
 * The cell ceiling one call may allocate, at 4,000,000 cells or 32 MB by default.
 *
 * `maxPolygonToCellsSize` returns an `int64_t` with no upper bound of its own, and a large polygon
 * at resolution 15 reports a number that would exhaust device memory, where the process is killed
 * long before `std::bad_alloc` could reach the caller. An application that knows its device can
 * afford more raises it, so the default is conservative rather than final.
 */
inline constexpr int64_t kDefaultMaxCellCount = 4000000;

/**
 * The ceiling in force. Atomic because a worker thread reads it while JavaScript may be setting it;
 * relaxed ordering is enough, since the value publishes nothing but itself.
 */
inline std::atomic<int64_t> gMaxCellCount{kDefaultMaxCellCount};

/** Replaces the ceiling. `std::numeric_limits<int64_t>::max()` is how a caller switches it off. */
inline void setMaxCellCount(int64_t limit) {
  gMaxCellCount.store(limit, std::memory_order_relaxed);
}

/** Returns the ceiling in force. */
inline int64_t maxCellCount() {
  return gMaxCellCount.load(std::memory_order_relaxed);
}

/**
 * Runs the size query, rejects an impossible or unaffordable answer, and allocates.
 *
 * Public because the ceiling is a property of the binding rather than of one template:
 * `gridDiskDistances` allocates a parallel distance array of its own and so cannot use either fill
 * below, but must still meet the same limit and report it in the same words.
 */
template <typename SizeQuery> h3core::CellBuffer allocateFor(SizeQuery&& sizeQuery) {
  const int64_t size = sizeQuery();
  if (size < 0) {
    h3core::throwInvalidArgument("H3 reported a negative output size");
  }
  // read once, so the number in the message is the number that was compared against
  const int64_t limit = maxCellCount();
  if (size > limit) {
    // not `E_MEMORY_ALLOC`'s wording: nothing has been allocated, so that would misdirect a reader
    const std::string message = "The requested result of " + std::to_string(size) +
                                " cells exceeds the cell limit of " + std::to_string(limit) +
                                ", which guards against exhausting device memory. Raise it with configure({ "
                                "maxCellCount })";
    h3core::throwInvalidArgument(message.c_str());
  }
  return h3core::CellBuffer(size);
}

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
  h3core::CellBuffer buffer = allocateFor(std::forward<SizeQuery>(sizeQuery));
  h3core::throwOnError(static_cast<uint32_t>(fill(buffer.data())));
  buffer.compact();
  return buffer;
}

/**
 * Fills as `fillCompactedCells` does but publishes the whole capacity as the count, for the
 * functions whose output size is documented as exact: `getRes0Cells`, `getPentagons`,
 * `cellToChildren`, `gridPathCells`, `uncompactCells` and `directedEdgeToCells`.
 *
 * Splitting these off is a safety property rather than an optimisation: were H3 ever to write an
 * `H3_NULL` into one of these outputs, compacting it away would silently shorten a result whose
 * length the caller is entitled to trust.
 */
template <typename SizeQuery, typename Fill> h3core::CellBuffer fillExactCells(SizeQuery&& sizeQuery, Fill&& fill) {
  h3core::CellBuffer buffer = allocateFor(std::forward<SizeQuery>(sizeQuery));
  h3core::throwOnError(static_cast<uint32_t>(fill(buffer.data())));
  buffer.setCount(buffer.capacity());
  return buffer;
}

} // namespace h3shapes
