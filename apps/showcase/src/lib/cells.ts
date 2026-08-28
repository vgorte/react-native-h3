import type { Feature, FeatureCollection, GeoJsonProperties, Polygon } from 'geojson'
import { cellToBoundary, cellToString } from 'react-native-h3'
import { polygonFeature } from './geo'

/** Builds the GeoJSON polygon of one cell, identified by its H3 string index. */
export function featureFromCell(
  cell: bigint,
  properties: GeoJsonProperties = null,
): Feature<Polygon> {
  return polygonFeature(cellToBoundary(cell), cellToString(cell), properties)
}

/**
 * Builds one collection from a whole cell set, which is what a `GeoJSONSource` takes.
 *
 * @param cells Any iterable of cells; a `BigUint64Array` and a `Set<bigint>` both work.
 * @param properties Called once per cell when the layer's paint expression needs a property.
 */
export function featureCollectionFromCells(
  cells: Iterable<bigint>,
  properties?: (cell: bigint) => GeoJsonProperties,
): FeatureCollection<Polygon> {
  const features: Feature<Polygon>[] = []
  for (const cell of cells) {
    features.push(featureFromCell(cell, properties?.(cell) ?? null))
  }
  return { type: 'FeatureCollection', features }
}
