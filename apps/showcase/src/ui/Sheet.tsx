import type React from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, space } from './theme'

/** Frames a sheet that slides over the screen: a title, the body it is given and a Close button. */
export function Sheet({
  title,
  visible,
  onClose,
  children,
}: {
  title: string
  visible: boolean
  onClose: () => void
  children: React.ReactNode
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Close ${title}`}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View style={[styles.sheet, { paddingBottom: space.lg + insets.bottom }]}>
        <Text style={styles.title}>{title}</Text>
        {/* the body scrolls, so the title and the button below it survive any length */}
        <ScrollView
          contentContainerStyle={styles.body}
          // a clipped sheet has no other cue that more follows, so the bar stays visible
          showsVerticalScrollIndicator
          persistentScrollbar
        >
          {children}
        </ScrollView>
        <Pressable accessibilityRole="button" style={styles.close} onPress={onClose}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.scrim },
  sheet: {
    maxHeight: '80%',
    padding: space.lg,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700', marginBottom: space.xs },
  body: { gap: space.sm },
  close: { alignSelf: 'flex-end', paddingVertical: space.sm, paddingHorizontal: space.md },
  closeLabel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
})
