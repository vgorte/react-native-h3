//
//  H3ErrorMapping.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/H3ErrorMapping.hpp"

#include <stdexcept>

extern "C" {
#include "h3api.h"
}

namespace h3core {

void throwOnError(uint32_t error) {
  if (error == E_SUCCESS) {
    return;
  }
  throw std::runtime_error(describeH3Error(static_cast<H3Error>(error)));
}

void throwInvalidArgument(const char* message) {
  throw std::runtime_error(message);
}

}  // namespace h3core
