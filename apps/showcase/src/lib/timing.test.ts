import { describe, expect, test } from 'bun:test'
import { cappedNote, formatCount, formatMs, measure, measureAsync } from './timing'

describe('measure', () => {
  test('passes the value through and reports a finite duration', () => {
    const measured = measure(() => 6 * 7)
    expect(measured.value).toBe(42)
    expect(Number.isFinite(measured.ms)).toBe(true)
  })
})

describe('measureAsync', () => {
  test('awaits the value and reports a finite duration', async () => {
    const measured = await measureAsync(async () => 'done')
    expect(measured.value).toBe('done')
    expect(Number.isFinite(measured.ms)).toBe(true)
  })
})

describe('formatMs', () => {
  test('keeps one decimal below ten milliseconds', () => {
    expect(formatMs(4.06)).toBe('4.1 ms')
  })

  test('rounds to whole milliseconds from ten upwards', () => {
    expect(formatMs(33.4)).toBe('33 ms')
  })

  test('drops the decimal when it rounds up to ten', () => {
    expect(formatMs(9.96)).toBe('10 ms')
  })
})

describe('formatCount', () => {
  test('groups thousands with a comma', () => {
    expect(formatCount(100000)).toBe('100,000')
    expect(formatCount(7)).toBe('7')
    expect(formatCount(192024001)).toBe('192,024,001')
  })
})

describe('cappedNote', () => {
  test('names the total and what the cap let through', () => {
    expect(cappedNote(86832, 50000, 'cells')).toBe('86,832 cells, drawing the first 50,000.')
  })

  test('says nothing while everything reaches the map', () => {
    expect(cappedNote(919, 919, 'polygons')).toBeUndefined()
  })
})
