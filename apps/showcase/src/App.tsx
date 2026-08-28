import { Camera, Map as MapLibreMap } from '@maplibre/maplibre-react-native'
import type React from 'react'
import { StatusBar, StyleSheet, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'

const BASEMAP_STYLE = 'https://sgx.geodatenzentrum.de/gdz_basemapde_vektor/styles/bm_web_col.json'
const GERMANY: [number, number] = [10.45, 51.16]

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* the app is dark on every device, so the status bar cannot follow the system */}
        <StatusBar barStyle="light-content" />
        <View style={styles.titleBar}>
          <Text style={styles.title}>H3 Showcase</Text>
        </View>
        <MapLibreMap
          style={styles.map}
          mapStyle={BASEMAP_STYLE}
          attribution
          attributionPosition={{ bottom: 8, right: 8 }}
          logo={false}
        >
          <Camera initialViewState={{ center: GERMANY, zoom: 5.2 }} />
        </MapLibreMap>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101418' },
  titleBar: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { color: '#f2f5f7', fontSize: 17, fontWeight: '600' },
  map: { flex: 1 },
})
