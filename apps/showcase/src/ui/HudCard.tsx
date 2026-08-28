import type React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, space } from './theme'

/** Names the side that paid for a figure: a call into the package, or this app's own JavaScript. */
export type HudSide = 'h3' | 'app'

/** Holds one measured figure of the last operation, filed under the side that produced it. */
export type HudRow = { label: string; value: string; side: HudSide }

/** Holds the two totals the split bar compares, in milliseconds. */
export type HudSplit = { h3Ms: number; appMs: number }

/** Holds everything the card draws, which is what a screen hands to its stage. */
export type HudProps = {
  rows: HudRow[]
  split?: HudSplit
  note?: string
}

/**
 * Splits a measured operation into the calls into the package and this app's own building.
 *
 * @param h3Ms Every call the package answered, where a step a screen skipped is `null`.
 * @param appMs The JavaScript that turned the result into map data.
 */
export function hudSplit(h3Ms: readonly (number | null)[], appMs: number): HudSplit {
  return { h3Ms: h3Ms.reduce<number>((sum, ms) => sum + (ms ?? 0), 0), appMs }
}

const HEADS: Record<HudSide, { title: string; color: string }> = {
  h3: { title: 'H3, native', color: colors.accent },
  app: { title: 'App, JS', color: colors.appTone },
}

function Column({ side, rows }: { side: HudSide; rows: HudRow[] }): React.JSX.Element {
  const head = HEADS[side]
  return (
    <View style={styles.column}>
      <View style={styles.head}>
        <View style={[styles.dot, { backgroundColor: head.color }]} />
        <Text style={styles.headLabel}>{head.title}</Text>
      </View>
      {rows.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </View>
  )
}

/** Draws what share of the measured time each side took, without naming a total the app cannot see. */
function SplitBar({ split }: { split: HudSplit }): React.JSX.Element | null {
  const total = split.h3Ms + split.appMs
  if (total <= 0) return null
  const share = (split.h3Ms / total) * 100
  return (
    <View
      accessible
      accessibilityLabel={`${Math.round(share)}% of the measured time in H3`}
      style={styles.split}
    >
      <View style={[styles.splitH3, { width: `${share}%` }]} />
      <View style={styles.splitApp} />
    </View>
  )
}

/**
 * Renders the card that floats over the map's bottom edge with the last measured numbers.
 *
 * The two columns are the whole point: a reader must never have to know which label belongs to the
 * package and which to the app.
 */
export function HudCard({
  rows,
  split,
  note,
  onHeight,
}: HudProps & { onHeight?: (height: number) => void }): React.JSX.Element {
  return (
    <View
      style={styles.card}
      pointerEvents="none"
      onLayout={(event) => onHeight?.(event.nativeEvent.layout.height)}
    >
      <View style={styles.columns}>
        <Column side="h3" rows={rows.filter((row) => row.side === 'h3')} />
        <View style={styles.rule} />
        <Column side="app" rows={rows.filter((row) => row.side === 'app')} />
      </View>
      {split == null ? null : <SplitBar split={split} />}
      {note == null ? null : <Text style={styles.note}>{note}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    backgroundColor: colors.veil,
    gap: space.sm,
  },
  columns: { flexDirection: 'row', alignItems: 'stretch', gap: space.md },
  // a fixed half each, so no number moving between widths reflows the other column
  column: { flex: 1, gap: space.xs },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 2 },
  headLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  label: {
    flexShrink: 1,
    color: colors.muted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { flexShrink: 1, color: colors.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden' },
  splitH3: { backgroundColor: colors.accent },
  splitApp: { flex: 1, backgroundColor: colors.appTone },
  note: { color: colors.accent, fontSize: 12 },
})
