//
//  Hierarchy.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include "ops/Hierarchy.hpp"

#include "core/Validation.hpp"
#include "ops/Internal.hpp"
#include "shapes/CellSetCall.hpp"
#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace h3ops {

namespace {

void requireValidCells(const uint64_t* cells, int64_t count) {
  for (int64_t i = 0; i < count; i++) {
    // H3 skips an `H3_NULL` member rather than rejecting it (`h3Index.c:594`, `h3Index.c:812`)
    if (cells[i] != H3_NULL) {
      internal::requireValidCell(cells[i]);
    }
  }
}

} // namespace

uint64_t cellToParent(uint64_t cell, double res) {
  // `cellToParent` compares resolutions and masks digits (`h3Index.c:416`), never validating
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<uint64_t>(::cellToParent, cell, h3core::toResolution(res));
}

uint64_t cellToCenterChild(uint64_t cell, double res) {
  // `_hasChildAtRes` is the only check `cellToCenterChild` runs (`h3Index.c:536`)
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<uint64_t>(::cellToCenterChild, cell, h3core::toResolution(res));
}

int64_t cellToChildrenSize(uint64_t cell, double res) {
  // the count is a formula over the two resolutions (`h3Index.c:460`), not a check
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<int64_t>(::cellToChildrenSize, cell, h3core::toResolution(res));
}

int64_t cellToChildPos(uint64_t cell, double parentRes) {
  // `cellToChildPos` rejects only an `INVALID_DIGIT` below `parentRes` (`h3Index.c:1384`)
  internal::requireValidCell(cell);
  return h3shapes::callWithOutParam<int64_t>(::cellToChildPos, cell, h3core::toResolution(parentRes));
}

uint64_t childPosToCell(double childPos, uint64_t parent, double childRes) {
  // `childPosToCell` reads the parent's resolution and nothing else of it (`h3Index.c:1464`)
  internal::requireValidCell(parent);
  // the position is the only H3 argument that is an `int64_t` rather than an index, and
  // `validateChildPos` owns its domain (`h3Index.c:1371`), so this narrows and nothing more.
  const int64_t position = h3core::toInt64(childPos, "Child position must be an integer");
  // hoisted because the evaluation order of two arguments to one call is unspecified
  const int resolution = h3core::toResolution(childRes);
  return h3shapes::callWithOutParam<uint64_t>(::childPosToCell, position, parent, resolution);
}

h3core::CellBuffer cellToChildren(uint64_t cell, double res) {
  // neither `cellToChildren` (`h3Index.c:499`) nor the size query below checks anything
  internal::requireValidCell(cell);
  const int resolution = h3core::toResolution(res);
  // `cellToChildrenSize` is documented as exact, so an `H3_NULL` appearing here would be a genuine
  // upstream change, and losing it to a compaction pass would silently shorten a result callers may
  // index by child position.
  return h3shapes::fillExactCells(
      [&] { return h3shapes::callWithOutParam<int64_t>(::cellToChildrenSize, cell, resolution); },
      [&](uint64_t* out) { return ::cellToChildren(cell, resolution, out); });
}

h3core::CellBuffer compactCells(const uint64_t* cells, int64_t count) {
  // `compactCells` rejects a member only for set reserved bits (`h3Index.c:599`), and passes
  // through whatever it cannot parent
  requireValidCells(cells, count);
  // the one function with no size function anywhere: the header says `numHexes` "is the size of the
  // input and output arrays", and the `H3_NULL`-padded output makes this the compacting path.
  return h3shapes::fillCompactedCells([&] { return count; },
                                      [&](uint64_t* out) { return ::compactCells(cells, out, count); });
}

h3core::CellBuffer uncompactCells(const uint64_t* cells, int64_t count, double res) {
  // `uncompactCellsSize` reads each member's resolution and nothing else (`h3Index.c:807`)
  requireValidCells(cells, count);
  const int resolution = h3core::toResolution(res);
  // both callers of `_hasChildAtRes` answer `E_RES_MISMATCH` for a resolution above 15
  // (`h3Index.c:786`, `h3Index.c:819`), and an empty set reaches neither.
  internal::requireResolution(resolution);
  // `uncompactCellsSize` is exact (`h3Index.c:807`), and `uncompactCells` answers `E_MEMORY_BOUNDS`
  // if the buffer is short of it anyway.
  int64_t size = 0;
  return h3shapes::fillExactCells(
      [&] {
        size = h3shapes::callWithOutParam<int64_t>(::uncompactCellsSize, cells, count, resolution);
        return size;
      },
      // five arguments carrying two lengths: `count` and `size`
      [&](uint64_t* out) { return ::uncompactCells(cells, count, out, size, resolution); });
}

} // namespace h3ops
