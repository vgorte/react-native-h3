//
//  InspectionOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>
#include <vector>

#include "ops/Inspection.hpp"
#include "ops/Units.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// h3-js `cellsToDirectedEdge("89283082803ffff", "8928308281bffff")` == `"169283082803ffff"`
constexpr uint64_t kEdge = 0x169283082803ffffULL;
// h3-js `cellToVertex("89283082803ffff", 0)` == `"209283082803ffff"`
constexpr uint64_t kVertex = 0x209283082803ffffULL;

TEST(UnitsOps, ConvertsDegreesAndRadians) {
  EXPECT_DOUBLE_EQ(h3ops::degsToRads(180.0), 3.141592653589793);
  EXPECT_DOUBLE_EQ(h3ops::radsToDegs(3.141592653589793), 180.0);
  EXPECT_DOUBLE_EQ(h3ops::degsToRads(0.0), 0.0);
}

TEST(InspectionOps, ClassifiesIndexesTheWayH3JsDoes) {
  EXPECT_TRUE(h3ops::isValidCell(kSanFrancisco));
  EXPECT_FALSE(h3ops::isValidCell(kEdge));
  EXPECT_TRUE(h3ops::isValidIndex(kSanFrancisco));
  EXPECT_TRUE(h3ops::isValidDirectedEdge(kEdge));
  EXPECT_FALSE(h3ops::isValidDirectedEdge(kSanFrancisco));
  EXPECT_TRUE(h3ops::isValidVertex(kVertex));
  EXPECT_FALSE(h3ops::isPentagon(kSanFrancisco));
  EXPECT_TRUE(h3ops::isPentagon(0x81083ffffffffffULL));
  EXPECT_TRUE(h3ops::isResClassIII(kSanFrancisco));
}

TEST(InspectionOps, ReadsResolutionAndBaseCell) {
  EXPECT_EQ(h3ops::getResolution(kSanFrancisco), 9);
  EXPECT_EQ(h3ops::getBaseCellNumber(kSanFrancisco), 20);
}

TEST(InspectionOps, GetResolutionAnswersMinusOneForAnythingButACell) {
  // h3-js wraps this with `if (!isValidCell(h)) return -1;`, so an edge and a vertex answer `-1`
  // even though C would read their resolution bits. `0xffffffffffffffff` has all four set.
  EXPECT_EQ(h3ops::getResolution(0xffffffffffffffffULL), -1);
  EXPECT_EQ(h3ops::getResolution(0), -1);
  EXPECT_EQ(h3ops::getResolution(kEdge), -1);
  EXPECT_EQ(h3ops::getResolution(kVertex), -1);
  EXPECT_TRUE(h3ops::isValidDirectedEdge(kEdge));
  EXPECT_TRUE(h3ops::isValidVertex(kVertex));
}

TEST(InspectionOps, ReadsIndexDigits) {
  // h3-js `getIndexDigit("89283082803ffff", d)` for `d` = 1..9 == `[0, 6, 0, 4, 0, 5, 0, 0, 0]`
  const int expected[] = {0, 6, 0, 4, 0, 5, 0, 0, 0};
  for (int digit = 1; digit <= 9; digit++) {
    EXPECT_EQ(h3ops::getIndexDigit(kSanFrancisco, digit), expected[digit - 1]) << "digit " << digit;
  }
}

TEST(InspectionOps, RejectsDigitZeroAndDigitSixteen) {
  // resolution 0 is specified by the base cell number, not an indexing digit
  EXPECT_THROW(h3ops::getIndexDigit(kSanFrancisco, 0), std::runtime_error);
  EXPECT_THROW(h3ops::getIndexDigit(kSanFrancisco, 16), std::runtime_error);
}

TEST(InspectionOps, GetIndexDigitRejectsAnInvalidCell) {
  try {
    h3ops::getIndexDigit(1, 1);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid (code: 5)");
  }
}

TEST(InspectionOps, RejectsAFractionalDigit) {
  EXPECT_THROW(h3ops::getIndexDigit(kSanFrancisco, 1.5), std::runtime_error);
}

TEST(InspectionOps, ConstructsACellFromItsComponents) {
  // h3-js `constructCell(20, [0, 6, 0, 4, 0, 5, 0, 0, 0], 9)` == `"89283082803ffff"`
  const std::vector<double> digits = {0, 6, 0, 4, 0, 5, 0, 0, 0};
  EXPECT_EQ(h3ops::constructCell(20, digits, 9), kSanFrancisco);
}

TEST(InspectionOps, ConstructsAResolutionZeroCellFromNoDigits) {
  // h3-js `constructCell(20, [], 0)` == `"8029fffffffffff"`
  EXPECT_EQ(h3ops::constructCell(20, {}, 0), 0x8029fffffffffffULL);
}

TEST(InspectionOps, RejectsADigitArrayOfTheWrongLength) {
  try {
    h3ops::constructCell(20, {0, 6, 0}, 9);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "constructCell needs exactly res digits");
  }
}

TEST(InspectionOps, RejectsAnOutOfRangeResolutionBeforeCountingDigits) {
  // the resolution is H3's rule, so `describeH3Error` words it even though the length check is ours
  try {
    h3ops::constructCell(20, {}, 99);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution argument was outside of acceptable range (code: 4)");
  }
}

TEST(InspectionOps, RejectsAnOutOfRangeBaseCellNumber) {
  EXPECT_THROW(h3ops::constructCell(122, {}, 0), std::runtime_error);
}

TEST(InspectionOps, RejectsAnOutOfRangeChildDigit) {
  EXPECT_THROW(h3ops::constructCell(20, {7}, 1), std::runtime_error);
}

TEST(InspectionOps, ConvertsCellsToAndFromStrings) {
  EXPECT_EQ(h3ops::cellToString(kSanFrancisco), "89283082803ffff");
  EXPECT_EQ(h3ops::cellFromString("89283082803ffff"), kSanFrancisco);
  // sixteen digits is the longest possible output and must not overflow the buffer
  EXPECT_EQ(h3ops::cellToString(0xffffffffffffffffULL), "ffffffffffffffff");
  EXPECT_EQ(h3ops::cellFromString("ffffffffffffffff"), 0xffffffffffffffffULL);
}

TEST(InspectionOps, RejectsAStringThatIsNotHexadecimal) {
  try {
    h3ops::cellFromString("not a cell");
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "The operation failed but a more specific error is not available (code: 1)");
  }
}

TEST(InspectionOps, DoesNotValidateTheResultOfCellFromString) {
  // `stringToH3` parses; it does not check. Matching that is deliberate: `cellFromString` is a
  // decoder, and `isValidCell` is the check.
  EXPECT_EQ(h3ops::cellFromString("1"), 1u);
  EXPECT_FALSE(h3ops::isValidCell(1));
}

} // namespace
