//
//  Edges.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Edges.hpp"

#include "core/BufferSizes.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

bool areNeighborCells(uint64_t origin, uint64_t destination) {
  // an index whose mode bits happen to say cell reaches the `gridDisk` walk unchecked
  // (`directedEdge.c:112`) and simply comes back as not a neighbour
  internal::requireValidCell(origin);
  internal::requireValidCell(destination);
  return h3shapes::callWithOutParam<int>(::areNeighborCells, origin, destination) != 0;
}

uint64_t cellsToDirectedEdge(uint64_t origin, uint64_t destination) {
  // `directionForNeighbor` reports `E_NOT_NEIGHBORS` for a malformed cell (`directedEdge.c:138`),
  // which would blame the pair rather than the index
  internal::requireValidCell(origin);
  internal::requireValidCell(destination);
  return h3shapes::callWithOutParam<uint64_t>(::cellsToDirectedEdge, origin, destination);
}

uint64_t getDirectedEdgeOrigin(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<uint64_t>(::getDirectedEdgeOrigin, edge);
}

uint64_t getDirectedEdgeDestination(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<uint64_t>(::getDirectedEdgeDestination, edge);
}

uint64_t reverseDirectedEdge(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<uint64_t>(::reverseDirectedEdge, edge);
}

h3core::CellBuffer directedEdgeToCells(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  // no size function exists for this one; the constant and its provenance live in `BufferSizes.hpp`
  return h3shapes::fillExactCells([] { return h3core::kDirectedEdgeToCellsSize; },
                                  [&](uint64_t* out) { return ::directedEdgeToCells(edge, out); });
}

h3core::CellBuffer originToDirectedEdges(uint64_t origin) {
  // `originToDirectedEdges` validates nothing at all (`directedEdge.c:234`)
  internal::requireValidCell(origin);
  // six slots always; a pentagon leaves one `H3_NULL`, which compaction removes
  return h3shapes::fillCompactedCells([] { return h3core::kOriginToDirectedEdgesSize; },
                                      [&](uint64_t* out) { return ::originToDirectedEdges(origin, out); });
}

h3core::Ring directedEdgeToBoundary(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return internal::toRing(h3shapes::callWithOutParam<::CellBoundary>(::directedEdgeToBoundary, edge));
}

double edgeLengthKm(uint64_t edge) {
  // all three lengths run through `directedEdgeToBoundary` (`latLng.c:285`), so they inherit its
  // mode-only check and would measure a malformed edge
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<double>(::edgeLengthKm, edge);
}

double edgeLengthM(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<double>(::edgeLengthM, edge);
}

double edgeLengthRads(uint64_t edge) {
  internal::requireValidDirectedEdge(edge);
  return h3shapes::callWithOutParam<double>(::edgeLengthRads, edge);
}

} // namespace h3ops
