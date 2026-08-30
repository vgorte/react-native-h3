//
//  LinkedGeoPolygonReader.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/LinkedGeoPolygonReader.hpp"

#include <climits>
#include <utility>

#include "core/H3ErrorMapping.hpp"

namespace h3core {

LinkedGeoPolygonReader::LinkedGeoPolygonReader(const uint64_t* cells, int64_t count) {
  if (count < 0) {
    throwInvalidArgument("A cell set must not have a negative length");
  }
  if (count > INT_MAX) {
    // `cellsToLinkedMultiPolygon` declares `const int numHexes`, which truncates silently
    throwInvalidArgument("A cell set for cellsToMultiPolygon must hold fewer than 2147483648 cells");
  }
  if (count == 0) {
    // an empty set has no graph, and H3 need never see a null pointer
    return;
  }

  // anything H3 leaves linked when it fails still has to be released
  linked_ = true;
  const H3Error error = ::cellsToLinkedMultiPolygon(cells, static_cast<int>(count), &root_);
  if (error != E_SUCCESS) {
    // a throwing constructor does not run its own destructor, and this call is idempotent
    // (`linkedGeo.c:126`) whether or not upstream released already
    ::destroyLinkedMultiPolygon(&root_);
    linked_ = false;
    throwOnError(static_cast<uint32_t>(error));
  }
}

LinkedGeoPolygonReader::~LinkedGeoPolygonReader() {
  if (linked_) {
    ::destroyLinkedMultiPolygon(&root_);
    linked_ = false;
  }
}

MultiPolygon LinkedGeoPolygonReader::read() const {
  MultiPolygon polygons;
  if (!linked_) {
    return polygons;
  }

  for (const ::LinkedGeoPolygon* polygon = &root_; polygon != nullptr; polygon = polygon->next) {
    Polygon loops;
    for (const ::LinkedGeoLoop* loop = polygon->first; loop != nullptr; loop = loop->next) {
      Ring ring;
      for (const ::LinkedLatLng* vertex = loop->first; vertex != nullptr; vertex = vertex->next) {
        // H3 stores radians; every public value in this package is degrees
        ring.push_back(Point{::radsToDegs(vertex->vertex.lat), ::radsToDegs(vertex->vertex.lng)});
      }
      loops.push_back(std::move(ring));
    }
    // a loopless polygon is kept rather than hidden, should H3 ever produce one
    polygons.push_back(std::move(loops));
  }
  return polygons;
}

} // namespace h3core
