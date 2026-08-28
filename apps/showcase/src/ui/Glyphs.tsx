import type React from 'react'
import { StyleSheet, Text } from 'react-native'
import Svg, { Path } from 'react-native-svg'

const GLYPH_SIZE = 22
const STROKE_WIDTH = 1.6

const CHEVRON_SIZE = 18

// widened, since the chevron draws smaller than the other glyphs
const CHEVRON_STROKE_WIDTH = 1.8

/** Carries the colour a glyph draws itself in, which the control hosting it decides. */
export type GlyphProps = { color: string }

/** Draws the pen that arms drawing on the map. */
export function PenGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
      <Path
        d="M4 20l1.2-4.2L15.6 5.4a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8.2 18.8 4 20z"
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinejoin="round"
      />
      <Path d="M14.2 6.8l3 3" fill="none" stroke={color} strokeWidth={STROKE_WIDTH} />
    </Svg>
  )
}

/** Draws the bin that empties the screen it sits on. */
export function ClearGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
      <Path
        d="M5 7h14M10 7V5.4h4V7m-7 0l.9 12.2h8.2L17 7"
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Draws the plus that steps the map one zoom level closer. */
export function PlusGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
      <Path
        d="M12 5.5v13M5.5 12h13"
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Draws the minus that steps the map one zoom level away. */
export function MinusGlyph({ color }: GlyphProps): React.JSX.Element {
  return (
    <Svg width={GLYPH_SIZE} height={GLYPH_SIZE} viewBox="0 0 24 24">
      <Path
        d="M5.5 12h13"
        fill="none"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/** Draws the question mark that opens a screen's help sheet. */
export function HelpGlyph({ color }: GlyphProps): React.JSX.Element {
  return <Text style={[styles.help, { color }]}>?</Text>
}

/** Draws the chevron that says which way the strip beside it will move. */
export function ChevronGlyph({
  color,
  direction,
}: GlyphProps & { direction: 'up' | 'down' }): React.JSX.Element {
  return (
    <Svg width={CHEVRON_SIZE} height={CHEVRON_SIZE} viewBox="0 0 24 24">
      <Path
        d={direction === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}
        fill="none"
        stroke={color}
        strokeWidth={CHEVRON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

const styles = StyleSheet.create({
  help: { fontSize: 17, fontWeight: '600', lineHeight: GLYPH_SIZE },
})
