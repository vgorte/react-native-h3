//
//  Regions.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/Geometry.hpp"

namespace h3ops {

/** Converts between cell sets and the shapes that cover them. */

/**
 * Returns the outline of a set of cells, as GeoJSON-shaped polygons in degrees.
 *
 * Every cell must be valid, unique and of the same resolution; H3 rejects anything else, and its
 * wording is what surfaces.
 */
h3core::MultiPolygon cellsToMultiPolygon(const uint64_t* cells, int64_t count);

} // namespace h3ops
