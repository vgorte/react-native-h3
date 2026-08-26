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
 * Throws a `std::runtime_error` for a non-zero H3 error code, with `describeH3Error`'s wording
 * verbatim. Does nothing for `E_SUCCESS`.
 *
 * Nitro erases everything but `what()` when an exception crosses into JS, so this message is
 * the whole error contract. Keeping the wording upstream's means never maintaining a second table.
 *
 * Takes `uint32_t` rather than `H3Error` so this header does not need `h3api.h`, which keeps it
 * usable from files that must stay free of the vendored C headers.
 */
void throwOnError(uint32_t error);

/** Throws a `std::runtime_error` for an argument H3 itself would not reject, with our own wording. */
[[noreturn]] void throwInvalidArgument(const char* message);

}  // namespace h3core
