//
//  CellBuffer.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <memory>

namespace h3core {

/**
 * Owns a zero-initialised block of H3 cell indexes and removes `H3_NULL` holes in place.
 * `gridDisk` (`algos.c:193`), `gridRing` (`algos.c:360`) and `polygonToCells` (`algos.c:990`)
 * all require the buffer to arrive zero-filled, and pentagons leave holes anywhere in the output.
 *
 * Stays free of Nitro so it can run in the host test target under AddressSanitizer.
 */
class CellBuffer final {
public:
  /**
   * Allocates `capacity` zeroed slots. Throws `std::invalid_argument` for a negative capacity,
   * and for one that does not fit in `size_t` once scaled to bytes.
   */
  explicit CellBuffer(int64_t capacity);

  CellBuffer(const CellBuffer&) = delete;
  CellBuffer& operator=(const CellBuffer&) = delete;

  /**
   * Takes the block over and leaves `other` empty, so a moved-from buffer reports `nullptr` data
   * with a capacity and a count of `0`. Written out by hand because a defaulted move would leave
   * the plain integers behind and report a stale capacity for a block that has gone.
   */
  CellBuffer(CellBuffer&& other) noexcept;
  CellBuffer& operator=(CellBuffer&& other) noexcept;

  ~CellBuffer() = default;

  /** Returns the writable slots for H3 to fill. `nullptr` after `release()`. */
  uint64_t* data() noexcept { return cells_.get(); }
  const uint64_t* data() const noexcept { return cells_.get(); }

  int64_t capacity() const noexcept { return capacity_; }

  /** Returns the number of real cells, valid only after `compact()`. */
  int64_t count() const noexcept { return count_; }

  /**
   * Removes every `H3_NULL` entry in place, preserving order, and returns the count of real cells.
   * Resets `[count(), capacity())` to `H3_NULL`, so a repeated call is idempotent. Never shrinks
   * the underlying block: reallocating to size would trade a scan for a copy on the path this
   * package exists for.
   */
  int64_t compact() noexcept;

  /**
   * Publishes a count without scanning, for the functions whose output size is documented as exact
   * and therefore cannot contain `H3_NULL`. Throws `std::invalid_argument` when `count` is negative
   * or above the capacity, because that would hand out memory this buffer does not own.
   */
  void setCount(int64_t count);

  /**
   * Hands the raw block to the caller, who takes ownership and must `delete[]` it. `capacity()`
   * and `count()` read `0` afterwards. Feeds Nitro's `ArrayBuffer::wrap`, whose deleter frees the
   * `uint64_t*` allocated here, not the `uint8_t*` the buffer is wrapped as.
   */
  uint64_t* release() noexcept;

private:
  std::unique_ptr<uint64_t[]> cells_;
  int64_t capacity_;
  int64_t count_;
};

} // namespace h3core
