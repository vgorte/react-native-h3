//
//  BatchesOpsTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 30.08.26.
//

#include <gtest/gtest.h>

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

} // namespace
