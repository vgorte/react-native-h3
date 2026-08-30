//
//  Validation.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

/**
 * Narrows the doubles arriving from JavaScript to the integer types H3 takes, in one place, so
 * the interior can trust its arguments.
 *
 * Only the narrowing belongs here: every domain rule (a resolution of `0` to `15`, a non-negative
 * `k`) is H3's, so that upstream's `describeH3Error` wording is what reaches JavaScript. Each of
 * these throws `std::runtime_error` through `h3core::throwInvalidArgument`, whose message is the
 * whole error contract once Nitro has erased everything but `what()`.
 */
namespace h3core {

/** Converts an integral double to `int`, throwing `message` when it is not one, or does not fit. */
int toInteger(double value, const char* message);

/**
 * Converts an integral double to `int64_t`, rejecting anything a JavaScript number cannot represent
 * exactly. Imposes no domain of its own, so a negative value passes for H3 to judge.
 */
int64_t toInt64(double value, const char* message);

/**
 * Narrows a double to an H3 resolution without checking its range. H3 range-checks resolutions
 * itself and answers `E_RES_DOMAIN`.
 */
int toResolution(double res);

} // namespace h3core
