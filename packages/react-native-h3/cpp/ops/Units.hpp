//
//  Units.hpp
//  react-native-h3
//
//  Created by Viktor Gorte on 26.08.26.
//

#pragma once

/**
 * Converts angles between degrees and radians.
 *
 * The public API speaks degrees everywhere, while H3 speaks radians, so these two are exported for
 * callers who need the other side of that boundary. Nothing here includes a Nitro header.
 */
namespace h3ops {

/** Converts degrees to radians. Cannot fail. */
double degsToRads(double degrees);

/** Converts radians to degrees. Cannot fail. */
double radsToDegs(double radians);

} // namespace h3ops
