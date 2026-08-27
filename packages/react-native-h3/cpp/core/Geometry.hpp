//
//  Geometry.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <vector>

namespace h3core {

// describes the geometry the public API exposes, in degrees, for the Nitro-free core.
//
// these stay separate types from H3's own `::LatLng` and `::CoordIJ`, which carry radians, so
// that a unit mix-up is a compile error rather than an answer wrong by a factor of 57.

/** Holds a latitude and a longitude in degrees. */
struct Point {
  double lat;
  double lng;
};

/** Represents a closed ring of points, whose first point is not repeated at the end. */
using Ring = std::vector<Point>;

/** Represents a polygon: the outer ring first, then any holes. */
using Polygon = std::vector<Ring>;

/** Represents a set of polygons. */
using MultiPolygon = std::vector<Polygon>;

/** Holds local IJ hexagon coordinates, whose axes are spaced 120 degrees apart. */
struct IJ {
  int i;
  int j;
};

} // namespace h3core
