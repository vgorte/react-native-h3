//
//  Regions.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <vector>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"

/** Converts between cell sets and the shapes that cover them. */
namespace h3ops {

/**
 * Returns the outline of a set of cells, as GeoJSON-shaped polygons in degrees.
 *
 * Every cell must be valid, unique and of the same resolution; H3 rejects anything else, and its
 * wording is what surfaces.
 */
h3core::MultiPolygon cellsToMultiPolygon(const uint64_t* cells, int64_t count);

/**
 * Returns every cell whose centre falls inside a polygon.
 *
 * `rings` is GeoJSON-shaped and in degrees: the first ring is the outer boundary, any further rings
 * are holes, and each point is a `[latitude, longitude]` pair.
 */
h3core::CellBuffer polygonToCells(const std::vector<std::vector<std::vector<double>>>& rings, double res);

/**
 * Returns the cells covering a polygon under a containment mode: `0` centre, `1` fully contained,
 * `2` overlapping, `3` bounding box overlapping.
 *
 * Takes `rings` as `polygonToCells` does. This is an experimental H3 API and may change behaviour
 * in a minor version of the C library.
 */
h3core::CellBuffer polygonToCellsExperimental(const std::vector<std::vector<std::vector<double>>>& rings, double res,
                                              double flags);

} // namespace h3ops
