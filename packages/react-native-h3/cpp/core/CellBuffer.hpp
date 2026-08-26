//
//  CellBuffer.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <memory>

namespace h3core {

/**
 * Owns a zero-initialised block of H3 cell indexes and removes `H3_NULL` holes in place.
 * `gridDisk`, `gridRing` and `polygonToCells` require the buffer to arrive zero-filled
 * (`algos.c:193-198`), and pentagons leave holes anywhere in the output.
 *
 * Stays free of Nitro so it can run in the host test target under AddressSanitizer.
 */
class CellBuffer final {
 public:
  /** Allocates `capacity` zeroed slots. Throws `std::invalid_argument` for a negative capacity. */
  explicit CellBuffer(int64_t capacity);

  CellBuffer(const CellBuffer&) = delete;
  CellBuffer& operator=(const CellBuffer&) = delete;
  CellBuffer(CellBuffer&&) noexcept = default;
  CellBuffer& operator=(CellBuffer&&) noexcept = default;
  ~CellBuffer() = default;

  /** Writable slots for H3 to fill. `nullptr` after `release()`. */
  uint64_t* data() noexcept { return cells_.get(); }
  const uint64_t* data() const noexcept { return cells_.get(); }

  int64_t capacity() const noexcept { return capacity_; }

  /** Number of real cells, valid only after `compact()`. */
  int64_t count() const noexcept { return count_; }

  /**
   * Removes every `H3_NULL` entry in place, preserving order, and returns the count of real cells.
   * Never shrinks the underlying block: reallocating to size would trade a scan for a copy on
   * the path this package exists for.
   */
  int64_t compact() noexcept;

  /**
   * Hands the raw block to the caller, who takes ownership and must `delete[]` it.
   * Feeds Nitro's `ArrayBuffer::wrap`, whose deleter frees the `uint64_t*` allocated here, not
   * the `uint8_t*` the buffer is wrapped as.
   */
  uint64_t* release() noexcept;

 private:
  std::unique_ptr<uint64_t[]> cells_;
  int64_t capacity_;
  int64_t count_;
};

}  // namespace h3core
