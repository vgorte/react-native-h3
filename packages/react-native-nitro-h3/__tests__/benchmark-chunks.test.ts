import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Chunks } from '../../../scripts/benchmark-device'
import { collectChunks, isComplete, joinChunks } from '../../../scripts/benchmark-device'
import { validatePayload } from '../../../scripts/benchmark-payload'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const PAYLOAD = join(ROOT, 'apps', 'example', 'benchmark.json')

// `BenchmarkScreen.logPayload`, reproduced so the test drives the lines a device actually writes
const CHUNK = 700

function chunkLines(text: string, prefix = ''): string[] {
  const total = Math.ceil(text.length / CHUNK)
  const lines: string[] = []
  for (let index = 0; index < total; index += 1) {
    const chunk = text.slice(index * CHUNK, (index + 1) * CHUNK)
    lines.push(`${prefix}BENCHMARK_JSON ${index + 1}/${total} |${chunk}|`)
  }
  return lines
}

function payloadText(): string {
  return JSON.stringify(JSON.parse(readFileSync(PAYLOAD, 'utf8')))
}

function recovered(log: string): string {
  const chunks = collectChunks(log)
  expect(isComplete(chunks)).toBe(true)
  return joinChunks(chunks as Chunks)
}

describe('benchmark chunk capture', () => {
  test('recovers a payload from a device log', () => {
    const text = payloadText()
    const log = ['Launching org.reactjs.native.example.H3Example', ...chunkLines(text), ''].join(
      '\n',
    )
    expect(recovered(log)).toBe(text)
    expect(validatePayload(JSON.parse(recovered(log)), PAYLOAD).rows.length).toBeGreaterThan(0)
  })

  test('reads through a logcat line prefix', () => {
    const text = payloadText()
    expect(recovered(chunkLines(text, '09-01 22:14:03.114 I/ReactNativeJS( 8021): ').join('\n'))) //
      .toBe(text)
  })

  test('takes the last payload when a log holds two runs', () => {
    const abandoned = JSON.stringify({ rows: ['an earlier run'] })
    const text = payloadText()
    expect(recovered([...chunkLines(abandoned), ...chunkLines(text)].join('\n'))).toBe(text)
  })

  test('reports an incomplete payload rather than a truncated one', () => {
    const lines = chunkLines(payloadText())
    expect(lines.length).toBeGreaterThan(2)
    expect(isComplete(collectChunks(lines.slice(0, -1).join('\n')))).toBe(false)
    expect(isComplete(collectChunks('nothing was logged'))).toBe(false)
  })
})
