//
//  Indexing.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Indexing.hpp"

#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

uint64_t latLngToCell(double lat, double lng, double res) {
  // `::LatLng` is H3's radians struct, never the generated Nitro struct of the same name
  ::LatLng coordinate{};
  coordinate.lat = ::degsToRads(lat);
  coordinate.lng = ::degsToRads(lng);
  // the leading `::` picks the C function; unqualified recurses into this operation
  return h3shapes::callWithOutParam<uint64_t>(::latLngToCell, &coordinate, h3core::toResolution(res));
}

h3core::Point cellToLatLng(uint64_t cell) {
  internal::requireValidCell(cell);
  const ::LatLng centre = h3shapes::callWithOutParam<::LatLng>(::cellToLatLng, cell);
  return h3core::Point{::radsToDegs(centre.lat), ::radsToDegs(centre.lng)};
}

h3core::Ring cellToBoundary(uint64_t cell) {
  internal::requireValidCell(cell);
  return internal::toRing(h3shapes::callWithOutParam<::CellBoundary>(::cellToBoundary, cell));
}

} // namespace h3ops
