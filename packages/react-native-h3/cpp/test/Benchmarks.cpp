//
//  Benchmarks.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 28.08.26.
//

/**
 * Measures the operations layer on the host and prints a Markdown table. Informational only, never
 * a gate.
 *
 * The number to watch is `allocs/op` rather than `ns/op`, which varies with the machine: a cell set
 * crosses into JS uncopied, so one allocation per call on the buffer paths is the invariant and a
 * second one means a copy was introduced.
 */

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <new>
#include <string>
#include <vector>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"
#include "ops/Hierarchy.hpp"
#include "ops/Regions.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

std::atomic<size_t> gAllocations{0};
std::atomic<size_t> gBytes{0};

struct Measurement {
  std::string name;
  double nanosPerOp;
  double allocationsPerOp;
  double bytesPerOp;
  int64_t result;
};

template <typename Fn> Measurement measure(const std::string& name, int iterations, Fn&& body) {
  // one warm-up pass, so first-touch page faults stay out of the measurement
  int64_t result = body();

  gAllocations.store(0);
  gBytes.store(0);
  const auto start = std::chrono::steady_clock::now();
  for (int i = 0; i < iterations; i++) {
    result = body();
  }
  const auto end = std::chrono::steady_clock::now();
  const double allocations = static_cast<double>(gAllocations.load());
  const double bytes = static_cast<double>(gBytes.load());

  const double nanos = static_cast<double>(std::chrono::duration_cast<std::chrono::nanoseconds>(end - start).count());
  return Measurement{name, nanos / iterations, allocations / iterations, bytes / iterations, result};
}

H3Index sanFrancisco(int resolution) {
  ::LatLng point{};
  point.lat = ::degsToRads(37.7749);
  point.lng = ::degsToRads(-122.4194);
  H3Index cell = H3_NULL;
  if (::latLngToCell(&point, resolution, &cell) != E_SUCCESS) {
    std::fprintf(stderr, "fixture failed\n");
    std::exit(1);
  }
  return cell;
}

/** Holds the ring list `h3ops` takes: GeoJSON-shaped `[latitude, longitude]` pairs in degrees. */
using Rings = std::vector<std::vector<std::vector<double>>>;

Rings sanFranciscoBox() {
  return {{
      {37.80, -122.45},
      {37.80, -122.39},
      {37.74, -122.39},
      {37.74, -122.45},
  }};
}

} // namespace

// counts C++ allocations only; H3 allocates through `malloc` (`alloc.h:46`) and stays invisible
// the `std::align_val_t` overloads are deliberately left alone, so `allocs/op` is a floor
void* operator new(size_t size) {
  gAllocations.fetch_add(1, std::memory_order_relaxed);
  gBytes.fetch_add(size, std::memory_order_relaxed);
  void* pointer = std::malloc(size == 0 ? 1 : size);
  if (pointer == nullptr) {
    throw std::bad_alloc();
  }
  return pointer;
}

void* operator new[](size_t size) {
  return operator new(size);
}

void operator delete(void* pointer) noexcept {
  std::free(pointer);
}

void operator delete[](void* pointer) noexcept {
  std::free(pointer);
}

void operator delete(void* pointer, size_t) noexcept {
  std::free(pointer);
}

void operator delete[](void* pointer, size_t) noexcept {
  std::free(pointer);
}

int main() {
  std::vector<Measurement> results;

  // the buffer path: allocate zeroed, fill, compact, release
  const H3Index origin9 = sanFrancisco(9);
  results.push_back(measure("gridDisk k=20 through CellBuffer", 200, [&]() -> int64_t {
    int64_t maxSize = 0;
    ::maxGridDiskSize(20, &maxSize);
    h3core::CellBuffer buffer(maxSize);
    ::gridDisk(origin9, 20, buffer.data());
    const int64_t count = buffer.compact();
    uint64_t* cells = buffer.release();
    delete[] cells;
    return count;
  }));

  // resolution 10 rather than 12 keeps the run short; the shape of the work is the same
  const Rings box = sanFranciscoBox();
  results.push_back(
      measure("polygonToCells SF box res 10", 20, [&]() -> int64_t { return h3ops::polygonToCells(box, 10).count(); }));

  // the other buffer-in buffer-out path
  int64_t diskSize = 0;
  ::maxGridDiskSize(4, &diskSize);
  std::vector<H3Index> disk(static_cast<size_t>(diskSize), H3_NULL);
  ::gridDisk(sanFrancisco(5), 4, disk.data());
  disk.erase(std::remove(disk.begin(), disk.end(), static_cast<H3Index>(H3_NULL)), disk.end());
  std::vector<H3Index> compacted(disk.size(), H3_NULL);
  ::compactCells(disk.data(), compacted.data(), static_cast<int64_t>(disk.size()));
  compacted.erase(std::remove(compacted.begin(), compacted.end(), static_cast<H3Index>(H3_NULL)), compacted.end());
  results.push_back(measure("uncompactCells to res 5", 200, [&]() -> int64_t {
    return h3ops::uncompactCells(compacted.data(), static_cast<int64_t>(compacted.size()), 5).count();
  }));

  // allocates per ring and per point by construction, so no fixed count applies
  results.push_back(measure("cellsToMultiPolygon of a k=4 disk", 100, [&]() -> int64_t {
    const h3core::MultiPolygon polygons = h3ops::cellsToMultiPolygon(disk.data(), static_cast<int64_t>(disk.size()));
    return static_cast<int64_t>(polygons.size());
  }));

  std::printf("### Host benchmark (informational, not a gate)\n\n");
  std::printf("| Workload | ns/op | allocs/op | bytes/op | result |\n");
  std::printf("|---|---:|---:|---:|---:|\n");
  for (const Measurement& measurement : results) {
    std::printf("| %s | %.0f | %.2f | %.0f | %lld |\n", measurement.name.c_str(), measurement.nanosPerOp,
                measurement.allocationsPerOp, measurement.bytesPerOp, static_cast<long long>(measurement.result));
  }
  std::printf("\nWatch `allocs/op` rather than `ns/op`. The buffer paths allocate once per call; a second "
              "allocation means a copy was introduced into the zero-copy path. H3's own `malloc` and any "
              "over-aligned allocation are not counted, so the figure is a floor.\n");
  return 0;
}
