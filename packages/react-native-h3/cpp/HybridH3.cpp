//
//  HybridH3.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "HybridH3.hpp"

#include <cstdint>
#include <memory>

#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"

extern "C" {
#include "h3api.h"
}

namespace margelo::nitro::h3 {

uint64_t HybridH3::latLngToCell(double lat, double lng, double res) {
  LatLng coordinate{};
  // H3 takes radians; the public API takes degrees, matching h3-js
  coordinate.lat = ::degsToRads(lat);
  coordinate.lng = ::degsToRads(lng);

  H3Index cell = H3_NULL;
  // the leading `::` picks the C function; unqualified recurses into this member
  h3core::throwOnError(::latLngToCell(&coordinate, h3core::toResolution(res), &cell));
  return cell;
}

std::shared_ptr<ArrayBuffer> HybridH3::gridDisk(uint64_t origin, double k) {
  // H3's `gridDisk` does not validate its origin (`algos.c:200`)
  if (!::isValidCell(origin)) {
    h3core::throwOnError(E_CELL_INVALID);
  }

  const int distance = h3core::toInteger(k, "k must be an integer");

  int64_t maxSize = 0;
  // rejects a negative `k` with `E_DOMAIN` (`algos.c:169`)
  h3core::throwOnError(::maxGridDiskSize(distance, &maxSize));

  h3core::CellBuffer buffer(maxSize);
  // the leading `::` picks the C function; unqualified recurses into this member
  h3core::throwOnError(::gridDisk(origin, distance, buffer.data()));

  const int64_t count = buffer.compact();
  // holds the block until `wrap` has taken it, so a throw in between does not leak
  std::unique_ptr<uint64_t[]> owned(buffer.release());
  if (owned == nullptr) {
    // unreachable for a valid k, since `maxGridDiskSize` is at least 1
    // `new uint64_t[0]` is unique, freeable and non-null, which `wrap` requires
    owned.reset(new uint64_t[0]);
  }

  uint64_t* cells = owned.get();
  // the deleter frees the `uint64_t*` allocated here, never the `uint8_t*` wrapped below
  auto wrapped = ArrayBuffer::wrap(reinterpret_cast<uint8_t*>(cells), static_cast<size_t>(count) * sizeof(uint64_t),
                                   [cells]() { delete[] cells; });
  owned.release();
  return wrapped;
}

} // namespace margelo::nitro::h3
