import type { CameraRef, MapRef } from '@maplibre/maplibre-react-native'
import React from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import { steppedZoom } from '../lib/zoom'
import { type GlyphProps, MinusGlyph, PlusGlyph } from './Glyphs'
import { colors, controlSize, radius, space } from './theme'

// long enough to read as a move between two zoom levels, short enough to feel like a button
const ZOOM_DURATION_MS = 250

/** Stacks the floating controls of a screen in the thumb's arc, bottom-most reached first. */
export function ThumbStack({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.stack}>{children}</View>
}

/** Picks the colour a control's glyph is drawn in, since only the background is a style. */
function glyphColor(active: boolean, disabled: boolean): string {
  if (disabled) return colors.muted
  // the light accent cannot carry white, so armed controls use paper
  return active ? colors.paper : colors.ink
}

/** Renders one floating map control, filled with the accent colour while its mode is armed. */
export function MapControl({
  label,
  glyph: Glyph,
  active = false,
  disabled = false,
  onPress,
}: {
  label: string
  glyph: React.ComponentType<GlyphProps>
  active?: boolean
  disabled?: boolean
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      style={[styles.control, styles.surface, active && styles.controlActive]}
      onPress={onPress}
    >
      <Glyph color={glyphColor(active, disabled)} />
    </Pressable>
  )
}

/** Renders the paired zoom controls, each press one whole level from the last one asked for. */
export function ZoomControls({
  map,
  camera,
}: {
  map: React.RefObject<MapRef | null>
  camera: React.RefObject<CameraRef | null>
}): React.JSX.Element {
  const requested = React.useRef<number | null>(null)
  const settle = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (settle.current != null) clearTimeout(settle.current)
    }
  }, [])

  const step = React.useCallback(
    (levels: number) => {
      void (async () => {
        // mid-animation `getZoom` reports an interpolated level, which two quick presses would halve
        const from = requested.current ?? (await map.current?.getZoom())
        if (from == null) return
        const next = steppedZoom(from, levels)
        // a press at either end of the range asks for the zoom the map already stands at
        if (next === from) return
        requested.current = next
        if (settle.current != null) clearTimeout(settle.current)
        settle.current = setTimeout(() => {
          requested.current = null
        }, ZOOM_DURATION_MS)
        camera.current?.zoomTo(next, { duration: ZOOM_DURATION_MS })
      })()
    },
    [camera, map],
  )

  return (
    <View
      // the two buttons are the elements; the surface they share must not repeat their labels
      accessible={false}
      importantForAccessibility="no"
      style={[styles.pair, styles.surface]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom in"
        style={styles.control}
        onPress={() => step(1)}
      >
        <PlusGlyph color={colors.ink} />
      </Pressable>
      <View style={styles.pairRule} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zoom out"
        style={styles.control}
        onPress={() => step(-1)}
      >
        <MinusGlyph color={colors.ink} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  surface: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  control: {
    width: controlSize,
    height: controlSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  // the two zoom steps read as one control, so they share a surface and a rule
  pair: { overflow: 'hidden' },
  pairRule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
})
