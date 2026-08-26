//
//  H3ErrorMappingTest.cpp
//  react-native-h3
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

TEST(H3ErrorMapping, UsesUpstreamWordingVerbatim) {
  try {
    h3core::throwOnError(E_CELL_INVALID);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    // exactly what describeH3Error returns; no prefix, no reformatting, no error code.
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid");
  }
}

TEST(H3ErrorMapping, CoversEveryDefinedErrorCode) {
  for (uint32_t code = 1; code < H3_ERROR_END; code++) {
    try {
      h3core::throwOnError(code);
      FAIL() << "code " << code << " did not throw";
    } catch (const std::runtime_error& error) {
      EXPECT_FALSE(std::string(error.what()).empty()) << "code " << code;
      EXPECT_NE(std::string(error.what()), "Invalid error code") << "code " << code;
    }
  }
}

TEST(H3ErrorMapping, HandlesAnUnknownCodeWithoutReadingOutOfBounds) {
  // describeH3Error guards this itself; the test pins that we do not add our own table.
  try {
    h3core::throwOnError(9999);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Invalid error code");
  }
}

TEST(H3ErrorMapping, InvalidArgumentUsesOurOwnWording) {
  try {
    h3core::throwInvalidArgument("Resolution must be an integer between 0 and 15");
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Resolution must be an integer between 0 and 15");
  }
}

}  // namespace
