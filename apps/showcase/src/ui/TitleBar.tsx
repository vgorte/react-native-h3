import type React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { LogoMark } from './LogoMark'
import { colors, space } from './theme'

/** Renders the bar every screen wears: the mark opens the about sheet, resolution on the right. */
export function TitleBar({
  title,
  resolution,
  onPressMark,
}: {
  title: string
  resolution: number
  onPressMark: () => void
}): React.JSX.Element {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="About this app"
        hitSlop={8}
        onPress={onPressMark}
      >
        <LogoMark />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.resolution}>res {resolution}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.paper,
  },
  title: { flex: 1, color: colors.ink, fontSize: 17, fontWeight: '600' },
  resolution: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
})
