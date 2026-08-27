//
//  GeoPolygonBuilderTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <limits>
#include <stdexcept>
#include <string>
#include <vector>

#include "core/GeoPolygonBuilder.hpp"
#include "ops/Regions.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

using Rings = std::vector<std::vector<std::vector<double>>>;

/** Returns a triangle over San Francisco, the same one h3-js's own test suite uses. */
Rings sanFranciscoTriangle() {
  return {{{37.813318999983238, -122.4089866999972145},
           {37.7198061999978478, -122.3544736999993603},
           {37.8151571999998453, -122.4798767000009008}}};
}

/** Returns a rectangle over San Francisco with a rectangular hole in the middle. */
Rings rectangleWithHole() {
  return {{{37.85, -122.50}, {37.85, -122.35}, {37.70, -122.35}, {37.70, -122.50}},
          {{37.80, -122.45}, {37.80, -122.40}, {37.75, -122.40}, {37.75, -122.45}}};
}

// asserts the wording rather than any error, because an unguarded argument either answers a
// plausible value or fails with a different code, and both would satisfy a bare `EXPECT_THROW`.
template <typename Call> void expectMessage(const char* label, const char* message, Call&& call) {
  SCOPED_TRACE(label);
  try {
    call();
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), message);
  }
}

TEST(GeoPolygonBuilder, BuildsAnOuterRingInRadians) {
  const h3core::GeoPolygonBuilder builder(sanFranciscoTriangle());
  const ::GeoPolygon* polygon = builder.polygon();
  ASSERT_NE(polygon, nullptr);
  EXPECT_EQ(polygon->geoloop.numVerts, 3);
  EXPECT_EQ(polygon->numHoles, 0);
  EXPECT_NEAR(::radsToDegs(polygon->geoloop.verts[0].lat), 37.813318999983238, 1e-12);
  EXPECT_NEAR(::radsToDegs(polygon->geoloop.verts[0].lng), -122.4089866999972145, 1e-12);
}

TEST(GeoPolygonBuilder, BuildsHoles) {
  const h3core::GeoPolygonBuilder builder(rectangleWithHole());
  const ::GeoPolygon* polygon = builder.polygon();
  ASSERT_EQ(polygon->numHoles, 1);
  EXPECT_EQ(polygon->geoloop.numVerts, 4);
  EXPECT_EQ(polygon->holes[0].numVerts, 4);
  EXPECT_NEAR(::radsToDegs(polygon->holes[0].verts[0].lat), 37.80, 1e-12);
  EXPECT_NEAR(::radsToDegs(polygon->holes[0].verts[0].lng), -122.45, 1e-12);
}

TEST(GeoPolygonBuilder, SurvivesTwoReadsOfTheSamePointers) {
  // the size query and the work call both read the same `::GeoPolygon`, so the vertex arrays must
  // still be there for the second read.
  const h3core::GeoPolygonBuilder builder(sanFranciscoTriangle());
  int64_t first = 0;
  int64_t second = 0;
  ASSERT_EQ(::maxPolygonToCellsSize(builder.polygon(), 7, 0, &first), E_SUCCESS);
  ASSERT_EQ(::maxPolygonToCellsSize(builder.polygon(), 7, 0, &second), E_SUCCESS);
  EXPECT_EQ(first, second);
  EXPECT_GT(first, 0);
}

TEST(GeoPolygonBuilder, AcceptsAnEmptyRingList) {
  const h3core::GeoPolygonBuilder builder({});
  EXPECT_EQ(builder.polygon()->geoloop.numVerts, 0);
  EXPECT_EQ(builder.polygon()->numHoles, 0);
}

TEST(GeoPolygonBuilder, AcceptsAnEmptyOuterRing) {
  const h3core::GeoPolygonBuilder builder({{}});
  EXPECT_EQ(builder.polygon()->geoloop.numVerts, 0);
  EXPECT_EQ(builder.polygon()->numHoles, 0);
}

TEST(GeoPolygonBuilder, RejectsAPointThatIsNotAPair) {
  expectMessage("one coordinate", "Each polygon point must be a [latitude, longitude] pair",
                [] { h3core::GeoPolygonBuilder builder({{{37.8, -122.4}, {37.7}}}); });
  expectMessage("three coordinates", "Each polygon point must be a [latitude, longitude] pair",
                [] { h3core::GeoPolygonBuilder builder({{{37.8, -122.4, 0.0}}}); });
  expectMessage("inside a hole", "Each polygon point must be a [latitude, longitude] pair", [] {
    h3core::GeoPolygonBuilder builder({{{37.8, -122.4}, {37.7, -122.3}, {37.6, -122.2}}, {{37.75}}});
  });
}

TEST(GeoPolygonBuilder, RejectsANonFiniteCoordinate) {
  const double nan = std::numeric_limits<double>::quiet_NaN();
  const double infinity = std::numeric_limits<double>::infinity();
  expectMessage("a latitude of NaN", "Polygon coordinates must be finite numbers",
                [nan] { h3core::GeoPolygonBuilder builder({{{37.8, -122.4}, {nan, -122.4}, {37.7, -122.3}}}); });
  expectMessage("a longitude of infinity", "Polygon coordinates must be finite numbers",
                [infinity] { h3core::GeoPolygonBuilder builder({{{37.8, infinity}}}); });
}

TEST(GeoPolygonBuilder, AcceptsACoordinateOutsideTheGlobe) {
  // H3 normalises rather than rejects: h3-js `polygonToCells([[[91, 0], [0, 0], [1, 1]]], 3)`
  // answers `41` cells, so this binding does not invent a rejection upstream does not have.
  const h3core::GeoPolygonBuilder builder({{{91.0, 0.0}, {0.0, 0.0}, {1.0, 1.0}}});
  EXPECT_EQ(builder.polygon()->geoloop.numVerts, 3);
  EXPECT_EQ(h3ops::polygonToCells({{{91.0, 0.0}, {0.0, 0.0}, {1.0, 1.0}}}, 3).count(), 41);
}

TEST(RegionsOps, PolygonToCellsMatchesH3Js) {
  // h3-js `polygonToCells(triangle, 7)` has seven cells, the first being `"87283082bffffff"`;
  // at resolution `9` it has `292`.
  const h3core::CellBuffer cells = h3ops::polygonToCells(sanFranciscoTriangle(), 7);
  ASSERT_EQ(cells.count(), 7);
  EXPECT_EQ(cells.data()[0], 0x87283082bffffffULL);
  EXPECT_EQ(h3ops::polygonToCells(sanFranciscoTriangle(), 9).count(), 292);
}

TEST(RegionsOps, PolygonToCellsHonoursHoles) {
  // h3-js: `287` cells without the hole, `254` with it, at resolution `8`.
  EXPECT_EQ(h3ops::polygonToCells({rectangleWithHole()[0]}, 8).count(), 287);
  EXPECT_EQ(h3ops::polygonToCells(rectangleWithHole(), 8).count(), 254);
}

TEST(RegionsOps, PolygonToCellsCompactsThePaddedOutput) {
  // `maxPolygonToCellsSize` is an upper bound, so the buffer arrives padded with `H3_NULL` and the
  // compaction pass is what makes the length real.
  const h3core::CellBuffer cells = h3ops::polygonToCells(sanFranciscoTriangle(), 7);
  EXPECT_GT(cells.capacity(), cells.count());
  for (int64_t i = 0; i < cells.count(); i++) {
    EXPECT_NE(cells.data()[i], 0u) << "slot " << i;
  }
}

TEST(RegionsOps, PolygonToCellsAnswersNothingForAnEmptyPolygon) {
  // h3-js answers `[]` for all six of these. The experimental half is H3's own special case
  // (`polyfill.c:736`); the stable half is guarded here, because H3 answers `E_FAILED` for a
  // bounding box of zero width (`bbox.c:203`).
  EXPECT_EQ(h3ops::polygonToCells({}, 7).count(), 0);
  EXPECT_EQ(h3ops::polygonToCells({{}}, 7).count(), 0);
  EXPECT_EQ(h3ops::polygonToCellsExperimental({}, 7, 0).count(), 0);
  EXPECT_EQ(h3ops::polygonToCellsExperimental({{}}, 7, 0).count(), 0);
  // an empty outer ring keeps its holes, and a hole alone still covers nothing
  const Rings emptyOuterWithHole = {{}, rectangleWithHole()[1]};
  EXPECT_EQ(h3ops::polygonToCells(emptyOuterWithHole, 7).count(), 0);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(emptyOuterWithHole, 7, 0).count(), 0);
}

TEST(RegionsOps, PolygonToCellsNarrowsTheResolutionAndLeavesItsRangeToH3) {
  // `maxPolygonToCellsSize` reaches `getPentagons` through `bboxHexEstimate` (`algos.c:885`,
  // `bbox.c:181`), and the experimental iterator checks the range itself (`polyfill.c:337`).
  expectMessage("sixteen", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCells(sanFranciscoTriangle(), 16); });
  expectMessage("minus one", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCells(sanFranciscoTriangle(), -1); });
  expectMessage("sixteen, experimental", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 16, 0); });
  expectMessage("sixteen, experimental and empty", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCellsExperimental({}, 16, 0); });
  // the empty polygon short circuit skips H3, so the range is checked before it, as h3-js does
  expectMessage("sixteen and empty", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCells({}, 16); });
  expectMessage("minus one and empty", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCells({}, -1); });
  expectMessage("sixteen and an empty outer ring", "Resolution argument was outside of acceptable range",
                [] { h3ops::polygonToCells({{}}, 16); });
  // the one condition H3 never sees, because the narrowing runs first
  expectMessage("fractional", "Resolution must be an integer between 0 and 15",
                [] { h3ops::polygonToCells(sanFranciscoTriangle(), 7.5); });
}

TEST(RegionsOps, PolygonToCellsExperimentalHonoursContainmentMode) {
  // h3-js `polygonToCellsExperimental(triangle, 7, mode).length` for centre, full, overlapping and
  // overlapping bounding box.
  EXPECT_EQ(h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 0).count(), 7);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 1).count(), 1);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 2).count(), 15);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 3).count(), 28);
  // h3-js `polygonToCellsExperimental(triangle, 7, "containmentFull")` is `["87283082bffffff"]`
  const h3core::CellBuffer full = h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 1);
  ASSERT_EQ(full.count(), 1);
  EXPECT_EQ(full.data()[0], 0x87283082bffffffULL);
}

TEST(RegionsOps, PolygonToCellsExperimentalHonoursHoles) {
  // h3-js on the holed rectangle at resolution `8`, for the four modes in order.
  EXPECT_EQ(h3ops::polygonToCellsExperimental(rectangleWithHole(), 8, 0).count(), 254);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(rectangleWithHole(), 8, 1).count(), 201);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(rectangleWithHole(), 8, 2).count(), 311);
  EXPECT_EQ(h3ops::polygonToCellsExperimental(rectangleWithHole(), 8, 3).count(), 342);
}

TEST(RegionsOps, PolygonToCellsExperimentalLeavesTheModeRangeToH3) {
  // `CONTAINMENT_INVALID` is `4` and is a sentinel, and `validatePolygonFlags` (`polygon.c:51`)
  // rejects it and everything above; a negative mode arrives as a very large `uint32_t`.
  expectMessage("four", "Mode or flags argument was not valid",
                [] { h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 4); });
  expectMessage("minus one", "Mode or flags argument was not valid",
                [] { h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, -1); });
  // the one condition H3 never sees, because the narrowing runs first
  expectMessage("fractional", "Containment mode must be an integer",
                [] { h3ops::polygonToCellsExperimental(sanFranciscoTriangle(), 7, 1.5); });
}

TEST(RegionsOps, PolygonToCellsRefusesAnUnaffordableRequest) {
  // a whole-globe polygon at resolution `15` is what the ceiling exists for: without it,
  // `maxPolygonToCellsSize` reports a number that would exhaust the device.
  const Rings globe = {{{89.0, -180.0}, {89.0, 0.0}, {-89.0, 0.0}, {-89.0, -180.0}}};
  expectMessage("the globe at resolution 15", "The requested result would exceed this binding's limit of 4000000 cells",
                [&globe] { h3ops::polygonToCells(globe, 15); });
  expectMessage("the globe at resolution 15, experimental",
                "The requested result would exceed this binding's limit of 4000000 cells",
                [&globe] { h3ops::polygonToCellsExperimental(globe, 15, 0); });
}

} // namespace
