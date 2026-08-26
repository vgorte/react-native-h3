import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Finds the cell containing the given coordinate at the given resolution.
 *
 * @param lat Latitude in degrees.
 * @param lng Longitude in degrees.
 * @param res Resolution, `0` to `15`.
 * @throws {@linkcode H3Error} If the coordinate or the resolution is out of range.
 */
export function latLngToCell(lat: number, lng: number, res: number): bigint {
  try {
    return native.latLngToCell(lat, lng, res)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
