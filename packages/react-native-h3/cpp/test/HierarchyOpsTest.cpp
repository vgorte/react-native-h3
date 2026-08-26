//
//  HierarchyOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "ops/Hierarchy.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// h3-js `cellToParent("89283082803ffff", 5)` == `"85283083fffffff"`
constexpr uint64_t kParentRes5 = 0x85283083fffffffULL;
// h3-js `cellToParent("89283082803ffff", 7)` == `"872830828ffffff"`
constexpr uint64_t kParentRes7 = 0x872830828ffffffULL;

TEST(HierarchyOps, WalksUpAndDownTheTree) {
  EXPECT_EQ(h3ops::cellToParent(kSanFrancisco, 5), kParentRes5);
  // h3-js `cellToCenterChild("89283082803ffff", 10)` == `"8a2830828007fff"`
  EXPECT_EQ(h3ops::cellToCenterChild(kSanFrancisco, 10), 0x8a2830828007fffULL);
}

TEST(HierarchyOps, RejectsAParentResolutionFinerThanTheCell) {
  try {
    h3ops::cellToParent(kSanFrancisco, 12);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell arguments had incompatible resolutions");
  }
}

TEST(HierarchyOps, CountsChildren) {
  // h3-js `cellToChildrenSize("89283082803ffff", 12)` == 343, which is 7^3.
  EXPECT_EQ(h3ops::cellToChildrenSize(kSanFrancisco, 12), 343LL);
  EXPECT_EQ(h3ops::cellToChildrenSize(kSanFrancisco, 9), 1LL);
}

TEST(HierarchyOps, RoundTripsAChildPosition) {
  // h3-js `cellToChildPos("89283082803ffff", 5)` == 1715, and `childPosToCell` reverses it.
  EXPECT_EQ(h3ops::cellToChildPos(kSanFrancisco, 5), 1715LL);
  EXPECT_EQ(h3ops::childPosToCell(1715, kParentRes5, 9), kSanFrancisco);
}

TEST(HierarchyOps, ChildPosToCellRejectsAPositionOutOfRange) {
  // the parent has 2401 children, so 2401 is one past the last position
  try {
    h3ops::childPosToCell(2401, kParentRes5, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Argument was outside of acceptable range");
  }
}

TEST(HierarchyOps, ChildPosToCellLeavesANegativePositionToH3) {
  // `validateChildPos` answers `E_DOMAIN` for a negative position (`h3Index.c:1371`), so the
  // narrowing here imposes no domain of its own.
  try {
    h3ops::childPosToCell(-1, kParentRes5, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Argument was outside of acceptable range");
  }
}

TEST(HierarchyOps, ChildPosToCellRejectsAFractionalPosition) {
  try {
    h3ops::childPosToCell(1.5, kParentRes5, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Child position must be an integer");
  }
}

TEST(HierarchyOps, ListsChildren) {
  // h3-js `cellToChildren("89283082803ffff", 10)` has seven entries, the first being the centre
  // child `"8a2830828007fff"` and the last `"8a2830828037fff"`.
  const h3core::CellBuffer children = h3ops::cellToChildren(kSanFrancisco, 10);
  ASSERT_EQ(children.count(), 7);
  EXPECT_EQ(children.data()[0], 0x8a2830828007fffULL);
  EXPECT_EQ(children.data()[6], 0x8a2830828037fffULL);
}

TEST(HierarchyOps, ListsChildrenOfAParentWithoutPadding) {
  // `cellToChildrenSize` is documented as exact, so the count equals the capacity and no compaction
  // pass runs. h3-js `cellToChildren(parentRes5, 9).length` == 2401, which is 7^4.
  const h3core::CellBuffer children = h3ops::cellToChildren(kParentRes5, 9);
  EXPECT_EQ(children.capacity(), 2401);
  EXPECT_EQ(children.count(), 2401);
  for (int64_t i = 0; i < children.count(); i++) {
    EXPECT_NE(children.data()[i], H3_NULL) << "slot " << i;
  }
}

TEST(HierarchyOps, CompactsACompleteChildSetToItsParent) {
  const h3core::CellBuffer children = h3ops::cellToChildren(kParentRes5, 9);
  const h3core::CellBuffer compacted = h3ops::compactCells(children.data(), children.count());
  // h3-js `compactCells(cellToChildren(parentRes5, 9))` == `[parentRes5]`
  ASSERT_EQ(compacted.count(), 1);
  EXPECT_EQ(compacted.data()[0], kParentRes5);
  // the output buffer is the same size as the input; the `H3_NULL` padding is what compaction removes
  EXPECT_EQ(compacted.capacity(), 2401);
}

TEST(HierarchyOps, CompactsAGridDiskPartially) {
  std::vector<uint64_t> disk(19, 0);
  ASSERT_EQ(gridDisk(kSanFrancisco, 2, disk.data()), E_SUCCESS);
  const h3core::CellBuffer compacted = h3ops::compactCells(disk.data(), 19);
  // h3-js `compactCells(gridDisk(sf, 2)).length` == 13
  EXPECT_EQ(compacted.count(), 13);
}

TEST(HierarchyOps, CompactsAnEmptySet) {
  const h3core::CellBuffer compacted = h3ops::compactCells(nullptr, 0);
  EXPECT_EQ(compacted.count(), 0);
}

TEST(HierarchyOps, UncompactsToAnExactSize) {
  const uint64_t cells[] = {kParentRes5};
  const h3core::CellBuffer uncompacted = h3ops::uncompactCells(cells, 1, 9);
  // h3-js `uncompactCells([parentRes5], 9).length` == 2401
  EXPECT_EQ(uncompacted.capacity(), 2401);
  EXPECT_EQ(uncompacted.count(), 2401);
}

TEST(HierarchyOps, UncompactsAMixedResolutionSet) {
  const uint64_t cells[] = {kParentRes5, kParentRes7};
  // h3-js `uncompactCells([parentRes5, parentRes7], 9).length` == 2450, that is 2401 + 49.
  EXPECT_EQ(h3ops::uncompactCells(cells, 2, 9).count(), 2450);
}

TEST(HierarchyOps, UncompactRejectsACoarserTargetResolution) {
  const uint64_t cells[] = {kParentRes5};
  try {
    h3ops::uncompactCells(cells, 1, 3);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell arguments had incompatible resolutions");
  }
}

TEST(HierarchyOps, UncompactRejectsAResolutionOutOfRange) {
  const uint64_t cells[] = {kParentRes5};
  // both callers of `_hasChildAtRes` answer `E_RES_MISMATCH` for a resolution above 15
  // (`h3Index.c:786`, `h3Index.c:819`), and an empty set reaches neither, so the range check
  // cannot be left to H3.
  try {
    h3ops::uncompactCells(cells, 1, 99);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution argument was outside of acceptable range");
  }
  EXPECT_THROW(h3ops::uncompactCells(nullptr, 0, 99), std::runtime_error);
}

TEST(HierarchyOps, RejectsAnInvalidCell) {
  // none of these read the cell beyond its resolution digits, so `1` would otherwise walk the tree
  // as a resolution 0 cell.
  try {
    h3ops::cellToParent(1, 0);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid");
  }
  EXPECT_THROW(h3ops::cellToCenterChild(1, 1), std::runtime_error);
  EXPECT_THROW(h3ops::cellToChildrenSize(1, 1), std::runtime_error);
  EXPECT_THROW(h3ops::cellToChildPos(1, 0), std::runtime_error);
  EXPECT_THROW(h3ops::childPosToCell(0, 1, 0), std::runtime_error);
  EXPECT_THROW(h3ops::cellToChildren(1, 1), std::runtime_error);
}

TEST(HierarchyOps, SkipsAnH3NullMemberOfASet) {
  // `compactCells` skips a zero member (`h3Index.c:594`) and `uncompactCellsSize` continues past it
  // (`h3Index.c:812`), so the guard leaves it alone rather than calling it an invalid cell.
  const uint64_t nullFirst[] = {H3_NULL, kParentRes5};
  const uint64_t nullLast[] = {kParentRes5, H3_NULL};
  // h3-js `compactCells(["0000000000000000", "85283083fffffff"])` == `["85283083fffffff"]`, either
  // way round, and the two orders take different paths through `compactCells`.
  const h3core::CellBuffer compactedNullFirst = h3ops::compactCells(nullFirst, 2);
  ASSERT_EQ(compactedNullFirst.count(), 1);
  EXPECT_EQ(compactedNullFirst.data()[0], kParentRes5);
  const h3core::CellBuffer compactedNullLast = h3ops::compactCells(nullLast, 2);
  ASSERT_EQ(compactedNullLast.count(), 1);
  EXPECT_EQ(compactedNullLast.data()[0], kParentRes5);

  // h3-js `uncompactCells(["0000000000000000", "872830828ffffff"], 9).length` == 49
  const uint64_t nullBesideRes7[] = {H3_NULL, kParentRes7};
  EXPECT_EQ(h3ops::uncompactCells(nullBesideRes7, 2, 9).count(), 49);
  // h3-js `uncompactCells(["85283083fffffff", "0000000000000000"], 9).length` == 2401
  EXPECT_EQ(h3ops::uncompactCells(nullLast, 2, 9).count(), 2401);
}

TEST(HierarchyOps, RejectsAnInvalidCellInASet) {
  // `compactCells` skips a member it cannot parent and `uncompactCellsSize` reads only its
  // resolution, so neither notices a malformed index.
  const uint64_t cells[] = {kParentRes5, 1};
  try {
    h3ops::compactCells(cells, 2);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid");
  }
  EXPECT_THROW(h3ops::uncompactCells(cells, 2, 9), std::runtime_error);
}

} // namespace
