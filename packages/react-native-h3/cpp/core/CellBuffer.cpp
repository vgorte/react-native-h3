//
//  CellBuffer.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/CellBuffer.hpp"

#include <algorithm>
#include <stdexcept>

extern "C" {
#include "h3api.h"
}

namespace h3core {

CellBuffer::CellBuffer(int64_t capacity) : capacity_(capacity), count_(0) {
  if (capacity < 0) {
    throw std::invalid_argument("CellBuffer capacity must not be negative");
  }
  if (capacity == 0) {
    return;
  }
  // value-initialising `new[]` zeroes the block, which H3 requires.
  cells_ = std::unique_ptr<uint64_t[]>(new uint64_t[static_cast<size_t>(capacity)]());
}

int64_t CellBuffer::compact() noexcept {
  if (cells_ == nullptr) {
    count_ = 0;
    return 0;
  }
  uint64_t* begin = cells_.get();
  uint64_t* end = begin + capacity_;
  uint64_t* newEnd = std::remove(begin, end, static_cast<uint64_t>(H3_NULL));
  count_ = static_cast<int64_t>(newEnd - begin);
  return count_;
}

uint64_t* CellBuffer::release() noexcept {
  return cells_.release();
}

}  // namespace h3core
