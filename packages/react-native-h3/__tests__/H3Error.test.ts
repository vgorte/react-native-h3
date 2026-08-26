import { describe, expect, test } from 'bun:test'
import { H3Error, rethrowAsH3Error } from '../src/H3Error'

describe('H3Error', () => {
  test('strips the prefix Nitro adds to synchronous throws', () => {
    // Nitro formats synchronous failures as "H3.<method>(...): <what()>".
    const raw = new Error('H3.gridDisk(...): Cell argument was not valid')
    expect(() => rethrowAsH3Error(raw)).toThrow(H3Error)
    try {
      rethrowAsH3Error(raw)
    } catch (error) {
      expect((error as H3Error).message).toBe('Cell argument was not valid')
    }
  })

  test('leaves an unprefixed message alone', () => {
    // Promise rejections arrive without the prefix.
    try {
      rethrowAsH3Error(new Error('Cell argument was not valid'))
    } catch (error) {
      expect((error as H3Error).message).toBe('Cell argument was not valid')
    }
  })

  test('is identifiable with instanceof and has a stable name', () => {
    try {
      rethrowAsH3Error(new Error('Success'))
    } catch (error) {
      expect(error).toBeInstanceOf(H3Error)
      expect(error).toBeInstanceOf(Error)
      expect((error as H3Error).name).toBe('H3Error')
    }
  })

  test('survives a non-Error being thrown', () => {
    try {
      rethrowAsH3Error('something odd')
    } catch (error) {
      expect(error).toBeInstanceOf(H3Error)
      expect((error as H3Error).message).toBe('something odd')
    }
  })
})
