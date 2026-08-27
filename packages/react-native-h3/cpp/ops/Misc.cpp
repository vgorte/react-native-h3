//
//  Misc.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Misc.hpp"

#include <cstddef>

#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

// each of these rejects a resolution outside `0` to `15` with `E_RES_DOMAIN` (`latLng.c:220`), so
// only the narrowing happens here.
double getHexagonAreaAvgKm2(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonAreaAvgKm2, h3core::toResolution(res));
}

double getHexagonAreaAvgM2(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonAreaAvgM2, h3core::toResolution(res));
}

double getHexagonEdgeLengthAvgKm(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonEdgeLengthAvgKm, h3core::toResolution(res));
}

double getHexagonEdgeLengthAvgM(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonEdgeLengthAvgM, h3core::toResolution(res));
}

int64_t getNumCells(double res) {
  return h3shapes::callWithOutParam<int64_t>(::getNumCells, h3core::toResolution(res));
}

h3core::CellBuffer getRes0Cells() {
  // `res0CellCount` cannot fail and the output is exactly `NUM_BASE_CELLS` entries with no padding
  // (`baseCells.c:931`), so this is the exact path.
  return h3shapes::fillExactCells([] { return static_cast<int64_t>(::res0CellCount()); },
                                  [](uint64_t* out) { return ::getRes0Cells(out); });
}

h3core::CellBuffer getPentagons(double res) {
  // `getPentagons` answers `E_RES_DOMAIN` itself (`h3Index.c:1335`), so only the narrowing happens
  // here; the size is `pentagonCount`, which is twelve at every resolution.
  const int resolution = h3core::toResolution(res);
  return h3shapes::fillExactCells([] { return static_cast<int64_t>(::pentagonCount()); },
                                  [&](uint64_t* out) { return ::getPentagons(resolution, out); });
}

std::vector<int> getIcosahedronFaces(uint64_t cell) {
  // `getIcosahedronFaces` reaches `_h3ToFaceIjk`, which checks only the base cell range
  // (`h3Index.c:1120`), so `1` otherwise answers with face `1`
  internal::requireValidCell(cell);
  // the one cell set whose elements are `int` with a `-1` sentinel rather than `H3Index` with
  // `H3_NULL`, so it is written out rather than pushed through `CellBuffer`
  const int maxFaces = h3shapes::callWithOutParam<int>(::maxFaceCount, cell);
  std::vector<int> slots(static_cast<size_t>(maxFaces), -1);
  h3core::throwOnError(static_cast<uint32_t>(::getIcosahedronFaces(cell, slots.data())));

  std::vector<int> faces;
  faces.reserve(slots.size());
  for (const int face : slots) {
    // the sentinel is `-1`, never `0`: face `0` is a real face (`faceijk.h:60`)
    if (face != -1) {
      faces.push_back(face);
    }
  }
  return faces;
}

} // namespace h3ops
