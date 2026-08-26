//
//  H3ErrorMapping.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

namespace h3core {

/**
 * Throws a `std::runtime_error` carrying exactly what `describeH3Error` returns, and does
 * nothing for `E_SUCCESS`. Nitro forwards only `what()` to JS, so this message is the whole
 * error contract. Takes `uint32_t` instead of `H3Error` so this header stays free of `h3api.h`.
 */
void throwOnError(uint32_t error);

/** Throws a `std::runtime_error` for an argument H3 itself would not reject, with our own wording. */
[[noreturn]] void throwInvalidArgument(const char* message);

}  // namespace h3core
