//
//  HybridH3.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "HybridH3.hpp"

#include <cmath>
#include <cstdint>

#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"

extern "C" {
#include "h3api.h"
}

namespace margelo::nitro::h3 {

namespace {

/**
 * Narrows a JS number to `int`, throwing `what` when it is not an exact integer that fits.
 *
 * Only the narrowing belongs here. Every domain rule (a resolution of `0` to `15`, a
 * non-negative `k`) is H3's, so that upstream's `describeH3Error` wording is what reaches
 * JavaScript.
 */
int toInteger(double value, const char* what) {
  if (std::isnan(value) || std::isinf(value) || value != std::floor(value)) {
    h3core::throwInvalidArgument(what);
  }
  if (value < static_cast<double>(INT32_MIN) || value > static_cast<double>(INT32_MAX)) {
    h3core::throwInvalidArgument(what);
  }
  return static_cast<int>(value);
}

int toResolution(double res) {
  return toInteger(res, "Resolution must be an integer between 0 and 15");
}

}  // namespace

uint64_t HybridH3::latLngToCell(double lat, double lng, double res) {
  LatLng coordinate{};
  // H3 takes radians; the public API takes degrees, matching h3-js
  coordinate.lat = ::degsToRads(lat);
  coordinate.lng = ::degsToRads(lng);

  H3Index cell = H3_NULL;
  // the leading `::` picks the C function; unqualified recurses into this member
  h3core::throwOnError(::latLngToCell(&coordinate, toResolution(res), &cell));
  return cell;
}

std::shared_ptr<ArrayBuffer> HybridH3::gridDisk(uint64_t origin, double k) {
  const int distance = toInteger(k, "k must be a non-negative integer");

  int64_t maxSize = 0;
  // rejects a negative `k` with `E_DOMAIN` (`algos.c:169`)
  h3core::throwOnError(::maxGridDiskSize(distance, &maxSize));

  h3core::CellBuffer buffer(maxSize);
  // the leading `::` picks the C function; unqualified recurses into this member
  h3core::throwOnError(::gridDisk(origin, distance, buffer.data()));

  const int64_t count = buffer.compact();
  uint64_t* cells = buffer.release();
  if (cells == nullptr) {
    // unreachable for a valid k, since `maxGridDiskSize` is at least 1
    // `new uint64_t[0]` is unique, freeable and non-null, which `wrap` requires
    cells = new uint64_t[0];
  }
  // the deleter frees the `uint64_t*` allocated here, never the `uint8_t*` wrapped below
  return ArrayBuffer::wrap(reinterpret_cast<uint8_t*>(cells),
                           static_cast<size_t>(count) * sizeof(uint64_t),
                           [cells]() { delete[] cells; });
}

}  // namespace margelo::nitro::h3
