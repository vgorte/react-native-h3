import type React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, space } from './theme'

/** Names the screens the tab bar switches between. */
export type TabId = 'geofence' | 'heatmap' | 'coverage'

export const TABS: readonly { id: TabId; label: string }[] = [
  { id: 'geofence', label: 'Geofence' },
  { id: 'heatmap', label: 'Heatmap' },
  { id: 'coverage', label: 'Coverage' },
]

/** Renders the bottom tabs. There are no nested screens, so this is the whole navigation. */
export function TabBar({
  active,
  onChange,
}: {
  active: TabId
  onChange: (id: TabId) => void
}): React.JSX.Element {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.id}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: tab.id === active }}
          style={styles.tab}
          onPress={() => onChange(tab.id)}
        >
          <Text style={tab.id === active ? styles.labelActive : styles.label}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space.md },
  label: { color: colors.muted, fontSize: 13 },
  labelActive: { color: colors.accent, fontSize: 13, fontWeight: '700' },
})
