//
//  H3ErrorMapping.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/H3ErrorMapping.hpp"

#include <stdexcept>
#include <string>

extern "C" {
#include "h3api.h"
}

namespace h3core {

void throwOnError(uint32_t error) {
  if (error == E_SUCCESS) {
    return;
  }
  // the concatenation is on the error path only, so the success path stays a single comparison.
  throw std::runtime_error(std::string(describeH3Error(static_cast<H3Error>(error))) +
                           " (code: " + std::to_string(error) + ")");
}

void throwInvalidArgument(const char* message) {
  throw std::runtime_error(message);
}

} // namespace h3core
