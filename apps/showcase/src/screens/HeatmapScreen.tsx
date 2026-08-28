import type React from 'react'
import { View } from 'react-native'
import { Basemap } from '../ui/Basemap'
import { HudCard } from '../ui/HudCard'
import { TitleBar } from '../ui/TitleBar'
import { screenStyles } from '../ui/theme'

const GERMANY: [number, number] = [10.45, 51.16]

export function HeatmapScreen({ onPressMark }: { onPressMark: () => void }): React.JSX.Element {
  return (
    <View style={screenStyles.screen}>
      <TitleBar title="Heatmap" resolution={6} onPressMark={onPressMark} />
      <View style={screenStyles.map}>
        <Basemap initialViewState={{ center: GERMANY, zoom: 6 }} />
        <HudCard rows={[{ label: 'cells', value: '0' }]} />
      </View>
    </View>
  )
}
