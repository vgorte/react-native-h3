//
//  OutParamCallTest.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#include <gtest/gtest.h>

#include <cstdint>
#include <stdexcept>
#include <string>

#include "shapes/OutParamCall.hpp"

extern "C" {
#include "h3api.h"
}

namespace {

// San Francisco at resolution 9, from h3-js 4.5.0's `89283082803ffff`.
constexpr H3Index kSanFrancisco = 0x89283082803ffffULL;
// Names base cell `127`, of which only 122 exist, so `_h3ToFaceIjk` rejects it (`h3Index.c:1120`).
constexpr H3Index kInvalidCell = 0xffffffffffffffffULL;

TEST(OutParamCall, ReturnsADoubleOutParam) {
  // h3-js `cellArea("89283082803ffff", "km2")` == 0.10940247351390452
  const double area = h3shapes::callWithOutParam<double>(cellAreaKm2, kSanFrancisco);
  EXPECT_NEAR(area, 0.10940247351390452, 1e-15);
}

TEST(OutParamCall, ReturnsAnH3IndexOutParam) {
  // h3-js `cellToParent("89283082803ffff", 5)` == `85283083fffffff`
  const H3Index parent = h3shapes::callWithOutParam<H3Index>(cellToParent, kSanFrancisco, 5);
  EXPECT_EQ(parent, 0x85283083fffffffULL);
}

TEST(OutParamCall, ReturnsAnInt64OutParam) {
  // h3-js `getNumCells(15)` == 569707381193162
  const int64_t cells = h3shapes::callWithOutParam<int64_t>(getNumCells, 15);
  EXPECT_EQ(cells, 569707381193162LL);
}

TEST(OutParamCall, ReturnsAnIntOutParam) {
  // h3-js `areNeighborCells("89283082803ffff", "8928308281bffff")` == `true`
  const int neighbors = h3shapes::callWithOutParam<int>(areNeighborCells, kSanFrancisco, 0x8928308281bffffULL);
  EXPECT_EQ(neighbors, 1);
}

TEST(OutParamCall, ReturnsAStructOutParam) {
  // h3-js `cellToLatLng("89283082803ffff")` == [37.773515097238146, -122.41827103692466]
  const LatLng centre = h3shapes::callWithOutParam<LatLng>(cellToLatLng, kSanFrancisco);
  EXPECT_NEAR(radsToDegs(centre.lat), 37.773515097238146, 1e-12);
  EXPECT_NEAR(radsToDegs(centre.lng), -122.41827103692466, 1e-12);
}

TEST(OutParamCall, ReturnsALargeStructOutParamWithoutTouchingAlignment) {
  // `CellBoundary` carries an `int` followed by a double-aligned array, so `verts` starts at byte
  // offset 8, not 4. The template never computes that offset; it hands H3 the whole struct.
  const CellBoundary boundary = h3shapes::callWithOutParam<CellBoundary>(cellToBoundary, kSanFrancisco);
  EXPECT_EQ(boundary.numVerts, 6);
  // h3-js `cellToBoundary("89283082803ffff")[0]` == [37.7720104773324, -122.41701147197293]
  EXPECT_NEAR(radsToDegs(boundary.verts[0].lat), 37.7720104773324, 1e-12);
  EXPECT_NEAR(radsToDegs(boundary.verts[0].lng), -122.41701147197293, 1e-12);
}

TEST(OutParamCall, ThrowsUpstreamWordingOnAnH3Error) {
  try {
    h3shapes::callWithOutParam<double>(cellAreaKm2, kInvalidCell);
    FAIL() << "expected an exception";
  } catch (const std::runtime_error& error) {
    EXPECT_EQ(std::string(error.what()), "Cell argument was not valid");
  }
}

TEST(OutParamCall, LeavesNoValueBehindWhenItThrows) {
  // The out-param is a local, so a failing call cannot publish a half-written value anywhere.
  double area = -1.0;
  try {
    area = h3shapes::callWithOutParam<double>(cellAreaKm2, kInvalidCell);
  } catch (const std::runtime_error&) {
  }
  EXPECT_EQ(area, -1.0);
}

TEST(OutParamCall, AcceptsAPointerArgument) {
  LatLng coordinate{};
  coordinate.lat = degsToRads(37.7749);
  coordinate.lng = degsToRads(-122.4194);
  const H3Index cell = h3shapes::callWithOutParam<H3Index>(latLngToCell, &coordinate, 9);
  EXPECT_EQ(cell, kSanFrancisco);
}

} // namespace
