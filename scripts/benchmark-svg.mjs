/**
 * Renders `apps/example/benchmark.json` as paired horizontal bars: for each README workload a
 * `react-native-h3` bar above an `h3-js` bar, scaled per pair so that the `h3-js` median spans the
 * full width and the shorter bar reads as the share of the time it takes.
 *
 * The JSON is the `BENCHMARK_JSON` line the example app's benchmark screen logs on a Release build,
 * reassembled from its chunks, pretty-printed and committed. Rows without an `h3-js` reference carry
 * no factor and are left out.
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

const TITLE = 'react-native-h3 against h3-js, median milliseconds per workload'
// no external resources: a system stack, resolved by the viewer
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

// the workload ids the README table shows, in the order it shows them
const CHART_IDS = ['W1', 'W3', 'W4', 'W7']

// No single colour clears 4.5:1 on white and on GitHub's `#0d1117` at once; 4.35:1 is the
// arithmetic ceiling. The base values sit on it, and the media queries lift each theme past 4.5:1
// wherever the renderer honours them.
const TEXT_BASE = '#727a84'
const TEXT_LIGHT = '#57606a'
const TEXT_DARK = '#8b949e'
const STRONG_BASE = '#727a84'
const STRONG_LIGHT = '#1f2328'
const STRONG_DARK = '#e6edf3'
const ACCENT_BASE = '#2f78dc'
const ACCENT_LIGHT = '#1f6feb'
const ACCENT_DARK = '#58a6ff'
// a bar is not text, so 3:1 is the bar to clear: the accent holds 3.68:1 on white and 5.15:1 on
// `#0d1117`, the neutral 3.73:1 and 5.07:1
const BAR_ACCENT = '#3b82f6'
const BAR_NEUTRAL_BASE = '#7d8590'
const BAR_NEUTRAL_LIGHT = '#6e7781'
const BAR_NEUTRAL_DARK = '#8b949e'

const WIDTH = 800
const MARGIN = 24
const LABEL_WIDTH = 130
const VALUE_WIDTH = 110
const BAR_HEIGHT = 18
const BAR_GAP = 6
const LABEL_TO_BAR = 8
const GROUP_STEP = 80
const CHART_TOP = 62
const CAPTION_FIRST = 30
const CAPTION_SECOND = 48
const CAPTION_GAP = 62

const BAR_LEFT = MARGIN + LABEL_WIDTH
const BAR_MAX = WIDTH - MARGIN - VALUE_WIDTH - BAR_LEFT
const GROUP_HEIGHT = LABEL_TO_BAR + 2 * BAR_HEIGHT + BAR_GAP

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// One decimal and grouped thousands, matching the README table, and no ICU dependency. A median
// under a millisecond gets three, where one decimal would round it into a different number.
function formatMillis(millis) {
  const [whole, fraction] = millis.toFixed(millis < 1 ? 3 : 1).split('.')
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`
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
    // a zero median is real, below clock resolution; `toBars` skips it
    if (!Number.isFinite(row.millis) || row.millis < 0) {
      fail(`${at}.millis`, 'must be a finite number of 0 or more')
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
  // the model is Android-only, so a payload without it stays valid
  if (measuredOn.device !== undefined) {
    requireString(measuredOn.device, 'measuredOn.device')
  }
  if (!Number.isInteger(measuredOn.warmupRuns) || measuredOn.warmupRuns < 0) {
    fail('measuredOn.warmupRuns', 'must be an integer of 0 or more')
  }
  // a Debug build is several times slower on the native side, so its factors are not comparable
  if (measuredOn.build.startsWith('Debug')) {
    fail(
      'measuredOn.build',
      'is `Debug`: a Debug build is several times slower on the native side and its numbers must ' +
        'not be published, re-run the benchmark screen in a Release build',
    )
  }
  return payload
}

function readPayload() {
  return validate(JSON.parse(readFileSync(INPUT, 'utf8')))
}

// the leading `W\d+` is an id, not part of the name a reader wants to see
function workloadId(workload) {
  return workload.split(' ')[0]
}

function workloadSubject(workload) {
  return workload.replace(/^W\d+ /, '')
}

function toBars(rows) {
  const bars = []
  for (const row of rows) {
    // a row with no `h3-js` counterpart has no factor; that is expected, not a defect
    if (row.referenceMillis === null) {
      continue
    }
    if (row.millis <= 0) {
      console.warn(`Skipped \`${row.workload}\`: \`millis\` is ${row.millis}, no factor to draw`)
      continue
    }
    bars.push({
      id: workloadId(row.workload),
      workload: row.workload,
      subject: workloadSubject(row.workload),
      runs: row.runs,
      millis: row.millis,
      referenceMillis: row.referenceMillis,
      factor: row.referenceMillis / row.millis,
    })
  }
  if (bars.length === 0) {
    throw new Error(`${INPUT} holds no row with an \`h3-js\` reference time`)
  }
  return bars
}

// the chart carries the README table and nothing else, so a missing or duplicated id is a defect
function chartBars(bars) {
  return CHART_IDS.map((id) => {
    const matches = bars.filter((bar) => bar.id === id)
    if (matches.length !== 1) {
      fail(
        'rows',
        `must hold exactly one \`${id}\` row with an h3-js reference, found ${matches.length}`,
      )
    }
    return matches[0]
  })
}

// The widest measured factor, named with the workload it belongs to. The published figure is a
// measurement, not a rounded claim, so the number is passed on as the payload carries it.
function headline(bars) {
  const widest = bars.reduce((best, bar) => (bar.factor > best.factor ? bar : best))
  return { workload: widest.workload, factor: widest.factor }
}

// The caption annotates the bars, so the run count is read back off the charted rows and not off
// the payload, which carries rows at other sample counts that no bar shows.
function runCounts(bars) {
  const tally = new Map()
  for (const bar of bars) {
    tally.set(bar.runs, (tally.get(bar.runs) ?? 0) + 1)
  }
  const [common] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]
  const exceptions = bars
    .filter((bar) => bar.runs !== common)
    .map((bar) => `${bar.runs} for ${bar.subject.split(/[ ,]/)[0]}`)
  return exceptions.length === 0 ? `${common} runs` : `${common} runs (${exceptions.join(', ')})`
}

function warmUps(count) {
  return count === 1 ? 'one warm-up' : `${count} warm-ups`
}

// `Platform.OS` is lowercase; the caption is prose, so it names the platform the way readers do
const PLATFORM_NAMES = { ios: 'iOS', android: 'Android' }

function platformName(platform) {
  return PLATFORM_NAMES[platform] ?? platform
}

// `Platform.Version` is the API level on Android, not the version a reader knows the OS by
function platformVersion(platform, osVersion) {
  return platform === 'android' ? `API ${osVersion}` : osVersion
}

// two lines, split on the sentence: all three would run past the canvas at this font size
function caption(payload, groups) {
  const { platform, osVersion, build, reactNative, h3js, date, warmupRuns } = payload.measuredOn
  return [
    `Measured on ${platformName(platform)} ${platformVersion(platform, osVersion)}, ` +
      `${build} build, ` +
      `react-native ${reactNative}, ` +
      `against h3-js ${h3js}, ${date}.`,
    `Median of ${runCounts(groups)} after ${warmUps(warmupRuns)}. ` +
      'Bars are scaled per workload.',
  ]
}

function styleBlock() {
  return [
    '<style>',
    `text { fill: ${TEXT_BASE} }`,
    `.strong { fill: ${STRONG_BASE} }`,
    `.factor { fill: ${ACCENT_BASE} }`,
    `.reference { fill: ${BAR_NEUTRAL_BASE} }`,
    '@media (prefers-color-scheme: light) {',
    `text { fill: ${TEXT_LIGHT} }`,
    `.strong { fill: ${STRONG_LIGHT} }`,
    `.factor { fill: ${ACCENT_LIGHT} }`,
    `.reference { fill: ${BAR_NEUTRAL_LIGHT} }`,
    '}',
    '@media (prefers-color-scheme: dark) {',
    `text { fill: ${TEXT_DARK} }`,
    `.strong { fill: ${STRONG_DARK} }`,
    `.factor { fill: ${ACCENT_DARK} }`,
    `.reference { fill: ${BAR_NEUTRAL_DARK} }`,
    '}',
    '</style>',
  ].join('\n')
}

// a bar never disappears: two pixels still read as a bar next to a full-width one
function barLength(millis, referenceMillis) {
  return Math.max(2, Math.round((millis / referenceMillis) * BAR_MAX))
}

function renderGroup(bar, top) {
  const subjectBaseline = top
  const fastTop = top + LABEL_TO_BAR
  const slowTop = fastTop + BAR_HEIGHT + BAR_GAP
  const fastLength = barLength(bar.millis, bar.referenceMillis)
  const textBaseline = (barTop) => barTop + 13
  return [
    `<text class="strong" x="${MARGIN}" y="${subjectBaseline}" font-size="14" font-weight="600">` +
      `${escapeXml(bar.subject)}</text>`,
    `<text x="${BAR_LEFT - 10}" y="${textBaseline(fastTop)}" font-size="12" text-anchor="end">` +
      'react-native-h3</text>',
    `<rect x="${BAR_LEFT}" y="${fastTop}" width="${fastLength}" height="${BAR_HEIGHT}" rx="3" ` +
      `fill="${BAR_ACCENT}"/>`,
    `<text x="${BAR_LEFT + fastLength + 8}" y="${textBaseline(fastTop)}" font-size="12" ` +
      `font-weight="600"><tspan class="strong">${escapeXml(`${formatMillis(bar.millis)} ms`)}` +
      `</tspan><tspan class="factor" dx="10">${bar.factor.toFixed(1)}× faster</tspan></text>`,
    `<text x="${BAR_LEFT - 10}" y="${textBaseline(slowTop)}" font-size="12" text-anchor="end">` +
      'h3-js</text>',
    `<rect class="reference" x="${BAR_LEFT}" y="${slowTop}" width="${BAR_MAX}" ` +
      `height="${BAR_HEIGHT}" rx="3" fill="${BAR_NEUTRAL_BASE}"/>`,
    `<text class="strong" x="${BAR_LEFT + BAR_MAX + 8}" y="${textBaseline(slowTop)}" ` +
      `font-size="12" font-weight="600">` +
      `${escapeXml(`${formatMillis(bar.referenceMillis)} ms`)}</text>`,
  ]
}

function render(payload) {
  const bars = toBars(payload.rows)
  const groups = chartBars(bars)
  const chartBottom = CHART_TOP + (groups.length - 1) * GROUP_STEP + GROUP_HEIGHT
  const height = chartBottom + CAPTION_GAP

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" ` +
      `viewBox="0 0 ${WIDTH} ${height}" font-family="${FONT}" role="img" ` +
      `aria-label="${escapeXml(TITLE)}">`,
    `<title>${escapeXml(TITLE)}</title>`,
    styleBlock(),
    `<text class="strong" x="${MARGIN}" y="32" font-size="17" font-weight="600">` +
      `${escapeXml(TITLE)}</text>`,
  ]

  groups.forEach((bar, index) => {
    lines.push(...renderGroup(bar, CHART_TOP + index * GROUP_STEP))
  })

  const [first, second] = caption(payload, groups)
  lines.push(
    `<text x="${MARGIN}" y="${chartBottom + CAPTION_FIRST}" font-size="11">` +
      `${escapeXml(first)}</text>`,
    `<text x="${MARGIN}" y="${chartBottom + CAPTION_SECOND}" font-size="11">` +
      `${escapeXml(second)}</text>`,
    '</svg>',
  )
  return `${lines.join('\n')}\n`
}

const payload = readPayload()
writeFileSync(OUTPUT, render(payload), 'utf8')
console.log(`Wrote ${OUTPUT}`)

// one line the README task can copy verbatim
const hero = headline(toBars(payload.rows))
console.log(`HEADLINE ${hero.factor.toFixed(1)}× faster than h3-js (${hero.workload})`)
