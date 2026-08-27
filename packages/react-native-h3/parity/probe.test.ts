import { describe, expect, mock, test } from 'bun:test'
import { callMany, openProbe, skipWithoutProbe } from './probe'

// the HybridObject cannot exist off-device, and `src/native.ts` creates it at module scope. Mocking
// here, before the barrel is imported, is what lets the export surface be compared with the probe.
mock.module('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => new Proxy({}, { get: () => () => undefined }),
  },
}))

// `bun test` runs everywhere, the probe is built only where CMake has run, so these skip rather
// than fail when it is absent. CI sets `H3_PARITY_REQUIRED`, and then they fail instead.
if (skipWithoutProbe) {
  console.warn(
    'Skipping the parity probe suite: build it with\n' +
      '  cmake -S packages/react-native-h3/cpp/test -B build/host -DCMAKE_BUILD_TYPE=Release\n' +
      '  cmake --build build/host --target parity_probe -j',
  )
}

describe.skipIf(skipWithoutProbe)('parity probe', () => {
  test('answers a scalar operation', () => {
    const probe = openProbe()
    try {
      expect(probe.call('cellAreaKm2', '89283082803ffff')).toBeCloseTo(0.10940247351390452, 15)
    } finally {
      probe.close()
    }
  })

  test('answers with a cell as a hexadecimal string', () => {
    const probe = openProbe()
    try {
      expect(probe.cell('latLngToCell', '37.7749', '-122.4194', '9')).toBe('89283082803ffff')
    } finally {
      probe.close()
    }
  })

  test('answers with a cell list', () => {
    const probe = openProbe()
    try {
      expect(probe.cells('gridDisk', '89283082803ffff', '1')).toHaveLength(7)
      expect(probe.cells('gridDisk', '81083ffffffffff', '1')).toHaveLength(6)
    } finally {
      probe.close()
    }
  })

  test('accepts a cell list argument', () => {
    const probe = openProbe()
    try {
      const disk = probe.cells('gridDisk', '89283082803ffff', '2').join(',')
      expect(probe.cells('compactCells', disk)).toHaveLength(13)
      expect(probe.cells('compactCells', '-')).toHaveLength(0)
    } finally {
      probe.close()
    }
  })

  test('accepts a polygon argument', () => {
    const probe = openProbe()
    try {
      const triangle =
        '37.813318999983238,-122.4089866999972145;' +
        '37.7198061999978478,-122.3544736999993603;' +
        '37.8151571999998453,-122.4798767000009008'
      expect(probe.cells('polygonToCells', triangle, '7')).toHaveLength(7)
    } finally {
      probe.close()
    }
  })

  test('reports a thrown error rather than dying', () => {
    const probe = openProbe()
    try {
      expect(() => probe.call('cellAreaKm2', '1')).toThrow('Cell argument was not valid')
      // the process is still usable afterwards, which is what makes a long-lived suite viable.
      expect(probe.cell('latLngToCell', '0', '0', '0')).toBe('8075fffffffffff')
    } finally {
      probe.close()
    }
  })

  test('reports a malformed request rather than dying', () => {
    const probe = openProbe()
    try {
      expect(() => probe.call('bogus', 'x')).toThrow('Unknown operation: bogus')
      expect(() => probe.call('gridDisk', 'zzz', '1')).toThrow('Not a cell: zzz')
      expect(() => probe.call('gridDisk', '89283082803ffff')).toThrow('Missing argument 2')
      expect(() => probe.call('gridDisk')).toThrow('Missing argument 1')
      expect(probe.cell('cellToParent', '89283082803ffff', '8')).toBe('8828308281fffff')
    } finally {
      probe.close()
    }
  })

  test('escapes a control character and decodes it back', () => {
    const probe = openProbe()
    try {
      // the byte crosses the wire as `\u0001`, so it returns intact only if the escaping is right
      let reported = ''
      try {
        probe.call('bo\u0001gus')
      } catch (error) {
        reported = (error as Error).message
      }
      expect(reported).toBe('Unknown operation: bo\u0001gus')
    } finally {
      probe.close()
    }
  })

  test('answers a batch in one run, a failure in place', () => {
    const answers = callMany(['gridDisk 89283082803ffff 1', 'bogus x', 'cellAreaKm2 1'])
    expect(answers[0]).toHaveLength(7)
    expect(answers[1]).toBeInstanceOf(Error)
    expect((answers[2] as Error).message).toContain('Cell argument was not valid')
  })

  test('lists exactly the operations the public API exports', async () => {
    const probe = openProbe()
    try {
      const exported = Object.entries(await import('../src/index'))
        // `H3Error` is a class, so it is a function too; every other export is an operation
        .filter(([name, value]) => typeof value === 'function' && name !== 'H3Error')
        .map(([name]) => name)
        .sort()
      expect(exported).toHaveLength(64)
      expect(probe.ops().sort()).toEqual(exported)
    } finally {
      probe.close()
    }
  })
})
