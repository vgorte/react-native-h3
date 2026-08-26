//
//  Units.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Units.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

// no out-param shape here on purpose: neither function has an error channel or a buffer, so a
// template would add indirection while removing no hazard. The leading `::` is still load-bearing.
double degsToRads(double degrees) {
  return ::degsToRads(degrees);
}

double radsToDegs(double radians) {
  return ::radsToDegs(radians);
}

} // namespace h3ops
