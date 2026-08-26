//
//  HybridH3.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include "HybridH3Spec.hpp"

namespace margelo::nitro::h3 {

/**
 * Implements the `H3` HybridObject by validating arguments, calling the vendored C and
 * converting the result. All memory discipline lives in `cpp/core`, which knows nothing
 * about Nitro.
 */
class HybridH3 final : public HybridH3Spec {
public:
  HybridH3() : HybridObject(TAG) {}

  // Indexing
  uint64_t latLngToCell(double lat, double lng, double res) override;
  LatLng cellToLatLng(uint64_t cell) override;
  std::vector<LatLng> cellToBoundary(uint64_t cell) override;

  // Traversal
  std::shared_ptr<ArrayBuffer> gridDisk(uint64_t origin, double k) override;

  // Regions
  std::vector<std::vector<std::vector<LatLng>>> cellsToMultiPolygon(const std::shared_ptr<ArrayBuffer>& cells) override;

  // Units
  double degsToRads(double degrees) override;
  double radsToDegs(double radians) override;

  // Inspection
  bool isValidCell(uint64_t cell) override;
  bool isValidIndex(uint64_t index) override;
  bool isValidDirectedEdge(uint64_t edge) override;
  bool isValidVertex(uint64_t vertex) override;
  bool isPentagon(uint64_t cell) override;
  bool isResClassIII(uint64_t cell) override;
  double getResolution(uint64_t index) override;
  double getBaseCellNumber(uint64_t cell) override;
  double getIndexDigit(uint64_t cell, double digit) override;
  uint64_t constructCell(double baseCellNumber, const std::vector<double>& digits, double res) override;
  std::string cellToString(uint64_t cell) override;
  uint64_t cellFromString(const std::string& text) override;

  // Measurement
  double cellAreaKm2(uint64_t cell) override;
  double cellAreaM2(uint64_t cell) override;
  double cellAreaRads2(uint64_t cell) override;
  double greatCircleDistanceKm(double lat1, double lng1, double lat2, double lng2) override;
  double greatCircleDistanceM(double lat1, double lng1, double lat2, double lng2) override;
  double greatCircleDistanceRads(double lat1, double lng1, double lat2, double lng2) override;

  // Hierarchy
  uint64_t cellToParent(uint64_t cell, double res) override;
  uint64_t cellToCenterChild(uint64_t cell, double res) override;
  double cellToChildrenSize(uint64_t cell, double res) override;
  double cellToChildPos(uint64_t cell, double parentRes) override;
  uint64_t childPosToCell(double childPos, uint64_t parent, double childRes) override;
  std::shared_ptr<ArrayBuffer> cellToChildren(uint64_t cell, double res) override;
  std::shared_ptr<ArrayBuffer> compactCells(const std::shared_ptr<ArrayBuffer>& cells) override;
  std::shared_ptr<ArrayBuffer> uncompactCells(const std::shared_ptr<ArrayBuffer>& cells, double res) override;

  // Misc
  double getHexagonAreaAvgKm2(double res) override;
  double getHexagonAreaAvgM2(double res) override;
  double getHexagonEdgeLengthAvgKm(double res) override;
  double getHexagonEdgeLengthAvgM(double res) override;
  double getNumCells(double res) override;
};

} // namespace margelo::nitro::h3
