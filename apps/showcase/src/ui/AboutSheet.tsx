import type React from 'react'
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_LICENCE_URL,
  BOUNDARY_ATTRIBUTION,
  H3_VERSION,
  PACKAGE_VERSION,
  REPOSITORY_URL,
} from '../lib/about'
import { CEILING_NOTE, CEILING_VALUE } from '../lib/ceiling'
import { Sheet } from './Sheet'
import { colors, space } from './theme'

const BEYOND_THE_MAP =
  'The four heaviest calls have async variants that run on a native thread pool, and the ' +
  'single-cell calls return in well under a microsecond each. Nothing here needs a map: the same ' +
  'grid indexes, joins and membership tests run on data that is never drawn.'

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  )
}

/** Shows the versions, the cell ceiling and the map attribution the licence requires. */
export function AboutSheet({
  visible,
  onClose,
}: {
  visible: boolean
  onClose: () => void
}): React.JSX.Element {
  return (
    <Sheet title="react-native-h3" visible={visible} onClose={onClose}>
      <Row label="Package" value={PACKAGE_VERSION} />
      <Row label="Bundled H3" value={H3_VERSION} />
      <Row label="Cell ceiling" value={CEILING_VALUE} />
      <Text style={styles.footnote}>{CEILING_NOTE}</Text>
      <Pressable onPress={() => void Linking.openURL(REPOSITORY_URL)}>
        <Text style={styles.link}>{REPOSITORY_URL}</Text>
      </Pressable>
      <Text style={styles.heading}>Beyond the map</Text>
      <Text style={styles.paragraph}>{BEYOND_THE_MAP}</Text>
      <Text style={styles.attribution}>{BASEMAP_ATTRIBUTION}</Text>
      <Pressable onPress={() => void Linking.openURL(BASEMAP_LICENCE_URL)}>
        <Text style={styles.link}>{BASEMAP_LICENCE_URL}</Text>
      </Pressable>
      <Text style={styles.attribution}>{BOUNDARY_ATTRIBUTION}</Text>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  label: { color: colors.muted, fontSize: 13 },
  value: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
  footnote: { color: colors.muted, fontSize: 12 },
  link: { color: colors.accent, fontSize: 13 },
  heading: { color: colors.ink, fontSize: 13, fontWeight: '600', marginTop: space.sm },
  paragraph: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  attribution: { color: colors.muted, fontSize: 12, marginTop: space.sm },
})
