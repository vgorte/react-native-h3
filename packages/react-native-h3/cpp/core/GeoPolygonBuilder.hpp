//
//  GeoPolygonBuilder.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <vector>

extern "C" {
#include "h3api.h"
}

namespace h3core {

/**
 * Owns the `::GeoPolygon` graph that `polygonToCells` and its size query both read.
 *
 * A `::GeoPolygon` owns nothing of its own: `geoloop.verts` and `holes` point into arrays the
 * caller must keep alive across both calls, so those arrays are members here and copying and moving
 * are deleted. Stays free of Nitro, so AddressSanitizer on the host exercises the whole graph.
 */
class GeoPolygonBuilder final {
public:
  /**
   * Builds the graph from GeoJSON-shaped rings in degrees, the outer boundary first and any holes
   * after it, each point a `[latitude, longitude]` pair. Throws `std::runtime_error` when a point
   * is not a pair of finite numbers, and accepts an empty ring list as an empty polygon.
   */
  explicit GeoPolygonBuilder(const std::vector<std::vector<std::vector<double>>>& rings);

  GeoPolygonBuilder(const GeoPolygonBuilder&) = delete;
  GeoPolygonBuilder& operator=(const GeoPolygonBuilder&) = delete;
  GeoPolygonBuilder(GeoPolygonBuilder&&) = delete;
  GeoPolygonBuilder& operator=(GeoPolygonBuilder&&) = delete;

  ~GeoPolygonBuilder() = default;

  /** Returns the graph in radians, valid for as long as this builder is. */
  const ::GeoPolygon* polygon() const noexcept { return &polygon_; }

private:
  std::vector<::LatLng> outerVerts_;
  std::vector<std::vector<::LatLng>> holeVerts_;
  std::vector<::GeoLoop> holes_;
  ::GeoPolygon polygon_{};
};

} // namespace h3core
