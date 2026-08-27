//
//  TraversalOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "ops/Traversal.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// h3-js `gridDisk("89283082803ffff", 1)` contains `"8928308281bffff"`, one step from the centre
constexpr uint64_t kNeighbor = 0x8928308281bffffULL;
// a resolution 1 pentagon; h3-js `isPentagon("81083ffffffffff")` is `true`
constexpr uint64_t kPentagonRes1 = 0x81083ffffffffffULL;
// one step off that pentagon, from h3-js `gridRing("81083ffffffffff", 1)`, and not one itself
constexpr uint64_t kBesidePentagonRes1 = 0x81093ffffffffffULL;

// asserts H3's `E_CELL_INVALID` wording rather than any error, because several of these operations
// fail with `E_PENTAGON` or answer a plausible number when the guard is missing.
template <typename Call> void expectInvalidCell(const char* label, Call&& call) {
  SCOPED_TRACE(label);
  try {
    call();
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid (code: 5)");
  }
}

TEST(TraversalOps, GridDiskMatchesH3Js) {
  // h3-js `gridDisk(sf, k).length` for `k` of 0, 1, 2 and 3
  EXPECT_EQ(h3ops::gridDisk(kSanFrancisco, 0).count(), 1);
  EXPECT_EQ(h3ops::gridDisk(kSanFrancisco, 1).count(), 7);
  EXPECT_EQ(h3ops::gridDisk(kSanFrancisco, 2).count(), 19);
  EXPECT_EQ(h3ops::gridDisk(kSanFrancisco, 3).count(), 37);
  EXPECT_EQ(h3ops::gridDisk(kSanFrancisco, 0).data()[0], kSanFrancisco);
}

TEST(TraversalOps, NarrowsKAndLeavesItsRangeToH3) {
  // `maxGridDiskSize` answers `E_DOMAIN` for a negative `k` (`algos.c:169`), so the narrowing here
  // imposes no domain of its own.
  try {
    h3ops::gridDisk(kSanFrancisco, -1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Argument was outside of acceptable range (code: 2)");
  }
  // `maxGridRingSize` rejects it the same way (`algos.c:345`)
  EXPECT_THROW(h3ops::gridRing(kSanFrancisco, -1), std::runtime_error);
  EXPECT_THROW(h3ops::gridRingUnsafe(kSanFrancisco, -1), std::runtime_error);
  EXPECT_THROW(h3ops::gridDiskDistances(kSanFrancisco, -1), std::runtime_error);

  // h3-js truncates a fractional `k` instead; this binding refuses to guess.
  try {
    h3ops::gridDisk(kSanFrancisco, 1.5);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "k must be an integer");
  }
}

TEST(TraversalOps, GridRingUsesMaxGridRingSizeRatherThanAFormula) {
  // `maxGridRingSize` returns 1 for `k` of 0 and `6 * k` otherwise (`algos.c:344`), matching h3-js
  // `gridRing(sf, 1).length` of 6 and `gridRing(pentagon, 1).length` of 5.
  EXPECT_EQ(h3ops::gridRing(kSanFrancisco, 0).count(), 1);
  EXPECT_EQ(h3ops::gridRing(kSanFrancisco, 1).count(), 6);
  EXPECT_EQ(h3ops::gridRing(kPentagonRes1, 1).count(), 5);
}

TEST(TraversalOps, GridRingUnsafeThrowsOnAPentagonAndPublishesNothing) {
  EXPECT_EQ(h3ops::gridRingUnsafe(kSanFrancisco, 1).count(), 6);
  // a pentagon origin bails before writing anything (`algos.c:803`)
  try {
    h3ops::gridRingUnsafe(kPentagonRes1, 1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Pentagon distortion was encountered (code: 9)");
  }
  // a ring that runs into a pentagon instead fails with four of its six slots already written
  // (`algos.c:846`); those contents are meaningless, and the buffer is destroyed while the
  // exception unwinds.
  try {
    h3ops::gridRingUnsafe(kBesidePentagonRes1, 1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Pentagon distortion was encountered (code: 9)");
  }
}

TEST(TraversalOps, GridDiskDistancesBucketsByRing) {
  // h3-js `gridDiskDistances(sf, 2)` has ring sizes 1, 6 and 12
  const std::vector<h3core::CellBuffer> rings = h3ops::gridDiskDistances(kSanFrancisco, 2);
  ASSERT_EQ(rings.size(), 3u);
  EXPECT_EQ(rings[0].count(), 1);
  EXPECT_EQ(rings[1].count(), 6);
  EXPECT_EQ(rings[2].count(), 12);
  EXPECT_EQ(rings[0].data()[0], kSanFrancisco);
}

TEST(TraversalOps, GridDiskDistancesShrinksRingsAroundAPentagon) {
  // h3-js `gridDiskDistances(pentagon, 2)` has ring sizes 1, 5 and 10
  const std::vector<h3core::CellBuffer> rings = h3ops::gridDiskDistances(kPentagonRes1, 2);
  ASSERT_EQ(rings.size(), 3u);
  EXPECT_EQ(rings[0].count(), 1);
  EXPECT_EQ(rings[1].count(), 5);
  EXPECT_EQ(rings[2].count(), 10);
}

TEST(TraversalOps, GridDiskDistancesAlwaysReturnsKPlusOneRings) {
  EXPECT_EQ(h3ops::gridDiskDistances(kSanFrancisco, 0).size(), 1u);
  EXPECT_EQ(h3ops::gridDiskDistances(kSanFrancisco, 5).size(), 6u);
}

TEST(TraversalOps, MeasuresAndWalksAGridPath) {
  // h3-js `gridDistance(sf, "892830828d7ffff")` is 3, and `gridPathCells` walks it in four steps
  constexpr uint64_t kThreeAway = 0x892830828d7ffffULL;
  EXPECT_EQ(h3ops::gridDistance(kSanFrancisco, kNeighbor), 1LL);
  EXPECT_EQ(h3ops::gridDistance(kSanFrancisco, kThreeAway), 3LL);

  const h3core::CellBuffer path = h3ops::gridPathCells(kSanFrancisco, kThreeAway);
  ASSERT_EQ(path.count(), 4);
  EXPECT_EQ(path.data()[0], kSanFrancisco);
  EXPECT_EQ(path.data()[1], 0x89283082813ffffULL);
  EXPECT_EQ(path.data()[2], 0x892830828c7ffffULL);
  EXPECT_EQ(path.data()[3], kThreeAway);
}

TEST(TraversalOps, RejectsMixedResolutions) {
  // `cellToLocalIjk` compares the two resolutions first (`localij.c:138`)
  try {
    h3ops::gridDistance(kSanFrancisco, 0x85283083fffffffULL);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell arguments had incompatible resolutions (code: 12)");
  }
  EXPECT_THROW(h3ops::gridPathCells(kSanFrancisco, 0x85283083fffffffULL), std::runtime_error);
  EXPECT_THROW(h3ops::cellToLocalIj(kSanFrancisco, 0x85283083fffffffULL), std::runtime_error);
}

TEST(TraversalOps, RoundTripsLocalIj) {
  // h3-js `cellToLocalIj(sf, sf)` is `{ i: 1120, j: 616 }` and `cellToLocalIj(sf, neighbor)` is
  // `{ i: 1121, j: 617 }`
  const h3core::IJ self = h3ops::cellToLocalIj(kSanFrancisco, kSanFrancisco);
  EXPECT_EQ(self.i, 1120);
  EXPECT_EQ(self.j, 616);

  const h3core::IJ ij = h3ops::cellToLocalIj(kSanFrancisco, kNeighbor);
  EXPECT_EQ(ij.i, 1121);
  EXPECT_EQ(ij.j, 617);
  EXPECT_EQ(h3ops::localIjToCell(kSanFrancisco, ij.i, ij.j), kNeighbor);
}

TEST(TraversalOps, LocalIjRejectsAFractionalCoordinate) {
  try {
    h3ops::localIjToCell(kSanFrancisco, 1121.5, 617);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Local IJ coordinates must be integers");
  }
  EXPECT_THROW(h3ops::localIjToCell(kSanFrancisco, 1121, 617.5), std::runtime_error);
}

TEST(TraversalOps, RejectsAnInvalidCell) {
  // every one of these reads a malformed index as a resolution 0 cell and answers with cells
  // derived from it, so the guard is the only thing between the caller and nonsense.
  expectInvalidCell("gridDisk", [] { h3ops::gridDisk(1, 1); });
  expectInvalidCell("gridRing", [] { h3ops::gridRing(1, 0); });
  expectInvalidCell("gridRingUnsafe", [] { h3ops::gridRingUnsafe(1, 1); });
  expectInvalidCell("gridDiskDistances", [] { h3ops::gridDiskDistances(1, 1); });
  expectInvalidCell("gridDistance origin", [] { h3ops::gridDistance(1, 1); });
  expectInvalidCell("gridDistance destination", [] { h3ops::gridDistance(kSanFrancisco, 1); });
  expectInvalidCell("gridPathCells start", [] { h3ops::gridPathCells(1, 1); });
  expectInvalidCell("gridPathCells end", [] { h3ops::gridPathCells(kSanFrancisco, 1); });
  expectInvalidCell("cellToLocalIj origin", [] { h3ops::cellToLocalIj(1, 1); });
  expectInvalidCell("cellToLocalIj cell", [] { h3ops::cellToLocalIj(kSanFrancisco, 1); });
  expectInvalidCell("localIjToCell", [] { h3ops::localIjToCell(1, 0, 0); });
}

} // namespace
