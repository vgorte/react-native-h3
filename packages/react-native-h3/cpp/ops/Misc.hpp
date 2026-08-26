//
//  Misc.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

/**
 * Answers what a resolution is like on average, without reference to any particular cell.
 *
 * Each value is a table lookup in H3 (`latLng.c:212`), so the only work left here is narrowing the
 * resolution. Nothing here includes a Nitro header, which is what lets the host tests drive the
 * production code path rather than a copy of it.
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

} // namespace h3ops
