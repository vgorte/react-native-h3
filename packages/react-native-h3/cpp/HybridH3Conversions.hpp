//
//  HybridH3Conversions.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstddef>
#include <cstdint>
#include <memory>
#include <vector>

#include "HybridH3Spec.hpp"
#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"
#include "core/H3ErrorMapping.hpp"

namespace margelo::nitro::h3::detail {

/** Hands a filled `CellBuffer` to JS as an owning `ArrayBuffer` of exactly `count() * 8` bytes. */
inline std::shared_ptr<ArrayBuffer> toArrayBuffer(h3core::CellBuffer&& buffer) {
  const int64_t count = buffer.count();
  uint64_t* cells = buffer.release();
  if (cells == nullptr) {
    // unreachable for a non-empty result; `wrap` rejects `nullptr`, `new uint64_t[0]` does not
    cells = new uint64_t[0];
  }
  // the deleter frees the `uint64_t*` allocated above, never the `uint8_t*` wrapped below
  return ArrayBuffer::wrap(reinterpret_cast<uint8_t*>(cells), static_cast<size_t>(count) * sizeof(uint64_t),
                           [cells]() { delete[] cells; });
}

/** Borrows a read-only view of a cell set that arrived from JS. */
struct CellSpan {
  const uint64_t* data;
  int64_t count;
};

/**
 * Validates an inbound `ArrayBuffer` and views it as cells.
 *
 * The span is valid only for the duration of the synchronous call, because a buffer from JS is
 * borrowing and Nitro enforces that by throwing from `data()` and `size()` off the JS thread.
 */
inline CellSpan toCellSpan(const std::shared_ptr<ArrayBuffer>& buffer) {
  if (buffer == nullptr) {
    h3core::throwInvalidArgument("Expected a cell set");
  }
  const size_t bytes = buffer->size();
  if (bytes == 0) {
    return CellSpan{nullptr, 0};
  }
  uint8_t* data = buffer->data();
  if (data == nullptr) {
    h3core::throwInvalidArgument("The cell set has already been released");
  }
  if (bytes % sizeof(uint64_t) != 0) {
    h3core::throwInvalidArgument("A cell set's byte length must be a multiple of 8");
  }
  if (reinterpret_cast<uintptr_t>(data) % alignof(uint64_t) != 0) {
    h3core::throwInvalidArgument("A cell set must be aligned to 8 bytes");
  }
  return CellSpan{reinterpret_cast<const uint64_t*>(data), static_cast<int64_t>(bytes / sizeof(uint64_t))};
}

/** Copies a ring of degrees into the generated Nitro struct. */
inline std::vector<LatLng> toLatLngs(const h3core::Ring& ring) {
  std::vector<LatLng> points;
  points.reserve(ring.size());
  for (const h3core::Point& point : ring) {
    points.push_back(LatLng(point.lat, point.lng));
  }
  return points;
}

} // namespace margelo::nitro::h3::detail
