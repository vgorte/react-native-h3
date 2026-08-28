//
//  CellSetCallTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>

#include "core/BufferSizes.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at resolution 9, from h3-js 4.5.0's `89283082803ffff`.
constexpr H3Index kSanFrancisco = 0x89283082803ffffULL;
// resolution 1 pentagon, from h3-js `getPentagons(1)[0]` == `81083ffffffffff`.
constexpr H3Index kPentagon = 0x81083ffffffffffULL;

TEST(CellSetCall, FillsAndCompactsAGridDisk) {
  auto buffer = h3shapes::fillCompactedCells([] { return h3shapes::callWithOutParam<int64_t>(maxGridDiskSize, 1); },
                                             [](uint64_t* out) { return gridDisk(kSanFrancisco, 1, out); });

  // h3-js `gridDisk("89283082803ffff", 1).length` == 7
  EXPECT_EQ(buffer.count(), 7);
  EXPECT_EQ(buffer.capacity(), 7);
  for (int64_t i = 0; i < buffer.count(); i++) {
    EXPECT_NE(buffer.data()[i], H3_NULL);
  }
}

TEST(CellSetCall, RemovesThePentagonHole) {
  auto buffer = h3shapes::fillCompactedCells([] { return h3shapes::callWithOutParam<int64_t>(maxGridDiskSize, 1); },
                                             [](uint64_t* out) { return gridDisk(kPentagon, 1, out); });

  // `maxGridDiskSize(1)` is 7; h3-js `gridDisk(pentagon, 1).length` == 6.
  EXPECT_EQ(buffer.capacity(), 7);
  EXPECT_EQ(buffer.count(), 6);
  for (int64_t i = 0; i < buffer.count(); i++) {
    EXPECT_NE(buffer.data()[i], H3_NULL);
  }
}

TEST(CellSetCall, HandsTheFillAZeroedBuffer) {
  // `gridDisk`, `gridRing` and `polygonToCells` all write into zeroed memory and leave holes, so
  // this asserts the buffer the fill actually receives.
  bool wasZeroed = true;
  int64_t seen = 0;
  auto buffer = h3shapes::fillCompactedCells([] { return int64_t{64}; },
                                             [&](uint64_t* out) {
                                               for (int64_t i = 0; i < 64; i++) {
                                                 if (out[i] != H3_NULL) {
                                                   wasZeroed = false;
                                                 }
                                                 seen++;
                                               }
                                               out[0] = kSanFrancisco;
                                               return E_SUCCESS;
                                             });
  EXPECT_TRUE(wasZeroed);
  EXPECT_EQ(seen, 64);
  EXPECT_EQ(buffer.count(), 1);
  EXPECT_EQ(buffer.data()[0], kSanFrancisco);
}

TEST(CellSetCall, ThrowsAndDiscardsAPartialWrite) {
  // `gridRingUnsafe` returns `E_PENTAGON` having already written part of the buffer, and those
  // contents are meaningless. RAII discards them: the `CellBuffer` dies while the exception unwinds.
  try {
    h3shapes::fillCompactedCells([] { return h3shapes::callWithOutParam<int64_t>(maxGridRingSize, 1); },
                                 [](uint64_t* out) { return gridRingUnsafe(kPentagon, 1, out); });
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Pentagon distortion was encountered (code: 9)");
  }
}

TEST(CellSetCall, PropagatesAFailingSizeQuery) {
  try {
    h3shapes::fillCompactedCells([] { return h3shapes::callWithOutParam<int64_t>(maxGridDiskSize, -1); },
                                 [](uint64_t*) { return E_SUCCESS; });
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Argument was outside of acceptable range (code: 2)");
  }
}

TEST(CellSetCall, DoesNotCallTheFillWhenTheSizeQueryThrows) {
  bool filled = false;
  try {
    h3shapes::fillCompactedCells([] { return h3shapes::callWithOutParam<int64_t>(maxGridDiskSize, -1); },
                                 [&](uint64_t*) {
                                   filled = true;
                                   return E_SUCCESS;
                                 });
  } catch (const std::runtime_error&) {
  }
  EXPECT_FALSE(filled);
}

TEST(CellSetCall, RefusesASizeAboveTheCeiling) {
  try {
    h3shapes::fillCompactedCells([] { return h3shapes::maxCellCount() + 1; }, [](uint64_t*) { return E_SUCCESS; });
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "The requested result of 4000001 cells exceeds the cell limit of 4000000, "
                                         "which guards against exhausting device memory. Raise it with configure({ "
                                         "maxCellCount })");
  }
}

TEST(CellSetCall, RefusesANegativeSize) {
  EXPECT_THROW(h3shapes::fillCompactedCells([] { return int64_t{-1}; }, [](uint64_t*) { return E_SUCCESS; }),
               std::runtime_error);
}

TEST(CellSetCall, ServesAFixedSizeBufferFromAConstantSizeQuery) {
  // `originToDirectedEdges` has no size function at all; the constant comes from `BufferSizes.hpp`.
  auto buffer = h3shapes::fillCompactedCells([] { return h3core::kOriginToDirectedEdgesSize; },
                                             [](uint64_t* out) { return originToDirectedEdges(kPentagon, out); });
  // h3-js `originToDirectedEdges(pentagon).length` == 5, from six slots.
  EXPECT_EQ(buffer.capacity(), 6);
  EXPECT_EQ(buffer.count(), 5);
}

TEST(CellSetCall, FillExactDoesNotCompact) {
  // `getRes0Cells` cannot pad its output, so a compaction pass could only ever shorten a result
  // whose length is exact.
  auto buffer = h3shapes::fillExactCells([] { return int64_t{res0CellCount()}; },
                                         [](uint64_t* out) { return getRes0Cells(out); });
  EXPECT_EQ(buffer.capacity(), 122);
  EXPECT_EQ(buffer.count(), 122);
  // h3-js `getRes0Cells()[0]` == `8001fffffffffff` and `[121]` == `80f3fffffffffff`.
  EXPECT_EQ(buffer.data()[0], 0x8001fffffffffffULL);
  EXPECT_EQ(buffer.data()[121], 0x80f3fffffffffffULL);
}

TEST(CellSetCall, FillExactStillRejectsAnOversizeRequest) {
  EXPECT_THROW(
      h3shapes::fillExactCells([] { return h3shapes::maxCellCount() + 1; }, [](uint64_t*) { return E_SUCCESS; }),
      std::runtime_error);
}

TEST(CellSetCall, HandlesAZeroSizedResult) {
  auto buffer = h3shapes::fillCompactedCells([] { return int64_t{0}; }, [](uint64_t*) { return E_SUCCESS; });
  EXPECT_EQ(buffer.capacity(), 0);
  EXPECT_EQ(buffer.count(), 0);
}

/** Restores the ceiling after every case, because it is process-global and other suites read it. */
class CellSetCallCeiling : public ::testing::Test {
protected:
  void TearDown() override { h3shapes::setMaxCellCount(h3shapes::kDefaultMaxCellCount); }
};

TEST_F(CellSetCallCeiling, StartsAtTheDefault) {
  EXPECT_EQ(h3shapes::kDefaultMaxCellCount, 4000000);
  EXPECT_EQ(h3shapes::maxCellCount(), h3shapes::kDefaultMaxCellCount);
}

TEST_F(CellSetCallCeiling, HonoursALoweredCeiling) {
  h3shapes::setMaxCellCount(10);
  EXPECT_EQ(h3shapes::maxCellCount(), 10);
  auto buffer = h3shapes::allocateFor([] { return int64_t{10}; });
  EXPECT_EQ(buffer.capacity(), 10);
}

TEST_F(CellSetCallCeiling, NamesTheRequestAndTheCeilingInTheMessage) {
  h3shapes::setMaxCellCount(10);
  try {
    h3shapes::allocateFor([] { return int64_t{11}; });
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "The requested result of 11 cells exceeds the cell limit of 10, which "
                                         "guards against exhausting device memory. Raise it with configure({ "
                                         "maxCellCount })");
  }
}

TEST_F(CellSetCallCeiling, IsSwitchedOffByTheLargestInt64) {
  h3shapes::setMaxCellCount(std::numeric_limits<int64_t>::max());
  // the smallest request the default would have refused, so this proves the ceiling and not the size
  auto buffer = h3shapes::allocateFor([] { return h3shapes::kDefaultMaxCellCount + 1; });
  EXPECT_EQ(buffer.capacity(), h3shapes::kDefaultMaxCellCount + 1);
}

} // namespace
