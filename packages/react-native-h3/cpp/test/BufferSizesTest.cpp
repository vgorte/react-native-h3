//
//  BufferSizesTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <array>
#include <cstring>
#include <string>

#include "core/BufferSizes.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at resolution 9, from h3-js 4.5.0's `89283082803ffff`.
constexpr H3Index kSanFrancisco = 0x89283082803ffffULL;
// Resolution 1 pentagon, from h3-js's `getPentagons(1)[0]` == `81083ffffffffff`.
constexpr H3Index kPentagon = 0x81083ffffffffffULL;
// A value H3 never writes into a cell array, so any slot still holding it was untouched.
constexpr H3Index kCanary = 0xCAFEBABEDEADBEEFULL;

int64_t writtenSlots(const std::array<H3Index, 32>& slots) {
  int64_t written = 0;
  for (size_t i = 0; i < slots.size(); i++) {
    if (slots[i] != kCanary) {
      written = static_cast<int64_t>(i) + 1;
    }
  }
  return written;
}

TEST(BufferSizes, OriginToDirectedEdgesWritesExactlySix) {
  std::array<H3Index, 32> slots{};
  slots.fill(kCanary);
  ASSERT_EQ(originToDirectedEdges(kSanFrancisco, slots.data()), E_SUCCESS);
  EXPECT_EQ(writtenSlots(slots), h3core::kOriginToDirectedEdgesSize);
  for (int64_t i = 0; i < h3core::kOriginToDirectedEdgesSize; i++) {
    EXPECT_NE(slots[static_cast<size_t>(i)], H3_NULL) << "hexagon slot " << i;
  }
}

TEST(BufferSizes, OriginToDirectedEdgesStillWritesSixForAPentagon) {
  std::array<H3Index, 32> slots{};
  slots.fill(kCanary);
  ASSERT_EQ(originToDirectedEdges(kPentagon, slots.data()), E_SUCCESS);
  // A pentagon has five edges, but H3 writes `H3_NULL` into the sixth slot rather than
  // leaving it alone, so the required capacity is still six.
  EXPECT_EQ(writtenSlots(slots), h3core::kOriginToDirectedEdgesSize);
  int64_t real = 0;
  for (int64_t i = 0; i < h3core::kOriginToDirectedEdgesSize; i++) {
    if (slots[static_cast<size_t>(i)] != H3_NULL)
      real++;
  }
  EXPECT_EQ(real, 5);
}

TEST(BufferSizes, CellToVertexesWritesExactlySix) {
  std::array<H3Index, 32> slots{};
  slots.fill(kCanary);
  ASSERT_EQ(cellToVertexes(kSanFrancisco, slots.data()), E_SUCCESS);
  EXPECT_EQ(writtenSlots(slots), h3core::kCellToVertexesSize);
}

TEST(BufferSizes, CellToVertexesStillWritesSixForAPentagon) {
  std::array<H3Index, 32> slots{};
  slots.fill(kCanary);
  ASSERT_EQ(cellToVertexes(kPentagon, slots.data()), E_SUCCESS);
  EXPECT_EQ(writtenSlots(slots), h3core::kCellToVertexesSize);
  int64_t real = 0;
  for (int64_t i = 0; i < h3core::kCellToVertexesSize; i++) {
    if (slots[static_cast<size_t>(i)] != H3_NULL)
      real++;
  }
  EXPECT_EQ(real, 5);
}

TEST(BufferSizes, DirectedEdgeToCellsWritesExactlyTwo) {
  H3Index neighbor = H3_NULL;
  ASSERT_EQ(cellToVertex(kSanFrancisco, 0, &neighbor), E_SUCCESS); // any valid call to warm up
  // Edge produced by h3-js: `cellsToDirectedEdge("89283082803ffff", "8928308281bffff")` ==
  // `169283082803ffff`.
  constexpr H3Index kEdge = 0x169283082803ffffULL;
  ASSERT_EQ(isValidDirectedEdge(kEdge), 1);

  std::array<H3Index, 32> slots{};
  slots.fill(kCanary);
  ASSERT_EQ(directedEdgeToCells(kEdge, slots.data()), E_SUCCESS);
  EXPECT_EQ(writtenSlots(slots), h3core::kDirectedEdgeToCellsSize);
  EXPECT_EQ(slots[0], kSanFrancisco);
  EXPECT_EQ(slots[1], 0x8928308281bffffULL);
}

TEST(BufferSizes, SeventeenBytesIsExactlyEnoughForH3ToString) {
  std::array<char, 64> text{};
  text.fill('\0');
  ASSERT_EQ(h3ToString(kSanFrancisco, text.data(), h3core::kH3ToStringBufferSize), E_SUCCESS);
  EXPECT_EQ(std::string(text.data()), "89283082803ffff");

  // The longest possible output is sixteen hex digits plus the NUL.
  constexpr H3Index kAllOnes = 0xffffffffffffffffULL;
  text.fill('\0');
  ASSERT_EQ(h3ToString(kAllOnes, text.data(), h3core::kH3ToStringBufferSize), E_SUCCESS);
  EXPECT_EQ(std::string(text.data()), "ffffffffffffffff");
  EXPECT_EQ(std::string(text.data()).size(), h3core::kH3ToStringBufferSize - 1);
}

TEST(BufferSizes, SixteenBytesIsNotEnoughForH3ToString) {
  std::array<char, 64> text{};
  text.fill('\0');
  constexpr H3Index kAllOnes = 0xffffffffffffffffULL;
  EXPECT_EQ(h3ToString(kAllOnes, text.data(), h3core::kH3ToStringBufferSize - 1), E_MEMORY_BOUNDS);
}

} // namespace
