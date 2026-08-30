//
//  Edges.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"

/**
 * Builds directed edges between neighbouring cells and reads them back.
 *
 * Every cell and every edge argument is checked here, because the readers in `directedEdge.c` look
 * only at an index's mode bits and answer a malformed one with a plausible origin, boundary or
 * length. Nothing here includes a Nitro header, which is what lets the host tests drive the
 * production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns whether two cells of the same resolution share an edge. */
bool areNeighborCells(uint64_t origin, uint64_t destination);

/** Returns the directed edge running from one cell to a neighbouring one. */
uint64_t cellsToDirectedEdge(uint64_t origin, uint64_t destination);

/** Returns the cell a directed edge leaves. */
uint64_t getDirectedEdgeOrigin(uint64_t edge);

/** Returns the cell a directed edge enters. */
uint64_t getDirectedEdgeDestination(uint64_t edge);

/** Returns the edge running the other way between the same two cells. */
uint64_t reverseDirectedEdge(uint64_t edge);

/** Returns the origin and the destination of a directed edge, in that order and always both. */
h3core::CellBuffer directedEdgeToCells(uint64_t edge);

/** Returns every directed edge leaving a cell: six, or five for a pentagon. */
h3core::CellBuffer originToDirectedEdges(uint64_t origin);

/**
 * Returns the geometry of a directed edge in degrees.
 *
 * Two points for an ordinary edge, three where it crosses an icosahedron face and H3 inserts the
 * crossing point.
 */
h3core::Ring directedEdgeToBoundary(uint64_t edge);

/** Returns the exact length of a directed edge in kilometres. */
double edgeLengthKm(uint64_t edge);

/** Returns the exact length of a directed edge in metres. */
double edgeLengthM(uint64_t edge);

/** Returns the exact length of a directed edge in radians. */
double edgeLengthRads(uint64_t edge);

} // namespace h3ops
