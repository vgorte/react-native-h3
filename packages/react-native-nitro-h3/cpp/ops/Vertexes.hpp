//
//  Vertexes.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"

/**
 * Names the topological vertexes of a cell and places them on the globe.
 *
 * Every cell and every vertex argument is checked here, because `vertex.c` reads an index's mode
 * bits and its base cell and no more. Nothing here includes a Nitro header, which is what lets the
 * host tests drive the production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns one vertex of a cell. Numbers run `0` to `5` counter-clockwise, `0` to `4` on a pentagon. */
uint64_t cellToVertex(uint64_t cell, double vertexNum);

/** Returns every vertex of a cell: six, or five for a pentagon. */
h3core::CellBuffer cellToVertexes(uint64_t cell);

/** Returns the coordinate of a vertex, in degrees. */
h3core::Point vertexToLatLng(uint64_t vertex);

} // namespace h3ops
