//
//  Batches.hpp
//  react-native-nitro-h3
//
//  Created by Viktor Gorte on 30.08.26.
//

#pragma once

#include <cstdint>
#include <vector>

#include "core/CellBuffer.hpp"

/**
 * Runs a scalar operation over a whole typed array in one native call, so a large set pays the
 * bridge crossing once. Additive surface beyond h3-js; the loop, the failing element's index and
 * the even-count rule live here so the host tests and the parity probe reach them.
 */
namespace h3ops {

/**
 * Returns one cell per interleaved `[lat, lng]` pair, all at `res`. The first failing pair aborts
 * the batch with its index prefixed to the message, and an odd `doubleCount` is rejected before
 * any pair is read. The cell ceiling counts the pairs.
 */
h3core::CellBuffer latLngsToCells(const double* coords, int64_t doubleCount, double res);

/**
 * Returns the centres of the given cells as interleaved `[lat, lng]` degrees, two doubles per
 * cell. The first invalid cell aborts the batch with its index prefixed to the message. The cell
 * ceiling counts the input cells.
 */
std::vector<double> cellsToLatLngs(const uint64_t* cells, int64_t count);

} // namespace h3ops
