/**
 * Renders `apps/example/benchmark.json` as a horizontal bar chart of the speedup over `h3-js`, on a
 * logarithmic axis: the fastest workload is over a hundred times the factor of the slowest, and a
 * linear axis flattens everything below it into a stub.
 *
 * The JSON is the `BENCHMARK_JSON` line the example app's benchmark screen logs on a Release build,
 * reassembled from its chunks, pretty-printed and committed. Rows without an `h3-js` reference carry
 * no factor and are left out of the bars.
 *
 * Usage:
 *   bun run benchmark:svg
 *   bun scripts/benchmark-svg.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INPUT = join(ROOT, 'apps', 'example', 'benchmark.json')
const OUTPUT = join(ROOT, 'img', 'benchmark.svg')

const TITLE = 'react-native-h3 vs h3-js, speedup per workload'
// no external resources: a system stack, resolved by the viewer
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// No single colour clears 4.5:1 on white and on GitHub's #0d1117 at once; 4.35:1 is the arithmetic
// ceiling. The base pair sits on it, and the media queries lift each theme past 4.5:1 wherever the
// renderer honours them.
const TEXT_BASE = '#727a84'
const TEXT_LIGHT = '#57606a'
const TEXT_DARK = '#8b949e'
const VALUE_BASE = '#2f78dc'
const VALUE_LIGHT = '#1f6feb'
const VALUE_DARK = '#58a6ff'
// a bar is not text, so 3:1 is the bar to clear: 3.68:1 on white, 5.15:1 on #0d1117
const BAR_COLOR = '#3b82f6'

const WIDTH = 840
const MARGIN = 20
const LABEL_WIDTH = 300
const VALUE_WIDTH = 64
const BAR_HEIGHT = 22
const ROW_STEP = 34
const CHART_TOP = 62
const TICK_BASELINE = 6
const FOOTER_FIRST = 30
const FOOTER_SECOND = 46
const FOOTER_GAP = 58

const BAR_LEFT = MARGIN + LABEL_WIDTH
const BAR_MAX = WIDTH - MARGIN - VALUE_WIDTH - BAR_LEFT

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatFactor(factor) {
  return factor >= 10 ? factor.toFixed(0) : factor.toFixed(1)
}

function fail(field, expectation) {
  throw new Error(`${INPUT}: \`${field}\` ${expectation}`)
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(field, 'must be a non-empty string')
  }
}

function validate(payload) {
  if (payload == null || typeof payload !== 'object') {
    fail('payload', 'must be an object')
  }
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    fail('rows', 'must be a non-empty array')
  }
  payload.rows.forEach((row, index) => {
    const at = `rows[${index}]`
    if (row == null || typeof row !== 'object') {
      fail(at, 'must be an object')
    }
    requireString(row.workload, `${at}.workload`)
    requireString(row.detail, `${at}.detail`)
    if (!Number.isInteger(row.runs) || row.runs <= 0) {
      fail(`${at}.runs`, 'must be an integer greater than 0')
    }
    if (typeof row.millis !== 'number' || !Number.isFinite(row.millis) || row.millis <= 0) {
      fail(`${at}.millis`, 'must be a finite number greater than 0')
    }
    const reference = row.referenceMillis
    if (reference !== null && (typeof reference !== 'number' || !Number.isFinite(reference))) {
      fail(`${at}.referenceMillis`, 'must be a finite number or null')
    }
  })
  const measuredOn = payload.measuredOn
  if (measuredOn == null || typeof measuredOn !== 'object') {
    fail('measuredOn', 'must be an object')
  }
  for (const field of ['platform', 'osVersion', 'build', 'reactNative', 'h3js', 'date']) {
    requireString(measuredOn[field], `measuredOn.${field}`)
  }
  if (!Number.isInteger(measuredOn.warmupRuns) || measuredOn.warmupRuns < 0) {
    fail('measuredOn.warmupRuns', 'must be an integer of 0 or more')
  }
  return payload
}

function readPayload() {
  return validate(JSON.parse(readFileSync(INPUT, 'utf8')))
}

function toBars(rows) {
  const bars = []
  for (const row of rows) {
    // a row with no h3-js counterpart has no factor; that is expected, not a defect
    if (row.referenceMillis === null) {
      continue
    }
    if (row.millis <= 0) {
      console.warn(`Skipped \`${row.workload}\`: \`millis\` is ${row.millis}, no factor to draw`)
      continue
    }
    bars.push({ workload: row.workload, factor: row.referenceMillis / row.millis })
  }
  if (bars.length === 0) {
    throw new Error(`${INPUT} holds no row with an \`h3-js\` reference time`)
  }
  return bars
}

// the axis reaches the decade above the widest factor, so the longest bar always stops short of the
// value labels and the decade ticks land at even fractions of the width
function axisMax(bars) {
  const widest = Math.max(...bars.map((bar) => bar.factor))
  return 10 ** (Math.floor(Math.log10(widest)) + 1)
}

function decades(max) {
  const ticks = []
  for (let power = 1; 10 ** power < max; power++) {
    ticks.push(10 ** power)
  }
  return ticks
}

// the axis starts at 1x, where a factor means no gain at all and the bar has no length
function barLength(factor, max) {
  return Math.max(2, Math.round((Math.log10(factor) / Math.log10(max)) * BAR_MAX))
}

// the run count is not assumed: it is read back off the rows, naming whichever ones differ
function runCounts(rows) {
  const tally = new Map()
  for (const row of rows) {
    tally.set(row.runs, (tally.get(row.runs) ?? 0) + 1)
  }
  const [common] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  const exceptions = [
    ...new Set(
      rows
        .filter((row) => row.runs !== common)
        .map((row) => `${row.runs} for ${row.workload.split(' ')[0]}`),
    ),
  ]
  return exceptions.length === 0 ? `${common} runs` : `${common} runs (${exceptions.join(', ')})`
}

function warmUps(count) {
  return count === 1 ? 'one warm-up' : `${count} warm-ups`
}

// two lines, split on the sentence: all three would run past the canvas at this font size
function footer(payload) {
  const { platform, osVersion, build, reactNative, h3js, date, warmupRuns } = payload.measuredOn
  return [
    `Measured on ${platform} ${osVersion}, ${build} build, react-native ${reactNative}, ` +
      `against h3-js ${h3js}, ${date}.`,
    `Median of ${runCounts(payload.rows)} after ${warmUps(warmupRuns)}. ` +
      'Bar length is logarithmic.',
  ]
}

function styleBlock() {
  return [
    '<style>',
    `text { fill: ${TEXT_BASE} }`,
    `.axis { stroke: ${TEXT_BASE} }`,
    `.factor { fill: ${VALUE_BASE} }`,
    '@media (prefers-color-scheme: light) {',
    `text { fill: ${TEXT_LIGHT} }`,
    `.axis { stroke: ${TEXT_LIGHT} }`,
    `.factor { fill: ${VALUE_LIGHT} }`,
    '}',
    '@media (prefers-color-scheme: dark) {',
    `text { fill: ${TEXT_DARK} }`,
    `.axis { stroke: ${TEXT_DARK} }`,
    `.factor { fill: ${VALUE_DARK} }`,
    '}',
    '</style>',
  ].join('\n')
}

function render(payload) {
  const bars = toBars(payload.rows)
  const max = axisMax(bars)
  const chartBottom = CHART_TOP + bars.length * ROW_STEP
  const height = chartBottom + FOOTER_GAP

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" ` +
      `viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}" role="img" ` +
      `aria-label="${escapeXml(TITLE)}">`,
    `<title>${escapeXml(TITLE)}</title>`,
    styleBlock(),
    `<text x="${MARGIN}" y="34" font-size="17" font-weight="600">${escapeXml(TITLE)}</text>`,
    `<line class="axis" x1="${BAR_LEFT}" y1="${CHART_TOP - 8}" x2="${BAR_LEFT}" ` +
      `y2="${chartBottom - 4}" stroke-width="1" opacity="0.35"/>`,
  ]

  for (const tick of decades(max)) {
    const x = BAR_LEFT + barLength(tick, max)
    lines.push(
      `<line class="axis" x1="${x}" y1="${CHART_TOP - 8}" x2="${x}" y2="${chartBottom - 4}" ` +
        'stroke-width="1" opacity="0.15"/>',
      `<text x="${x}" y="${chartBottom + TICK_BASELINE}" font-size="11" text-anchor="middle">` +
        `${formatFactor(tick)}×</text>`,
    )
  }

  bars.forEach((bar, index) => {
    const top = CHART_TOP + index * ROW_STEP
    const baseline = top + BAR_HEIGHT - 6
    const length = barLength(bar.factor, max)
    lines.push(
      `<text x="${BAR_LEFT - 12}" y="${baseline}" font-size="13" text-anchor="end">` +
        `${escapeXml(bar.workload)}</text>`,
      `<rect x="${BAR_LEFT}" y="${top}" width="${length}" height="${BAR_HEIGHT}" rx="3" ` +
        `fill="${BAR_COLOR}"/>`,
      `<text class="factor" x="${BAR_LEFT + length + 10}" y="${baseline}" font-size="13" ` +
        `font-weight="600">${formatFactor(bar.factor)}×</text>`,
    )
  })

  const [first, second] = footer(payload)
  lines.push(
    `<text x="${MARGIN}" y="${chartBottom + FOOTER_FIRST}" font-size="12">` +
      `${escapeXml(first)}</text>`,
    `<text x="${MARGIN}" y="${chartBottom + FOOTER_SECOND}" font-size="12">` +
      `${escapeXml(second)}</text>`,
    '</svg>',
  )
  return `${lines.join('\n')}\n`
}

writeFileSync(OUTPUT, render(readPayload()), 'utf8')
console.log(`Wrote ${OUTPUT}`)
