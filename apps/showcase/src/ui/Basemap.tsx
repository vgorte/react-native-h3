import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Layer,
  Map as MapLibreMap,
  type MapProps,
  type MapRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native'
import React from 'react'
import { RASTER_ATTRIBUTION } from '../lib/about'
import { colors, screenStyles, space } from './theme'

const VECTOR_STYLE = 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json'

const RASTER_TILES =
  'https://sgx.geodatenzentrum.de/wmts_topplus_open/tile/1.0.0/web/default/' +
  'WEBMERCATOR/{z}/{y}/{x}.png'

const ATTRIBUTION_POSITION = { top: space.sm, right: space.sm }

const RASTER_LAYER = 'topplus'

// the fallback keeps cells drawing when the vector style fails
const RASTER_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    topplus: {
      type: 'raster',
      tiles: [RASTER_TILES],
      tileSize: 256,
      attribution: RASTER_ATTRIBUTION,
    },
  },
  layers: [{ id: RASTER_LAYER, type: 'raster', source: 'topplus' }],
}

type StyleArm = 'vector' | 'raster'

// both styles end at the German border, and `Hintergrund` is the lowest layer of the vector one
const GROUND_BELOW: Record<StyleArm, string> = { vector: 'Hintergrund', raster: RASTER_LAYER }

type BasemapProps = {
  mapRef?: React.Ref<MapRef>
  cameraRef?: React.Ref<CameraRef>
  initialViewState: InitialViewState
  gestures?: boolean
  onRegionDidChange?: MapProps['onRegionDidChange']
  onLongPress?: MapProps['onLongPress']
  children?: React.ReactNode
}

/** Renders the map every screen sits on, falling back to raster tiles when the style fails. */
export function Basemap({
  mapRef,
  cameraRef,
  initialViewState,
  gestures = true,
  onRegionDidChange,
  onLongPress,
  children,
}: BasemapProps): React.JSX.Element {
  const [arm, setArm] = React.useState<StyleArm>('vector')

  const onFailed = React.useCallback(() => setArm('raster'), [])

  return (
    <MapLibreMap
      ref={mapRef}
      style={screenStyles.map}
      mapStyle={arm === 'vector' ? VECTOR_STYLE : RASTER_STYLE}
      attribution
      attributionPosition={ATTRIBUTION_POSITION}
      logo={false}
      compass={false}
      dragPan={gestures}
      touchZoom={gestures}
      doubleTapZoom={gestures}
      doubleTapHoldZoom={gestures}
      touchRotate={gestures}
      touchPitch={gestures}
      onRegionDidChange={onRegionDidChange}
      onLongPress={onLongPress}
      onDidFailLoadingMap={onFailed}
    >
      <Layer
        id="basemap-ground"
        type="background"
        beforeId={GROUND_BELOW[arm]}
        paint={{ 'background-color': colors.paper }}
      />
      <Camera ref={cameraRef} initialViewState={initialViewState} />
      {children}
    </MapLibreMap>
  )
}
