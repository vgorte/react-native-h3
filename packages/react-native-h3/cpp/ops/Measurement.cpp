//
//  Measurement.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Measurement.hpp"

#include "ops/Internal.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

namespace {

// H3 takes radians; every public coordinate in this package is degrees.
::LatLng toRadians(double lat, double lng) {
  ::LatLng point{};
  point.lat = ::degsToRads(lat);
  point.lng = ::degsToRads(lng);
  return point;
}

} // namespace

double cellAreaKm2(uint64_t cell) {
  // all three areas run through `cellAreaRads2`, where H3 checks only the base cell range
  // (`_h3ToFaceIjk`, `h3Index.c:1120`); invalid digits are absorbed silently and measured as a
  // real cell at the index's own resolution, so the guard has to reject them first
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<double>(::cellAreaKm2, cell);
}

double cellAreaM2(uint64_t cell) {
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<double>(::cellAreaM2, cell);
}

double cellAreaRads2(uint64_t cell) {
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<double>(::cellAreaRads2, cell);
}

// no out-param shape below: these cannot fail (`latLng.c:171`) and answer `NaN` for `NaN`
double greatCircleDistanceKm(double lat1, double lng1, double lat2, double lng2) {
  const ::LatLng a = toRadians(lat1, lng1);
  const ::LatLng b = toRadians(lat2, lng2);
  return ::greatCircleDistanceKm(&a, &b);
}

double greatCircleDistanceM(double lat1, double lng1, double lat2, double lng2) {
  const ::LatLng a = toRadians(lat1, lng1);
  const ::LatLng b = toRadians(lat2, lng2);
  return ::greatCircleDistanceM(&a, &b);
}

double greatCircleDistanceRads(double lat1, double lng1, double lat2, double lng2) {
  const ::LatLng a = toRadians(lat1, lng1);
  const ::LatLng b = toRadians(lat2, lng2);
  return ::greatCircleDistanceRads(&a, &b);
}

} // namespace h3ops
