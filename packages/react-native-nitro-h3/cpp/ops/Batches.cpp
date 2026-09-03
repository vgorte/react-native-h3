//
//  Batches.cpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 30.08.26.
//

#include "ops/Batches.hpp"

#include <limits>
#include <stdexcept>
#include <string>

#include "core/Geometry.hpp"
#include "core/H3ErrorMapping.hpp"
#include "ops/Indexing.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

static_assert(MAX_CELL_BNDRY_VERTS == 10, "H3 changed its maximum boundary vertex count; the documented stride of 20 "
                                          "and the JSDoc range of 5 to 10 both need revisiting");
static_assert(kBoundaryStride == static_cast<size_t>(MAX_CELL_BNDRY_VERTS) * 2,
              "kBoundaryStride must stay two doubles per boundary vertex");

namespace {

/** Reruns a per-element failure with the element's index prefixed, keeping the code suffix last. */
[[noreturn]] void rethrowWithIndex(const char* name, int64_t index, const std::runtime_error& error) {
  throw std::runtime_error(std::string(name) + "[" + std::to_string(index) + "]: " + error.what());
}

} // namespace

h3core::CellBuffer latLngsToCells(const double* coords, int64_t doubleCount, double res) {
  if (doubleCount % 2 != 0) {
    h3core::throwInvalidArgument("A coordinate set must hold an even number of doubles");
  }
  const int64_t pairCount = doubleCount / 2;
  h3core::CellBuffer buffer = h3shapes::allocateFor([&] { return pairCount; });
  for (int64_t i = 0; i < pairCount; i++) {
    try {
      buffer.data()[i] = latLngToCell(coords[2 * i], coords[2 * i + 1], res);
    } catch (const std::runtime_error& error) {
      rethrowWithIndex("coords", i, error);
    }
  }
  // exact by construction: one cell per pair, so no `H3_NULL` scan
  buffer.setCount(pairCount);
  return buffer;
}

std::vector<double> cellsToLatLngs(const uint64_t* cells, int64_t count) {
  // the output is doubles, so the ceiling is met by the check alone; the unit is cells, not doubles
  h3shapes::requireWithinCellLimit(count);
  std::vector<double> centres;
  centres.reserve(static_cast<size_t>(count) * 2);
  for (int64_t i = 0; i < count; i++) {
    try {
      const h3core::Point centre = cellToLatLng(cells[i]);
      centres.push_back(centre.lat);
      centres.push_back(centre.lng);
    } catch (const std::runtime_error& error) {
      rethrowWithIndex("cells", i, error);
    }
  }
  return centres;
}

BoundaryBuffers cellsToBoundaries(const uint64_t* cells, int64_t count) {
  // the output is doubles and counts, so the ceiling is met by the check alone; the unit is cells
  h3shapes::requireWithinCellLimit(count);
  BoundaryBuffers buffers;
  // every slot starts as padding, so only the counted ones need writing
  buffers.vertices.assign(static_cast<size_t>(count) * kBoundaryStride, std::numeric_limits<double>::quiet_NaN());
  buffers.vertexCounts.assign(static_cast<size_t>(count), 0);
  for (int64_t i = 0; i < count; i++) {
    try {
      internal::requireValidCell(cells[i]);
      // a stack `::CellBoundary` rather than the scalar path's `Ring`, so no cell allocates
      const ::CellBoundary boundary = h3shapes::callWithOutParam<::CellBoundary>(::cellToBoundary, cells[i]);
      const size_t base = static_cast<size_t>(i) * kBoundaryStride;
      for (int v = 0; v < boundary.numVerts; v++) {
        const size_t slot = base + static_cast<size_t>(2 * v);
        buffers.vertices[slot] = ::radsToDegs(boundary.verts[v].lat);
        buffers.vertices[slot + 1] = ::radsToDegs(boundary.verts[v].lng);
      }
      buffers.vertexCounts[static_cast<size_t>(i)] = static_cast<uint8_t>(boundary.numVerts);
    } catch (const std::runtime_error& error) {
      rethrowWithIndex("cells", i, error);
    }
  }
  return buffers;
}

} // namespace h3ops
