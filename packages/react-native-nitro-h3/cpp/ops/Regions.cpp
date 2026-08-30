//
//  Regions.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Regions.hpp"

#include "core/GeoPolygonBuilder.hpp"
#include "core/LinkedGeoPolygonReader.hpp"
#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

namespace {

// `CONTAINMENT_CENTER` is `0` and is the only mode the stable `polygonToCells` accepts.
constexpr uint32_t kCenterContainment = 0;

// H3 owns the range of the mode: `validatePolygonFlags` (`polygon.c:51`) answers `E_OPTION_INVALID`
// for anything at or above `CONTAINMENT_INVALID`, which a negative mode reaches once widened.
uint32_t toContainmentMode(double flags) {
  return static_cast<uint32_t>(h3core::toInteger(flags, "Containment mode must be an integer"));
}

} // namespace

h3core::MultiPolygon cellsToMultiPolygon(const uint64_t* cells, int64_t count) {
  const h3core::LinkedGeoPolygonReader reader(cells, count);
  return reader.read();
}

h3core::CellBuffer polygonToCells(const std::vector<std::vector<std::vector<double>>>& rings, double res) {
  // `maxPolygonToCellsSize` reaches `getPentagons` through `bboxHexEstimate` (`algos.c:885`), so
  // the resolution range stays H3's and only the narrowing happens here.
  const int resolution = h3core::toResolution(res);
  // a local, so the graph outlives both the size query and the fill, which read the same pointers.
  const h3core::GeoPolygonBuilder builder(rings);
  if (builder.polygon()->geoloop.numVerts == 0) {
    // `bboxHexEstimate` answers `E_FAILED` for a bounding box of zero width (`bbox.c:203`), so an
    // empty polygon is answered here instead, as h3-js answers it in JavaScript. The short circuit
    // skips H3, so the resolution it would have range-checked is checked here, as h3-js does before
    // its own guard.
    internal::requireResolution(resolution);
    return h3core::CellBuffer(0);
  }
  return h3shapes::fillCompactedCells(
      [&] {
        return h3shapes::callWithOutParam<int64_t>(::maxPolygonToCellsSize, builder.polygon(), resolution,
                                                   kCenterContainment);
      },
      [&](uint64_t* out) { return ::polygonToCells(builder.polygon(), resolution, kCenterContainment, out); });
}

h3core::CellBuffer polygonToCellsExperimental(const std::vector<std::vector<std::vector<double>>>& rings, double res,
                                              double flags) {
  const int resolution = h3core::toResolution(res);
  const uint32_t mode = toContainmentMode(flags);
  const h3core::GeoPolygonBuilder builder(rings);

  // the only H3 function that takes its own computed size back as an argument, which is why the
  // size is captured rather than only used to allocate.
  int64_t size = 0;
  return h3shapes::fillCompactedCells(
      [&] {
        size = h3shapes::callWithOutParam<int64_t>(::maxPolygonToCellsSizeExperimental, builder.polygon(), resolution,
                                                   mode);
        return size;
      },
      [&](uint64_t* out) { return ::polygonToCellsExperimental(builder.polygon(), resolution, mode, size, out); });
}

} // namespace h3ops
