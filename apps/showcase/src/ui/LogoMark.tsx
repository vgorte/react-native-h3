import type React from 'react'
import { StyleSheet, View } from 'react-native'
import { colors } from './theme'

const CELL = 6
const GAP = 1
const OFFSETS: [number, number][] = [
  [0, 0],
  [0, -(CELL + GAP)],
  [0, CELL + GAP],
  [-(CELL + GAP), -(CELL + GAP) / 2],
  [-(CELL + GAP), (CELL + GAP) / 2],
  [CELL + GAP, -(CELL + GAP) / 2],
  [CELL + GAP, (CELL + GAP) / 2],
]

/** Draws the package's mark in one colour: a filled centre cell inside six outlined neighbours. */
export function LogoMark(): React.JSX.Element {
  return (
    <View style={styles.frame}>
      {OFFSETS.map(([x, y], index) => (
        <View
          key={`${x},${y}`}
          style={[
            styles.cell,
            { transform: [{ translateX: x }, { translateY: y }] },
            index === 0 ? styles.centre : styles.neighbour,
          ]}
        />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  frame: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  cell: { position: 'absolute', width: CELL, height: CELL, borderRadius: 1 },
  centre: { backgroundColor: colors.ink },
  neighbour: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.ink },
})
