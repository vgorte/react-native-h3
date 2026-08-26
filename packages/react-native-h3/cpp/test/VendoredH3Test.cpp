//
//  VendoredH3Test.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <algorithm>
#include <vector>

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at res 9; `h3-js` 4.5.0 produces `89283082803ffff`.
constexpr H3Index kSanFrancisco = 0x89283082803ffffULL;

TEST(VendoredH3, LatLngToCellMatchesKnownValue) {
  LatLng sf{};
  sf.lat = degsToRads(37.7749);
  sf.lng = degsToRads(-122.4194);

  H3Index out = H3_NULL;
  ASSERT_EQ(latLngToCell(&sf, 9, &out), E_SUCCESS);
  EXPECT_EQ(out, kSanFrancisco);
}

TEST(VendoredH3, ReportsTheVersionWeVendored) {
  EXPECT_EQ(H3_VERSION_MAJOR, 4);
  EXPECT_EQ(H3_VERSION_MINOR, 5);
  EXPECT_EQ(H3_VERSION_PATCH, 0);
}

TEST(VendoredH3, DescribesErrorsWithUpstreamWording) {
  // the exact strings the public API surfaces; see `H3ErrorDescriptions` in `h3Index.c`.
  EXPECT_STREQ(describeH3Error(E_RES_DOMAIN), "Resolution argument was outside of acceptable range");
  EXPECT_STREQ(describeH3Error(E_CELL_INVALID), "Cell argument was not valid");
}

TEST(VendoredH3, GridDiskLeavesHolesAroundAPentagon) {
  // pentagon at res 1, from `h3-js` `getPentagons(1)[0]` == `81083ffffffffff`.
  constexpr H3Index kPentagon = 0x81083ffffffffffULL;
  ASSERT_EQ(isPentagon(kPentagon), 1);

  int64_t maxSize = 0;
  ASSERT_EQ(maxGridDiskSize(1, &maxSize), E_SUCCESS);
  EXPECT_EQ(maxSize, 7);

  std::vector<H3Index> cells(static_cast<size_t>(maxSize), H3_NULL);
  ASSERT_EQ(gridDisk(kPentagon, 1, cells.data()), E_SUCCESS);

  // the raggedness `CellBuffer` exists to handle: 7 slots, 6 real cells.
  const auto real = std::count_if(cells.begin(), cells.end(), [](H3Index c) { return c != H3_NULL; });
  EXPECT_EQ(real, 6);
}

TEST(VendoredH3, GridDiskDoesNotValidateItsOrigin) {
  // the reason `HybridH3::gridDisk` guards with `isValidCell`: upstream reports success and
  // fills the buffer with cells derived from a nonsense origin (`algos.c:200`).
  constexpr H3Index kNotACell = 1;
  EXPECT_EQ(isValidCell(kNotACell), 0);

  int64_t maxSize = 0;
  ASSERT_EQ(maxGridDiskSize(1, &maxSize), E_SUCCESS);

  std::vector<H3Index> cells(static_cast<size_t>(maxSize), H3_NULL);
  EXPECT_EQ(gridDisk(kNotACell, 1, cells.data()), E_SUCCESS);
}

} // namespace
