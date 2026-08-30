//
//  LinkedGeoPolygonReaderTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cmath>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "core/LinkedGeoPolygonReader.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at resolution 9, from h3-js 4.5.0's `89283082803ffff`.
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// `latLngToCell(0, 0, 9)` == `89754e64993ffff`, a different base cell from San Francisco.
constexpr uint64_t kNullIsland = 0x89754e64993ffffULL;

TEST(LinkedGeoPolygonReader, ReadsASingleCellAsOneSixVertexLoop) {
  const uint64_t cells[] = {kSanFrancisco};
  h3core::LinkedGeoPolygonReader reader(cells, 1);
  const h3core::MultiPolygon result = reader.read();

  ASSERT_EQ(result.size(), 1u);
  ASSERT_EQ(result[0].size(), 1u);
  EXPECT_EQ(result[0][0].size(), 6u);

  // h3-js `cellsToMultiPolygon(["89283082803ffff"])[0][0][0]`
  //   == `[37.77501967379261, -122.41953062807342]`
  EXPECT_NEAR(result[0][0][0].lat, 37.77501967379261, 1e-11);
  EXPECT_NEAR(result[0][0][0].lng, -122.41953062807342, 1e-11);
}

TEST(LinkedGeoPolygonReader, ReadsAGridDiskAsOneEighteenVertexLoop) {
  std::vector<uint64_t> cells(7, 0);
  ASSERT_EQ(gridDisk(kSanFrancisco, 1, cells.data()), E_SUCCESS);

  h3core::LinkedGeoPolygonReader reader(cells.data(), 7);
  const h3core::MultiPolygon result = reader.read();

  ASSERT_EQ(result.size(), 1u);
  ASSERT_EQ(result[0].size(), 1u);
  // h3-js `cellsToMultiPolygon(gridDisk(sf, 1))` has one polygon, one loop, eighteen vertices.
  EXPECT_EQ(result[0][0].size(), 18u);
  EXPECT_NEAR(result[0][0][0].lat, 37.77236651869776, 1e-11);
  EXPECT_NEAR(result[0][0][0].lng, -122.41234965984782, 1e-11);
}

TEST(LinkedGeoPolygonReader, ReadsTwoDisjointCellsAsTwoPolygons) {
  const uint64_t cells[] = {kSanFrancisco, kNullIsland};
  h3core::LinkedGeoPolygonReader reader(cells, 2);
  const h3core::MultiPolygon result = reader.read();

  ASSERT_EQ(result.size(), 2u);
  EXPECT_EQ(result[0].size(), 1u);
  EXPECT_EQ(result[0][0].size(), 6u);
  EXPECT_EQ(result[1].size(), 1u);
  EXPECT_EQ(result[1][0].size(), 6u);
}

TEST(LinkedGeoPolygonReader, ReadsAnEmptySetAsAnEmptyMultiPolygon) {
  h3core::LinkedGeoPolygonReader reader(nullptr, 0);
  EXPECT_TRUE(reader.read().empty());
}

TEST(LinkedGeoPolygonReader, ReturnsDegreesNotRadians) {
  const uint64_t cells[] = {kSanFrancisco};
  h3core::LinkedGeoPolygonReader reader(cells, 1);
  const h3core::MultiPolygon result = reader.read();
  for (const h3core::Point& point : result[0][0]) {
    EXPECT_GT(std::abs(point.lat), 1.6); // radians would put this near 0.659
    EXPECT_LT(std::abs(point.lat), 90.0);
    EXPECT_GT(std::abs(point.lng), 3.2); // radians would put this near -2.137
    EXPECT_LE(std::abs(point.lng), 180.0);
  }
}

TEST(LinkedGeoPolygonReader, ThrowsAndCleansUpOnAResolutionMismatch) {
  // mixed resolutions are rejected by `cellsToLinkedMultiPolygon`; under LeakSanitizer this test is
  // the proof that `destroyLinkedMultiPolygon` runs on the error path, where partial structure may
  // already be linked.
  uint64_t parent = 0;
  ASSERT_EQ(cellToParent(kSanFrancisco, 5, &parent), E_SUCCESS);
  const uint64_t cells[] = {kSanFrancisco, parent};

  EXPECT_THROW(h3core::LinkedGeoPolygonReader(cells, 2), std::runtime_error);
}

TEST(LinkedGeoPolygonReader, ThrowsOnDuplicateInput) {
  const uint64_t cells[] = {kSanFrancisco, kSanFrancisco};
  EXPECT_THROW(h3core::LinkedGeoPolygonReader(cells, 2), std::runtime_error);
}

TEST(LinkedGeoPolygonReader, RejectsACountAboveIntMax) {
  // `cellsToLinkedMultiPolygon` takes `const int numHexes`, so a larger set must be refused before
  // the call rather than silently truncated.
  const uint64_t cells[] = {kSanFrancisco};
  try {
    h3core::LinkedGeoPolygonReader reader(cells, 2147483648LL);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "A cell set for cellsToMultiPolygon must hold fewer than 2147483648 cells");
  }
}

TEST(LinkedGeoPolygonReader, RejectsANegativeCount) {
  const uint64_t cells[] = {kSanFrancisco};
  EXPECT_THROW(h3core::LinkedGeoPolygonReader(cells, -1), std::runtime_error);
}

TEST(LinkedGeoPolygonReader, CanBeReadTwiceWithTheSameResult) {
  const uint64_t cells[] = {kSanFrancisco};
  h3core::LinkedGeoPolygonReader reader(cells, 1);

  const h3core::MultiPolygon first = reader.read();
  const h3core::MultiPolygon second = reader.read();

  for (const h3core::MultiPolygon& result : {first, second}) {
    ASSERT_EQ(result.size(), 1u);
    ASSERT_EQ(result[0].size(), 1u);
    ASSERT_EQ(result[0][0].size(), 6u);
    EXPECT_NEAR(result[0][0][0].lat, 37.77501967379261, 1e-11);
    EXPECT_NEAR(result[0][0][0].lng, -122.41953062807342, 1e-11);
  }
  EXPECT_EQ(first[0][0][0].lat, second[0][0][0].lat);
  EXPECT_EQ(first[0][0][0].lng, second[0][0][0].lng);
}

} // namespace
