//
//  BatchesOpsTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 30.08.26.
//

#include <gtest/gtest.h>

#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "ops/Batches.hpp"
#include "ops/Indexing.hpp"
#include "shapes/CellSetCall.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;

// restores the no-limit default however a test exits
struct CeilingGuard {
  ~CeilingGuard() { h3shapes::setMaxCellCount(h3shapes::kNoCellLimit); }
};

// one cell of every vertex class: 6, 10, 7, 8 and 5 vertices, in this order
std::vector<uint64_t> boundaryCells() {
  return {0x8001fffffffffffULL, 0x81083ffffffffffULL, 0x81017ffffffffffULL, 0x81023ffffffffffULL, 0x820807fffffffffULL};
}

// pentagons carry 5 vertices at even resolutions and 10 at odd ones, hexagons 6, or 7 to 8 across an
// icosahedron edge
std::vector<uint8_t> boundaryVertexCounts() {
  return {6, 10, 7, 8, 5};
}

TEST(BatchesOps, LatLngsToCellsMatchesTheScalar) {
  const std::vector<double> coords = {37.7749, -122.4194, 48.8566, 2.3522, -33.8688, 151.2093};
  const h3core::CellBuffer cells = h3ops::latLngsToCells(coords.data(), 6, 9);
  ASSERT_EQ(cells.count(), 3);
  for (int64_t i = 0; i < 3; i++) {
    EXPECT_EQ(cells.data()[i], h3ops::latLngToCell(coords[2 * i], coords[2 * i + 1], 9));
  }
}

TEST(BatchesOps, LatLngsToCellsRejectsAnOddCount) {
  const std::vector<double> coords = {37.7749, -122.4194, 48.8566};
  try {
    h3ops::latLngsToCells(coords.data(), 3, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "A coordinate set must hold an even number of doubles");
  }
}

TEST(BatchesOps, LatLngsToCellsPrefixesTheFailingPair) {
  const std::vector<double> coords = {37.7749, -122.4194};
  try {
    h3ops::latLngsToCells(coords.data(), 2, 99);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    // a batch-wide bad resolution still fails on the first pair, so the index reads 0
    EXPECT_EQ(std::string(error.what()), "coords[0]: Resolution argument was outside of acceptable range (code: 4)");
  }
}

TEST(BatchesOps, LatLngsToCellsAcceptsAnEmptySetWithoutJudgingRes) {
  // documented consequence: an empty batch performs no per-element validation
  EXPECT_EQ(h3ops::latLngsToCells(nullptr, 0, 99).count(), 0);
}

TEST(BatchesOps, LatLngsToCellsMeetsTheCeiling) {
  CeilingGuard guard;
  h3shapes::setMaxCellCount(2);
  const std::vector<double> coords = {37.7749, -122.4194, 48.8566, 2.3522, -33.8688, 151.2093};
  try {
    h3ops::latLngsToCells(coords.data(), 6, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_NE(std::string(error.what()).find("exceeds the cell limit of 2"), std::string::npos);
  }
}

TEST(BatchesOps, CellsToLatLngsMatchesTheScalar) {
  const std::vector<uint64_t> cells = {kSanFrancisco, h3ops::latLngToCell(48.8566, 2.3522, 7)};
  const std::vector<double> centres = h3ops::cellsToLatLngs(cells.data(), 2);
  ASSERT_EQ(centres.size(), 4u);
  for (size_t i = 0; i < cells.size(); i++) {
    const h3core::Point centre = h3ops::cellToLatLng(cells[i]);
    EXPECT_EQ(centres[2 * i], centre.lat);
    EXPECT_EQ(centres[2 * i + 1], centre.lng);
  }
}

TEST(BatchesOps, CellsToLatLngsPrefixesTheFailingCell) {
  const std::vector<uint64_t> cells = {kSanFrancisco, 1};
  try {
    h3ops::cellsToLatLngs(cells.data(), 2);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "cells[1]: Cell argument was not valid (code: 5)");
  }
}

TEST(BatchesOps, CellsToLatLngsAcceptsAnEmptySet) {
  EXPECT_TRUE(h3ops::cellsToLatLngs(nullptr, 0).empty());
}

TEST(BatchesOps, CellsToLatLngsMeetsTheCeiling) {
  CeilingGuard guard;
  h3shapes::setMaxCellCount(2);
  const std::vector<uint64_t> cells = {kSanFrancisco, kSanFrancisco, kSanFrancisco};
  try {
    h3ops::cellsToLatLngs(cells.data(), 3);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_NE(std::string(error.what()).find("exceeds the cell limit of 2"), std::string::npos);
  }
}

TEST(BatchesOps, CellsToBoundariesMatchesTheScalar) {
  const std::vector<uint64_t> cells = boundaryCells();
  const std::vector<uint8_t> counts = boundaryVertexCounts();
  const h3ops::BoundaryBuffers boundaries = h3ops::cellsToBoundaries(cells.data(), static_cast<int64_t>(cells.size()));
  // the documented stride, which `Batches.cpp` also asserts against `MAX_CELL_BNDRY_VERTS`
  EXPECT_EQ(h3ops::kBoundaryStride, 20u);
  ASSERT_EQ(boundaries.vertexCounts.size(), cells.size());
  ASSERT_EQ(boundaries.vertices.size(), cells.size() * h3ops::kBoundaryStride);
  for (size_t i = 0; i < cells.size(); i++) {
    const h3core::Ring ring = h3ops::cellToBoundary(cells[i]);
    EXPECT_EQ(boundaries.vertexCounts[i], counts[i]);
    ASSERT_EQ(ring.size(), static_cast<size_t>(counts[i]));
    for (size_t v = 0; v < ring.size(); v++) {
      // exact: both paths read the same `::CellBoundary` through `::radsToDegs`
      EXPECT_EQ(boundaries.vertices[i * h3ops::kBoundaryStride + 2 * v], ring[v].lat);
      EXPECT_EQ(boundaries.vertices[i * h3ops::kBoundaryStride + 2 * v + 1], ring[v].lng);
    }
  }
}

TEST(BatchesOps, CellsToBoundariesPadsUnusedSlotsWithNaN) {
  const std::vector<uint64_t> cells = boundaryCells();
  const std::vector<uint8_t> counts = boundaryVertexCounts();
  const h3ops::BoundaryBuffers boundaries = h3ops::cellsToBoundaries(cells.data(), static_cast<int64_t>(cells.size()));
  for (size_t i = 0; i < cells.size(); i++) {
    for (size_t slot = static_cast<size_t>(2 * counts[i]); slot < h3ops::kBoundaryStride; slot++) {
      // never `0`, so a read past the count is visible rather than a point in the Gulf of Guinea
      EXPECT_TRUE(std::isnan(boundaries.vertices[i * h3ops::kBoundaryStride + slot]))
          << "cell " << i << " slot " << slot;
    }
  }
}

TEST(BatchesOps, CellsToBoundariesPrefixesTheFailingCell) {
  const std::vector<uint64_t> cells = {kSanFrancisco, 1};
  try {
    h3ops::cellsToBoundaries(cells.data(), 2);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "cells[1]: Cell argument was not valid (code: 5)");
  }
}

TEST(BatchesOps, CellsToBoundariesAcceptsAnEmptySet) {
  const h3ops::BoundaryBuffers boundaries = h3ops::cellsToBoundaries(nullptr, 0);
  EXPECT_TRUE(boundaries.vertices.empty());
  EXPECT_TRUE(boundaries.vertexCounts.empty());
}

TEST(BatchesOps, CellsToBoundariesMeetsTheCeiling) {
  CeilingGuard guard;
  h3shapes::setMaxCellCount(2);
  const std::vector<uint64_t> cells = {kSanFrancisco, kSanFrancisco, kSanFrancisco};
  try {
    h3ops::cellsToBoundaries(cells.data(), 3);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_NE(std::string(error.what()).find("exceeds the cell limit of 2"), std::string::npos);
  }
}

} // namespace
