import type React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Sheet } from './Sheet'
import { colors, space } from './theme'

/** Holds one term a screen uses beside the sentence that explains it. */
export type HelpEntry = { term: string; text: string }

/** Explains the controls, the views and the measured numbers of one screen. */
export function HelpSheet({
  title,
  entries,
  visible,
  onClose,
}: {
  title: string
  entries: readonly HelpEntry[]
  visible: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <Sheet title={title} visible={visible} onClose={onClose}>
      <View style={styles.list}>
        {entries.map((entry) => (
          <View key={entry.term}>
            <Text style={styles.term}>{entry.term}</Text>
            <Text style={styles.text}>{entry.text}</Text>
          </View>
        ))}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  term: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  text: { color: colors.ink, fontSize: 13, lineHeight: 19, marginTop: 2 },
})
