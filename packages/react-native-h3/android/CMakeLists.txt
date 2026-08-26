cmake_minimum_required(VERSION 3.22.1)
project(NitroH3)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

set(PACKAGE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)
set(H3_ROOT ${PACKAGE_ROOT}/third_party/h3)

# Vendored H3 (C), read from the list the podspec also reads. Listing the sources instead of
# calling `add_subdirectory` keeps both platforms on an identical source set compiled against
# an identical pre-generated header.
file(READ ${H3_ROOT}/sources.json H3_SOURCES_JSON)
string(JSON H3_SOURCE_COUNT LENGTH ${H3_SOURCES_JSON} sources)
set(H3_SOURCES "")
math(EXPR H3_LAST_INDEX "${H3_SOURCE_COUNT} - 1")
foreach(i RANGE ${H3_LAST_INDEX})
  string(JSON H3_SOURCE GET ${H3_SOURCES_JSON} sources ${i})
  list(APPEND H3_SOURCES ${H3_ROOT}/${H3_SOURCE})
endforeach()

add_library(
  NitroH3
  SHARED
  ${H3_SOURCES}
  ${PACKAGE_ROOT}/cpp/core/CellBuffer.cpp
  ${PACKAGE_ROOT}/cpp/core/H3ErrorMapping.cpp
  ${PACKAGE_ROOT}/cpp/core/Validation.cpp
  ${PACKAGE_ROOT}/cpp/core/LinkedGeoPolygonReader.cpp
  ${PACKAGE_ROOT}/cpp/ops/Indexing.cpp
  ${PACKAGE_ROOT}/cpp/ops/Inspection.cpp
  ${PACKAGE_ROOT}/cpp/ops/Measurement.cpp
  ${PACKAGE_ROOT}/cpp/ops/Misc.cpp
  ${PACKAGE_ROOT}/cpp/ops/Regions.cpp
  ${PACKAGE_ROOT}/cpp/ops/Units.cpp
  ${PACKAGE_ROOT}/cpp/HybridH3.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/src/main/cpp/cpp-adapter.cpp  # <-- `JNI_OnLoad`, Android only
)

target_include_directories(NitroH3 PUBLIC ${PACKAGE_ROOT}/cpp ${H3_ROOT}/include)
set_source_files_properties(${H3_SOURCES} PROPERTIES COMPILE_FLAGS "-w")  # <-- vendored, not ours to fix

# Nitrogen autolinking, which must stay last. Purely additive to the target above: generated
# sources, include paths and `c++20`.
include(${CMAKE_CURRENT_SOURCE_DIR}/../nitrogen/generated/android/NitroH3+autolinking.cmake)
