//
//  Regions.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Regions.hpp"

#include <limits>

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
// `CONTAINMENT_FULL`, `CONTAINMENT_OVERLAPPING` and `CONTAINMENT_OVERLAPPING_BBOX` (`h3api.h:183`).
constexpr uint32_t kFullContainment = 1;
constexpr uint32_t kOverlappingContainment = 2;
constexpr uint32_t kOverlappingBboxContainment = 3;

// H3 owns the range of the mode: `validatePolygonFlags` (`polygon.c:51`) answers `E_OPTION_INVALID`
// for anything at or above `CONTAINMENT_INVALID`, which a negative mode reaches once widened.
uint32_t toContainmentMode(double flags) {
  return static_cast<uint32_t>(h3core::toInteger(flags, "Containment mode must be an integer"));
}

/** Returns the length of one ring in cell edges, the closing edge included. */
double ringEdgeSteps(const ::GeoLoop& loop, double edgeKm) {
  double steps = 0.0;
  for (int i = 0; i < loop.numVerts; i++) {
    const ::LatLng& from = loop.verts[i];
    const ::LatLng& to = loop.verts[(i + 1) % loop.numVerts];
    steps += ::greatCircleDistanceKm(&from, &to) / edgeKm;
  }
  return steps;
}

/**
 * Returns an upper bound on the cells an outline of no area can overlap: three cells per edge step,
 * which is what a straight line can touch as it crosses a row, plus one per vertex. Saturates at
 * `INT64_MAX` rather than wrapping, so an unpriceable outline is refused rather than admitted.
 */
int64_t outlineCellBound(const ::GeoPolygon* polygon, int resolution) {
  double edgeKm = 0.0;
  if (::getHexagonEdgeLengthAvgKm(resolution, &edgeKm) != E_SUCCESS || edgeKm <= 0.0) {
    return std::numeric_limits<int64_t>::max();
  }
  double steps = ringEdgeSteps(polygon->geoloop, edgeKm);
  double verts = static_cast<double>(polygon->geoloop.numVerts);
  for (int i = 0; i < polygon->numHoles; i++) {
    steps += ringEdgeSteps(polygon->holes[i], edgeKm);
    verts += static_cast<double>(polygon->holes[i].numVerts);
  }
  const double bound = steps * 3.0 + verts;
  // false for a NaN too, which is the answer for a coordinate H3 cannot measure
  if (!(bound < static_cast<double>(std::numeric_limits<int64_t>::max()))) {
    return std::numeric_limits<int64_t>::max();
  }
  return static_cast<int64_t>(bound);
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

  if (h3shapes::maxCellCount() != h3shapes::kNoCellLimit && builder.polygon()->geoloop.numVerts > 0) {
    // `maxPolygonToCellsSizeExperimental` counts the polygon out cell by cell (`polyfill.c:775`),
    // and a sliver bounding box leaves that walk at the requested resolution for minutes. The
    // stable bound is a formula, so a ceiling refuses from it first.
    int64_t stableSize = 0;
    if (::maxPolygonToCellsSize(builder.polygon(), resolution, kCenterContainment, &stableSize) == E_SUCCESS) {
      h3shapes::requireWithinCellLimit(stableSize);
    } else if (mode == kCenterContainment || mode == kFullContainment) {
      // the estimate H3 declines is the one for a bounding box of no area (`bbox.c:203`), and such
      // a polygon holds no cell centre and no whole cell, which is what the walk answers too.
      return h3core::CellBuffer(0);
    } else if (mode == kOverlappingContainment || mode == kOverlappingBboxContainment) {
      // an outline of no area still overlaps the cells it crosses, and its length prices those
      h3shapes::requireWithinCellLimit(outlineCellBound(builder.polygon(), resolution));
    }
    // an invalid mode falls through, so H3 keeps reporting it
  }

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
