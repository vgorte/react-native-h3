//
//  MeasurementOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>

#include "ops/Measurement.hpp"
#include "ops/Misc.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;

TEST(MeasurementOps, CellAreaSplitsByUnit) {
  // h3-js `cellArea("89283082803ffff", unit)`
  EXPECT_NEAR(h3ops::cellAreaKm2(kSanFrancisco), 0.10940247351390452, 1e-15);
  EXPECT_NEAR(h3ops::cellAreaM2(kSanFrancisco), 109402.47351390452, 1e-9);
  EXPECT_NEAR(h3ops::cellAreaRads2(kSanFrancisco), 2.695323836286712e-9, 1e-23);
}

TEST(MeasurementOps, CellAreaRejectsAnInvalidCell) {
  // `cellAreaRads2` reaches `_h3ToFaceIjk`, which checks only the base cell range
  // (`h3Index.c:1120`), so `1` would otherwise measure as a res-0 cell.
  try {
    h3ops::cellAreaKm2(1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid");
  }
  EXPECT_THROW(h3ops::cellAreaM2(1), std::runtime_error);
  EXPECT_THROW(h3ops::cellAreaRads2(1), std::runtime_error);
}

TEST(MeasurementOps, GreatCircleDistanceSplitsByUnit) {
  // h3-js `greatCircleDistance([37.7749, -122.4194], [40.7128, -74.006], unit)`
  EXPECT_NEAR(h3ops::greatCircleDistanceKm(37.7749, -122.4194, 40.7128, -74.006), 4129.090819056859, 1e-9);
  EXPECT_NEAR(h3ops::greatCircleDistanceM(37.7749, -122.4194, 40.7128, -74.006), 4129090.819056859, 1e-6);
  EXPECT_NEAR(h3ops::greatCircleDistanceRads(37.7749, -122.4194, 40.7128, -74.006), 0.648106445621929, 1e-15);
}

TEST(MeasurementOps, GreatCircleDistanceIsZeroForTheSamePoint) {
  EXPECT_DOUBLE_EQ(h3ops::greatCircleDistanceKm(37.7749, -122.4194, 37.7749, -122.4194), 0.0);
}

TEST(MiscOps, HexagonAveragesSplitByUnit) {
  // h3-js `getHexagonAreaAvg(9, unit)` and `getHexagonEdgeLengthAvg(9, unit)`
  EXPECT_NEAR(h3ops::getHexagonAreaAvgKm2(9), 0.1053325134272067, 1e-15);
  EXPECT_NEAR(h3ops::getHexagonAreaAvgM2(9), 105332.5134272069, 1e-9);
  EXPECT_NEAR(h3ops::getHexagonEdgeLengthAvgKm(9), 0.200786148, 1e-12);
  EXPECT_NEAR(h3ops::getHexagonEdgeLengthAvgM(9), 200.7861476, 1e-9);
}

TEST(MiscOps, HexagonAveragesRejectAnImpossibleResolution) {
  // H3 range-checks the resolution itself (`latLng.c:220`), so its wording is what reaches the caller
  try {
    h3ops::getHexagonAreaAvgKm2(16);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution argument was outside of acceptable range");
  }
}

TEST(MiscOps, HexagonAveragesRejectAFractionalResolution) {
  // a resolution H3 has no way to express is the one case our own wording covers
  try {
    h3ops::getHexagonAreaAvgKm2(9.5);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution must be an integer between 0 and 15");
  }
}

TEST(MiscOps, GetNumCellsMatchesH3JsAtEveryResolution) {
  // h3-js `getNumCells(res)` for `0`, `1`, `9` and `15`.
  EXPECT_EQ(h3ops::getNumCells(0), 122LL);
  EXPECT_EQ(h3ops::getNumCells(1), 842LL);
  EXPECT_EQ(h3ops::getNumCells(9), 4842432842LL);
  EXPECT_EQ(h3ops::getNumCells(15), 569707381193162LL);
}

TEST(MiscOps, GetNumCellsRejectsAnImpossibleResolution) {
  try {
    h3ops::getNumCells(-1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution argument was outside of acceptable range");
  }
}

TEST(MiscOps, GetNumCellsStaysInsideTheExactRangeOfAJsNumber) {
  // `2^53 - 1` is `9007199254740991`, so every value `getNumCells` can produce survives the crossing
  // into a JavaScript number without losing precision. This is why the public type is `number`.
  EXPECT_LT(h3ops::getNumCells(15), 9007199254740991LL);
}

} // namespace
