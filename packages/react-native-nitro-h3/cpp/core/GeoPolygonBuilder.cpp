//
//  GeoPolygonBuilder.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "core/GeoPolygonBuilder.hpp"

#include <cmath>
#include <cstddef>

#include "core/H3ErrorMapping.hpp"

namespace h3core {

namespace {

// rejects only what H3 cannot express; H3 normalises a coordinate outside the globe and answers
std::vector<::LatLng> toRadians(const std::vector<std::vector<double>>& ring) {
  std::vector<::LatLng> verts;
  verts.reserve(ring.size());
  for (const std::vector<double>& point : ring) {
    if (point.size() != 2) {
      throwInvalidArgument("Each polygon point must be a [latitude, longitude] pair");
    }
    const double lat = point[0];
    const double lng = point[1];
    if (!std::isfinite(lat) || !std::isfinite(lng)) {
      // H3 answers `E_FAILED` for one of these and a nonsense cell for the other.
      throwInvalidArgument("Polygon coordinates must be finite numbers");
    }
    ::LatLng vertex{};
    vertex.lat = ::degsToRads(lat);
    vertex.lng = ::degsToRads(lng);
    verts.push_back(vertex);
  }
  return verts;
}

} // namespace

GeoPolygonBuilder::GeoPolygonBuilder(const std::vector<std::vector<std::vector<double>>>& rings) {
  // every vector is filled before any pointer into it is taken; a reallocation afterwards would
  // leave the `::GeoPolygon` pointing at freed memory, and nothing would report it.
  if (!rings.empty()) {
    outerVerts_ = toRadians(rings[0]);
    holeVerts_.reserve(rings.size() - 1);
    for (std::size_t i = 1; i < rings.size(); i++) {
      holeVerts_.push_back(toRadians(rings[i]));
    }
  }

  holes_.reserve(holeVerts_.size());
  for (std::vector<::LatLng>& hole : holeVerts_) {
    ::GeoLoop loop{};
    loop.numVerts = static_cast<int>(hole.size());
    loop.verts = hole.data();
    holes_.push_back(loop);
  }

  polygon_.geoloop.numVerts = static_cast<int>(outerVerts_.size());
  polygon_.geoloop.verts = outerVerts_.data();
  polygon_.numHoles = static_cast<int>(holes_.size());
  polygon_.holes = holes_.data();
}

} // namespace h3core
