//
//  Traversal.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <vector>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"

/**
 * Walks the grid around a cell and maps a neighbourhood onto local IJ coordinates.
 *
 * Every cell argument is checked here, because the H3 functions below read a malformed index as a
 * resolution 0 cell and answer with the cells that follow from it. Nothing here includes a Nitro
 * header, which is what lets the host tests drive the production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns every cell within grid distance `k` of the origin, including the origin. */
h3core::CellBuffer gridDisk(uint64_t origin, double k);

/** Returns the hollow ring of cells at exactly grid distance `k`. Safe near pentagons. */
h3core::CellBuffer gridRing(uint64_t origin, double k);

/** Returns the ring as `gridRing` does, but fails rather than working around a pentagon. */
h3core::CellBuffer gridRingUnsafe(uint64_t origin, double k);

/** Returns the disk split into `k + 1` rings by grid distance. Ring 0 holds only the origin. */
std::vector<h3core::CellBuffer> gridDiskDistances(uint64_t origin, double k);

/** Returns the cells along a line between two cells, inclusive of both ends. */
h3core::CellBuffer gridPathCells(uint64_t start, uint64_t end);

/** Returns the grid distance between two cells of the same resolution. */
int64_t gridDistance(uint64_t origin, uint64_t destination);

/** Returns local IJ coordinates of a cell relative to an origin. Not stable across H3 versions. */
h3core::IJ cellToLocalIj(uint64_t origin, uint64_t cell);

/** Returns the cell at local IJ coordinates relative to an origin. */
uint64_t localIjToCell(uint64_t origin, double i, double j);

} // namespace h3ops
