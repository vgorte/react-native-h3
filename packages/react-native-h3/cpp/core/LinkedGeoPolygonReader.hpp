//
//  LinkedGeoPolygonReader.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/Geometry.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3core {

/**
 * Owns the `::LinkedGeoPolygon` graph `cellsToLinkedMultiPolygon` produces, and reads it out as
 * plain `h3core::MultiPolygon` values in degrees.
 *
 * Ownership is split, which is the whole reason this class exists: the root node's storage is the
 * member below, while H3 owns every `::LinkedGeoLoop`, `::LinkedLatLng` and sibling
 * `::LinkedGeoPolygon` reachable from it, all of which `destroyLinkedMultiPolygon` releases without
 * freeing the root. Stays free of Nitro, so LeakSanitizer on Linux can prove both paths.
 */
class LinkedGeoPolygonReader final {
public:
  /**
   * Runs `cellsToLinkedMultiPolygon` over `count` cells and holds on to the result.
   *
   * Throws `std::runtime_error` with upstream's wording when H3 rejects the set (mixed resolutions,
   * duplicates, invalid cells), and with this package's wording when `count` is negative or does not
   * fit the `const int numHexes` parameter the C function declares.
   */
  explicit LinkedGeoPolygonReader(const uint64_t* cells, int64_t count);

  LinkedGeoPolygonReader(const LinkedGeoPolygonReader&) = delete;
  LinkedGeoPolygonReader& operator=(const LinkedGeoPolygonReader&) = delete;
  LinkedGeoPolygonReader(LinkedGeoPolygonReader&&) = delete;
  LinkedGeoPolygonReader& operator=(LinkedGeoPolygonReader&&) = delete;

  ~LinkedGeoPolygonReader();

  /** Walks the graph and returns every polygon, every loop and every vertex, in degrees. */
  MultiPolygon read() const;

private:
  ::LinkedGeoPolygon root_{};
  bool linked_ = false;
};

} // namespace h3core
