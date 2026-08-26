//
//  CellBuffer.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/CellBuffer.hpp"

#include <algorithm>
#include <cstddef>
#include <limits>
#include <stdexcept>
#include <utility>

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
  // 32-bit ABIs (armeabi-v7a, x86) have a `size_t` narrower than `int64_t`; reject before it wraps.
  if (static_cast<uint64_t>(capacity) > std::numeric_limits<std::size_t>::max() / sizeof(uint64_t)) {
    throw std::invalid_argument("CellBuffer capacity exceeds addressable memory");
  }
  // value-initialising `new[]` zeroes the block; never swap this for `malloc` or a reserve.
  cells_ = std::unique_ptr<uint64_t[]>(new uint64_t[static_cast<std::size_t>(capacity)]());
}

CellBuffer::CellBuffer(CellBuffer&& other) noexcept
    : cells_(std::move(other.cells_)), capacity_(std::exchange(other.capacity_, 0)),
      count_(std::exchange(other.count_, 0)) {}

CellBuffer& CellBuffer::operator=(CellBuffer&& other) noexcept {
  if (this != &other) {
    cells_ = std::move(other.cells_);
    capacity_ = std::exchange(other.capacity_, 0);
    count_ = std::exchange(other.count_, 0);
  }
  return *this;
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
  // keeps a repeated compact() idempotent instead of reporting stale duplicates.
  std::fill(newEnd, end, static_cast<uint64_t>(H3_NULL));
  return count_;
}

void CellBuffer::setCount(int64_t count) {
  if (count < 0 || count > capacity_) {
    throw std::invalid_argument("CellBuffer count must be between 0 and the capacity");
  }
  count_ = count;
}

uint64_t* CellBuffer::release() noexcept {
  capacity_ = 0;
  count_ = 0;
  return cells_.release();
}

} // namespace h3core
