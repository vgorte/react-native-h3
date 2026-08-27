//
//  Vertexes.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Vertexes.hpp"

#include "core/BufferSizes.hpp"
#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

namespace {

constexpr const char* kIntegerVertexNum = "Vertex number must be an integer";

} // namespace

uint64_t cellToVertex(uint64_t cell, double vertexNum) {
  // `cellToVertex` range-checks the number but never the cell (`vertex.c:212`)
  internal::requireValidCell(cell);
  // no range check here: H3 owns the range and answers `E_DOMAIN` outside `0` to `5` (`vertex.c:217`)
  return h3shapes::callWithOutParam<uint64_t>(::cellToVertex, cell, h3core::toInteger(vertexNum, kIntegerVertexNum));
}

h3core::CellBuffer cellToVertexes(uint64_t cell) {
  internal::requireValidCell(cell);
  // the size is stated only in `vertex.c:298`, never in the header; a pentagon leaves one `H3_NULL`
  return h3shapes::fillCompactedCells([] { return h3core::kCellToVertexesSize; },
                                      [&](uint64_t* out) { return ::cellToVertexes(cell, out); });
}

h3core::Point vertexToLatLng(uint64_t vertex) {
  internal::requireValidVertex(vertex);
  const ::LatLng point = h3shapes::callWithOutParam<::LatLng>(::vertexToLatLng, vertex);
  return h3core::Point{::radsToDegs(point.lat), ::radsToDegs(point.lng)};
}

} // namespace h3ops
