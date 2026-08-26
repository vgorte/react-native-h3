/**
 * Generates the example app's launcher icons from `img/logo.svg`.
 *
 * The logo is the single source of truth, so the icons are derived rather than drawn twice.
 * No SVG rasteriser is assumed to be installed: the mark is eight convex polygons, which a
 * supersampling scanline fill and a hand-rolled PNG encoder cover exactly.
 *
 * Usage:
 *   bun run scripts/generate-app-icons.ts
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const LOGO = join(ROOT, 'img', 'logo.svg')
const IOS_ICONSET = join(ROOT, 'apps/example/ios/H3Example/Images.xcassets/AppIcon.appiconset')
const ANDROID_RES = join(ROOT, 'apps/example/android/app/src/main/res')

// The mark sits on an opaque ground: iOS rejects alpha outright, and the dark outer hexagon
// is what carries the silhouette on a light surface.
const BACKGROUND = '#FFFFFF'

// Android's adaptive icon guarantees only the central 66 of 108dp survives every mask shape,
// and the hexagon's points are its extremities, so the mark is fitted to exactly that circle.
const ADAPTIVE_CANVAS = 108
const ADAPTIVE_SAFE_DIAMETER = 66

const LEGACY_DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }

// Share of the icon's width the mark's bounding circle spans on the pre-adaptive launcher icons.
const LEGACY_FILL = 0.8

type Point = { x: number; y: number }
type Polygon = { points: Point[]; fill: string }

function parsePolygons(svg: string): Polygon[] {
  const polygons: Polygon[] = []
  // `fill` is either on the polygon or inherited from the one enclosing `<g>`
  let groupFill: string | null = null
  const tags = svg.matchAll(/<(g|\/g|polygon)\b([^>]*)>/g)
  for (const [, tag, attributes] of tags) {
    if (tag === '/g') {
      groupFill = null
      continue
    }
    const fill = attributes.match(/fill="([^"]+)"/)?.[1] ?? null
    if (tag === 'g') {
      groupFill = fill
      continue
    }
    const points = attributes.match(/points="([^"]+)"/)?.[1]
    const resolved = fill ?? groupFill
    if (points == null || resolved == null) {
      throw new Error(`Polygon without points or fill: ${attributes}`)
    }
    polygons.push({
      fill: resolved,
      points: points
        .trim()
        .split(/\s+/)
        .map((pair) => {
          const [x, y] = pair.split(',').map(Number)
          if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error(`Malformed point "${pair}"`)
          }
          return { x, y }
        }),
    })
  }
  return polygons
}

function parseViewBox(svg: string): number {
  const viewBox = svg.match(/viewBox="0 0 (\d+) (\d+)"/)
  if (viewBox == null || viewBox[1] !== viewBox[2]) {
    throw new Error('Expected a square viewBox anchored at the origin')
  }
  return Number(viewBox[1])
}

function parseColor(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff]
}

/** Reports whether the point is inside the polygon, by counting ray crossings. */
function contains(polygon: Point[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside
    }
  }
  return inside
}

type RenderOptions = {
  size: number
  /** Fraction of the canvas the logo's viewBox is scaled to occupy. */
  contentScale: number
  /** Clips the background to an inscribed circle, for the legacy round launcher icon. */
  round?: boolean
  /** Drops the background entirely, for the adaptive icon's foreground layer. */
  transparent?: boolean
}

const SAMPLES = 4

function render(polygons: Polygon[], viewBox: number, options: RenderOptions): Uint8Array {
  const { size, contentScale, round = false, transparent = false } = options
  const rgba = new Uint8Array(size * size * 4)

  if (!transparent) {
    const [r, g, b] = parseColor(BACKGROUND)
    const radius = size / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let coverage = 1
        if (round) {
          coverage = 0
          for (let sy = 0; sy < SAMPLES; sy++) {
            for (let sx = 0; sx < SAMPLES; sx++) {
              const dx = x + (sx + 0.5) / SAMPLES - radius
              const dy = y + (sy + 0.5) / SAMPLES - radius
              if (dx * dx + dy * dy <= radius * radius) coverage++
            }
          }
          coverage /= SAMPLES * SAMPLES
        }
        const at = (y * size + x) * 4
        rgba[at] = r
        rgba[at + 1] = g
        rgba[at + 2] = b
        rgba[at + 3] = Math.round(coverage * 255)
      }
    }
  }

  // viewBox units to pixels, centred
  const scale = (size * contentScale) / viewBox
  const offset = (size - viewBox * scale) / 2
  const project = (point: Point): Point => ({
    x: point.x * scale + offset,
    y: point.y * scale + offset,
  })

  for (const polygon of polygons) {
    const projected = polygon.points.map(project)
    const [r, g, b] = parseColor(polygon.fill)
    const minX = Math.max(0, Math.floor(Math.min(...projected.map((p) => p.x))))
    const maxX = Math.min(size - 1, Math.ceil(Math.max(...projected.map((p) => p.x))))
    const minY = Math.max(0, Math.floor(Math.min(...projected.map((p) => p.y))))
    const maxY = Math.min(size - 1, Math.ceil(Math.max(...projected.map((p) => p.y))))

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        let hits = 0
        for (let sy = 0; sy < SAMPLES; sy++) {
          for (let sx = 0; sx < SAMPLES; sx++) {
            if (contains(projected, x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) {
              hits++
            }
          }
        }
        if (hits === 0) continue

        const alpha = hits / (SAMPLES * SAMPLES)
        const at = (y * size + x) * 4
        const under = rgba[at + 3] / 255
        const over = alpha + under * (1 - alpha)
        // source-over with premultiplication undone, so edges over transparency stay clean
        for (let channel = 0; channel < 3; channel++) {
          const source = [r, g, b][channel]
          rgba[at + channel] = Math.round(
            (source * alpha + rgba[at + channel] * under * (1 - alpha)) / over,
          )
        }
        rgba[at + 3] = Math.round(over * 255)
      }
    }
  }

  return rgba
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Uint8Array): Buffer {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Encodes RGBA pixels as a PNG, dropping the alpha channel when opacity is not wanted. */
function encodePng(rgba: Uint8Array, size: number, withAlpha: boolean): Buffer {
  const channels = withAlpha ? 4 : 3
  const raw = Buffer.alloc(size * (size * channels + 1))
  for (let y = 0; y < size; y++) {
    const row = y * (size * channels + 1)
    raw[row] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const from = (y * size + x) * 4
      const to = row + 1 + x * channels
      raw[to] = rgba[from]
      raw[to + 1] = rgba[from + 1]
      raw[to + 2] = rgba[from + 2]
      if (withAlpha) raw[to + 3] = rgba[from + 3]
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = withAlpha ? 6 : 2 // colour type
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ])
}

/** Returns the mark's bounding radius in viewBox units, taken from the outer hexagon. */
function markRadius(outer: Polygon, viewBox: number): number {
  const centre = viewBox / 2
  return Math.max(...outer.points.map((p) => Math.hypot(p.x - centre, p.y - centre)))
}

/** Rewrites viewBox coordinates into the adaptive icon's 108dp canvas. */
function toAdaptivePath(points: Point[], viewBox: number, radius: number): string {
  const scale = ADAPTIVE_SAFE_DIAMETER / 2 / radius
  const centre = ADAPTIVE_CANVAS / 2
  return `${points
    .map((point, index) => {
      const x = ((point.x - viewBox / 2) * scale + centre).toFixed(3)
      const y = ((point.y - viewBox / 2) * scale + centre).toFixed(3)
      return `${index === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')} Z`
}

function vectorDrawable(paths: string): string {
  return `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${ADAPTIVE_CANVAS}dp"
    android:height="${ADAPTIVE_CANVAS}dp"
    android:viewportWidth="${ADAPTIVE_CANVAS}"
    android:viewportHeight="${ADAPTIVE_CANVAS}">
${paths}
</vector>
`
}

async function main(): Promise<void> {
  const svg = await readFile(LOGO, 'utf8')
  const viewBox = parseViewBox(svg)
  const polygons = parsePolygons(svg)
  if (polygons.length !== 8) {
    throw new Error(`Expected 8 polygons in the logo, found ${polygons.length}`)
  }

  const radius = markRadius(polygons[0], viewBox)
  // the contentScale that makes the mark's bounding circle span the given share of the canvas
  const fill = (share: number) => (share * viewBox) / (2 * radius)

  // iOS: one universal 1024 slot, opaque, the viewBox filling the canvas.
  await mkdir(IOS_ICONSET, { recursive: true })
  await writeFile(
    join(IOS_ICONSET, 'AppIcon.png'),
    encodePng(render(polygons, viewBox, { size: 1024, contentScale: 1 }), 1024, false),
  )
  await writeFile(
    join(IOS_ICONSET, 'Contents.json'),
    `${JSON.stringify(
      {
        images: [
          { filename: 'AppIcon.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2,
    )}\n`,
  )

  // Android: PNGs for API 24 and 25, which predate the adaptive icon.
  for (const [density, size] of Object.entries(LEGACY_DENSITIES)) {
    const directory = join(ANDROID_RES, `mipmap-${density}`)
    await mkdir(directory, { recursive: true })
    const contentScale = fill(LEGACY_FILL)
    await writeFile(
      join(directory, 'ic_launcher.png'),
      encodePng(render(polygons, viewBox, { size, contentScale }), size, true),
    )
    await writeFile(
      join(directory, 'ic_launcher_round.png'),
      encodePng(render(polygons, viewBox, { size, contentScale, round: true }), size, true),
    )
  }

  // Android: the adaptive icon stays vector, so no density loses detail.
  const foreground = polygons
    .map((polygon) => {
      const path = toAdaptivePath(polygon.points, viewBox, radius)
      return `    <path android:fillColor="${polygon.fill}" android:pathData="${path}" />`
    })
    .join('\n')
  const drawable = join(ANDROID_RES, 'drawable')
  await mkdir(drawable, { recursive: true })
  await writeFile(join(drawable, 'ic_launcher_foreground.xml'), vectorDrawable(foreground))

  // The themed icon is the outer hexagon with the seven children punched out, so the system
  // can tint one shape. `evenOdd` over a single path is what makes the holes holes.
  const monochromePath = polygons
    .map((polygon) => toAdaptivePath(polygon.points, viewBox, radius))
    .join(' ')
  await writeFile(
    join(drawable, 'ic_launcher_monochrome.xml'),
    vectorDrawable(
      `    <path android:fillColor="#FFFFFF" android:fillType="evenOdd" android:pathData="${monochromePath}" />`,
    ),
  )

  const anydpi = join(ANDROID_RES, 'mipmap-anydpi-v26')
  await mkdir(anydpi, { recursive: true })
  const adaptive = `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`
  await writeFile(join(anydpi, 'ic_launcher.xml'), adaptive)
  await writeFile(join(anydpi, 'ic_launcher_round.xml'), adaptive)

  await writeFile(
    join(ANDROID_RES, 'values', 'ic_launcher_background.xml'),
    `<resources>
    <color name="ic_launcher_background">${BACKGROUND}</color>
</resources>
`,
  )

  console.log(
    `Wrote the iOS icon, ${Object.keys(LEGACY_DENSITIES).length * 2} legacy PNGs and the adaptive icon.`,
  )
  console.log(
    `Mark spans ${((2 * radius) / viewBox) * 100}% of the iOS canvas and ` +
      `${ADAPTIVE_SAFE_DIAMETER}dp of the ${ADAPTIVE_CANVAS}dp adaptive canvas.`,
  )
}

await main()
