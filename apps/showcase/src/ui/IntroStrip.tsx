import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ChevronGlyph } from './Glyphs'
import type { TabId } from './TabBar'
import { colors, space } from './theme'

const HEADING = 'What this shows'

const IntroContext = React.createContext<{
  collapsed: ReadonlySet<TabId>
  toggle: (id: TabId) => void
}>({ collapsed: new Set(), toggle: () => undefined })

/**
 * Remembers which screens have had their intro strip collapsed.
 *
 * A screen unmounts when its tab is left, so the flag cannot live inside it. It is deliberately
 * not persisted: every launch is somebody's first look at the app.
 */
export function IntroProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<TabId>>(() => new Set<TabId>())

  const toggle = React.useCallback((id: TabId) => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  const value = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle])

  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>
}

/** Renders the strip under the title bar that says what the screen below it demonstrates. */
export function IntroStrip({
  id,
  shows,
  usedFor,
}: {
  id: TabId
  shows: string
  usedFor: string
}): React.JSX.Element {
  const { collapsed, toggle } = React.useContext(IntroContext)
  const open = !collapsed.has(id)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={HEADING}
      accessibilityState={{ expanded: open }}
      style={[styles.strip, open ? styles.stripOpen : styles.stripClosed]}
      onPress={() => toggle(id)}
    >
      <View style={styles.text}>
        <Text style={styles.heading}>{HEADING}</Text>
        {open ? <Text style={styles.shows}>{shows}</Text> : null}
        {open ? <Text style={styles.usedFor}>Used for: {usedFor}</Text> : null}
      </View>
      <ChevronGlyph color={colors.muted} direction={open ? 'up' : 'down'} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.accent,
    backgroundColor: colors.surface,
  },
  stripOpen: { alignItems: 'flex-start', paddingVertical: space.sm },
  stripClosed: { alignItems: 'center', paddingVertical: space.xs },
  text: { flex: 1, gap: space.xs },
  heading: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  shows: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  usedFor: { color: colors.muted, fontSize: 12, lineHeight: 17 },
})
