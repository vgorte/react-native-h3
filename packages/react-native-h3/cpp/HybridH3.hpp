//
//  HybridH3.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include "HybridH3Spec.hpp"

namespace margelo::nitro::h3 {

/**
 * Implements the `H3` HybridObject by validating arguments, calling the vendored C and
 * converting the result. All memory discipline lives in `cpp/core`, which knows nothing
 * about Nitro.
 */
class HybridH3 final : public HybridH3Spec {
public:
  HybridH3() : HybridObject(TAG) {}

  // Indexing
  uint64_t latLngToCell(double lat, double lng, double res) override;
  LatLng cellToLatLng(uint64_t cell) override;
  std::vector<LatLng> cellToBoundary(uint64_t cell) override;

  // Traversal
  std::shared_ptr<ArrayBuffer> gridDisk(uint64_t origin, double k) override;

  // Regions
  std::vector<std::vector<std::vector<LatLng>>> cellsToMultiPolygon(const std::shared_ptr<ArrayBuffer>& cells) override;
};

} // namespace margelo::nitro::h3
