//
//  EdgesOpsTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>

#include "ops/Edges.hpp"
#include "ops/Vertexes.hpp"

namespace {

// San Francisco at resolution 9, from h3-js: `"89283082803ffff"`
constexpr uint64_t kSanFrancisco = 0x89283082803ffffULL;
// h3-js `gridDisk("89283082803ffff", 1)` contains `"8928308281bffff"`, one step from the centre
constexpr uint64_t kNeighbor = 0x8928308281bffffULL;
// three steps away, so h3-js `areNeighborCells` with `kSanFrancisco` is `false`
constexpr uint64_t kFarCell = 0x892830828d7ffffULL;
// h3-js `cellsToDirectedEdge("89283082803ffff", "8928308281bffff")` is `"169283082803ffff"`
constexpr uint64_t kEdge = 0x169283082803ffffULL;
// a resolution 1 pentagon; h3-js `isPentagon("81083ffffffffff")` is `true`
constexpr uint64_t kPentagonRes1 = 0x81083ffffffffffULL;

// cell mode at resolution 9 over base cell `127`, of which only `0` to `121` exist; h3-js
// `isValidCell` is `false` and every cell-taking operation here still answers it.
constexpr uint64_t kInvalidCell = 0x89fe3082803ffffULL;
// `0x82080ffffffffff` is a resolution 2 cell on a pentagon's deleted `k` subsequence, so h3-js
// `isValidCell` is `false`; these are that cell read as a directed edge and as a vertex.
constexpr uint64_t kInvalidEdge = 0x122080ffffffffffULL;
constexpr uint64_t kInvalidVertex = 0x202080ffffffffffULL;

// asserts H3's wording rather than any error, because an unguarded operation either answers a
// plausible number or fails with a different code, and both would satisfy a bare `EXPECT_THROW`.
template <typename Call> void expectMessage(const char* label, const char* message, Call&& call) {
  SCOPED_TRACE(label);
  try {
    call();
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), message);
  }
}

template <typename Call> void expectInvalidCell(const char* label, Call&& call) {
  expectMessage(label, "Cell argument was not valid", call);
}

template <typename Call> void expectInvalidDirectedEdge(const char* label, Call&& call) {
  expectMessage(label, "Directed edge argument was not valid", call);
}

TEST(EdgesOps, BuildsAndReadsADirectedEdge) {
  EXPECT_TRUE(h3ops::areNeighborCells(kSanFrancisco, kNeighbor));
  EXPECT_EQ(h3ops::cellsToDirectedEdge(kSanFrancisco, kNeighbor), kEdge);
  EXPECT_EQ(h3ops::getDirectedEdgeOrigin(kEdge), kSanFrancisco);
  EXPECT_EQ(h3ops::getDirectedEdgeDestination(kEdge), kNeighbor);
}

TEST(EdgesOps, ReversesADirectedEdge) {
  // h3-js `reverseDirectedEdge("169283082803ffff")` is `"11928308281bffff"`
  const uint64_t reversed = h3ops::reverseDirectedEdge(kEdge);
  EXPECT_EQ(reversed, 0x11928308281bffffULL);
  EXPECT_EQ(h3ops::getDirectedEdgeOrigin(reversed), kNeighbor);
  EXPECT_EQ(h3ops::getDirectedEdgeDestination(reversed), kSanFrancisco);
}

TEST(EdgesOps, RejectsCellsThatAreNotNeighbors) {
  EXPECT_FALSE(h3ops::areNeighborCells(kSanFrancisco, kFarCell));
  expectMessage("cellsToDirectedEdge", "Cell arguments were not neighbors",
                [] { h3ops::cellsToDirectedEdge(kSanFrancisco, kFarCell); });
}

TEST(EdgesOps, DirectedEdgeToCellsAlwaysReturnsExactlyTwo) {
  const h3core::CellBuffer cells = h3ops::directedEdgeToCells(kEdge);
  ASSERT_EQ(cells.capacity(), 2);
  ASSERT_EQ(cells.count(), 2);
  EXPECT_EQ(cells.data()[0], kSanFrancisco);
  EXPECT_EQ(cells.data()[1], kNeighbor);
}

TEST(EdgesOps, OriginToDirectedEdgesGivesSixForAHexagonAndFiveForAPentagon) {
  // h3-js `originToDirectedEdges(sf)` has six entries, the last being `"169283082803ffff"`
  const h3core::CellBuffer hexEdges = h3ops::originToDirectedEdges(kSanFrancisco);
  EXPECT_EQ(hexEdges.capacity(), 6);
  EXPECT_EQ(hexEdges.count(), 6);
  EXPECT_EQ(hexEdges.data()[0], 0x119283082803ffffULL);
  EXPECT_EQ(hexEdges.data()[5], kEdge);

  // a pentagon leaves `H3_NULL` in slot `0` (`directedEdge.c:243`), which compaction removes
  const h3core::CellBuffer pentEdges = h3ops::originToDirectedEdges(kPentagonRes1);
  EXPECT_EQ(pentEdges.capacity(), 6);
  EXPECT_EQ(pentEdges.count(), 5);
  EXPECT_EQ(pentEdges.data()[0], 0x121083ffffffffffULL);
}

TEST(EdgesOps, DirectedEdgeToBoundaryIsTwoPointsInDegrees) {
  // h3-js `directedEdgeToBoundary("169283082803ffff")`. An edge crossing an icosahedron face can
  // return three points instead.
  const h3core::Ring boundary = h3ops::directedEdgeToBoundary(kEdge);
  ASSERT_EQ(boundary.size(), 2u);
  EXPECT_NEAR(boundary[0].lat, 37.7720104773324, 1e-11);
  EXPECT_NEAR(boundary[0].lng, -122.41701147197293, 1e-11);
  EXPECT_NEAR(boundary[1].lat, 37.77369317299806, 1e-11);
  EXPECT_NEAR(boundary[1].lng, -122.4159401398489, 1e-11);
}

TEST(EdgesOps, EdgeLengthSplitsByUnit) {
  // h3-js `edgeLength("169283082803ffff", unit)`. The tolerances are three parts in `1e12` rather
  // than a few `ulp`, because h3-js runs the same haversine (`latLng.c:171`) through emscripten's
  // `sin`, `cos` and `atan2`; over an edge this short its `A` term differs enough to move the
  // twelfth significant digit. Feeding h3-js's own boundary coordinates into this platform's libm
  // reproduces the values below exactly, so the vertexes agree and only the transcendentals differ.
  EXPECT_NEAR(h3ops::edgeLengthKm(kEdge), 0.20946576896709992, 1e-11);
  EXPECT_NEAR(h3ops::edgeLengthM(kEdge), 209.46576896709993, 1e-8);
  EXPECT_NEAR(h3ops::edgeLengthRads(kEdge), 0.000032877967803028334, 1e-15);

  // the unit split itself is exact, so it is pinned exactly (`latLng.c:308`, `latLng.c:321`)
  EXPECT_DOUBLE_EQ(h3ops::edgeLengthM(kEdge), h3ops::edgeLengthKm(kEdge) * 1000.0);
}

TEST(EdgesOps, EdgeFunctionsRejectACell) {
  expectInvalidDirectedEdge("edgeLengthKm", [] { h3ops::edgeLengthKm(kSanFrancisco); });
  expectInvalidDirectedEdge("getDirectedEdgeOrigin", [] { h3ops::getDirectedEdgeOrigin(kSanFrancisco); });
}

TEST(EdgesOps, RejectsAnInvalidDirectedEdge) {
  expectInvalidDirectedEdge("getDirectedEdgeOrigin", [] { h3ops::getDirectedEdgeOrigin(kInvalidEdge); });
  expectInvalidDirectedEdge("getDirectedEdgeDestination", [] { h3ops::getDirectedEdgeDestination(kInvalidEdge); });
  expectInvalidDirectedEdge("reverseDirectedEdge", [] { h3ops::reverseDirectedEdge(kInvalidEdge); });
  expectInvalidDirectedEdge("directedEdgeToCells", [] { h3ops::directedEdgeToCells(kInvalidEdge); });
  expectInvalidDirectedEdge("directedEdgeToBoundary", [] { h3ops::directedEdgeToBoundary(kInvalidEdge); });
  expectInvalidDirectedEdge("edgeLengthKm", [] { h3ops::edgeLengthKm(kInvalidEdge); });
  expectInvalidDirectedEdge("edgeLengthM", [] { h3ops::edgeLengthM(kInvalidEdge); });
  expectInvalidDirectedEdge("edgeLengthRads", [] { h3ops::edgeLengthRads(kInvalidEdge); });
}

TEST(EdgesOps, RejectsAnInvalidCell) {
  expectInvalidCell("areNeighborCells origin", [] { h3ops::areNeighborCells(kInvalidCell, kSanFrancisco); });
  expectInvalidCell("areNeighborCells destination", [] { h3ops::areNeighborCells(kSanFrancisco, kInvalidCell); });
  expectInvalidCell("cellsToDirectedEdge origin", [] { h3ops::cellsToDirectedEdge(kInvalidCell, kSanFrancisco); });
  expectInvalidCell("cellsToDirectedEdge destination", [] { h3ops::cellsToDirectedEdge(kSanFrancisco, kInvalidCell); });
  expectInvalidCell("originToDirectedEdges", [] { h3ops::originToDirectedEdges(kInvalidCell); });
}

TEST(VertexesOps, ReadsASingleVertex) {
  // h3-js `cellToVertex("89283082803ffff", 0)` is `"209283082803ffff"`
  EXPECT_EQ(h3ops::cellToVertex(kSanFrancisco, 0), 0x209283082803ffffULL);
}

TEST(VertexesOps, NarrowsTheVertexNumberAndLeavesItsRangeToH3) {
  // `cellToVertex` answers `E_DOMAIN` outside `0` to five (`vertex.c:217`), so the narrowing here
  // imposes no domain of its own.
  expectMessage("six", "Argument was outside of acceptable range", [] { h3ops::cellToVertex(kSanFrancisco, 6); });
  expectMessage("minus one", "Argument was outside of acceptable range",
                [] { h3ops::cellToVertex(kSanFrancisco, -1); });
  // a pentagon has five vertexes, so five is out of range there but not on a hexagon
  expectMessage("five on a pentagon", "Argument was outside of acceptable range",
                [] { h3ops::cellToVertex(kPentagonRes1, 5); });
  EXPECT_NO_THROW(h3ops::cellToVertex(kSanFrancisco, 5));
  // the one condition H3 never sees, because the narrowing runs first
  expectMessage("fractional", "Vertex number must be an integer", [] { h3ops::cellToVertex(kSanFrancisco, 0.5); });
}

TEST(VertexesOps, CellToVertexesGivesSixForAHexagonAndFiveForAPentagon) {
  const h3core::CellBuffer hexVertexes = h3ops::cellToVertexes(kSanFrancisco);
  EXPECT_EQ(hexVertexes.capacity(), 6);
  EXPECT_EQ(hexVertexes.count(), 6);
  EXPECT_EQ(hexVertexes.data()[0], 0x209283082803ffffULL);

  // a pentagon leaves `H3_NULL` in slot `5` (`vertex.c:306`), which compaction removes
  const h3core::CellBuffer pentVertexes = h3ops::cellToVertexes(kPentagonRes1);
  EXPECT_EQ(pentVertexes.capacity(), 6);
  EXPECT_EQ(pentVertexes.count(), 5);
  EXPECT_EQ(pentVertexes.data()[0], 0x201083ffffffffffULL);
}

TEST(VertexesOps, ReadsAVertexAsDegrees) {
  // h3-js `vertexToLatLng("209283082803ffff")` is `[37.7720104773324, -122.41701147197293]`
  const h3core::Point point = h3ops::vertexToLatLng(0x209283082803ffffULL);
  EXPECT_NEAR(point.lat, 37.7720104773324, 1e-11);
  EXPECT_NEAR(point.lng, -122.41701147197293, 1e-11);
}

TEST(VertexesOps, RejectsAnInvalidCellOrVertex) {
  expectInvalidCell("cellToVertex", [] { h3ops::cellToVertex(kInvalidCell, 0); });
  expectInvalidCell("cellToVertexes", [] { h3ops::cellToVertexes(kInvalidCell); });
  expectMessage("vertexToLatLng", "Vertex argument was not valid", [] { h3ops::vertexToLatLng(kInvalidVertex); });
  // a cell read as a vertex otherwise measures as a coordinate, because `vertexToLatLng` only
  // clears the mode bits it is handed (`vertex.c:326`)
  expectMessage("vertexToLatLng on a cell", "Vertex argument was not valid",
                [] { h3ops::vertexToLatLng(kSanFrancisco); });
}

} // namespace
