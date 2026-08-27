//
//  Misc.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <vector>

#include "core/CellBuffer.hpp"

/**
 * Answers what a resolution is like on average, and enumerates the sets H3 fixes in advance.
 *
 * The averages are table lookups in H3 (`latLng.c:212`), and the listings take their size from
 * `res0CellCount` and `pentagonCount`, the two size sources in H3 that cannot fail. Nothing here
 * includes a Nitro header, which is what lets the host tests drive the production code path rather
 * than a copy of it.
 */
namespace h3ops {

/** Returns the average area of a cell at a resolution, in square kilometres. */
double getHexagonAreaAvgKm2(double res);

/** Returns the average area of a cell at a resolution, in square metres. */
double getHexagonAreaAvgM2(double res);

/** Returns the average edge length of a cell at a resolution, in kilometres. */
double getHexagonEdgeLengthAvgKm(double res);

/** Returns the average edge length of a cell at a resolution, in metres. */
double getHexagonEdgeLengthAvgM(double res);

/**
 * Returns the number of cells at a resolution.
 *
 * The largest value is `getNumCells(15)` = `569707381193162`, which a JavaScript number represents
 * exactly, so the public type is `number` rather than `bigint`.
 */
int64_t getNumCells(double res);

/** Returns all `122` resolution `0` cells, the roots of the H3 hierarchy. */
h3core::CellBuffer getRes0Cells();

/** Returns the twelve pentagons at a resolution. */
h3core::CellBuffer getPentagons(double res);

/**
 * Returns the icosahedron faces a cell intersects, as numbers from `0` to `19`.
 *
 * One or two for a hexagon, five for a pentagon. H3's `-1` padding is dropped, so every entry is a
 * real face.
 */
std::vector<int> getIcosahedronFaces(uint64_t cell);

} // namespace h3ops
