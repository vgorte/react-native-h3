//
//  FuzzScalarOps.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 01.09.26.
//

#include <cstddef>
#include <cstdint>
#include <vector>

#include "FuzzSupport.hpp"
#include "core/Validation.hpp"
#include "ops/Edges.hpp"
#include "ops/Hierarchy.hpp"
#include "ops/Indexing.hpp"
#include "ops/Inspection.hpp"
#include "ops/Misc.hpp"
#include "ops/Traversal.hpp"
#include "ops/Vertexes.hpp"
#include "shapes/CellSetCall.hpp"

extern "C" int LLVMFuzzerInitialize(int*, char***) {
  h3shapes::setMaxCellCount(h3fuzz::kMaxCellCount);
  return 0;
}

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  h3fuzz::Input input(data, size);

  const uint64_t origin = input.cell();
  const uint64_t destination = input.cell();
  const double lat = input.number();
  const double lng = input.number();
  // a raw bit pattern, so the narrowing in `Validation` sees NaN, infinity and fractions
  const double childPos = input.number();

  const double res = static_cast<double>(input.byte() % 18) - 1.0;
  // bounded so that one execution stays cheap under AddressSanitizer
  const double k = static_cast<double>(input.byte() % 128) - 1.0;
  const double i = static_cast<double>(static_cast<int8_t>(input.byte()));
  const double j = static_cast<double>(static_cast<int8_t>(input.byte()));
  const double vertexNum = static_cast<double>(input.byte() % 8) - 1.0;
  const double digit = static_cast<double>(input.byte() % 18) - 1.0;
  const double baseCellNumber = static_cast<double>(input.byte());

  std::vector<double> digits;
  const size_t digitCount = input.takeCount(1);
  digits.reserve(digitCount);
  for (size_t index = 0; index < digitCount; ++index) {
    digits.push_back(static_cast<double>(input.byte() % 8));
  }

  h3fuzz::runOp([&] { (void)h3core::toInteger(childPos, "fuzz"); });
  h3fuzz::runOp([&] { (void)h3core::toInt64(childPos, "fuzz"); });
  h3fuzz::runOp([&] { (void)h3core::toResolution(childPos); });

  h3fuzz::runOp([&] { (void)h3ops::latLngToCell(lat, lng, res); });
  h3fuzz::runOp([&] { (void)h3ops::cellToLatLng(origin); });
  h3fuzz::runOp([&] { (void)h3ops::cellToBoundary(origin); });

  h3fuzz::runOp([&] { (void)h3ops::gridDisk(origin, k); });
  h3fuzz::runOp([&] { (void)h3ops::gridDiskDistances(origin, k); });
  h3fuzz::runOp([&] { (void)h3ops::gridRing(origin, k); });
  h3fuzz::runOp([&] { (void)h3ops::gridRingUnsafe(origin, k); });
  h3fuzz::runOp([&] { (void)h3ops::gridPathCells(origin, destination); });
  h3fuzz::runOp([&] { (void)h3ops::gridDistance(origin, destination); });
  h3fuzz::runOp([&] { (void)h3ops::cellToLocalIj(origin, destination); });
  h3fuzz::runOp([&] { (void)h3ops::localIjToCell(origin, i, j); });

  h3fuzz::runOp([&] { (void)h3ops::cellToParent(origin, res); });
  h3fuzz::runOp([&] { (void)h3ops::cellToCenterChild(origin, res); });
  h3fuzz::runOp([&] { (void)h3ops::cellToChildrenSize(origin, res); });
  h3fuzz::runOp([&] { (void)h3ops::cellToChildren(origin, res); });
  h3fuzz::runOp([&] { (void)h3ops::cellToChildPos(origin, res); });
  h3fuzz::runOp([&] { (void)h3ops::childPosToCell(childPos, origin, res); });

  h3fuzz::runOp([&] { (void)h3ops::areNeighborCells(origin, destination); });
  h3fuzz::runOp([&] { (void)h3ops::cellsToDirectedEdge(origin, destination); });
  h3fuzz::runOp([&] { (void)h3ops::originToDirectedEdges(origin); });
  h3fuzz::runOp([&] { (void)h3ops::directedEdgeToCells(origin); });
  h3fuzz::runOp([&] { (void)h3ops::directedEdgeToBoundary(origin); });

  h3fuzz::runOp([&] { (void)h3ops::cellToVertex(origin, vertexNum); });
  h3fuzz::runOp([&] { (void)h3ops::cellToVertexes(origin); });
  h3fuzz::runOp([&] { (void)h3ops::vertexToLatLng(origin); });

  h3fuzz::runOp([&] { (void)h3ops::getIcosahedronFaces(origin); });
  h3fuzz::runOp([&] { (void)h3ops::getPentagons(res); });
  h3fuzz::runOp([&] { (void)h3ops::getIndexDigit(origin, digit); });
  h3fuzz::runOp([&] { (void)h3ops::constructCell(baseCellNumber, digits, res); });
  return 0;
}
