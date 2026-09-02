//
//  FuzzPolygonRings.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 01.09.26.
//

#include <cstddef>
#include <cstdint>
#include <utility>
#include <vector>

#include "FuzzSupport.hpp"
#include "core/GeoPolygonBuilder.hpp"
#include "ops/Regions.hpp"
#include "shapes/CellSetCall.hpp"

namespace {

// a point is two doubles, so a ring or point count is never larger than the bytes left could fill
constexpr size_t kBytesPerPoint = 2 * sizeof(double);

} // namespace

extern "C" int LLVMFuzzerInitialize(int*, char***) {
  h3shapes::setMaxCellCount(h3fuzz::kMaxCellCount);
  return 0;
}

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  h3fuzz::Input input(data, size);
  const double res = static_cast<double>(input.byte() % 18) - 1.0;
  // `-1` reaches H3's `E_OPTION_INVALID` path and `0` to `3` the four containment modes
  const double flags = static_cast<double>(input.byte() % 5) - 1.0;

  std::vector<std::vector<std::vector<double>>> rings;
  const size_t ringCount = input.takeCount(kBytesPerPoint);
  rings.reserve(ringCount);
  for (size_t ring = 0; ring < ringCount; ++ring) {
    const size_t pointCount = input.takeCount(kBytesPerPoint);
    std::vector<std::vector<double>> points;
    points.reserve(pointCount);
    for (size_t point = 0; point < pointCount; ++point) {
      // raw bit patterns, so NaN and infinity land in the builder's rejection path
      points.push_back({input.number(), input.number()});
    }
    rings.push_back(std::move(points));
  }

  h3fuzz::runOp([&] {
    const h3core::GeoPolygonBuilder builder(rings);
    (void)builder.polygon();
  });
  h3fuzz::runOp([&] { (void)h3ops::polygonToCells(rings, res); });
  h3fuzz::runOp([&] { (void)h3ops::polygonToCellsExperimental(rings, res, flags); });
  return 0;
}
