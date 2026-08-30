//
//  H3ErrorMappingTest.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <stdexcept>
#include <string>

#include "core/H3ErrorMapping.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

TEST(H3ErrorMapping, SuccessDoesNotThrow) {
  EXPECT_NO_THROW(h3core::throwOnError(E_SUCCESS));
}

TEST(H3ErrorMapping, UsesUpstreamWordingWithTheCodeSuffix) {
  try {
    h3core::throwOnError(E_CELL_INVALID);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    // what describeH3Error returns, plus the suffix h3-js appends; no prefix, no reformatting.
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid (code: 5)");
  }
}

TEST(H3ErrorMapping, CoversEveryDefinedErrorCode) {
  for (uint32_t code = 1; code < H3_ERROR_END; code++) {
    try {
      h3core::throwOnError(code);
      FAIL() << "code " << code << " did not throw";
    } catch (const std::runtime_error& error) {
      const std::string suffix = " (code: " + std::to_string(code) + ")";
      const std::string message(error.what());
      EXPECT_GT(message.size(), suffix.size()) << "code " << code;
      EXPECT_EQ(message.substr(message.size() - suffix.size()), suffix) << "code " << code;
      EXPECT_EQ(message.find("Invalid error code"), std::string::npos) << "code " << code;
    }
  }
}

TEST(H3ErrorMapping, HandlesAnUnknownCodeWithoutReadingOutOfBounds) {
  // pins that no local error table exists; describeH3Error guards the range
  try {
    h3core::throwOnError(9999);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Invalid error code (code: 9999)");
  }
}

TEST(H3ErrorMapping, InvalidArgumentUsesOurOwnWordingWithoutACode) {
  try {
    h3core::throwInvalidArgument("Resolution must be an integer between 0 and 15");
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution must be an integer between 0 and 15");
  }
}

} // namespace
