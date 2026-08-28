import type React from 'react'
import { View } from 'react-native'
import { Basemap } from '../ui/Basemap'
import { HudCard } from '../ui/HudCard'
import { TitleBar } from '../ui/TitleBar'
import { screenStyles } from '../ui/theme'

const BERLIN: [number, number] = [13.405, 52.52]

export function CoverageScreen({ onPressMark }: { onPressMark: () => void }): React.JSX.Element {
  return (
    <View style={screenStyles.screen}>
      <TitleBar title="Coverage" resolution={9} onPressMark={onPressMark} />
      <View style={screenStyles.map}>
        <Basemap initialViewState={{ center: BERLIN, zoom: 10 }} />
        <HudCard rows={[{ label: 'cells', value: '0' }]} />
      </View>
    </View>
  )
}
