//
//  MiscListsOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <algorithm>
#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "ops/Misc.hpp"

namespace {

// San Francisco at resolution `9`, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// a resolution `1` pentagon; h3-js `isPentagon("81083ffffffffff")` is `true`
constexpr uint64_t kPentagonRes1 = 0x81083ffffffffffULL;
// a resolution `1` hexagon straddling an icosahedron edge, so both of its two slots are real;
// h3-js `isPentagon("81017ffffffffff")` is `false`
constexpr uint64_t kTwoFacedHexagon = 0x81017ffffffffffULL;
// h3-js `isValidCell("1")` is `false`, yet base cell `0` carries it past `_h3ToFaceIjk`
// (`h3Index.c:1120`) and h3-js `getIcosahedronFaces("1")` answers `[1]`.
constexpr uint64_t kNotACell = 1ULL;

// asserts the wording rather than any error, because an unguarded operation either answers a
// plausible value or fails with a different code, and both would satisfy a bare `EXPECT_THROW`.
template <typename Call> void expectMessage(const char* label, const char* message, Call&& call) {
  SCOPED_TRACE(label);
  try {
    call();
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), message);
  }
}

TEST(MiscListsOps, ListsAllHundredAndTwentyTwoBaseCells) {
  const h3core::CellBuffer cells = h3ops::getRes0Cells();
  ASSERT_EQ(cells.capacity(), 122);
  ASSERT_EQ(cells.count(), 122);
  // h3-js `getRes0Cells()[0]` is `"8001fffffffffff"` and `[121]` is `"80f3fffffffffff"`
  EXPECT_EQ(cells.data()[0], 0x8001fffffffffffULL);
  EXPECT_EQ(cells.data()[121], 0x80f3fffffffffffULL);
  for (int64_t i = 0; i < cells.count(); i++) {
    EXPECT_NE(cells.data()[i], 0u) << "slot " << i;
  }
}

TEST(MiscListsOps, ListsTwelvePentagonsAtEveryResolution) {
  for (int res = 0; res <= 15; res++) {
    const h3core::CellBuffer pentagons = h3ops::getPentagons(res);
    ASSERT_EQ(pentagons.capacity(), 12) << "resolution " << res;
    ASSERT_EQ(pentagons.count(), 12) << "resolution " << res;
  }
  // h3-js `getPentagons(0)[0]` is `"8009fffffffffff"` and `getPentagons(1)[0]` is `"81083ffffffffff"`
  EXPECT_EQ(h3ops::getPentagons(0).data()[0], 0x8009fffffffffffULL);
  EXPECT_EQ(h3ops::getPentagons(1).data()[0], kPentagonRes1);
  // h3-js `getPentagons(3)` ends `"83ea00fffffffff"`
  EXPECT_EQ(h3ops::getPentagons(3).data()[0], 0x830800fffffffffULL);
  EXPECT_EQ(h3ops::getPentagons(3).data()[11], 0x83ea00fffffffffULL);
}

TEST(MiscListsOps, NarrowsThePentagonResolutionAndLeavesItsRangeToH3) {
  expectMessage("sixteen", "Resolution argument was outside of acceptable range (code: 4)",
                [] { h3ops::getPentagons(16); });
  expectMessage("minus one", "Resolution argument was outside of acceptable range (code: 4)",
                [] { h3ops::getPentagons(-1); });
  // the one condition H3 never sees, because the narrowing runs first
  expectMessage("fractional", "Resolution must be an integer between 0 and 15", [] { h3ops::getPentagons(1.5); });
}

TEST(MiscListsOps, IcosahedronFacesFiltersTheMinusOnePadding) {
  // `maxFaceCount` is `2` for a hexagon (`h3Index.c:1233`), so H3 writes `[7, -1]` here and the
  // `-1` must not surface. h3-js `getIcosahedronFaces("89283082803ffff")` is `[7]`.
  const std::vector<int> hexFaces = h3ops::getIcosahedronFaces(kSanFrancisco);
  ASSERT_EQ(hexFaces.size(), 1u);
  EXPECT_EQ(hexFaces[0], 7);
}

TEST(MiscListsOps, IcosahedronFacesReturnsTwoForAHexagonOnAFaceSeam) {
  // both slots are real here, so nothing is filtered and the count is the full `maxFaceCount`;
  // h3-js `getIcosahedronFaces("81017ffffffffff")` is `[1, 2]`, in that order.
  const std::vector<int> hexFaces = h3ops::getIcosahedronFaces(kTwoFacedHexagon);
  ASSERT_EQ(hexFaces.size(), 2u);
  EXPECT_EQ(hexFaces[0], 1);
  EXPECT_EQ(hexFaces[1], 2);
}

TEST(MiscListsOps, IcosahedronFacesReturnsFiveForAPentagon) {
  // `maxFaceCount` is `5` for a pentagon and every slot is real; h3-js
  // `getIcosahedronFaces("81083ffffffffff")` is `[3, 4, 0, 1, 2]`, in that order.
  const std::vector<int> pentFaces = h3ops::getIcosahedronFaces(kPentagonRes1);
  ASSERT_EQ(pentFaces.size(), 5u);
  EXPECT_EQ(pentFaces[0], 3);
  EXPECT_EQ(pentFaces[1], 4);
  EXPECT_EQ(pentFaces[2], 0);
  EXPECT_EQ(pentFaces[3], 1);
  EXPECT_EQ(pentFaces[4], 2);
}

TEST(MiscListsOps, IcosahedronFacesKeepsFaceZero) {
  // the sentinel is `-1`, not `0` (`faceijk.h:60`), so a filter written against `H3_NULL` would
  // silently drop a real face
  const std::vector<int> pentFaces = h3ops::getIcosahedronFaces(kPentagonRes1);
  EXPECT_NE(std::find(pentFaces.begin(), pentFaces.end(), 0), pentFaces.end());
}

TEST(MiscListsOps, IcosahedronFacesRejectsAnInvalidCell) {
  expectMessage("getIcosahedronFaces", "Cell argument was not valid (code: 5)",
                [] { h3ops::getIcosahedronFaces(kNotACell); });
}

} // namespace
