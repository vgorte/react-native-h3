//
//  Regions.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Regions.hpp"

#include "core/LinkedGeoPolygonReader.hpp"

namespace h3ops {

h3core::MultiPolygon cellsToMultiPolygon(const uint64_t* cells, int64_t count) {
  const h3core::LinkedGeoPolygonReader reader(cells, count);
  return reader.read();
}

} // namespace h3ops
