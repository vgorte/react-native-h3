//
//  Measurement.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

/**
 * Measures the size of a cell and the distance between two coordinates.
 *
 * h3-js takes a unit string; here the unit is part of the function name, so nothing about it is
 * decided at run time. Nothing here includes a Nitro header, which is what lets the host tests drive
 * the production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns the exact area of a cell in square kilometres. */
double cellAreaKm2(uint64_t cell);

/** Returns the exact area of a cell in square metres. */
double cellAreaM2(uint64_t cell);

/** Returns the exact area of a cell in square radians. */
double cellAreaRads2(uint64_t cell);

/** Returns the great-circle distance between two coordinates in kilometres. Arguments in degrees. */
double greatCircleDistanceKm(double lat1, double lng1, double lat2, double lng2);

/** Returns the great-circle distance between two coordinates in metres. Arguments in degrees. */
double greatCircleDistanceM(double lat1, double lng1, double lat2, double lng2);

/** Returns the great-circle distance between two coordinates in radians. Arguments in degrees. */
double greatCircleDistanceRads(double lat1, double lng1, double lat2, double lng2);

} // namespace h3ops
