//
//  Misc.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Misc.hpp"

#include "core/Validation.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

// each of these rejects a resolution outside `0` to `15` with `E_RES_DOMAIN` (`latLng.c:220`), so
// only the narrowing happens here.
double getHexagonAreaAvgKm2(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonAreaAvgKm2, h3core::toResolution(res));
}

double getHexagonAreaAvgM2(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonAreaAvgM2, h3core::toResolution(res));
}

double getHexagonEdgeLengthAvgKm(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonEdgeLengthAvgKm, h3core::toResolution(res));
}

double getHexagonEdgeLengthAvgM(double res) {
  return h3shapes::callWithOutParam<double>(::getHexagonEdgeLengthAvgM, h3core::toResolution(res));
}

int64_t getNumCells(double res) {
  return h3shapes::callWithOutParam<int64_t>(::getNumCells, h3core::toResolution(res));
}

} // namespace h3ops
