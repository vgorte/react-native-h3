import { rethrowAsH3Error } from './H3Error'
import { native } from './native'

/**
 * Converts degrees to radians.
 *
 * @param degrees An angle in degrees.
 * @returns The same angle in radians.
 */
export function degsToRads(degrees: number): number {
  try {
    return native.degsToRads(degrees)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}

/**
 * Converts radians to degrees.
 *
 * @param radians An angle in radians.
 * @returns The same angle in degrees.
 */
export function radsToDegs(radians: number): number {
  try {
    return native.radsToDegs(radians)
  } catch (error) {
    rethrowAsH3Error(error)
  }
}
