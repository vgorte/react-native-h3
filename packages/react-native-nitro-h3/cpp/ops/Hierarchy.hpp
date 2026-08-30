//
//  Hierarchy.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>

#include "core/CellBuffer.hpp"

/**
 * Walks the cell tree between resolutions and compacts a cell set along it.
 *
 * Every cell argument is checked here, because the H3 functions below read a cell's resolution
 * digits without asking whether the index is one. Nothing here includes a Nitro header, which is
 * what lets the host tests drive the production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns the ancestor of a cell at a coarser resolution. */
uint64_t cellToParent(uint64_t cell, double res);

/** Returns the centre child of a cell at a finer resolution. */
uint64_t cellToCenterChild(uint64_t cell, double res);

/** Returns how many children a cell has at a finer resolution. Exact, not an upper bound. */
int64_t cellToChildrenSize(uint64_t cell, double res);

/** Returns the position of a cell within the ordered children of one of its ancestors. */
int64_t cellToChildPos(uint64_t cell, double parentRes);

/** Returns the child of `parent` at the given position and resolution. Inverts `cellToChildPos`. */
uint64_t childPosToCell(double childPos, uint64_t parent, double childRes);

/** Returns every child of a cell at a finer resolution, in order. */
h3core::CellBuffer cellToChildren(uint64_t cell, double res);

/**
 * Returns the smallest set of cells covering the same area, replacing every complete set of siblings
 * by its parent. The input must be free of duplicates and all at one resolution.
 */
h3core::CellBuffer compactCells(const uint64_t* cells, int64_t count);

/** Expands a compacted set so that every cell sits at the given resolution. */
h3core::CellBuffer uncompactCells(const uint64_t* cells, int64_t count, double res);

} // namespace h3ops
