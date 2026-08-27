//
//  Inspection.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

#include <cstdint>
#include <string>
#include <vector>

/**
 * Reads what an index already carries: whether it is valid, what it is made of, and how it is
 * written down.
 *
 * The predicates and getters answer without an error channel, because for a question this cheap a
 * sentinel or a plausible number is more useful than a throw. Nothing here includes a Nitro header,
 * which is what lets the host tests drive the production code path rather than a copy of it.
 */
namespace h3ops {

/** Returns whether the index is a valid cell. */
bool isValidCell(uint64_t cell);

/** Returns whether the index is valid as anything: a cell, a directed edge or a vertex. */
bool isValidIndex(uint64_t index);

/** Returns whether the index is a valid directed edge. */
bool isValidDirectedEdge(uint64_t edge);

/** Returns whether the index is a valid vertex. */
bool isValidVertex(uint64_t vertex);

/** Returns whether the cell is one of the twelve pentagons at its resolution. */
bool isPentagon(uint64_t cell);

/** Returns whether the cell's resolution uses Class III orientation. */
bool isResClassIII(uint64_t cell);

/**
 * Returns the resolution of a cell, or `-1` for anything that is not a valid cell.
 *
 * The guard is `isValidCell` alone, which is what h3-js checks, so a valid directed edge and a
 * valid vertex answer `-1` as well.
 */
int getResolution(uint64_t index);

/**
 * Returns the base cell number, `0` to `121`. Works on directed edges too, answering the origin's
 * base cell.
 */
int getBaseCellNumber(uint64_t cell);

/** Returns the indexing digit at `digit`, which is 1-indexed and must be `1` to `15`. */
int getIndexDigit(uint64_t cell, double digit);

/**
 * Builds a cell from a base cell number and its child digits.
 *
 * Argument order follows h3-js, not C's `(res, baseCellNumber, digits)`. `digits` must hold exactly
 * `res` values, each `0` to `6`.
 */
uint64_t constructCell(double baseCellNumber, const std::vector<double>& digits, double res);

/** Returns the canonical lowercase hexadecimal form of an index. */
std::string cellToString(uint64_t cell);

/** Parses a hexadecimal index. Does not check that the result is a valid cell. */
uint64_t cellFromString(const std::string& text);

} // namespace h3ops
