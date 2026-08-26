//
//  HybridH3.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "HybridH3.hpp"

#include <cstdint>
#include <memory>
#include <utility>
#include <vector>

#include "HybridH3Conversions.hpp"
#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"
#include "ops/Indexing.hpp"
#include "ops/Regions.hpp"

extern "C" {
#include "h3api.h"
}

using namespace margelo::nitro::h3::detail;

namespace margelo::nitro::h3 {

uint64_t HybridH3::latLngToCell(double lat, double lng, double res) {
  return h3ops::latLngToCell(lat, lng, res);
}

LatLng HybridH3::cellToLatLng(uint64_t cell) {
  const h3core::Point centre = h3ops::cellToLatLng(cell);
  return LatLng(centre.lat, centre.lng);
}

std::vector<LatLng> HybridH3::cellToBoundary(uint64_t cell) {
  return toLatLngs(h3ops::cellToBoundary(cell));
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
  buffer.compact();
  return toArrayBuffer(std::move(buffer));
}

std::vector<std::vector<std::vector<LatLng>>> HybridH3::cellsToMultiPolygon(const std::shared_ptr<ArrayBuffer>& cells) {
  const CellSpan span = toCellSpan(cells);
  const h3core::MultiPolygon polygons = h3ops::cellsToMultiPolygon(span.data, span.count);

  std::vector<std::vector<std::vector<LatLng>>> result;
  result.reserve(polygons.size());
  for (const h3core::Polygon& polygon : polygons) {
    std::vector<std::vector<LatLng>> loops;
    loops.reserve(polygon.size());
    for (const h3core::Ring& ring : polygon) {
      loops.push_back(toLatLngs(ring));
    }
    result.push_back(std::move(loops));
  }
  return result;
}

} // namespace margelo::nitro::h3
