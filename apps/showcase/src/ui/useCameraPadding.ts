import React from 'react'
import type { LayoutChangeEvent } from 'react-native'
import { type CameraPadding, cameraPadding } from './theme'

/** Holds the padding a camera fit needs and the two layout handlers it is measured from. */
export type MeasuredCamera = {
  measured: boolean
  padding: CameraPadding
  onMapLayout: (event: LayoutChangeEvent) => void
  onCardLayout: (height: number) => void
}

/**
 * Measures the map and the HUD card over it, and insets a camera fit by what they turn out to be.
 *
 * Both heights follow the display scale, so a screen holds its map back until `measured` rather
 * than framing against an assumed card. Only the first of each is kept, since a collapsing intro
 * strip must not restate a frame the visitor is already looking at.
 */
export function useCameraPadding(): MeasuredCamera {
  const [mapHeight, setMapHeight] = React.useState(0)
  const [cardHeight, setCardHeight] = React.useState(0)

  const onMapLayout = React.useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout
    setMapHeight((current) => (current === 0 ? height : current))
  }, [])

  const onCardLayout = React.useCallback((height: number) => {
    setCardHeight((current) => (current === 0 ? height : current))
  }, [])

  const padding = React.useMemo(() => cameraPadding(mapHeight, cardHeight), [cardHeight, mapHeight])

  return { measured: mapHeight > 0 && cardHeight > 0, padding, onMapLayout, onCardLayout }
}
