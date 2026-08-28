import { StyleSheet } from 'react-native'

export const colors = {
  // `paper` is also the launch screen's ground, and `ink` the mark's only colour
  paper: '#101418',
  surface: '#1a2029',
  line: '#2a3440',
  ink: '#f2f5f7',
  muted: '#9fb0c0',
  accent: '#61dafb',
  danger: '#e5484d',
  onAccent: '#ffffff',
  // `veil` floats a card over the map, `scrim` dims what a sheet covers
  veil: 'rgba(16, 20, 24, 0.88)',
  scrim: 'rgba(0, 0, 0, 0.5)',
  // the map shows through a veiled card, where `line` disappears
  rule: '#3f4c5a',
  // marks the app's side of the HUD, where `muted` reads as a label rather than as a colour
  appTone: '#dbe4ec',
  zoneA: '#3b82f6',
  zoneB: '#f59e0b',
  zoneC: '#10b981',
  shared: '#e879f9',
} as const

export const space = { xs: 4, sm: 8, md: 12, lg: 16 } as const

export const radius = { sm: 6, md: 10, lg: 14 } as const

/** Sets the height of the compact pills: segments and buttons. */
export const controlPaddingVertical = 6

/** Sets the edge of a floating map control, the smallest square a thumb hits reliably. */
export const controlSize = 44

// the largest share of the map height a fit may give up to clearance
const MAX_CLEARANCE_SHARE = 1 / 3

/** Holds the insets a camera fit keeps free, in the shape MapLibre reads them. */
export type CameraPadding = { top: number; right: number; bottom: number; left: number }

/**
 * Insets a camera fit, so what it frames clears the screen edges and the HUD card below it.
 *
 * The card's height follows the display scale and the rows it carries, so a fit reserves what the
 * card measured rather than a fixed figure, and never more than a third of the map.
 *
 * @param mapHeight The measured height of the map.
 * @param cardHeight The measured height of the HUD card floating over its bottom edge.
 */
export function cameraPadding(mapHeight: number, cardHeight: number): CameraPadding {
  // the card sits `space.md` above the map's bottom edge, and `space.sm` keeps a fit off its top
  const clearance = cardHeight + space.md + space.sm
  return {
    top: space.lg,
    right: space.lg,
    bottom: Math.min(clearance, Math.round(mapHeight * MAX_CLEARANCE_SHARE)),
    left: space.lg,
  }
}

/** Frames a screen: a column whose map fills whatever the title bar and control strip leave. */
export const screenStyles = StyleSheet.create({
  screen: { flex: 1 },
  map: { flex: 1 },
  // the margin the control strip pads by, so both surfaces share one left and right edge
  overlay: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    alignItems: 'flex-end',
    gap: space.sm,
  },
})
