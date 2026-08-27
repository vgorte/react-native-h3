//
//  Traversal.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Traversal.hpp"

#include <cstddef>

#include "core/H3ErrorMapping.hpp"
#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

namespace {

// H3 owns the range of `k`: every size query below answers `E_DOMAIN` for a negative one.
constexpr const char* kIntegerK = "k must be an integer";

// `cellToLocalIj` and `localIjToCell` take a mode that must be `0`. Only the source says so
// (`localij.c:528`), so it is pinned here rather than at every call site.
constexpr uint32_t kLocalIjMode = 0;

} // namespace

h3core::CellBuffer gridDisk(uint64_t origin, double k) {
  // `gridDiskDistancesUnsafe` writes the origin out before looking at it (`algos.c:676`)
  internal::requireValidCell(origin);
  const int distance = h3core::toInteger(k, kIntegerK);
  return h3shapes::fillCompactedCells([&] { return h3shapes::callWithOutParam<int64_t>(::maxGridDiskSize, distance); },
                                      [&](uint64_t* out) { return ::gridDisk(origin, distance, out); });
}

h3core::CellBuffer gridRing(uint64_t origin, double k) {
  // `gridRingUnsafe` short-circuits `k` of 0 to the origin itself (`algos.c:794`)
  internal::requireValidCell(origin);
  const int distance = h3core::toInteger(k, kIntegerK);
  // `maxGridRingSize` returns 1 for `k` of 0 and `6 * k` otherwise (`algos.c:344`); calling it
  // instead of reimplementing the formula keeps one source of truth for the ring size.
  return h3shapes::fillCompactedCells([&] { return h3shapes::callWithOutParam<int64_t>(::maxGridRingSize, distance); },
                                      [&](uint64_t* out) { return ::gridRing(origin, distance, out); });
}

h3core::CellBuffer gridRingUnsafe(uint64_t origin, double k) {
  internal::requireValidCell(origin);
  const int distance = h3core::toInteger(k, kIntegerK);
  // a pentagon origin bails before writing (`algos.c:803`), but a ring that runs into one fails
  // mid-buffer (`algos.c:846`), and the fill template destroys it while the exception unwinds.
  return h3shapes::fillCompactedCells([&] { return h3shapes::callWithOutParam<int64_t>(::maxGridRingSize, distance); },
                                      [&](uint64_t* out) { return ::gridRingUnsafe(origin, distance, out); });
}

std::vector<h3core::CellBuffer> gridDiskDistances(uint64_t origin, double k) {
  internal::requireValidCell(origin);
  const int distance = h3core::toInteger(k, kIntegerK);
  // the parallel distance array rules out either fill template, but not the shared ceiling
  h3core::CellBuffer cells =
      h3shapes::allocateFor([&] { return h3shapes::callWithOutParam<int64_t>(::maxGridDiskSize, distance); });
  const size_t capacity = static_cast<size_t>(cells.capacity());
  // zero-filled for the same reason the cells are: H3 leaves the slots it skips untouched
  std::vector<int> distances(capacity, 0);
  h3core::throwOnError(static_cast<uint32_t>(::gridDiskDistances(origin, distance, cells.data(), distances.data())));

  // `k + 1` buckets, sized in a first pass, so that a ring a pentagon empties is still present and
  // empty rather than missing and the index is always the grid distance.
  std::vector<int64_t> counts(static_cast<size_t>(distance) + 1, 0);
  for (size_t i = 0; i < capacity; i++) {
    const size_t ring = static_cast<size_t>(distances[i]);
    // the buckets are sized from `k`, not from H3's output, so an unexpected distance is dropped
    if (cells.data()[i] == H3_NULL || ring >= counts.size()) {
      continue;
    }
    counts[ring]++;
  }

  std::vector<h3core::CellBuffer> rings;
  rings.reserve(counts.size());
  for (const int64_t count : counts) {
    rings.emplace_back(count);
  }

  std::vector<int64_t> written(counts.size(), 0);
  for (size_t i = 0; i < capacity; i++) {
    const uint64_t cell = cells.data()[i];
    const size_t ring = static_cast<size_t>(distances[i]);
    // dropped by the same test as in the counting pass, so the two stay in step
    if (cell == H3_NULL || ring >= rings.size()) {
      continue;
    }
    rings[ring].data()[written[ring]] = cell;
    written[ring]++;
  }
  for (size_t ring = 0; ring < rings.size(); ring++) {
    rings[ring].setCount(written[ring]);
  }
  return rings;
}

h3core::CellBuffer gridPathCells(uint64_t start, uint64_t end) {
  // `cellToLocalIjk` checks the base cell range and nothing more (`localij.c:145`)
  internal::requireValidCell(start);
  internal::requireValidCell(end);
  // `gridPathCellsSize` is `gridDistance` plus one and therefore exact (`localij.c:620`); h3-js
  // drops the error check at this one call site, but keeping it is a divergence worth asserting.
  return h3shapes::fillExactCells([&] { return h3shapes::callWithOutParam<int64_t>(::gridPathCellsSize, start, end); },
                                  [&](uint64_t* out) { return ::gridPathCells(start, end, out); });
}

int64_t gridDistance(uint64_t origin, uint64_t destination) {
  internal::requireValidCell(origin);
  internal::requireValidCell(destination);
  return h3shapes::callWithOutParam<int64_t>(::gridDistance, origin, destination);
}

h3core::IJ cellToLocalIj(uint64_t origin, uint64_t cell) {
  internal::requireValidCell(origin);
  internal::requireValidCell(cell);
  const ::CoordIJ ij = h3shapes::callWithOutParam<::CoordIJ>(::cellToLocalIj, origin, cell, kLocalIjMode);
  return h3core::IJ{ij.i, ij.j};
}

uint64_t localIjToCell(uint64_t origin, double i, double j) {
  // `localIjkToCell` reads the origin's resolution and base cell only (`localij.c:306`)
  internal::requireValidCell(origin);
  ::CoordIJ ij{};
  ij.i = h3core::toInteger(i, "Local IJ coordinates must be integers");
  ij.j = h3core::toInteger(j, "Local IJ coordinates must be integers");
  return h3shapes::callWithOutParam<uint64_t>(::localIjToCell, origin, &ij, kLocalIjMode);
}

} // namespace h3ops
