import { describe, expect, test } from 'bun:test'
import { inBounds, padBoundsByCell, zoomToResolution } from './zoom'

describe('zoomToResolution', () => {
  test('holds the country resolution below zoom 8', () => {
    expect(zoomToResolution(4)).toBe(5)
    expect(zoomToResolution(7.9)).toBe(5)
  })

  test('walks up one resolution per zoom band', () => {
    expect(zoomToResolution(8)).toBe(6)
    expect(zoomToResolution(9.9)).toBe(6)
    expect(zoomToResolution(10)).toBe(7)
    expect(zoomToResolution(11)).toBe(8)
    expect(zoomToResolution(12)).toBe(9)
    expect(zoomToResolution(13)).toBe(10)
  })

  test('caps at resolution 11', () => {
    expect(zoomToResolution(14)).toBe(11)
    expect(zoomToResolution(22)).toBe(11)
  })
})

describe('inBounds', () => {
  test('accepts a point inside and rejects one outside', () => {
    const bounds: [number, number, number, number] = [13.0, 52.0, 13.5, 52.6]
    expect(inBounds(52.52, 13.405, bounds)).toBe(true)
    expect(inBounds(52.52, 12.9, bounds)).toBe(false)
  })
})

describe('padBoundsByCell', () => {
  test('grows the box north and south by one cell diameter', () => {
    // 11.1 km of edge is a 22.2 km diameter, which is 0.2 degrees of latitude
    const [, south, , north] = padBoundsByCell([13.0, 52.0, 13.5, 52.6], 11.1)
    expect(south).toBeCloseTo(51.8, 6)
    expect(north).toBeCloseTo(52.8, 6)
  })

  test('widens longitude more than latitude away from the equator', () => {
    const [west, south, east, north] = padBoundsByCell([13.0, 52.0, 13.5, 52.6], 11.1)
    expect(13.0 - west).toBeGreaterThan(52.0 - south)
    expect(east - 13.5).toBeCloseTo(13.0 - west, 6)
    expect(north - 52.6).toBeCloseTo(52.0 - south, 6)
  })
})
