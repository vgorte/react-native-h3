//
//  FuzzSupport.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 01.09.26.
//

#pragma once

#include <cstddef>
#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <utility>

namespace h3fuzz {

/**
 * The cell ceiling every harness installs once, so that no allocation is ever sized by fuzz input.
 * Every `allocateFor` path is measured against it, which is what keeps a decoded resolution from
 * turning into an out-of-memory kill rather than a refusal.
 */
inline constexpr int64_t kMaxCellCount = 100000;

/**
 * Hands the fuzzer's bytes out as typed values and reports zero once they are spent.
 *
 * Every element count a harness decodes goes through `takeCount`, so a handful of input bytes can
 * never be turned into a request for a billion elements.
 */
class Input final {
public:
  Input(const uint8_t* data, size_t size) noexcept : data_(data), size_(size) {}

  size_t remaining() const noexcept { return size_ - offset_; }

  /** Returns the next byte, or `0` once the input is spent. */
  uint8_t byte() noexcept {
    if (offset_ >= size_) {
      return 0;
    }
    return data_[offset_++];
  }

  /** Returns the next little-endian `uint64_t`, zero-padded once the input is spent. */
  uint64_t cell() noexcept {
    uint64_t value = 0;
    for (int shift = 0; shift < 64; shift += 8) {
      value |= static_cast<uint64_t>(byte()) << shift;
    }
    return value;
  }

  /** Returns the next `double` as a raw bit pattern, so NaN and infinity reach the operations. */
  double number() noexcept {
    const uint64_t bits = cell();
    double value = 0.0;
    std::memcpy(&value, &bits, sizeof(value));
    return value;
  }

  /** Returns a count no larger than the remaining bytes could fill at `bytesPerElement`. */
  size_t takeCount(size_t bytesPerElement) noexcept {
    const size_t selector = byte();
    const size_t affordable = remaining() / bytesPerElement;
    if (affordable == 0) {
      return 0;
    }
    return selector % (affordable + 1);
  }

private:
  const uint8_t* data_;
  size_t size_;
  size_t offset_ = 0;
};

/**
 * Runs one operation under the oracle: `std::runtime_error` is how this package refuses an input,
 * so it is expected and swallowed. Every other exception escapes and the input is recorded.
 * One call per operation; a shared block would gate later operations behind earlier ones succeeding.
 */
template <typename Call> void runOp(Call&& call) {
  try {
    std::forward<Call>(call)();
  } catch (const std::runtime_error&) {
  }
}

} // namespace h3fuzz
