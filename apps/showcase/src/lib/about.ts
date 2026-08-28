import { version } from 'react-native-h3/package.json'

/** Reports the version of the package this app demonstrates, read from its manifest. */
export const PACKAGE_VERSION: string = version

/** Names the version of the H3 C library vendored into the package. Pinned by `about.test.ts`. */
export const H3_VERSION = '4.5.0'

/** Caps how many cells one call may allocate. Pinned by `about.test.ts`. */
export const DEFAULT_MAX_CELL_COUNT = 4000000

export const REPOSITORY_URL = 'https://github.com/vgorte/react-native-h3'

export const BASEMAP_ATTRIBUTION = '© GeoBasis-DE / BKG (2026) CC BY 4.0'

export const BASEMAP_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'

/** Credits the administrative boundary the Geofence screen ships, as its licence requires. */
export const BOUNDARY_ATTRIBUTION =
  '© BKG 2026 dl-de/by-2-0, Datenquellen: ' +
  'https://sgx.geodatenzentrum.de/web_public/gdz/datenquellen/datenquellen_vg_nuts.pdf'
