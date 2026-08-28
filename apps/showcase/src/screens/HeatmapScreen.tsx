import {
  type CameraRef,
  GeoJSONSource,
  Layer,
  type LngLatBounds,
  type MapProps,
  type MapRef,
} from '@maplibre/maplibre-react-native'
import type { Feature, FeatureCollection, Polygon } from 'geojson'
import React from 'react'
import { View } from 'react-native'
import { cellToLatLng, getHexagonEdgeLengthAvgKm, latLngToCell } from 'react-native-h3'
import { featureFromCell } from '../lib/cells'
import { loadPoints, POINT_COUNT } from '../lib/dataset'
import { boundsOfRing, emptyFeatureCollection } from '../lib/geo'
import { GERMANY_RING } from '../lib/germany'
import { cappedNote, formatCount, formatMs, measure } from '../lib/timing'
import {
  AUTO_RESOLUTION_MAX,
  AUTO_RESOLUTION_MIN,
  inBounds,
  padBoundsByCell,
  zoomToResolution,
} from '../lib/zoom'
import { ControlStrip, Segmented, StepSlider } from '../ui/ControlStrip'
import { type HelpEntry, HelpSheet } from '../ui/HelpSheet'
import { type HudProps, type HudRow, hudSplit, type LegendStop } from '../ui/HudCard'
import { IntroStrip } from '../ui/IntroStrip'
import { MapStage } from '../ui/MapStage'
import { TitleBar } from '../ui/TitleBar'
import { useH3Catch, useToast } from '../ui/Toast'
import { colors, screenStyles } from '../ui/theme'
import { useCameraPadding } from '../ui/useCameraPadding'

// occupied cells drawn in full before the viewport filter takes over
const VIEWPORT_THRESHOLD = 20000

// from this resolution on, off-screen cells are pure waste
const VIEWPORT_RESOLUTION = 10

// features one collection carries before the map stops keeping up
const DRAWN_CAP = 50000

// the sample interleaves `lat, lng`, so its length is twice the number of points
const COORDINATES_PER_POINT = 2

// an absolute ramp, so one colour means one density at every resolution
// thin cells keep the basemap readable, dense ones close over it
const RAMP = [
  { count: 1, color: colors.zoneA, opacity: 0.25 },
  { count: 10, color: colors.zoneC, opacity: 0.4 },
  { count: 50, color: colors.zoneB, opacity: 0.55 },
  { count: 200, color: colors.danger, opacity: 0.7 },
  { count: 1000, color: colors.zoneD, opacity: 0.8 },
]

const LEGEND: LegendStop[] = RAMP.map((stop, index) => ({
  label: index === RAMP.length - 1 ? `${stop.count}+` : String(stop.count),
  color: stop.color,
}))

const EMPTY_VIEWPORT_NOTE = 'No points in this viewport; pan to a city.'

const GERMANY_BOUNDS = boundsOfRing(GERMANY_RING)
const INITIAL_FIXED_RESOLUTION = 7
const MODES = ['auto', 'fixed'] as const

const SHOWS =
  `Every zoom bins ${formatCount(POINT_COUNT)} points into cells with latLngToCell, at the ` +
  'resolution the current zoom calls for.'

const USED_FOR = 'demand aggregation, spatial joins and hot spots without a server round trip.'

const HELP: readonly HelpEntry[] = [
  {
    term: 'The points',
    text: `${formatCount(POINT_COUNT)} synthetic points: dense cores around twelve German cities, a wide halo around each, corridors between the big ones and a thin scatter over the rest of the country. The seed is fixed, so every device sees the same sample.`,
  },
  {
    term: 'The zoom ladder',
    text: `In auto mode the resolution follows the zoom: ${AUTO_RESOLUTION_MIN} below zoom 8, ${AUTO_RESOLUTION_MIN + 1} up to zoom 10, then one resolution per zoom level up to ${AUTO_RESOLUTION_MAX}.`,
  },
  {
    term: 'auto and fixed',
    text: `fixed pins one resolution between ${AUTO_RESOLUTION_MIN} and ${AUTO_RESOLUTION_MAX}, so the cells stay the same size while the map moves under them.`,
  },
  {
    term: 'The colours',
    text: 'Each colour stands for a number of points in one cell. The scale is absolute, so one colour means one density at every resolution.',
  },
  {
    term: 'The numbers',
    text: `loop times ${formatCount(POINT_COUNT)} latLngToCell calls and the counting around them, and geojson is the JavaScript that builds the polygons.`,
  },
  {
    term: 'The viewport rule',
    text: `From resolution ${VIEWPORT_RESOLUTION}, or above ${formatCount(VIEWPORT_THRESHOLD)} occupied cells, only cells whose centre falls in the viewport are drawn.`,
  },
  {
    term: 'The drawn cap',
    text: `At most ${formatCount(DRAWN_CAP)} cells reach the map in one collection, and the note under the numbers says when the rest are left out.`,
  },
]

const EMPTY = emptyFeatureCollection<Polygon>()

const CELL_LAYER = (
  <Layer
    id="heatmap-fill"
    type="fill"
    source="heatmap-cells"
    paint={{
      'fill-opacity': [
        'interpolate',
        ['linear'],
        ['get', 'count'],
        ...RAMP.flatMap((stop) => [stop.count, stop.opacity]),
      ],
      'fill-color': [
        'interpolate',
        ['linear'],
        ['get', 'count'],
        ...RAMP.flatMap((stop) => [stop.count, stop.color]),
      ],
    }}
  />
)

type Mode = (typeof MODES)[number]

type Region = { bounds: LngLatBounds; zoom: number }

type Counted = { counts: Map<bigint, number>; loopMs: number }

type Built = { features: Feature<Polygon>[]; capped: boolean }

type Binned = {
  res: number
  occupied: number
  drawn: number
  capped: boolean
  loopMs: number
  buildMs: number
  data: FeatureCollection<Polygon>
}

/** Counts how many sample points fall into each cell, and times the loop that does it. */
function bin(points: Float64Array, res: number): Counted {
  const counts = new Map<bigint, number>()
  const loop = measure(() => {
    for (let i = 0; i < points.length; i += COORDINATES_PER_POINT) {
      const cell = latLngToCell(points[i], points[i + 1], res)
      counts.set(cell, (counts.get(cell) ?? 0) + 1)
    }
  })
  return { counts, loopMs: loop.ms }
}

/** Returns the box a cell centre must fall inside to be drawn, or `null` to draw every cell. */
function viewportBox(
  occupied: number,
  res: number,
  bounds: LngLatBounds | null,
): LngLatBounds | null {
  if (bounds == null) return null
  if (res < VIEWPORT_RESOLUTION && occupied <= VIEWPORT_THRESHOLD) return null
  return padBoundsByCell(bounds, getHexagonEdgeLengthAvgKm(res))
}

/** Builds the polygon of every counted cell, dropping those a viewport box or the cap excludes. */
function featuresInBox(counts: Map<bigint, number>, box: LngLatBounds | null): Built {
  const features: Feature<Polygon>[] = []
  for (const [cell, count] of counts) {
    // the cell's own centre decides, not whichever point landed in it first
    if (box != null) {
      const centre = cellToLatLng(cell)
      if (!inBounds(centre.lat, centre.lng, box)) continue
    }
    if (features.length === DRAWN_CAP) return { features, capped: true }
    features.push(featureFromCell(cell, { count }))
  }
  return { features, capped: false }
}

/** Builds one HUD row per figure the last binning measured, filed under the side that paid. */
function hudRows(result: Binned | null, points: Float64Array | null): HudRow[] {
  return [
    // the loop time only means something beside the number of calls it made
    {
      label: 'points',
      value: points == null ? '-' : formatCount(points.length / COORDINATES_PER_POINT),
      side: 'h3',
    },
    { label: 'cells', value: result == null ? '0' : formatCount(result.occupied), side: 'h3' },
    { label: 'loop', value: result == null ? '-' : formatMs(result.loopMs), side: 'h3' },
    { label: 'geojson', value: result == null ? '-' : formatMs(result.buildMs), side: 'app' },
  ]
}

/** Says how much of the occupied set reaches the map, once a filter or the cap takes over. */
function drawnNote(result: Binned | null): string | undefined {
  if (result == null) return undefined
  if (result.drawn === 0) return EMPTY_VIEWPORT_NOTE
  if (result.capped) return cappedNote(result.occupied, DRAWN_CAP, 'cells')
  if (result.drawn >= result.occupied) return undefined
  return `Drawing ${formatCount(result.drawn)} cells in the viewport.`
}

export function HeatmapScreen({ onPressMark }: { onPressMark: () => void }): React.JSX.Element {
  const map = React.useRef<MapRef>(null)
  const camera = React.useRef<CameraRef>(null)
  const region = React.useRef<Region | null>(null)
  const catchH3 = useH3Catch()
  const { reportError } = useToast()
  const stage = useCameraPadding()

  const [points, setPoints] = React.useState<Float64Array | null>(null)
  const [help, setHelp] = React.useState(false)
  const [mode, setMode] = React.useState<Mode>('auto')
  const [fixed, setFixed] = React.useState(INITIAL_FIXED_RESOLUTION)
  const [result, setResult] = React.useState<Binned | null>(null)

  const rebin = React.useCallback(
    (res: number) => {
      if (points == null) return
      catchH3(() => {
        const { counts, loopMs } = bin(points, res)
        const built = measure(() =>
          featuresInBox(counts, viewportBox(counts.size, res, region.current?.bounds ?? null)),
        )
        setResult({
          res,
          occupied: counts.size,
          drawn: built.value.features.length,
          capped: built.value.capped,
          loopMs,
          buildMs: built.ms,
          data: { type: 'FeatureCollection', features: built.value.features },
        })
      })
    },
    [catchH3, points],
  )

  const chooseResolution = React.useCallback((): number | null => {
    const current = region.current
    // neither mode bins before the map reports the opening fit
    if (current == null) return null
    return mode === 'fixed' ? fixed : zoomToResolution(current.zoom)
  }, [fixed, mode])

  const onRegionDidChange = React.useCallback<NonNullable<MapProps['onRegionDidChange']>>(
    (event) => {
      region.current = { bounds: event.nativeEvent.bounds, zoom: event.nativeEvent.zoom }
      const res = chooseResolution()
      // binning at gesture end, never per frame, keeps the pan smooth
      if (res != null) rebin(res)
    },
    [chooseResolution, rebin],
  )

  // the sample arriving and either control moving all mean the same `rebin`
  React.useEffect(() => {
    const res = chooseResolution()
    if (res != null) rebin(res)
  }, [chooseResolution, rebin])

  React.useEffect(() => {
    void loadPoints().then(setPoints).catch(reportError)
  }, [reportError])

  const initialViewState = React.useMemo(
    () => ({ bounds: GERMANY_BOUNDS, padding: stage.padding }),
    [stage.padding],
  )

  const hud: HudProps = {
    rows: hudRows(result, points),
    split: result == null ? undefined : hudSplit([result.loopMs], result.buildMs),
    note: drawnNote(result),
    legend: LEGEND,
  }

  return (
    <View style={screenStyles.screen}>
      <TitleBar title="Heatmap" resolution={result?.res ?? null} onPressMark={onPressMark} />
      <IntroStrip id="heatmap" shows={SHOWS} usedFor={USED_FOR} />
      <MapStage
        stage={stage}
        map={map}
        camera={camera}
        initialViewState={initialViewState}
        onRegionDidChange={onRegionDidChange}
        onHelp={() => setHelp(true)}
        hud={hud}
      >
        <GeoJSONSource id="heatmap-cells" data={result?.data ?? EMPTY}>
          {CELL_LAYER}
        </GeoJSONSource>
      </MapStage>
      <ControlStrip>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        {mode === 'fixed' ? (
          <StepSlider
            label="res"
            min={AUTO_RESOLUTION_MIN}
            max={AUTO_RESOLUTION_MAX}
            value={fixed}
            onChange={setFixed}
          />
        ) : null}
      </ControlStrip>
      <HelpSheet title="Heatmap" entries={HELP} visible={help} onClose={() => setHelp(false)} />
    </View>
  )
}
