//
//  HybridH3.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "HybridH3.hpp"

#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "HybridH3Conversions.hpp"
#include "core/CellBuffer.hpp"
#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"
#include "ops/Hierarchy.hpp"
#include "ops/Indexing.hpp"
#include "ops/Inspection.hpp"
#include "ops/Measurement.hpp"
#include "ops/Misc.hpp"
#include "ops/Regions.hpp"
#include "ops/Units.hpp"

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

double HybridH3::degsToRads(double degrees) {
  return h3ops::degsToRads(degrees);
}

double HybridH3::radsToDegs(double radians) {
  return h3ops::radsToDegs(radians);
}

bool HybridH3::isValidCell(uint64_t cell) {
  return h3ops::isValidCell(cell);
}

bool HybridH3::isValidIndex(uint64_t index) {
  return h3ops::isValidIndex(index);
}

bool HybridH3::isValidDirectedEdge(uint64_t edge) {
  return h3ops::isValidDirectedEdge(edge);
}

bool HybridH3::isValidVertex(uint64_t vertex) {
  return h3ops::isValidVertex(vertex);
}

bool HybridH3::isPentagon(uint64_t cell) {
  return h3ops::isPentagon(cell);
}

bool HybridH3::isResClassIII(uint64_t cell) {
  return h3ops::isResClassIII(cell);
}

double HybridH3::getResolution(uint64_t index) {
  return static_cast<double>(h3ops::getResolution(index));
}

double HybridH3::getBaseCellNumber(uint64_t cell) {
  return static_cast<double>(h3ops::getBaseCellNumber(cell));
}

double HybridH3::getIndexDigit(uint64_t cell, double digit) {
  return static_cast<double>(h3ops::getIndexDigit(cell, digit));
}

uint64_t HybridH3::constructCell(double baseCellNumber, const std::vector<double>& digits, double res) {
  return h3ops::constructCell(baseCellNumber, digits, res);
}

std::string HybridH3::cellToString(uint64_t cell) {
  return h3ops::cellToString(cell);
}

uint64_t HybridH3::cellFromString(const std::string& text) {
  return h3ops::cellFromString(text);
}

double HybridH3::cellAreaKm2(uint64_t cell) {
  return h3ops::cellAreaKm2(cell);
}

double HybridH3::cellAreaM2(uint64_t cell) {
  return h3ops::cellAreaM2(cell);
}

double HybridH3::cellAreaRads2(uint64_t cell) {
  return h3ops::cellAreaRads2(cell);
}

double HybridH3::greatCircleDistanceKm(double lat1, double lng1, double lat2, double lng2) {
  return h3ops::greatCircleDistanceKm(lat1, lng1, lat2, lng2);
}

double HybridH3::greatCircleDistanceM(double lat1, double lng1, double lat2, double lng2) {
  return h3ops::greatCircleDistanceM(lat1, lng1, lat2, lng2);
}

double HybridH3::greatCircleDistanceRads(double lat1, double lng1, double lat2, double lng2) {
  return h3ops::greatCircleDistanceRads(lat1, lng1, lat2, lng2);
}

uint64_t HybridH3::cellToParent(uint64_t cell, double res) {
  return h3ops::cellToParent(cell, res);
}

uint64_t HybridH3::cellToCenterChild(uint64_t cell, double res) {
  return h3ops::cellToCenterChild(cell, res);
}

double HybridH3::cellToChildrenSize(uint64_t cell, double res) {
  // at most `getNumCells(15)`, well inside `2^53 - 1`, so the widening is exact
  return static_cast<double>(h3ops::cellToChildrenSize(cell, res));
}

double HybridH3::cellToChildPos(uint64_t cell, double parentRes) {
  return static_cast<double>(h3ops::cellToChildPos(cell, parentRes));
}

uint64_t HybridH3::childPosToCell(double childPos, uint64_t parent, double childRes) {
  return h3ops::childPosToCell(childPos, parent, childRes);
}

std::shared_ptr<ArrayBuffer> HybridH3::cellToChildren(uint64_t cell, double res) {
  return toArrayBuffer(h3ops::cellToChildren(cell, res));
}

std::shared_ptr<ArrayBuffer> HybridH3::compactCells(const std::shared_ptr<ArrayBuffer>& cells) {
  const CellSpan span = toCellSpan(cells);
  return toArrayBuffer(h3ops::compactCells(span.data, span.count));
}

std::shared_ptr<ArrayBuffer> HybridH3::uncompactCells(const std::shared_ptr<ArrayBuffer>& cells, double res) {
  const CellSpan span = toCellSpan(cells);
  return toArrayBuffer(h3ops::uncompactCells(span.data, span.count, res));
}

double HybridH3::getHexagonAreaAvgKm2(double res) {
  return h3ops::getHexagonAreaAvgKm2(res);
}

double HybridH3::getHexagonAreaAvgM2(double res) {
  return h3ops::getHexagonAreaAvgM2(res);
}

double HybridH3::getHexagonEdgeLengthAvgKm(double res) {
  return h3ops::getHexagonEdgeLengthAvgKm(res);
}

double HybridH3::getHexagonEdgeLengthAvgM(double res) {
  return h3ops::getHexagonEdgeLengthAvgM(res);
}

double HybridH3::getNumCells(double res) {
  // `569707381193162` at resolution `15` is well inside `2^53 - 1`, so the widening is exact
  return static_cast<double>(h3ops::getNumCells(res));
}

} // namespace margelo::nitro::h3
