//
//  FuzzCellStrings.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 01.09.26.
//

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <string>

#include "FuzzSupport.hpp"
#include "ops/Inspection.hpp"
#include "shapes/CellSetCall.hpp"

extern "C" int LLVMFuzzerInitialize(int*, char***) {
  h3shapes::setMaxCellCount(h3fuzz::kMaxCellCount);
  return 0;
}

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  if (size == 0) {
    return 0;
  }
  // `stringToH3` reads a C string, so nothing past the first NUL can reach the parser anyway
  const void* terminator = std::memchr(data, 0, size);
  const size_t length =
      terminator == nullptr ? size : static_cast<size_t>(static_cast<const uint8_t*>(terminator) - data);
  const std::string text(reinterpret_cast<const char*>(data), length);

  uint64_t cell = 0;
  bool parsed = false;
  h3fuzz::runOp([&] {
    cell = h3ops::cellFromString(text);
    parsed = true;
  });
  if (!parsed) {
    return 0;
  }

  // no round-trip equality: `sscanf %x` accepts prefixes and whitespace `cellToString` never emits
  h3fuzz::runOp([&] { (void)h3ops::cellToString(cell); });
  h3fuzz::runOp([&] { (void)h3ops::isValidCell(cell); });
  h3fuzz::runOp([&] { (void)h3ops::getResolution(cell); });
  return 0;
}
