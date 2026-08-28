import { expect, test } from 'bun:test'
import { CEILING_HELP, CEILING_NOTE, CEILING_VALUE, CELL_CEILING } from './ceiling'
import { formatCount } from './timing'

test('caps a call at four million cells', () => {
  expect(CELL_CEILING).toBe(4_000_000)
})

test('the about row carries the ceiling as a plain number', () => {
  expect(CEILING_VALUE).toBe(formatCount(CELL_CEILING))
})

test('names who set the ceiling in both places a reader can reach it', () => {
  for (const copy of [CEILING_NOTE, CEILING_HELP]) {
    expect(copy).toContain('configure({ maxCellCount })')
    expect(copy).toContain('package ships without a limit')
  }
  expect(CEILING_HELP).toContain(formatCount(CELL_CEILING))
})
