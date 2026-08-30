import { describe, expect, test } from 'bun:test'
import { H3Error, rethrowAsH3Error } from '../src/H3Error'

describe('H3Error', () => {
  test('strips the prefix Nitro adds to synchronous throws', () => {
    // Nitro formats synchronous failures as "H3.<method>(...): <what()>".
    const raw = new Error('H3.gridDisk(...): Cell argument was not valid (code: 5)')
    expect(() => rethrowAsH3Error(raw)).toThrow(H3Error)
    try {
      rethrowAsH3Error(raw)
    } catch (error) {
      expect((error as H3Error).message).toBe('Cell argument was not valid (code: 5)')
    }
  })

  test('leaves an unprefixed message alone', () => {
    // `Promise` rejections arrive without the prefix.
    try {
      rethrowAsH3Error(new Error('Cell argument was not valid (code: 5)'))
    } catch (error) {
      expect((error as H3Error).message).toBe('Cell argument was not valid (code: 5)')
    }
  })

  test('reads the code from the suffix and keeps the suffix, as h3-js does', () => {
    try {
      rethrowAsH3Error(
        new Error(
          'H3.latLngToCell(...): Resolution argument was outside of acceptable range (code: 4)',
        ),
      )
    } catch (error) {
      expect((error as H3Error).code).toBe(4)
      expect((error as H3Error).message).toBe(
        'Resolution argument was outside of acceptable range (code: 4)',
      )
    }
  })

  test('leaves the code undefined for wording of our own', () => {
    try {
      rethrowAsH3Error(new Error('H3.constructCell(...): constructCell needs exactly res digits'))
    } catch (error) {
      expect((error as H3Error).code).toBeUndefined()
      expect((error as H3Error).message).toBe('constructCell needs exactly res digits')
    }
  })

  test('reads a code only from the end of the message', () => {
    // a number in the middle is prose, not H3's suffix.
    try {
      rethrowAsH3Error(
        new Error(
          'The requested result of 4005541 cells exceeds the cell limit of 4000000 set with configure({ maxCellCount }). Raise or remove the limit to allow it.',
        ),
      )
    } catch (error) {
      expect((error as H3Error).code).toBeUndefined()
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
      expect((error as H3Error).code).toBeUndefined()
    }
  })
})

describe('H3Error on the async path', () => {
  async function rejectWith(message: string): Promise<never> {
    try {
      return await Promise.reject(new Error(message))
    } catch (error) {
      rethrowAsH3Error(error)
    }
  }

  test('a rejection carries no method prefix and is passed through unchanged', async () => {
    // `JSIConverter+Exception.hpp:40` rejects with `what()` alone, where `HybridFunction.hpp`
    // prefixes synchronous throws
    let thrown: unknown
    try {
      await rejectWith('Resolution argument was outside of acceptable range (code: 4)')
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(H3Error)
    expect((thrown as H3Error).message).toBe(
      'Resolution argument was outside of acceptable range (code: 4)',
    )
    expect((thrown as H3Error).code).toBe(4)
  })

  test('a prefixed message is still stripped on the async path', async () => {
    // not the shape Nitro produces for rejections today, but the regex must not depend on that
    let thrown: unknown
    try {
      await rejectWith('H3.uncompactCellsAsync(...): Cell argument was not valid (code: 5)')
    } catch (error) {
      thrown = error
    }
    expect((thrown as H3Error).message).toBe('Cell argument was not valid (code: 5)')
  })
})
