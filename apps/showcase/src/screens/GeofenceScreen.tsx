import {
  type CameraRef,
  GeoJSONSource,
  Layer,
  type LngLat,
  type MapRef,
  type PixelPoint,
} from '@maplibre/maplibre-react-native'
import type { FeatureCollection } from 'geojson'
import React from 'react'
import { ActivityIndicator, StyleSheet, View } from 'react-native'
import {
  cellsToMultiPolygonAsync,
  compactCells,
  polygonToCellsAsync,
  type Ring,
} from 'react-native-h3'
import { BERLIN_RING } from '../lib/berlin'
import { featureCollectionFromCells } from '../lib/cells'
import {
  boundsOfRing,
  emptyFeatureCollection,
  hasThreeDistinctPoints,
  lineFeature,
  multiPolygonFeature,
  ringFromLngLat,
} from '../lib/geo'
import {
  cappedNote,
  formatCount,
  formatMs,
  type Measured,
  measure,
  measureAsync,
} from '../lib/timing'
import { ActionButton, ControlStrip, Segmented, StepSlider } from '../ui/ControlStrip'
import { DrawCanvas } from '../ui/DrawCanvas'
import { ClearGlyph, PenGlyph } from '../ui/Glyphs'
import { type HelpEntry, HelpSheet } from '../ui/HelpSheet'
import { type HudProps, type HudRow, hudSplit } from '../ui/HudCard'
import { IntroStrip } from '../ui/IntroStrip'
import { MapControl } from '../ui/MapControls'
import { MapStage } from '../ui/MapStage'
import { TitleBar } from '../ui/TitleBar'
import { useToast } from '../ui/Toast'
import { colors, screenStyles } from '../ui/theme'
import { useCameraPadding } from '../ui/useCameraPadding'

// cells the raw view still draws smoothly
const RAW_CAP = 50000

const BERLIN_BOUNDS = boundsOfRing(BERLIN_RING)
const MIN_RESOLUTION = 6
const MAX_RESOLUTION = 12
const VIEWS = ['raw', 'compacted', 'outline'] as const
const RAW_DISABLED = ['raw'] as const

const DRAWING_NOTE = 'Drawing: release to fill'

const SHOWS =
  'A stroke on the map becomes a ring, and polygonToCellsAsync fills it with cells on a ' +
  'background thread.'

const USED_FOR = 'geofence membership checks by cell set, region indexing and dedup on device.'

const HELP: readonly HelpEntry[] = [
  {
    term: 'Draw',
    text: 'The pen arms drawing. Trace a region on the map with one finger and release to fill it.',
  },
  {
    term: 'raw',
    text: 'Every cell of the chosen resolution whose centre falls inside the region you drew.',
  },
  {
    term: 'compacted',
    text:
      'compactCells collapses every full group of seven children into their parent. The area ' +
      'stays the same, the polygon count falls sharply.',
  },
  {
    term: 'outline',
    text: 'cellsToMultiPolygon returns only the boundary of the union, without the interior edges.',
  },
  {
    term: 'Resolution',
    text: `The slider spans resolutions ${MIN_RESOLUTION} to ${MAX_RESOLUTION}, where one cell edge measures roughly 3 km down to 9 m.`,
  },
  {
    term: 'The numbers',
    text:
      'H3 time is polygonToCellsAsync alone, compact and outline time their own calls, and ' +
      'geojson is the JavaScript that builds the map data. polygons counts the shapes drawn.',
  },
  {
    term: 'The raw cap',
    text: `Above ${formatCount(RAW_CAP)} cells the raw view is switched off and the compacted view takes over. No view builds more than ${formatCount(RAW_CAP)} shapes, and the note under the numbers says when the rest are left out.`,
  },
]

const EMPTY = emptyFeatureCollection()

const CELL_LAYER = (
  <Layer
    id="geofence-fill"
    type="fill"
    source="geofence-cells"
    paint={{
      'fill-color': colors.zoneA,
      'fill-opacity': 0.35,
      'fill-outline-color': colors.accent,
    }}
  />
)

const PATH_LAYER = (
  <Layer
    id="geofence-line"
    type="line"
    source="geofence-path"
    paint={{ 'line-color': colors.accent, 'line-width': 2 }}
  />
)

type ViewMode = (typeof VIEWS)[number]

type Result = {
  cells: number
  polygons: number
  drawn: number
  mode: ViewMode
  capped: boolean
  fillMs: number
  compactMs: number | null
  outlineMs: number | null
  buildMs: number
  data: FeatureCollection
}

type Filled = { ring: Ring; res: number; cells: Measured<BigUint64Array> }

/** Shapes a filled cell set into the collection the chosen view draws. */
async function shape(filled: Measured<BigUint64Array>, view: ViewMode): Promise<Result> {
  const cells = filled.value
  const capped = cells.length > RAW_CAP
  const mode: ViewMode = capped && view === 'raw' ? 'compacted' : view

  if (mode === 'outline') {
    const loops = await measureAsync(() => cellsToMultiPolygonAsync(cells))
    const shown = loops.value.slice(0, RAW_CAP)
    const built = measure(() => multiPolygonFeature(shown, 'outline'))
    return {
      cells: cells.length,
      polygons: loops.value.length,
      drawn: shown.length,
      mode,
      capped,
      fillMs: filled.ms,
      compactMs: null,
      outlineMs: loops.ms,
      buildMs: built.ms,
      data: { type: 'FeatureCollection', features: [built.value] },
    }
  }

  const compacted = mode === 'compacted' ? measure(() => compactCells(cells)) : null
  const reshaped = compacted?.value ?? cells
  // no view builds more shapes than the map draws smoothly, whatever the fill returned
  const shown = reshaped.subarray(0, RAW_CAP)
  const built = measure(() => featureCollectionFromCells(shown))
  return {
    cells: cells.length,
    polygons: reshaped.length,
    drawn: shown.length,
    mode,
    capped,
    fillMs: filled.ms,
    compactMs: compacted?.ms ?? null,
    outlineMs: null,
    buildMs: built.ms,
    data: built.value,
  }
}

/** Says why the raw view is out of reach, once a fill has passed the cap. */
function capNote(result: Result | null): string | undefined {
  if (result == null || !result.capped) return undefined
  const cells = formatCount(result.cells)
  return result.mode === 'compacted'
    ? `${cells} cells, showing compacted: ${formatCount(result.polygons)} polygons`
    : `${cells} cells, more than the ${formatCount(RAW_CAP)} the raw view draws`
}

/** Builds one HUD row per figure the last fill measured, filed under the side that paid for it. */
function hudRows(result: Result | null, view: ViewMode): HudRow[] {
  const rows: HudRow[] = [
    { label: 'cells', value: result == null ? '0' : formatCount(result.cells), side: 'h3' },
    { label: 'H3 time', value: result == null ? '-' : formatMs(result.fillMs), side: 'h3' },
    { label: 'geojson', value: result == null ? '-' : formatMs(result.buildMs), side: 'app' },
    { label: 'polygons', value: result == null ? '0' : formatCount(result.polygons), side: 'app' },
    { label: 'view', value: view, side: 'app' },
  ]
  if (result == null) return rows
  // both reshape a cell set the package already holds, so they belong to the native side
  if (result.compactMs != null) {
    rows.push({ label: 'compact', value: formatMs(result.compactMs), side: 'h3' })
  }
  if (result.outlineMs != null) {
    rows.push({ label: 'outline', value: formatMs(result.outlineMs), side: 'h3' })
  }
  return rows
}

/** Keeps what the cap did to the last fill readable while a stroke asks for the next one. */
function hudNote(result: Result | null, drawing: boolean): string | undefined {
  const notes = [
    drawing ? DRAWING_NOTE : undefined,
    capNote(result),
    result == null ? undefined : cappedNote(result.polygons, result.drawn, 'polygons'),
  ]
  const shown = notes.filter((note): note is string => note != null)
  return shown.length === 0 ? undefined : shown.join('\n')
}

export function GeofenceScreen({ onPressMark }: { onPressMark: () => void }): React.JSX.Element {
  const map = React.useRef<MapRef>(null)
  const camera = React.useRef<CameraRef>(null)
  const landed = React.useRef(false)
  const latest = React.useRef(0)
  const filled = React.useRef<Filled | null>(null)
  const { reportError } = useToast()
  const stage = useCameraPadding()

  const [resolution, setResolution] = React.useState(9)
  const [drawing, setDrawing] = React.useState(false)
  const [stroking, setStroking] = React.useState(false)
  const [help, setHelp] = React.useState(false)
  const [view, setView] = React.useState<ViewMode>('raw')
  const [busy, setBusy] = React.useState(false)
  const [ring, setRing] = React.useState<Ring | null>(null)
  const [result, setResult] = React.useState<Result | null>(null)

  const run = React.useCallback(
    (nextRing: Ring, nextView: ViewMode, res: number) => {
      const id = ++latest.current
      setRing(nextRing)
      setBusy(true)
      void (async () => {
        // switching the view reshapes the cells the last fill produced
        const kept = filled.current
        const cells =
          kept != null && kept.ring === nextRing && kept.res === res
            ? kept.cells
            : await measureAsync(() => polygonToCellsAsync([nextRing], res))
        // a later run has superseded this one
        if (id !== latest.current) return
        filled.current = { ring: nextRing, res, cells }
        const next = await shape(cells, nextView)
        if (id !== latest.current) return
        setView(next.mode)
        setResult(next)
      })()
        .catch(reportError)
        .finally(() => {
          if (id === latest.current) setBusy(false)
        })
    },
    [reportError],
  )

  const sample = React.useCallback(() => {
    run(BERLIN_RING, view, resolution)
    // a drawn ring is already on screen, the sample is not
    camera.current?.fitBounds(BERLIN_BOUNDS, { padding: stage.padding })
  }, [resolution, run, stage.padding, view])

  // the screen opens on the sample, never on a bare map
  React.useEffect(() => {
    if (landed.current) return
    landed.current = true
    run(BERLIN_RING, view, resolution)
  }, [resolution, run, view])

  const startStroke = React.useCallback(() => setStroking(true), [])

  const fill = React.useCallback(
    async (points: PixelPoint[]) => {
      setStroking(false)
      const lngLats = await Promise.all(points.map((point) => map.current?.unproject(point)))
      const drawn = ringFromLngLat(lngLats.filter((value): value is LngLat => value != null))
      // a tap is not a region
      if (!hasThreeDistinctPoints(drawn)) return
      run(drawn, view, resolution)
    },
    [resolution, run, view],
  )

  const initialViewState = React.useMemo(
    () => ({ bounds: BERLIN_BOUNDS, padding: stage.padding }),
    [stage.padding],
  )

  const clear = React.useCallback((): void => {
    // a fill still in flight must not repopulate the map
    latest.current += 1
    filled.current = null
    setBusy(false)
    setRing(null)
    setResult(null)
  }, [])

  const path = React.useMemo(
    (): FeatureCollection =>
      ring == null ? EMPTY : { type: 'FeatureCollection', features: [lineFeature(ring, 'drawn')] },
    [ring],
  )

  const hud: HudProps = {
    rows: hudRows(result, view),
    split:
      result == null
        ? undefined
        : hudSplit([result.fillMs, result.compactMs, result.outlineMs], result.buildMs),
    note: hudNote(result, stroking),
  }

  return (
    <View style={screenStyles.screen}>
      <TitleBar title="Geofence" resolution={resolution} onPressMark={onPressMark} />
      <IntroStrip id="geofence" shows={SHOWS} usedFor={USED_FOR} />
      <MapStage
        stage={stage}
        map={map}
        camera={camera}
        initialViewState={initialViewState}
        gestures={!drawing}
        onHelp={() => setHelp(true)}
        overlay={
          <>
            {drawing ? <DrawCanvas onStart={startStroke} onComplete={fill} /> : null}
            {busy ? (
              <View style={styles.spinner} pointerEvents="none">
                <ActivityIndicator color={colors.accent} size="large" />
              </View>
            ) : null}
          </>
        }
        controls={
          <>
            <MapControl label="Clear" glyph={ClearGlyph} disabled={ring == null} onPress={clear} />
            <MapControl
              label="Draw a region"
              glyph={PenGlyph}
              active={drawing}
              onPress={() => setDrawing((current) => !current)}
            />
          </>
        }
        hud={hud}
      >
        <GeoJSONSource id="geofence-cells" data={result?.data ?? EMPTY}>
          {CELL_LAYER}
        </GeoJSONSource>
        <GeoJSONSource id="geofence-path" data={path}>
          {PATH_LAYER}
        </GeoJSONSource>
      </MapStage>
      <ControlStrip>
        <StepSlider
          label="res"
          min={MIN_RESOLUTION}
          max={MAX_RESOLUTION}
          value={resolution}
          onChange={(next) => {
            setResolution(next)
            if (ring != null) run(ring, view, next)
          }}
        />
        <Segmented
          options={VIEWS}
          value={view}
          disabled={result?.capped === true ? RAW_DISABLED : undefined}
          onChange={(next) => {
            setView(next)
            if (ring != null) run(ring, next, resolution)
          }}
        />
        <ActionButton label="Sample: Berlin" onPress={sample} />
      </ControlStrip>
      <HelpSheet title="Geofence" entries={HELP} visible={help} onClose={() => setHelp(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  spinner: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
})
