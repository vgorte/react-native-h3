//
//  Validation.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/Validation.hpp"

#include <cmath>
#include <cstdint>

#include "core/H3ErrorMapping.hpp"

namespace h3core {

namespace {

/** `2^53 - 1`, the largest integer a JavaScript number represents exactly. */
constexpr double kMaxSafeInteger = 9007199254740991.0;

void requireIntegral(double value, const char* message) {
  if (std::isnan(value) || std::isinf(value) || value != std::floor(value)) {
    throwInvalidArgument(message);
  }
}

} // namespace

int toInteger(double value, const char* message) {
  requireIntegral(value, message);
  if (value < -2147483648.0 || value > 2147483647.0) {
    throwInvalidArgument(message);
  }
  return static_cast<int>(value);
}

int64_t toCount(double value, const char* message) {
  requireIntegral(value, message);
  if (value < 0.0 || value > kMaxSafeInteger) {
    throwInvalidArgument(message);
  }
  return static_cast<int64_t>(value);
}

int toResolution(double res) {
  return toInteger(res, "Resolution must be an integer between 0 and 15");
}

} // namespace h3core
