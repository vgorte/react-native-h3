//
//  FuzzCellBuffers.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 01.09.26.
//

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <vector>

#include "FuzzSupport.hpp"
#include "ops/Batches.hpp"
#include "ops/Hierarchy.hpp"
#include "ops/Regions.hpp"
#include "shapes/CellSetCall.hpp"

extern "C" int LLVMFuzzerInitialize(int*, char***) {
  h3shapes::setMaxCellCount(h3fuzz::kMaxCellCount);
  return 0;
}

extern "C" int LLVMFuzzerTestOneInput(const uint8_t* data, size_t size) {
  if (size < 1 + sizeof(uint64_t)) {
    return 0;
  }
  // `-1` and `16` reach H3's own range check rather than being filtered out here
  const double res = static_cast<double>(data[0] % 18) - 1.0;

  const size_t count = (size - 1) / sizeof(uint64_t);
  // two separately typed buffers: one block read as both types would violate strict aliasing
  std::vector<uint64_t> cells(count);
  std::vector<double> coords(count);
  std::memcpy(cells.data(), data + 1, count * sizeof(uint64_t));
  std::memcpy(coords.data(), data + 1, count * sizeof(double));

  const int64_t cellCount = static_cast<int64_t>(count);
  h3fuzz::runOp([&] { (void)h3ops::compactCells(cells.data(), cellCount); });
  h3fuzz::runOp([&] { (void)h3ops::uncompactCells(cells.data(), cellCount, res); });
  // not ceiling-guarded upstream, so its memory is bounded by `-max_len` alone
  h3fuzz::runOp([&] { (void)h3ops::cellsToMultiPolygon(cells.data(), cellCount); });
  h3fuzz::runOp([&] { (void)h3ops::cellsToLatLngs(cells.data(), cellCount); });
  h3fuzz::runOp([&] { (void)h3ops::latLngsToCells(coords.data(), cellCount, res); });
  return 0;
}
