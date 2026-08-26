//
//  Indexing.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/Geometry.hpp"

namespace h3ops {

/**
 * Turns a coordinate into a cell, and a cell back into geometry, in degrees.
 *
 * Each function takes the values a JavaScript caller supplies and narrows them before touching H3,
 * so `HybridH3` stays a pure type adapter. Nothing here includes a Nitro header, which is what lets
 * the host tests drive the production code path rather than a copy of it.
 */

/** Returns the cell containing a coordinate. `lat` and `lng` are degrees, `res` is `0` to `15`. */
uint64_t latLngToCell(double lat, double lng, double res);

/** Returns the centre of a cell, in degrees. */
h3core::Point cellToLatLng(uint64_t cell);

/**
 * Returns the boundary of a cell in degrees, counter-clockwise. Six points for a hexagon, up to ten
 * for a pentagon or a cell that crosses an icosahedron edge.
 */
h3core::Ring cellToBoundary(uint64_t cell);

} // namespace h3ops
