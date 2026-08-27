//
//  ParityProbe.cpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

// drives the Nitro-free operations layer from a line protocol, so the h3-js comparison can run
// under `bun test` on a machine with no JavaScript runtime bridge.
//
// it links `nitro_free_core` and includes no Nitro header, so every answer comes from the code
// that ships. The podspec's `exclude_files` keeps `cpp/test` out of the published pod.
//
// each line of stdin is one request, `<op> <arg>...` with whitespace-free arguments, and each
// line of stdout is one response, `{"ok":<value>}` or `{"err":"<message>"}`. `__ops` answers the
// name of every operation, and a blank line earns no response.
//
// an argument is a cell (lowercase hexadecimal without `0x`), a number (decimal, `stod` syntax),
// a comma-separated list of either with `-` for empty, or a polygon, whose rings are separated by
// `|`, points by `;` and `lat,lng` by `,`.
//
// a result is a cell or an array of cells as hexadecimal strings, a point as `[lat, lng]`, a ring
// as an array of points, a multi polygon as an array of arrays of rings, local coordinates as
// `{"i":<number>,"j":<number>}`, or a number written `%.17g` so that every double round-trips.
// `int64` results are numbers too: the largest reachable value, `getNumCells(15)`, is below `2^53`.

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <functional>
#include <iostream>
#include <map>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

#include "core/CellBuffer.hpp"
#include "core/Geometry.hpp"
#include "ops/Edges.hpp"
#include "ops/Hierarchy.hpp"
#include "ops/Indexing.hpp"
#include "ops/Inspection.hpp"
#include "ops/Measurement.hpp"
#include "ops/Misc.hpp"
#include "ops/Regions.hpp"
#include "ops/Traversal.hpp"
#include "ops/Units.hpp"
#include "ops/Vertexes.hpp"

namespace {

using Args = std::vector<std::string>;
using Handler = std::function<std::string(const Args&)>;

std::vector<std::string> split(const std::string& text, char separator) {
  std::vector<std::string> parts;
  std::string part;
  std::istringstream stream(text);
  while (std::getline(stream, part, separator)) {
    parts.push_back(part);
  }
  return parts;
}

// Argument decoding

const std::string& rawArg(const Args& args, size_t index) {
  if (index >= args.size()) {
    // 1-based, so the number matches the position a caller counts on the request line
    throw std::invalid_argument("Missing argument " + std::to_string(index + 1));
  }
  return args[index];
}

uint64_t parseCell(const std::string& token) {
  size_t consumed = 0;
  uint64_t cell = 0;
  try {
    cell = std::stoull(token, &consumed, 16);
  } catch (const std::exception&) {
    throw std::invalid_argument("Not a cell: " + token);
  }
  // `stoull` stops at the first non-hexadecimal character rather than complaining
  if (consumed != token.size()) {
    throw std::invalid_argument("Not a cell: " + token);
  }
  return cell;
}

double parseNumber(const std::string& token) {
  size_t consumed = 0;
  double value = 0;
  try {
    value = std::stod(token, &consumed);
  } catch (const std::exception&) {
    throw std::invalid_argument("Not a number: " + token);
  }
  if (consumed != token.size()) {
    throw std::invalid_argument("Not a number: " + token);
  }
  return value;
}

uint64_t cellArg(const Args& args, size_t index) {
  return parseCell(rawArg(args, index));
}

double numArg(const Args& args, size_t index) {
  return parseNumber(rawArg(args, index));
}

std::vector<uint64_t> cellsArg(const Args& args, size_t index) {
  std::vector<uint64_t> cells;
  const std::string& token = rawArg(args, index);
  if (token == "-") {
    return cells;
  }
  for (const std::string& part : split(token, ',')) {
    cells.push_back(parseCell(part));
  }
  return cells;
}

std::vector<double> numbersArg(const Args& args, size_t index) {
  std::vector<double> numbers;
  const std::string& token = rawArg(args, index);
  if (token == "-") {
    return numbers;
  }
  for (const std::string& part : split(token, ',')) {
    numbers.push_back(parseNumber(part));
  }
  return numbers;
}

std::vector<std::vector<std::vector<double>>> ringsArg(const Args& args, size_t index) {
  std::vector<std::vector<std::vector<double>>> rings;
  const std::string& token = rawArg(args, index);
  if (token == "-") {
    return rings;
  }
  for (const std::string& ringText : split(token, '|')) {
    std::vector<std::vector<double>> ring;
    for (const std::string& pointText : split(ringText, ';')) {
      const std::vector<std::string> pair = split(pointText, ',');
      if (pair.size() != 2) {
        throw std::invalid_argument("Not a point: " + pointText);
      }
      ring.push_back({parseNumber(pair[0]), parseNumber(pair[1])});
    }
    rings.push_back(ring);
  }
  return rings;
}

// Response building

std::string jsonNumber(double value) {
  if (std::isnan(value) || std::isinf(value)) {
    return "null";
  }
  char text[40];
  // `%.17g` round-trips every double, which matters because the comparison is exact
  std::snprintf(text, sizeof(text), "%.17g", value);
  return text;
}

std::string jsonString(const std::string& value) {
  std::string escaped = "\"";
  for (const unsigned char character : value) {
    switch (character) {
    case '"':
      escaped += "\\\"";
      break;
    case '\\':
      escaped += "\\\\";
      break;
    case '\n':
      escaped += "\\n";
      break;
    case '\r':
      escaped += "\\r";
      break;
    case '\t':
      escaped += "\\t";
      break;
    default:
      if (character < 0x20) {
        char unicode[8];
        std::snprintf(unicode, sizeof(unicode), "\\u%04x", character);
        escaped += unicode;
      } else {
        escaped += static_cast<char>(character);
      }
      break;
    }
  }
  return escaped + "\"";
}

std::string jsonBool(bool value) {
  return value ? "true" : "false";
}

std::string jsonArray(const std::vector<std::string>& items) {
  std::string text = "[";
  for (size_t i = 0; i < items.size(); i++) {
    if (i > 0) {
      text += ",";
    }
    text += items[i];
  }
  return text + "]";
}

std::string jsonCell(uint64_t cell) {
  return jsonString(h3ops::cellToString(cell));
}

std::string jsonCells(const h3core::CellBuffer& buffer) {
  std::vector<std::string> items;
  items.reserve(static_cast<size_t>(buffer.count()));
  for (int64_t i = 0; i < buffer.count(); i++) {
    items.push_back(jsonCell(buffer.data()[i]));
  }
  return jsonArray(items);
}

std::string jsonPoint(const h3core::Point& point) {
  return jsonArray({jsonNumber(point.lat), jsonNumber(point.lng)});
}

std::string jsonRing(const h3core::Ring& ring) {
  std::vector<std::string> items;
  items.reserve(ring.size());
  for (const h3core::Point& point : ring) {
    items.push_back(jsonPoint(point));
  }
  return jsonArray(items);
}

std::string jsonMultiPolygon(const h3core::MultiPolygon& polygons) {
  std::vector<std::string> polygonItems;
  polygonItems.reserve(polygons.size());
  for (const h3core::Polygon& polygon : polygons) {
    std::vector<std::string> ringItems;
    ringItems.reserve(polygon.size());
    for (const h3core::Ring& ring : polygon) {
      ringItems.push_back(jsonRing(ring));
    }
    polygonItems.push_back(jsonArray(ringItems));
  }
  return jsonArray(polygonItems);
}

std::string jsonIJ(const h3core::IJ& ij) {
  return "{\"i\":" + jsonNumber(ij.i) + ",\"j\":" + jsonNumber(ij.j) + "}";
}

// Operations

const std::map<std::string, Handler>& handlers() {
  static const std::map<std::string, Handler> table = {
      // Units
      {"degsToRads", [](const Args& a) { return jsonNumber(h3ops::degsToRads(numArg(a, 0))); }},
      {"radsToDegs", [](const Args& a) { return jsonNumber(h3ops::radsToDegs(numArg(a, 0))); }},

      // Indexing
      {"latLngToCell",
       [](const Args& a) { return jsonCell(h3ops::latLngToCell(numArg(a, 0), numArg(a, 1), numArg(a, 2))); }},
      {"cellToLatLng", [](const Args& a) { return jsonPoint(h3ops::cellToLatLng(cellArg(a, 0))); }},
      {"cellToBoundary", [](const Args& a) { return jsonRing(h3ops::cellToBoundary(cellArg(a, 0))); }},

      // Inspection
      {"isValidCell", [](const Args& a) { return jsonBool(h3ops::isValidCell(cellArg(a, 0))); }},
      {"isValidIndex", [](const Args& a) { return jsonBool(h3ops::isValidIndex(cellArg(a, 0))); }},
      {"isValidDirectedEdge", [](const Args& a) { return jsonBool(h3ops::isValidDirectedEdge(cellArg(a, 0))); }},
      {"isValidVertex", [](const Args& a) { return jsonBool(h3ops::isValidVertex(cellArg(a, 0))); }},
      {"isPentagon", [](const Args& a) { return jsonBool(h3ops::isPentagon(cellArg(a, 0))); }},
      {"isResClassIII", [](const Args& a) { return jsonBool(h3ops::isResClassIII(cellArg(a, 0))); }},
      {"getResolution", [](const Args& a) { return jsonNumber(h3ops::getResolution(cellArg(a, 0))); }},
      {"getBaseCellNumber", [](const Args& a) { return jsonNumber(h3ops::getBaseCellNumber(cellArg(a, 0))); }},
      {"getIndexDigit", [](const Args& a) { return jsonNumber(h3ops::getIndexDigit(cellArg(a, 0), numArg(a, 1))); }},
      {"constructCell",
       [](const Args& a) { return jsonCell(h3ops::constructCell(numArg(a, 0), numbersArg(a, 1), numArg(a, 2))); }},
      {"cellToString", [](const Args& a) { return jsonString(h3ops::cellToString(cellArg(a, 0))); }},
      {"cellFromString", [](const Args& a) { return jsonCell(h3ops::cellFromString(rawArg(a, 0))); }},

      // Measurement
      {"cellAreaKm2", [](const Args& a) { return jsonNumber(h3ops::cellAreaKm2(cellArg(a, 0))); }},
      {"cellAreaM2", [](const Args& a) { return jsonNumber(h3ops::cellAreaM2(cellArg(a, 0))); }},
      {"cellAreaRads2", [](const Args& a) { return jsonNumber(h3ops::cellAreaRads2(cellArg(a, 0))); }},
      {"greatCircleDistanceKm",
       [](const Args& a) {
         return jsonNumber(h3ops::greatCircleDistanceKm(numArg(a, 0), numArg(a, 1), numArg(a, 2), numArg(a, 3)));
       }},
      {"greatCircleDistanceM",
       [](const Args& a) {
         return jsonNumber(h3ops::greatCircleDistanceM(numArg(a, 0), numArg(a, 1), numArg(a, 2), numArg(a, 3)));
       }},
      {"greatCircleDistanceRads",
       [](const Args& a) {
         return jsonNumber(h3ops::greatCircleDistanceRads(numArg(a, 0), numArg(a, 1), numArg(a, 2), numArg(a, 3)));
       }},

      // Miscellaneous
      {"getHexagonAreaAvgKm2", [](const Args& a) { return jsonNumber(h3ops::getHexagonAreaAvgKm2(numArg(a, 0))); }},
      {"getHexagonAreaAvgM2", [](const Args& a) { return jsonNumber(h3ops::getHexagonAreaAvgM2(numArg(a, 0))); }},
      {"getHexagonEdgeLengthAvgKm",
       [](const Args& a) { return jsonNumber(h3ops::getHexagonEdgeLengthAvgKm(numArg(a, 0))); }},
      {"getHexagonEdgeLengthAvgM",
       [](const Args& a) { return jsonNumber(h3ops::getHexagonEdgeLengthAvgM(numArg(a, 0))); }},
      {"getNumCells", [](const Args& a) { return jsonNumber(static_cast<double>(h3ops::getNumCells(numArg(a, 0)))); }},
      {"getRes0Cells", [](const Args&) { return jsonCells(h3ops::getRes0Cells()); }},
      {"getPentagons", [](const Args& a) { return jsonCells(h3ops::getPentagons(numArg(a, 0))); }},
      {"getIcosahedronFaces",
       [](const Args& a) {
         std::vector<std::string> items;
         for (const int face : h3ops::getIcosahedronFaces(cellArg(a, 0))) {
           items.push_back(jsonNumber(face));
         }
         return jsonArray(items);
       }},

      // Hierarchy
      {"cellToParent", [](const Args& a) { return jsonCell(h3ops::cellToParent(cellArg(a, 0), numArg(a, 1))); }},
      {"cellToCenterChild",
       [](const Args& a) { return jsonCell(h3ops::cellToCenterChild(cellArg(a, 0), numArg(a, 1))); }},
      {"cellToChildrenSize",
       [](const Args& a) {
         return jsonNumber(static_cast<double>(h3ops::cellToChildrenSize(cellArg(a, 0), numArg(a, 1))));
       }},
      {"cellToChildPos",
       [](const Args& a) {
         return jsonNumber(static_cast<double>(h3ops::cellToChildPos(cellArg(a, 0), numArg(a, 1))));
       }},
      {"childPosToCell",
       [](const Args& a) { return jsonCell(h3ops::childPosToCell(numArg(a, 0), cellArg(a, 1), numArg(a, 2))); }},
      {"cellToChildren", [](const Args& a) { return jsonCells(h3ops::cellToChildren(cellArg(a, 0), numArg(a, 1))); }},
      {"compactCells",
       [](const Args& a) {
         const std::vector<uint64_t> cells = cellsArg(a, 0);
         return jsonCells(h3ops::compactCells(cells.data(), static_cast<int64_t>(cells.size())));
       }},
      {"uncompactCells",
       [](const Args& a) {
         const std::vector<uint64_t> cells = cellsArg(a, 0);
         return jsonCells(h3ops::uncompactCells(cells.data(), static_cast<int64_t>(cells.size()), numArg(a, 1)));
       }},

      // Traversal
      {"gridDisk", [](const Args& a) { return jsonCells(h3ops::gridDisk(cellArg(a, 0), numArg(a, 1))); }},
      {"gridRing", [](const Args& a) { return jsonCells(h3ops::gridRing(cellArg(a, 0), numArg(a, 1))); }},
      {"gridRingUnsafe", [](const Args& a) { return jsonCells(h3ops::gridRingUnsafe(cellArg(a, 0), numArg(a, 1))); }},
      {"gridDiskDistances",
       [](const Args& a) {
         std::vector<std::string> rings;
         for (const h3core::CellBuffer& ring : h3ops::gridDiskDistances(cellArg(a, 0), numArg(a, 1))) {
           rings.push_back(jsonCells(ring));
         }
         return jsonArray(rings);
       }},
      {"gridPathCells", [](const Args& a) { return jsonCells(h3ops::gridPathCells(cellArg(a, 0), cellArg(a, 1))); }},
      {"gridDistance",
       [](const Args& a) {
         return jsonNumber(static_cast<double>(h3ops::gridDistance(cellArg(a, 0), cellArg(a, 1))));
       }},
      {"cellToLocalIj", [](const Args& a) { return jsonIJ(h3ops::cellToLocalIj(cellArg(a, 0), cellArg(a, 1))); }},
      {"localIjToCell",
       [](const Args& a) { return jsonCell(h3ops::localIjToCell(cellArg(a, 0), numArg(a, 1), numArg(a, 2))); }},

      // Edges
      {"areNeighborCells",
       [](const Args& a) { return jsonBool(h3ops::areNeighborCells(cellArg(a, 0), cellArg(a, 1))); }},
      {"cellsToDirectedEdge",
       [](const Args& a) { return jsonCell(h3ops::cellsToDirectedEdge(cellArg(a, 0), cellArg(a, 1))); }},
      {"getDirectedEdgeOrigin", [](const Args& a) { return jsonCell(h3ops::getDirectedEdgeOrigin(cellArg(a, 0))); }},
      {"getDirectedEdgeDestination",
       [](const Args& a) { return jsonCell(h3ops::getDirectedEdgeDestination(cellArg(a, 0))); }},
      {"reverseDirectedEdge", [](const Args& a) { return jsonCell(h3ops::reverseDirectedEdge(cellArg(a, 0))); }},
      {"directedEdgeToCells", [](const Args& a) { return jsonCells(h3ops::directedEdgeToCells(cellArg(a, 0))); }},
      {"originToDirectedEdges", [](const Args& a) { return jsonCells(h3ops::originToDirectedEdges(cellArg(a, 0))); }},
      {"directedEdgeToBoundary", [](const Args& a) { return jsonRing(h3ops::directedEdgeToBoundary(cellArg(a, 0))); }},
      {"edgeLengthKm", [](const Args& a) { return jsonNumber(h3ops::edgeLengthKm(cellArg(a, 0))); }},
      {"edgeLengthM", [](const Args& a) { return jsonNumber(h3ops::edgeLengthM(cellArg(a, 0))); }},
      {"edgeLengthRads", [](const Args& a) { return jsonNumber(h3ops::edgeLengthRads(cellArg(a, 0))); }},

      // Vertexes
      {"cellToVertex", [](const Args& a) { return jsonCell(h3ops::cellToVertex(cellArg(a, 0), numArg(a, 1))); }},
      {"cellToVertexes", [](const Args& a) { return jsonCells(h3ops::cellToVertexes(cellArg(a, 0))); }},
      {"vertexToLatLng", [](const Args& a) { return jsonPoint(h3ops::vertexToLatLng(cellArg(a, 0))); }},

      // Regions
      {"cellsToMultiPolygon",
       [](const Args& a) {
         const std::vector<uint64_t> cells = cellsArg(a, 0);
         return jsonMultiPolygon(h3ops::cellsToMultiPolygon(cells.data(), static_cast<int64_t>(cells.size())));
       }},
      {"polygonToCells", [](const Args& a) { return jsonCells(h3ops::polygonToCells(ringsArg(a, 0), numArg(a, 1))); }},
      {"polygonToCellsExperimental",
       [](const Args& a) {
         return jsonCells(h3ops::polygonToCellsExperimental(ringsArg(a, 0), numArg(a, 1), numArg(a, 2)));
       }},
  };
  return table;
}

std::string listOps() {
  std::vector<std::string> names;
  names.reserve(handlers().size());
  for (const auto& entry : handlers()) {
    names.push_back(jsonString(entry.first));
  }
  return jsonArray(names);
}

} // namespace

int main() {
  std::ios::sync_with_stdio(false);
  std::string line;
  while (std::getline(std::cin, line)) {
    Args tokens;
    std::istringstream stream(line);
    std::string token;
    while (stream >> token) {
      tokens.push_back(token);
    }
    // a blank line is not a request, so it earns no response line
    if (tokens.empty()) {
      continue;
    }
    const std::string op = tokens.front();
    tokens.erase(tokens.begin());

    if (op == "__ops") {
      std::cout << "{\"ok\":" << listOps() << "}\n" << std::flush;
      continue;
    }

    const auto handler = handlers().find(op);
    if (handler == handlers().end()) {
      std::cout << "{\"err\":" << jsonString("Unknown operation: " + op) << "}\n" << std::flush;
      continue;
    }

    // the value is built before anything is written, so a throw cannot leave `{"ok":` on the line
    try {
      const std::string value = handler->second(tokens);
      std::cout << "{\"ok\":" << value << "}\n" << std::flush;
    } catch (const std::exception& error) {
      std::cout << "{\"err\":" << jsonString(error.what()) << "}\n" << std::flush;
    }
  }
  return 0;
}
