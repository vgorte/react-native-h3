import React from 'react'
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  type LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, controlPaddingVertical, radius, space } from './theme'

const ADJUST_ACTIONS: AccessibilityActionInfo[] = [{ name: 'increment' }, { name: 'decrement' }]

/** Wraps the row of controls that sits between the map and the tab bar. */
export function ControlStrip({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <View style={styles.strip}>{children}</View>
}

/** Renders an exclusive choice between short labels. */
export function Segmented<T extends string>({
  options,
  value,
  disabled,
  onChange,
}: {
  options: readonly T[]
  value: T
  disabled?: readonly T[]
  onChange: (value: T) => void
}): React.JSX.Element {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const isDisabled = disabled?.includes(option) ?? false
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected: option === value, disabled: isDisabled }}
            disabled={isDisabled}
            style={[styles.segment, option === value && styles.segmentActive]}
            onPress={() => onChange(option)}
          >
            <Text
              style={[
                styles.segmentLabel,
                option === value && styles.segmentLabelActive,
                isDisabled && styles.segmentLabelDisabled,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** Renders an integer slider; every value this app picks is a resolution or a `k`. */
export function StepSlider({
  label,
  min,
  max,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}): React.JSX.Element {
  const width = React.useRef(1)

  const emit = React.useCallback(
    (x: number) => {
      const fraction = Math.min(1, Math.max(0, x / width.current))
      const step = min + Math.round(fraction * (max - min))
      // a drag delivers dozens of touches per step
      if (step !== value) onChange(step)
    },
    [min, max, onChange, value],
  )

  const responder = React.useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => emit(event.nativeEvent.locationX),
        onPanResponderMove: (event) => emit(event.nativeEvent.locationX),
      }),
    [emit],
  )

  const onLayout = (event: LayoutChangeEvent): void => {
    width.current = Math.max(1, event.nativeEvent.layout.width)
  }

  const adjust = (event: AccessibilityActionEvent): void => {
    const step = event.nativeEvent.actionName === 'increment' ? 1 : -1
    onChange(Math.min(max, Math.max(min, value + step)))
  }

  const fraction = max === min ? 0 : (value - min) / (max - min)
  return (
    <View style={styles.slider}>
      <Text style={styles.sliderLabel}>
        {label} {value}
      </Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min, max, now: value }}
        accessibilityActions={ADJUST_ACTIONS}
        onAccessibilityAction={adjust}
        style={styles.track}
        onLayout={onLayout}
        {...responder.panHandlers}
      >
        {/* the track stays the only touch target, so `locationX` is relative to it */}
        <View pointerEvents="none" style={[styles.fill, { width: `${fraction * 100}%` }]} />
        <View pointerEvents="none" style={[styles.knob, { left: `${fraction * 100}%` }]} />
      </View>
    </View>
  )
}

/** Renders a single command, the one control of the strip that carries a whole phrase. */
export function ActionButton({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}): React.JSX.Element {
  return (
    <Pressable accessibilityRole="button" style={styles.button} onPress={onPress}>
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    // the same margin the HUD card floats at, so the two read as one column
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  segmented: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.sm },
  segment: {
    paddingHorizontal: space.md,
    paddingVertical: controlPaddingVertical,
    borderRadius: radius.sm,
  },
  segmentActive: { backgroundColor: colors.line },
  segmentLabel: { color: colors.muted, fontSize: 13 },
  segmentLabelActive: { color: colors.ink, fontWeight: '600' },
  segmentLabelDisabled: { color: colors.line },
  slider: { flexGrow: 1, minWidth: 150, gap: space.xs },
  sliderLabel: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 24, justifyContent: 'center' },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.accent },
  knob: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: colors.ink,
  },
  button: {
    paddingHorizontal: space.md,
    paddingVertical: controlPaddingVertical,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  buttonLabel: { color: colors.ink, fontSize: 13 },
})
