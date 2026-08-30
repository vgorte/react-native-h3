//
//  CellBufferTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <limits>
#include <memory>
#include <stdexcept>
#include <utility>

#include "core/CellBuffer.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

using h3core::CellBuffer;

TEST(CellBuffer, IsZeroInitialisedOnConstruction) {
  // `gridDisk`, `gridRing` and `polygonToCells` document that they write into zeroed memory.
  CellBuffer buffer(64);
  ASSERT_EQ(buffer.capacity(), 64);
  for (int64_t i = 0; i < buffer.capacity(); i++) {
    EXPECT_EQ(buffer.data()[i], H3_NULL) << "slot " << i << " was not zeroed";
  }
}

TEST(CellBuffer, CompactKeepsOrderAndReportsTheRealCount) {
  CellBuffer buffer(5);
  buffer.data()[0] = 10;
  buffer.data()[1] = H3_NULL;
  buffer.data()[2] = 20;
  buffer.data()[3] = H3_NULL;
  buffer.data()[4] = 30;

  EXPECT_EQ(buffer.compact(), 3);
  EXPECT_EQ(buffer.count(), 3);
  EXPECT_EQ(buffer.data()[0], 10u);
  EXPECT_EQ(buffer.data()[1], 20u);
  EXPECT_EQ(buffer.data()[2], 30u);
}

TEST(CellBuffer, CompactHandlesAHoleInFirstPosition) {
  CellBuffer buffer(3);
  buffer.data()[0] = H3_NULL;
  buffer.data()[1] = 1;
  buffer.data()[2] = 2;

  EXPECT_EQ(buffer.compact(), 2);
  EXPECT_EQ(buffer.data()[0], 1u);
  EXPECT_EQ(buffer.data()[1], 2u);
}

TEST(CellBuffer, CompactHandlesAHoleInLastPosition) {
  CellBuffer buffer(3);
  buffer.data()[0] = 1;
  buffer.data()[1] = 2;
  buffer.data()[2] = H3_NULL;

  EXPECT_EQ(buffer.compact(), 2);
  EXPECT_EQ(buffer.data()[0], 1u);
  EXPECT_EQ(buffer.data()[1], 2u);
}

TEST(CellBuffer, CompactHandlesAllHoles) {
  CellBuffer buffer(4);
  EXPECT_EQ(buffer.compact(), 0);
  EXPECT_EQ(buffer.count(), 0);
}

TEST(CellBuffer, CompactHandlesNoHoles) {
  CellBuffer buffer(3);
  buffer.data()[0] = 1;
  buffer.data()[1] = 2;
  buffer.data()[2] = 3;

  EXPECT_EQ(buffer.compact(), 3);
}

TEST(CellBuffer, CompactIsIdempotentAndZeroesTheTail) {
  CellBuffer buffer(5);
  buffer.data()[0] = 10;
  buffer.data()[1] = H3_NULL;
  buffer.data()[2] = 20;
  buffer.data()[3] = H3_NULL;
  buffer.data()[4] = 30;

  EXPECT_EQ(buffer.compact(), 3);
  EXPECT_EQ(buffer.compact(), 3);
  EXPECT_EQ(buffer.count(), 3);
  for (int64_t i = buffer.count(); i < buffer.capacity(); i++) {
    EXPECT_EQ(buffer.data()[i], H3_NULL) << "slot " << i << " was not reset";
  }
}

TEST(CellBuffer, SupportsAnEmptyBuffer) {
  CellBuffer buffer(0);
  EXPECT_EQ(buffer.capacity(), 0);
  EXPECT_EQ(buffer.compact(), 0);
  EXPECT_EQ(buffer.release(), nullptr);
}

TEST(CellBuffer, ReleaseTransfersOwnership) {
  CellBuffer buffer(2);
  buffer.data()[0] = 7;
  uint64_t* raw = buffer.release();
  ASSERT_NE(raw, nullptr);
  EXPECT_EQ(raw[0], 7u);
  EXPECT_EQ(buffer.data(), nullptr);
  EXPECT_EQ(buffer.capacity(), 0);
  // the caller now owns it; under ASan this line is what proves the contract.
  delete[] raw;
}

TEST(CellBuffer, SetCountPublishesAnExactLength) {
  CellBuffer buffer(4);
  buffer.setCount(4);
  EXPECT_EQ(buffer.count(), 4);
  buffer.setCount(0);
  EXPECT_EQ(buffer.count(), 0);
  EXPECT_THROW(buffer.setCount(5), std::invalid_argument);
  EXPECT_THROW(buffer.setCount(-1), std::invalid_argument);
}

TEST(CellBuffer, MoveConstructionEmptiesTheSource) {
  CellBuffer source(3);
  source.data()[0] = 7;
  source.compact();
  uint64_t* block = source.data();

  CellBuffer moved(std::move(source));
  EXPECT_EQ(moved.data(), block);
  EXPECT_EQ(moved.capacity(), 3);
  EXPECT_EQ(moved.count(), 1);
  EXPECT_EQ(moved.data()[0], 7u);

  EXPECT_EQ(source.data(), nullptr);
  EXPECT_EQ(source.capacity(), 0);
  EXPECT_EQ(source.count(), 0);
}

TEST(CellBuffer, MoveAssignmentTransfersTheBlockAndEmptiesTheSource) {
  CellBuffer source(2);
  source.data()[0] = 5;
  source.compact();
  uint64_t* block = source.data();

  CellBuffer target(4);
  target = std::move(source);

  EXPECT_EQ(target.data(), block);
  EXPECT_EQ(target.capacity(), 2);
  EXPECT_EQ(target.count(), 1);

  EXPECT_EQ(source.data(), nullptr);
  EXPECT_EQ(source.capacity(), 0);
  EXPECT_EQ(source.count(), 0);
}

TEST(CellBuffer, ReleaseAfterAMoveReturnsTheOriginalBlock) {
  CellBuffer source(2);
  source.data()[0] = 7;
  uint64_t* block = source.data();

  CellBuffer moved(std::move(source));
  uint64_t* raw = moved.release();
  EXPECT_EQ(raw, block);
  EXPECT_EQ(raw[0], 7u);
  // the moved-to buffer owned it; under ASan this line is what proves the transfer.
  delete[] raw;
}

TEST(CellBuffer, MoveAssignmentToItselfKeepsTheBlock) {
  CellBuffer buffer(2);
  buffer.data()[0] = 9;
  uint64_t* block = buffer.data();

  CellBuffer& alias = buffer;
  buffer = std::move(alias);

  EXPECT_EQ(buffer.data(), block);
  EXPECT_EQ(buffer.capacity(), 2);
  EXPECT_EQ(buffer.data()[0], 9u);
}

TEST(CellBuffer, RejectsANegativeCapacity) {
  EXPECT_THROW(CellBuffer(-1), std::invalid_argument);
}

TEST(CellBuffer, RejectsACapacityThatDoesNotFitInSizeT) {
  // 64-bit included: `SIZE_MAX / sizeof(uint64_t)` stays below `INT64_MAX` on every ABI.
  constexpr int64_t kUnaddressable = std::numeric_limits<int64_t>::max();
  EXPECT_THROW(CellBuffer{kUnaddressable}, std::invalid_argument);
}

TEST(CellBuffer, CompactsARealPentagonGridDisk) {
  constexpr H3Index kPentagon = 0x81083ffffffffffULL;
  int64_t maxSize = 0;
  ASSERT_EQ(maxGridDiskSize(1, &maxSize), E_SUCCESS);

  CellBuffer buffer(maxSize);
  ASSERT_EQ(gridDisk(kPentagon, 1, buffer.data()), E_SUCCESS);
  EXPECT_EQ(buffer.compact(), 6);
  for (int64_t i = 0; i < buffer.count(); i++) {
    EXPECT_NE(buffer.data()[i], H3_NULL);
  }
}

} // namespace
