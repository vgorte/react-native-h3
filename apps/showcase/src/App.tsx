import React from 'react'
import { StatusBar, StyleSheet, View } from 'react-native'
import { configure } from 'react-native-h3'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { CELL_CEILING } from './lib/ceiling'
import { CoverageScreen } from './screens/CoverageScreen'
import { GeofenceScreen } from './screens/GeofenceScreen'
import { HeatmapScreen } from './screens/HeatmapScreen'
import { AboutSheet } from './ui/AboutSheet'
import { IntroProvider } from './ui/IntroStrip'
import { TabBar, type TabId } from './ui/TabBar'
import { ToastProvider } from './ui/Toast'
import { colors } from './ui/theme'

// the app owns the guard, and it precedes any call
configure({ maxCellCount: CELL_CEILING })

export default function App(): React.JSX.Element {
  const [tab, setTab] = React.useState<TabId>('geofence')
  const [about, setAbout] = React.useState(false)
  const openAbout = React.useCallback(() => setAbout(true), [])

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        {/* the app is dark on every device, so the status bar cannot follow the system */}
        <StatusBar barStyle="light-content" />
        <ToastProvider>
          <IntroProvider>
            <View style={styles.body}>
              {tab === 'geofence' ? <GeofenceScreen onPressMark={openAbout} /> : null}
              {tab === 'heatmap' ? <HeatmapScreen onPressMark={openAbout} /> : null}
              {tab === 'coverage' ? <CoverageScreen onPressMark={openAbout} /> : null}
            </View>
            <TabBar active={tab} onChange={setTab} />
          </IntroProvider>
          <AboutSheet visible={about} onClose={() => setAbout(false)} />
        </ToastProvider>
      </SafeAreaView>
    </SafeAreaProvider>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.paper },
  body: { flex: 1 },
})
