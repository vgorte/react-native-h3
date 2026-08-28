import { formatCount } from './timing'

/**
 * Caps how many cells one call may allocate, which this app configures for itself at startup.
 *
 * A geofence drawn over Berlin at resolution 12 would push millions of cells through the GeoJSON
 * build, which is what this number stops.
 */
export const CELL_CEILING = 4_000_000

/** States the ceiling, for the About sheet's row. */
export const CEILING_VALUE = formatCount(CELL_CEILING)

/** Says who set the ceiling, for the line under the About sheet's rows. */
export const CEILING_NOTE =
  'Set by this app with configure({ maxCellCount }); the package ships without a limit.'

/** Explains the ceiling in the same register as the rest of the Coverage help. */
export const CEILING_HELP =
  `This app calls configure({ maxCellCount }) at startup and caps one call at ` +
  `${formatCount(CELL_CEILING)} cells. The package ships without a limit, so an app sets ` +
  'whatever guard it needs.'
