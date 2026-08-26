import React from 'react'
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native'
import { gridDisk, H3Error, latLngToCell } from 'react-native-h3'

const SAN_FRANCISCO = { lat: 37.7749, lng: -122.4194 }
// Resolution 1 pentagon, from h3-js getPentagons(1)[0].
const PENTAGON = 0x81083ffffffffffn

function useResults(): string[] {
  return React.useMemo(() => {
    const lines: string[] = []
    const cell = latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 9)
    lines.push(`latLngToCell: ${cell.toString(16)}`)
    lines.push('  expected:   89283082803ffff')

    const disk = gridDisk(cell, 1)
    lines.push(`gridDisk(k=1): ${disk.length} cells, expected 7`)
    lines.push(`  is a view:   ${disk instanceof BigUint64Array}`)

    const pentagonDisk = gridDisk(PENTAGON, 1)
    lines.push(`pentagon gridDisk(k=1): ${pentagonDisk.length} cells, expected 6 of 7 slots`)

    try {
      latLngToCell(SAN_FRANCISCO.lat, SAN_FRANCISCO.lng, 99)
      lines.push('error path: FAILED, no throw')
    } catch (error) {
      const isH3Error = error instanceof H3Error
      lines.push(`error path: ${isH3Error ? 'H3Error' : 'wrong type'}`)
      lines.push(`  message:  ${(error as Error).message}`)
      // The boundary check in `toResolution` rejects 99 before H3 sees it, so this is our
      // wording, not `describeH3Error(E_RES_DOMAIN)`.
      lines.push('  expected: Resolution must be an integer between 0 and 15')
    }
    return lines
  }, [])
}

export default function App(): React.JSX.Element {
  const results = useResults()
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>react-native-h3</Text>
        <View style={styles.results}>
          {results.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 16 },
  results: { gap: 4 },
  line: { fontFamily: 'Courier', fontSize: 13 },
})
