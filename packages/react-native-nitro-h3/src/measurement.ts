import type { UInt64 } from 'react-native-nitro-modules'
import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Measures the exact area of a cell in square kilometres.
 *
 * h3-js spells this `cellArea(cell, 'km2')`. Here the unit is part of the name, so nothing about the
 * unit crosses the bridge at call time.
 *
 * @param cell The cell.
 * @returns The area in square kilometres.
 * @throws {@linkcode H3Error} if the cell is not valid.
 */
export function cellAreaKm2(cell: bigint): number {
  try {
    return native.cellAreaKm2(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Measures the exact area of a cell in square metres.
 *
 * @param cell The cell.
 * @returns The area in square metres.
 * @throws {@linkcode H3Error} if the cell is not valid.
 */
export function cellAreaM2(cell: bigint): number {
  try {
    return native.cellAreaM2(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Measures the exact area of a cell in square radians.
 *
 * @param cell The cell.
 * @returns The area in square radians, on the unit sphere.
 * @throws {@linkcode H3Error} if the cell is not valid.
 */
export function cellAreaRads2(cell: bigint): number {
  try {
    return native.cellAreaRads2(cell as UInt64)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Measures the great-circle distance between two coordinates in kilometres.
 *
 * @param lat1 Latitude of the first point in degrees.
 * @param lng1 Longitude of the first point in degrees.
 * @param lat2 Latitude of the second point in degrees.
 * @param lng2 Longitude of the second point in degrees.
 * @returns The distance in kilometres.
 */
export function greatCircleDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  try {
    return native.greatCircleDistanceKm(lat1, lng1, lat2, lng2)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Measures the great-circle distance between two coordinates in metres.
 *
 * @param lat1 Latitude of the first point in degrees.
 * @param lng1 Longitude of the first point in degrees.
 * @param lat2 Latitude of the second point in degrees.
 * @param lng2 Longitude of the second point in degrees.
 * @returns The distance in metres.
 */
export function greatCircleDistanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  try {
    return native.greatCircleDistanceM(lat1, lng1, lat2, lng2)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Measures the great-circle distance between two coordinates in radians.
 *
 * @param lat1 Latitude of the first point in degrees.
 * @param lng1 Longitude of the first point in degrees.
 * @param lat2 Latitude of the second point in degrees.
 * @param lng2 Longitude of the second point in degrees.
 * @returns The distance in radians, on the unit sphere.
 */
export function greatCircleDistanceRads(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  try {
    return native.greatCircleDistanceRads(lat1, lng1, lat2, lng2)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
