import type { PixelPoint } from '@maplibre/maplibre-react-native'
import React from 'react'
import { PanResponder, StyleSheet, View } from 'react-native'
import Svg, { Polyline } from 'react-native-svg'
import { colors } from './theme'

// the width the live stroke is drawn at, thick enough to follow a finger
const STROKE_WIDTH = 3

const MIN_MOVE_PX = 8

/**
 * Traces a stroke over the map and hands its points on when the finger lifts.
 *
 * The canvas takes every touch the map would otherwise get, and it keeps the stroke on screen until
 * `onComplete` settles, so the fill that replaces it is already under way.
 */
export function DrawCanvas({
  onStart,
  onComplete,
}: {
  onStart: () => void
  onComplete: (points: PixelPoint[]) => Promise<void>
}): React.JSX.Element {
  const stroke = React.useRef<PixelPoint[]>([])
  const [trace, setTrace] = React.useState<PixelPoint[]>([])

  const complete = React.useCallback(() => {
    const points = stroke.current
    stroke.current = []
    void onComplete(points).finally(() => setTrace([]))
  }, [onComplete])

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          stroke.current = [[event.nativeEvent.locationX, event.nativeEvent.locationY]]
          setTrace(stroke.current)
          onStart()
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent
          const last = stroke.current[stroke.current.length - 1]
          // sampling every touch would send hundreds of points to `unproject`
          if (Math.hypot(locationX - last[0], locationY - last[1]) >= MIN_MOVE_PX) {
            // a fresh array is what tells the overlay to redraw, so the ref is replaced, not pushed
            stroke.current = [...stroke.current, [locationX, locationY]]
            setTrace(stroke.current)
          }
        },
        onPanResponderRelease: complete,
        onPanResponderTerminate: complete,
      }),
    [complete, onStart],
  )

  const points = React.useMemo(
    () => trace.map((point) => `${point[0]},${point[1]}`).join(' '),
    [trace],
  )

  return (
    <View style={styles.canvas} {...responder.panHandlers}>
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Polyline
          points={points}
          fill="none"
          stroke={colors.accent}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: StyleSheet.absoluteFill,
})
