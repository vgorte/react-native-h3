import type { CameraRef, InitialViewState, MapProps, MapRef } from '@maplibre/maplibre-react-native'
import type React from 'react'
import { View } from 'react-native'
import { Basemap } from './Basemap'
import { HelpGlyph } from './Glyphs'
import { HudCard, type HudProps } from './HudCard'
import { MapControl, ThumbStack, ZoomControls } from './MapControls'
import { screenStyles } from './theme'
import type { MeasuredCamera } from './useCameraPadding'

/**
 * Frames the map every screen is built on: the basemap, the floating controls and the HUD card.
 *
 * Sources and layers arrive as children, so a screen can hold them as module constants that
 * `GeoJSONSource`'s memo never has to restringify.
 */
export function MapStage({
  stage,
  map,
  camera,
  initialViewState,
  gestures,
  onRegionDidChange,
  onLongPress,
  onHelp,
  controls,
  overlay,
  hud,
  children,
}: {
  stage: MeasuredCamera
  map: React.RefObject<MapRef | null>
  camera: React.RefObject<CameraRef | null>
  initialViewState: InitialViewState
  gestures?: boolean
  onRegionDidChange?: MapProps['onRegionDidChange']
  onLongPress?: MapProps['onLongPress']
  onHelp: () => void
  controls?: React.ReactNode
  overlay?: React.ReactNode
  hud: HudProps
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <View style={screenStyles.map} onLayout={stage.onMapLayout}>
      {/* the opening frame needs the heights its clearance is measured from */}
      {stage.measured ? (
        <Basemap
          mapRef={map}
          cameraRef={camera}
          initialViewState={initialViewState}
          gestures={gestures}
          onRegionDidChange={onRegionDidChange}
          onLongPress={onLongPress}
        >
          {children}
        </Basemap>
      ) : null}
      {overlay}
      <View style={screenStyles.overlay} pointerEvents="box-none">
        <ThumbStack>
          <ZoomControls map={map} camera={camera} />
          <MapControl label="Help" glyph={HelpGlyph} onPress={onHelp} />
          {controls}
        </ThumbStack>
        <HudCard {...hud} onHeight={stage.onCardLayout} />
      </View>
    </View>
  )
}
