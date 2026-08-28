/**
 * Renders `apps/example/benchmark.json` as a horizontal bar chart of the speedup over `h3-js`.
 *
 * The JSON is the `BENCHMARK_JSON` line the example app's benchmark screen logs on a Release build,
 * pretty-printed and committed. Rows without an `h3-js` reference carry no factor and are left out
 * of the bars.
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
const FOOTER_GAP = 34

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
  for (const field of ['platform', 'osVersion', 'build', 'h3js', 'date']) {
    requireString(measuredOn[field], `measuredOn.${field}`)
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

function footer(measuredOn) {
  const { platform, osVersion, build, h3js, date } = measuredOn
  return `Measured on ${platform} ${osVersion}, ${build} build, against h3-js ${h3js}, ${date}.`
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
  const scale = BAR_MAX / Math.max(...bars.map((bar) => bar.factor))
  const height = CHART_TOP + bars.length * ROW_STEP + FOOTER_GAP

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" ` +
      `viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}" role="img" ` +
      `aria-label="${escapeXml(TITLE)}">`,
    `<title>${escapeXml(TITLE)}</title>`,
    styleBlock(),
    `<text x="${MARGIN}" y="34" font-size="17" font-weight="600">${escapeXml(TITLE)}</text>`,
    `<line class="axis" x1="${BAR_LEFT}" y1="${CHART_TOP - 8}" x2="${BAR_LEFT}" ` +
      `y2="${CHART_TOP + bars.length * ROW_STEP - 4}" stroke-width="1" opacity="0.35"/>`,
  ]

  bars.forEach((bar, index) => {
    const top = CHART_TOP + index * ROW_STEP
    const baseline = top + BAR_HEIGHT - 6
    const length = Math.max(2, Math.round(bar.factor * scale))
    lines.push(
      `<text x="${BAR_LEFT - 12}" y="${baseline}" font-size="13" text-anchor="end">` +
        `${escapeXml(bar.workload)}</text>`,
      `<rect x="${BAR_LEFT}" y="${top}" width="${length}" height="${BAR_HEIGHT}" rx="3" ` +
        `fill="${BAR_COLOR}"/>`,
      `<text class="factor" x="${BAR_LEFT + length + 10}" y="${baseline}" font-size="13" ` +
        `font-weight="600">${formatFactor(bar.factor)}×</text>`,
    )
  })

  lines.push(
    `<text x="${MARGIN}" y="${height - 12}" font-size="12">` +
      `${escapeXml(footer(payload.measuredOn))}</text>`,
    '</svg>',
  )
  return `${lines.join('\n')}\n`
}

writeFileSync(OUTPUT, render(readPayload()), 'utf8')
console.log(`Wrote ${OUTPUT}`)
