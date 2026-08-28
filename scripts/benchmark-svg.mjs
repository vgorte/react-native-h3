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
// mid-tones, so both stay legible on a light and on a dark page background
const BAR_COLOR = '#3b82f6'
const TEXT_COLOR = '#6b7280'

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

function readPayload() {
  const payload = JSON.parse(readFileSync(INPUT, 'utf8'))
  if (!Array.isArray(payload.rows) || payload.measuredOn == null) {
    throw new Error(`${INPUT} is not a benchmark payload: expected \`rows\` and \`measuredOn\``)
  }
  return payload
}

function toBars(rows) {
  const bars = []
  for (const row of rows) {
    if (row.referenceMillis == null || row.millis <= 0) {
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
    `<text x="${MARGIN}" y="34" font-size="17" font-weight="600" fill="${TEXT_COLOR}">` +
      `${escapeXml(TITLE)}</text>`,
    `<line x1="${BAR_LEFT}" y1="${CHART_TOP - 8}" x2="${BAR_LEFT}" ` +
      `y2="${CHART_TOP + bars.length * ROW_STEP - 4}" stroke="${TEXT_COLOR}" ` +
      'stroke-width="1" opacity="0.35"/>',
  ]

  bars.forEach((bar, index) => {
    const top = CHART_TOP + index * ROW_STEP
    const baseline = top + BAR_HEIGHT - 6
    const length = Math.max(2, Math.round(bar.factor * scale))
    lines.push(
      `<text x="${BAR_LEFT - 12}" y="${baseline}" font-size="13" fill="${TEXT_COLOR}" ` +
        `text-anchor="end">${escapeXml(bar.workload)}</text>`,
      `<rect x="${BAR_LEFT}" y="${top}" width="${length}" height="${BAR_HEIGHT}" rx="3" ` +
        `fill="${BAR_COLOR}"/>`,
      `<text x="${BAR_LEFT + length + 10}" y="${baseline}" font-size="13" font-weight="600" ` +
        `fill="${BAR_COLOR}">${formatFactor(bar.factor)}×</text>`,
    )
  })

  lines.push(
    `<text x="${MARGIN}" y="${height - 12}" font-size="12" fill="${TEXT_COLOR}">` +
      `${escapeXml(footer(payload.measuredOn))}</text>`,
    '</svg>',
  )
  return `${lines.join('\n')}\n`
}

writeFileSync(OUTPUT, render(readPayload()), 'utf8')
console.log(`Wrote ${OUTPUT}`)
