//
//  Inspection.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Inspection.hpp"

#include <array>
#include <cstddef>

#include "core/BufferSizes.hpp"
#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

bool isValidCell(uint64_t cell) {
  return ::isValidCell(cell) != 0;
}

bool isValidIndex(uint64_t index) {
  return ::isValidIndex(index) != 0;
}

bool isValidDirectedEdge(uint64_t edge) {
  return ::isValidDirectedEdge(edge) != 0;
}

bool isValidVertex(uint64_t vertex) {
  return ::isValidVertex(vertex) != 0;
}

bool isPentagon(uint64_t cell) {
  return ::isPentagon(cell) != 0;
}

bool isResClassIII(uint64_t cell) {
  return ::isResClassIII(cell) != 0;
}

int getResolution(uint64_t index) {
  // h3-js guards this with `isValidCell` alone, so a directed edge and a vertex answer `-1` too.
  return ::isValidCell(index) != 0 ? ::getResolution(index) : -1;
}

int getBaseCellNumber(uint64_t cell) {
  return ::getBaseCellNumber(cell);
}

int getIndexDigit(uint64_t cell, double digit) {
  // `getIndexDigit` validates only its `res` (`h3Index.c:116-122`), so a malformed index otherwise
  // yields a digit rather than an error.
  internal::requireValidCell(cell);
  // H3 rejects a `res` outside `1` to `15` with `E_RES_DOMAIN` (`h3Index.c:117`), so that range
  // check is left to it; only the narrowing happens here.
  return h3shapes::callWithOutParam<int>(::getIndexDigit, cell, h3core::toInteger(digit, "Digit must be an integer"));
}

uint64_t constructCell(double baseCellNumber, const std::vector<double>& digits, double res) {
  const int resolution = h3core::toResolution(res);
  const int baseCell = h3core::toInteger(baseCellNumber, "Base cell number must be an integer");
  // H3 range-checks the resolution itself (`h3Index.c:137`) but never sees the digit count, so its
  // verdict has to come first; otherwise a nonsense resolution reads as a digit-count mismatch.
  internal::requireResolution(resolution);
  if (digits.size() != static_cast<size_t>(resolution)) {
    h3core::throwInvalidArgument("constructCell needs exactly res digits");
  }

  std::vector<int> childDigits;
  childDigits.reserve(digits.size());
  for (const double digit : digits) {
    childDigits.push_back(h3core::toInteger(digit, "Child digits must be integers"));
  }

  // the header allows a null pointer only for resolution `0`, and an empty vector's `data()` may be
  // null, so both cases pass exactly what the header permits.
  return h3shapes::callWithOutParam<uint64_t>(::constructCell, resolution, baseCell, childDigits.data());
}

std::string cellToString(uint64_t cell) {
  std::array<char, h3core::kH3ToStringBufferSize> text{};
  h3core::throwOnError(static_cast<uint32_t>(::h3ToString(cell, text.data(), text.size())));
  return std::string(text.data());
}

uint64_t cellFromString(const std::string& text) {
  return h3shapes::callWithOutParam<uint64_t>(::stringToH3, text.c_str());
}

} // namespace h3ops
