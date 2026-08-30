import { describe, expect, test } from 'bun:test'
import { toBuffer } from '../src/buffers'

describe('toBuffer', () => {
  test('passes a whole-buffer view through without copying', () => {
    const cells = new BigUint64Array([1n, 2n, 3n])
    expect(toBuffer(cells)).toBe(cells.buffer as ArrayBuffer)
  })

  test('copies a view that is a window onto a larger buffer', () => {
    const backing = new BigUint64Array([1n, 2n, 3n, 4n])
    const window = backing.subarray(1, 3)
    const buffer = toBuffer(window)
    expect(buffer).not.toBe(backing.buffer as ArrayBuffer)
    expect(buffer.byteLength).toBe(16)
    expect(Array.from(new BigUint64Array(buffer))).toEqual([2n, 3n])
  })

  test('copies a view with a non-zero offset that reaches the end', () => {
    const backing = new BigUint64Array([1n, 2n, 3n])
    const window = backing.subarray(1)
    const buffer = toBuffer(window)
    expect(buffer.byteLength).toBe(16)
    expect(Array.from(new BigUint64Array(buffer))).toEqual([2n, 3n])
  })

  test('handles an empty set', () => {
    expect(toBuffer(new BigUint64Array(0)).byteLength).toBe(0)
  })
})
