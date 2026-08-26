//
//  ValidationTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <limits>
#include <stdexcept>
#include <string>

#include "core/Validation.hpp"

namespace {

TEST(Validation, AcceptsAnIntegralDouble) {
  EXPECT_EQ(h3core::toInteger(7.0, "not an integer"), 7);
  EXPECT_EQ(h3core::toInteger(-7.0, "not an integer"), -7);
  EXPECT_EQ(h3core::toInteger(0.0, "not an integer"), 0);
}

TEST(Validation, RejectsAFractionalDouble) {
  try {
    h3core::toInteger(7.5, "k must be an integer");
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "k must be an integer");
  }
}

TEST(Validation, RejectsNaNAndInfinity) {
  EXPECT_THROW(h3core::toInteger(std::numeric_limits<double>::quiet_NaN(), "bad"), std::runtime_error);
  EXPECT_THROW(h3core::toInteger(std::numeric_limits<double>::infinity(), "bad"), std::runtime_error);
  EXPECT_THROW(h3core::toInteger(-std::numeric_limits<double>::infinity(), "bad"), std::runtime_error);
}

TEST(Validation, RejectsValuesOutsideTheIntRange) {
  EXPECT_THROW(h3core::toInteger(2147483648.0, "bad"), std::runtime_error);
  EXPECT_THROW(h3core::toInteger(-2147483649.0, "bad"), std::runtime_error);
  EXPECT_EQ(h3core::toInteger(2147483647.0, "bad"), 2147483647);
  EXPECT_EQ(h3core::toInteger(-2147483648.0, "bad"), -2147483648);
}

TEST(Validation, AcceptsEveryResolution) {
  for (int res = 0; res <= 15; res++) {
    EXPECT_EQ(h3core::toResolution(static_cast<double>(res)), res);
  }
}

TEST(Validation, NarrowsAResolutionWithoutCheckingItsRange) {
  // H3 owns the `0` to `15` rule and reports `E_RES_DOMAIN` itself
  EXPECT_EQ(h3core::toResolution(16.0), 16);
  EXPECT_EQ(h3core::toResolution(-1.0), -1);
  try {
    h3core::toResolution(1.5);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution must be an integer between 0 and 15");
  }
}

TEST(Validation, ToCountCoversTheSafeIntegerRange) {
  // The largest count H3 can report is `getNumCells(15)` == 569,707,381,193,162, which is well
  // inside the range a JS number represents exactly, and far outside the `int` range.
  EXPECT_EQ(h3core::toCount(569707381193162.0, "bad"), 569707381193162LL);
  EXPECT_THROW(h3core::toCount(-1.0, "bad"), std::runtime_error);
  EXPECT_THROW(h3core::toCount(9007199254740993.0, "bad"), std::runtime_error);
}

TEST(Validation, ToInt64NarrowsWithoutADomain) {
  // H3 owns the domain: `validateChildPos` rejects a negative position itself (`h3Index.c:1371`).
  EXPECT_EQ(h3core::toInt64(-1.0, "bad"), -1LL);
  EXPECT_EQ(h3core::toInt64(0.0, "bad"), 0LL);
  EXPECT_EQ(h3core::toInt64(9007199254740991.0, "bad"), 9007199254740991LL);
}

TEST(Validation, ToInt64RejectsWhatAJavaScriptNumberCannotHold) {
  EXPECT_THROW(h3core::toInt64(9007199254740993.0, "bad"), std::runtime_error);
  EXPECT_THROW(h3core::toInt64(-9007199254740993.0, "bad"), std::runtime_error);
  try {
    h3core::toInt64(1.5, "Child position must be an integer");
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Child position must be an integer");
  }
}

} // namespace
