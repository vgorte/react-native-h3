import { expect, mock, test } from 'bun:test'

// only Metro reads React Native's Flow sources, and the split needs none of them
mock.module('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Text: () => null,
  View: () => null,
}))

const { hudSplit } = await import('./HudCard')

test('adds up every call the package answered', () => {
  expect(hudSplit([21, 1.5, 17], 61)).toEqual({ h3Ms: 39.5, appMs: 61 })
})

test('counts a step the screen never ran as no time at all', () => {
  expect(hudSplit([111, null, null], 5.7)).toEqual({ h3Ms: 111, appMs: 5.7 })
})
