import {
  Camera,
  type CameraRef,
  type InitialViewState,
  Map as MapLibreMap,
  type MapProps,
  type MapRef,
} from '@maplibre/maplibre-react-native'
import type React from 'react'
import { screenStyles, space } from './theme'

// a near-neutral style, so cell colours and the labels under them both stay readable
const STYLE = 'https://tiles.openfreemap.org/styles/positron'

const ATTRIBUTION_POSITION = { top: space.sm, right: space.sm }

type BasemapProps = {
  mapRef?: React.Ref<MapRef>
  cameraRef?: React.Ref<CameraRef>
  initialViewState: InitialViewState
  gestures?: boolean
  onRegionDidChange?: MapProps['onRegionDidChange']
  onLongPress?: MapProps['onLongPress']
  children?: React.ReactNode
}

/** Renders the map every screen sits on. */
export function Basemap({
  mapRef,
  cameraRef,
  initialViewState,
  gestures = true,
  onRegionDidChange,
  onLongPress,
  children,
}: BasemapProps): React.JSX.Element {
  return (
    <MapLibreMap
      ref={mapRef}
      style={screenStyles.map}
      mapStyle={STYLE}
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
    >
      <Camera ref={cameraRef} initialViewState={initialViewState} />
      {children}
    </MapLibreMap>
  )
}
