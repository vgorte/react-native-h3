//
//  IndexingOpsTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>

#include "ops/Indexing.hpp"
#include "ops/Regions.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// resolution 1 pentagon, from h3-js `getPentagons(1)[0]` == `"81083ffffffffff"`
constexpr uint64_t kPentagon = 0x81083ffffffffffULL;

TEST(IndexingOps, LatLngToCellMatchesH3Js) {
  EXPECT_EQ(h3ops::latLngToCell(37.7749, -122.4194, 9), kSanFrancisco);
}

TEST(IndexingOps, LatLngToCellRejectsAnImpossibleResolution) {
  try {
    h3ops::latLngToCell(37.7749, -122.4194, 99);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    // the range is H3's rule, so `describeH3Error` words it
    EXPECT_EQ(std::string(error.what()), "Resolution argument was outside of acceptable range (code: 4)");
  }
}

TEST(IndexingOps, LatLngToCellRejectsAFractionalResolution) {
  EXPECT_THROW(h3ops::latLngToCell(37.7749, -122.4194, 9.5), std::runtime_error);
}

TEST(IndexingOps, CellToLatLngReturnsDegrees) {
  // h3-js `cellToLatLng("89283082803ffff")` == [37.773515097238146, -122.41827103692466]
  const h3core::Point centre = h3ops::cellToLatLng(kSanFrancisco);
  EXPECT_NEAR(centre.lat, 37.773515097238146, 1e-11);
  EXPECT_NEAR(centre.lng, -122.41827103692466, 1e-11);
}

TEST(IndexingOps, CellToLatLngRejectsAnInvalidCell) {
  try {
    h3ops::cellToLatLng(1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid (code: 5)");
  }
}

TEST(IndexingOps, CellToBoundaryRejectsAnInvalidCell) {
  try {
    h3ops::cellToBoundary(1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid (code: 5)");
  }
}

TEST(IndexingOps, CellToBoundaryReturnsSixVerticesForAHexagon) {
  // h3-js `cellToBoundary("89283082803ffff")[0]` == [37.7720104773324, -122.41701147197293]
  const h3core::Ring boundary = h3ops::cellToBoundary(kSanFrancisco);
  ASSERT_EQ(boundary.size(), 6u);
  EXPECT_NEAR(boundary[0].lat, 37.7720104773324, 1e-11);
  EXPECT_NEAR(boundary[0].lng, -122.41701147197293, 1e-11);
}

TEST(IndexingOps, CellToBoundaryUsesNumVertsNotTheArrayCapacity) {
  // `CellBoundary` always carries ten slots; a hexagon fills six and this pentagon ten
  EXPECT_EQ(h3ops::cellToBoundary(kSanFrancisco).size(), 6u);
  EXPECT_EQ(h3ops::cellToBoundary(kPentagon).size(), 10u);
}

TEST(RegionsOps, CellsToMultiPolygonReadsASingleCell) {
  const uint64_t cells[] = {kSanFrancisco};
  const h3core::MultiPolygon result = h3ops::cellsToMultiPolygon(cells, 1);
  ASSERT_EQ(result.size(), 1u);
  ASSERT_EQ(result[0].size(), 1u);
  EXPECT_EQ(result[0][0].size(), 6u);
}

TEST(RegionsOps, CellsToMultiPolygonRejectsAMixedResolutionSet) {
  const uint64_t cells[] = {kSanFrancisco, 0x85283083fffffffULL};
  EXPECT_THROW(h3ops::cellsToMultiPolygon(cells, 2), std::runtime_error);
}

} // namespace
