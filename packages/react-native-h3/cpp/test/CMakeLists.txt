cmake_minimum_required(VERSION 3.20)
project(react_native_h3_tests CXX C)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(PACKAGE_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/../..)
set(H3_ROOT ${PACKAGE_ROOT}/third_party/h3)

# Vendored H3 source list
# Read the list instead of globbing, so a missing file fails loudly.
file(READ ${H3_ROOT}/sources.json H3_SOURCES_JSON)
string(JSON H3_SOURCE_COUNT LENGTH ${H3_SOURCES_JSON} sources)
set(H3_SOURCES "")
math(EXPR H3_LAST_INDEX "${H3_SOURCE_COUNT} - 1")
foreach(i RANGE ${H3_LAST_INDEX})
  string(JSON H3_SOURCE GET ${H3_SOURCES_JSON} sources ${i})
  list(APPEND H3_SOURCES ${H3_ROOT}/${H3_SOURCE})
endforeach()

add_library(h3_vendored STATIC ${H3_SOURCES})
target_include_directories(h3_vendored PUBLIC ${H3_ROOT}/include)
# upstream builds with these warnings off; we do not own this code.
target_compile_options(h3_vendored PRIVATE -w)

# Nitro-free core
# Every memory hazard in the project lives here, so it must stay free of Nitro headers and
# therefore testable on the host under sanitizers.
add_library(nitro_free_core STATIC
  ${PACKAGE_ROOT}/cpp/core/CellBuffer.cpp
  ${PACKAGE_ROOT}/cpp/core/H3ErrorMapping.cpp
  ${PACKAGE_ROOT}/cpp/core/Validation.cpp
  ${PACKAGE_ROOT}/cpp/core/LinkedGeoPolygonReader.cpp
  ${PACKAGE_ROOT}/cpp/ops/Edges.cpp
  ${PACKAGE_ROOT}/cpp/ops/Hierarchy.cpp
  ${PACKAGE_ROOT}/cpp/ops/Indexing.cpp
  ${PACKAGE_ROOT}/cpp/ops/Inspection.cpp
  ${PACKAGE_ROOT}/cpp/ops/Measurement.cpp
  ${PACKAGE_ROOT}/cpp/ops/Misc.cpp
  ${PACKAGE_ROOT}/cpp/ops/Regions.cpp
  ${PACKAGE_ROOT}/cpp/ops/Traversal.cpp
  ${PACKAGE_ROOT}/cpp/ops/Units.cpp
  ${PACKAGE_ROOT}/cpp/ops/Vertexes.cpp
)
target_include_directories(nitro_free_core PUBLIC ${PACKAGE_ROOT}/cpp)
target_link_libraries(nitro_free_core PUBLIC h3_vendored)
target_compile_options(nitro_free_core PRIVATE -Wall -Wextra -Wpedantic -Werror)

# GoogleTest
# Use an installed copy of 1.18.0 when there is one, fetch otherwise.
find_package(GTest 1.18.0 QUIET)
if(NOT GTest_FOUND)
  include(FetchContent)
  FetchContent_Declare(
    googletest
    GIT_REPOSITORY https://github.com/google/googletest.git
    GIT_TAG v1.18.0
  )
  set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
  FetchContent_MakeAvailable(googletest)
endif()

enable_testing()
include(GoogleTest)

# Test targets
# Test sources, shared by the plain and the sanitised executable
set(TEST_SOURCES
  ${CMAKE_CURRENT_SOURCE_DIR}/VendoredH3Test.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/CellBufferTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/H3ErrorMappingTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/BufferSizesTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/ValidationTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/OutParamCallTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/CellSetCallTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/LinkedGeoPolygonReaderTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/IndexingOpsTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/InspectionOpsTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/MeasurementOpsTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/HierarchyOpsTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/TraversalOpsTest.cpp
  ${CMAKE_CURRENT_SOURCE_DIR}/EdgesOpsTest.cpp
)

add_executable(tests ${TEST_SOURCES})
target_link_libraries(tests PRIVATE nitro_free_core GTest::gtest_main)
gtest_discover_tests(tests)

# Sanitised twin
# LeakSanitizer needs Linux (CI or Docker); it does not exist on macOS/arm64.
add_executable(tests_asan ${TEST_SOURCES})
target_link_libraries(tests_asan PRIVATE nitro_free_core GTest::gtest_main)
target_compile_options(tests_asan PRIVATE -fsanitize=address,undefined -fno-omit-frame-pointer -g -O1)
target_link_options(tests_asan PRIVATE -fsanitize=address,undefined)
