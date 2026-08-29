import {
  type CameraRef,
  GeoJSONSource,
  Layer,
  type LngLat,
  type MapProps,
  type MapRef,
  type PressEvent,
} from '@maplibre/maplibre-react-native'
import type { Feature, FeatureCollection, Point, Polygon } from 'geojson'
import React from 'react'
import { type NativeSyntheticEvent, View } from 'react-native'
import { gridDisk, gridDiskDistances, latLngToCell } from 'react-native-h3'
import { CEILING_HELP } from '../lib/ceiling'
import { featureFromCell } from '../lib/cells'
import { emptyFeatureCollection, latLngFromLngLat, pointFeature } from '../lib/geo'
import { intersectCells, toCellSet } from '../lib/sets'
import { formatCount, formatMs, measure } from '../lib/timing'
import { ControlStrip, Segmented, StepSlider } from '../ui/ControlStrip'
import { ClearGlyph } from '../ui/Glyphs'
import { type HelpEntry, HelpSheet } from '../ui/HelpSheet'
import { type HudProps, type HudRow, hudSplit } from '../ui/HudCard'
import { IntroStrip } from '../ui/IntroStrip'
import { MapControl } from '../ui/MapControls'
import { MapStage } from '../ui/MapStage'
import { TitleBar } from '../ui/TitleBar'
import { useH3Catch, useToast } from '../ui/Toast'
import { colors, screenStyles } from '../ui/theme'
import { useCameraPadding } from '../ui/useCameraPadding'

// largest `k` whose three disks still reach the map as one collection
const K_MAX = 60

const BERLIN: LngLat = [13.405, 52.52]
const INITIAL_ZOOM = 10
const RESOLUTION = 9
const INITIAL_K = 8
const MODES = ['union', 'intersection', 'rings'] as const
const MIN_INTERSECTION_MARKERS = 2

// half of MapLibre's default source hitbox, `44` by `44` pixels
const MARKER_HIT_RADIUS_PX = 22

// one colour per marker, a ramp the rings step through
const ZONE_COLORS = [colors.zoneA, colors.zoneB, colors.zoneC]
const BAND_COLORS = [colors.zoneA, colors.zoneC, colors.zoneB, colors.danger, colors.zoneD]

const MARKER_LIMIT = ZONE_COLORS.length

/** Counts the cells of one disk, the closed form H3 documents as `1 + 3k(k + 1)`. */
function cellsInDisk(k: number): number {
  return 1 + 3 * k * (k + 1)
}

const SHOWS =
  'gridDisk walks the grid outwards from every marker, and the algebra over the disks runs on ' +
  'bigint sets in JavaScript.'

const USED_FOR = 'coverage analysis, catchment areas and service area overlap.'

const HELP: readonly HelpEntry[] = [
  {
    term: 'Markers',
    text: `A long press places a marker, up to ${MARKER_LIMIT}. A tap on one removes it again.`,
  },
  {
    term: 'k',
    text: `k is how many rings of neighbours gridDisk walks out from each marker. At k = ${K_MAX} one disk holds ${formatCount(cellsInDisk(K_MAX))} cells.`,
  },
  { term: 'union', text: "Draws every cell of every disk in its own marker's colour." },
  {
    term: 'intersection',
    text: 'Paints the cells all disks share, over the disks themselves drawn faintly beneath.',
  },
  {
    term: 'rings',
    text: 'Uses gridDiskDistances and colours each cell by its smallest distance to any marker.',
  },
  {
    term: 'The numbers',
    text:
      'per disk and disk time cover all gridDisk calls, geojson is the JavaScript that builds ' +
      'the polygons, and shared counts the cells the intersection found.',
  },
  { term: 'The ceiling', text: CEILING_HELP },
]

const MARKER_LIMIT_MESSAGE = 'Three markers is the limit.'
const PLACE_MARKERS_NOTE = 'Long press to place up to three markers.'
const SECOND_MARKER_NOTE = 'Place a second marker to see an intersection.'
const NO_OVERLAP_NOTE = 'No cells are shared. Raise k or move the markers closer.'

const EMPTY_CELLS = emptyFeatureCollection<Polygon>()
const EMPTY_MARKERS = emptyFeatureCollection<Point>()

// the role an intersection gives the disks it draws faintly beneath the shared cells
const UNDERLAY_ROLE = 'underlay'
const CELL_OPACITY = 0.4
const UNDERLAY_OPACITY = 0.12

const UNDERLAY_LAYER = (
  <Layer
    id="coverage-underlay"
    type="fill"
    source="coverage-cells"
    filter={['==', ['get', 'role'], UNDERLAY_ROLE]}
    paint={{
      'fill-opacity': UNDERLAY_OPACITY,
      'fill-color': ['to-color', ['get', 'color']],
    }}
  />
)

const CELL_LAYER = (
  <Layer
    id="coverage-fill"
    type="fill"
    source="coverage-cells"
    // a missing `role` is unequal to any string, so every other mode draws here
    filter={['!=', ['get', 'role'], UNDERLAY_ROLE]}
    paint={{
      'fill-opacity': CELL_OPACITY,
      // the mode decides a cell's colour, so it travels with the feature
      'fill-color': ['to-color', ['get', 'color']],
    }}
  />
)

const MARKER_LAYER = (
  <Layer
    id="coverage-marker"
    type="circle"
    source="coverage-markers"
    paint={{
      'circle-radius': 7,
      'circle-color': colors.ink,
      'circle-stroke-color': colors.paper,
      'circle-stroke-width': 2,
    }}
  />
)

type SourcePress = NonNullable<React.ComponentProps<typeof GeoJSONSource>['onPress']>

type Mode = (typeof MODES)[number]

type Marker = { id: string; lat: number; lng: number }

type Job = { markers: Marker[]; k: number; mode: Mode }

type Grids = { disks: BigUint64Array[]; bands: BigUint64Array[][]; perDisk: number[] }

type Painted = { features: Feature<Polygon>[]; shared: number }

type Computed = {
  mode: Mode
  perDisk: number[]
  shared: number
  diskMs: number
  buildMs: number
  data: FeatureCollection<Polygon>
}

/** Bands a disk into as many colours as the ramp holds, whatever `k` the slider stands at. */
function bandColor(distance: number, k: number): string {
  const last = BAND_COLORS.length - 1
  const band = k === 0 ? 0 : Math.min(last, Math.floor((distance / k) * BAND_COLORS.length))
  return BAND_COLORS[band]
}

/** Walks the grid around every marker, splitting a disk into rings only where they are drawn. */
function traverse(markers: Marker[], k: number, mode: Mode): Grids {
  const disks: BigUint64Array[] = []
  const bands: BigUint64Array[][] = []
  const perDisk: number[] = []
  for (const marker of markers) {
    const origin = latLngToCell(marker.lat, marker.lng, RESOLUTION)
    if (mode === 'rings') {
      const rings = gridDiskDistances(origin, k)
      bands.push(rings)
      perDisk.push(rings.reduce((sum, ring) => sum + ring.length, 0))
    } else {
      const disk = gridDisk(origin, k)
      disks.push(disk)
      perDisk.push(disk.length)
    }
  }
  return { disks, bands, perDisk }
}

/** Builds one feature per cell of every disk, in the colour of the marker it surrounds. */
function diskFeatures(disks: readonly BigUint64Array[], role?: string): Feature<Polygon>[] {
  const features: Feature<Polygon>[] = []
  for (const [index, disk] of disks.entries()) {
    const color = ZONE_COLORS[index]
    for (const cell of disk) {
      features.push(featureFromCell(cell, role == null ? { color } : { color, role }))
    }
  }
  return features
}

/** Builds the polygons the chosen mode paints, each carrying the colour it is drawn in. */
function paint(grids: Grids, mode: Mode, k: number): Painted {
  if (mode === 'rings') {
    // overlapping disks read as one distance field, not as stacked bands
    const nearest = new Map<bigint, number>()
    for (const rings of grids.bands) {
      for (const [distance, cells] of rings.entries()) {
        for (const cell of cells) {
          const seen = nearest.get(cell)
          if (seen == null || distance < seen) nearest.set(cell, distance)
        }
      }
    }
    const features: Feature<Polygon>[] = []
    for (const [cell, distance] of nearest) {
      features.push(featureFromCell(cell, { color: bandColor(distance, k) }))
    }
    return { features, shared: 0 }
  }

  if (mode === 'intersection') {
    // the disks stay faintly under the overlap, so a placed marker never leaves the map blank
    const features = diskFeatures(grids.disks, UNDERLAY_ROLE)
    // one disk intersects itself, which would paint it entirely as overlap
    if (grids.disks.length < MIN_INTERSECTION_MARKERS) return { features, shared: 0 }
    const common = intersectCells(grids.disks.map(toCellSet))
    for (const cell of common) features.push(featureFromCell(cell, { color: colors.shared }))
    return { features, shared: common.size }
  }

  return { features: diskFeatures(grids.disks), shared: 0 }
}

/** Times the traversal and the boundary build separately, since only one of them is the cost. */
function build(markers: Marker[], k: number, mode: Mode): Computed {
  const grids = measure(() => traverse(markers, k, mode))
  const painted = measure(() => paint(grids.value, mode, k))
  return {
    mode,
    perDisk: grids.value.perDisk,
    shared: painted.value.shared,
    diskMs: grids.ms,
    buildMs: painted.ms,
    data: { type: 'FeatureCollection', features: painted.value.features },
  }
}

/** Reports how many cells one disk holds, as a range where a pentagon makes the disks differ. */
function diskSize(perDisk: readonly number[]): string {
  const low = Math.min(...perDisk)
  const high = Math.max(...perDisk)
  return low === high ? formatCount(low) : `${formatCount(low)}-${formatCount(high)}`
}

/** Builds one HUD row per figure the last traversal measured, filed under the side that paid. */
function hudRows(result: Computed | null): HudRow[] {
  const rows: HudRow[] = [
    {
      label: 'per disk',
      value: result == null ? '-' : diskSize(result.perDisk),
      side: 'h3',
    },
    { label: 'disk time', value: result == null ? '-' : formatMs(result.diskMs), side: 'h3' },
    { label: 'geojson', value: result == null ? '-' : formatMs(result.buildMs), side: 'app' },
  ]
  // the shared count only means something once two disks are being compared
  if (result?.mode === 'intersection') {
    // `intersectCells` walks bigint sets in JavaScript, so the overlap is the app's own work
    rows.push({ label: 'shared', value: formatCount(result.shared), side: 'app' })
  }
  return rows
}

/** Says what the map is waiting for, or why an intersection of placed disks is empty. */
function hudNote(result: Computed | null, placed: number): string | undefined {
  if (placed === 0) return PLACE_MARKERS_NOTE
  // the note describes what is drawn, so it follows the result rather than the controls
  if (result == null || result.mode !== 'intersection') return undefined
  if (result.perDisk.length < MIN_INTERSECTION_MARKERS) return SECOND_MARKER_NOTE
  return result.shared === 0 ? NO_OVERLAP_NOTE : undefined
}

export function CoverageScreen({ onPressMark }: { onPressMark: () => void }): React.JSX.Element {
  const catchH3 = useH3Catch()
  const { show } = useToast()
  const stage = useCameraPadding()
  const map = React.useRef<MapRef>(null)
  const camera = React.useRef<CameraRef>(null)
  const pending = React.useRef<Job | null>(null)
  const frame = React.useRef<number | null>(null)
  const nextId = React.useRef(0)
  const placed = React.useRef<Marker[]>([])

  const [markers, setMarkers] = React.useState<Marker[]>([])
  const [k, setK] = React.useState(INITIAL_K)
  const [mode, setMode] = React.useState<Mode>('union')
  const [help, setHelp] = React.useState(false)
  const [result, setResult] = React.useState<Computed | null>(null)

  // every input reaches the map through here, so a build has one owner
  React.useEffect(() => {
    pending.current = { markers, k, mode }
    if (frame.current != null) return
    // a drag outpaces the build, so a frame draws only the last value it saw
    frame.current = requestAnimationFrame(() => {
      frame.current = null
      const job = pending.current
      pending.current = null
      if (job == null) return
      if (job.markers.length === 0) {
        setResult(null)
        return
      }
      catchH3(() => setResult(build(job.markers, job.k, job.mode)))
    })
  }, [catchH3, k, markers, mode])

  React.useEffect(() => {
    return () => {
      if (frame.current != null) cancelAnimationFrame(frame.current)
    }
  }, [])

  // the hit test below runs after an await, so it reads the markers through a ref
  React.useEffect(() => {
    placed.current = markers
  }, [markers])

  const place = React.useCallback(
    async (event: NativeSyntheticEvent<PressEvent>): Promise<void> => {
      const existing = placed.current
      if (existing.length >= MARKER_LIMIT) {
        show(MARKER_LIMIT_MESSAGE)
        return
      }
      const { lngLat, point } = event.nativeEvent
      const drawn = await Promise.all(
        existing.map((marker) => map.current?.project([marker.lng, marker.lat])),
      )
      // a press over a marker belongs to the tap that removes it
      const onMarker = drawn.some(
        (at) =>
          at != null && Math.hypot(at[0] - point[0], at[1] - point[1]) <= MARKER_HIT_RADIUS_PX,
      )
      if (onMarker) return
      const marker = { id: `marker-${nextId.current++}`, ...latLngFromLngLat(lngLat) }
      // the functional updater, not the ref above, decides whether the limit still holds
      setMarkers((current) => (current.length >= MARKER_LIMIT ? current : [...current, marker]))
    },
    [show],
  )

  const onLongPress = React.useCallback<NonNullable<MapProps['onLongPress']>>(
    (event) => void place(event),
    [place],
  )

  const removeMarker = React.useCallback<SourcePress>((event) => {
    const tapped = event.nativeEvent.features[0]?.properties?.id as string | undefined
    if (tapped == null) return
    setMarkers((current) => current.filter((marker) => marker.id !== tapped))
  }, [])

  const initialViewState = React.useMemo(
    () => ({ center: BERLIN, zoom: INITIAL_ZOOM, padding: stage.padding }),
    [stage.padding],
  )

  const markerData = React.useMemo((): FeatureCollection<Point> => {
    if (markers.length === 0) return EMPTY_MARKERS
    return {
      type: 'FeatureCollection',
      features: markers.map((marker) =>
        pointFeature(marker.lat, marker.lng, marker.id, { id: marker.id }),
      ),
    }
  }, [markers])

  const hud: HudProps = {
    rows: hudRows(result),
    split: result == null ? undefined : hudSplit([result.diskMs], result.buildMs),
    note: hudNote(result, markers.length),
  }

  return (
    <View style={screenStyles.screen}>
      <TitleBar title="Coverage" resolution={RESOLUTION} onPressMark={onPressMark} />
      <IntroStrip id="coverage" shows={SHOWS} usedFor={USED_FOR} />
      <MapStage
        stage={stage}
        map={map}
        camera={camera}
        initialViewState={initialViewState}
        onLongPress={onLongPress}
        onHelp={() => setHelp(true)}
        controls={
          <MapControl
            label="Clear"
            glyph={ClearGlyph}
            disabled={markers.length === 0}
            onPress={() => setMarkers([])}
          />
        }
        hud={hud}
      >
        <GeoJSONSource id="coverage-cells" data={result?.data ?? EMPTY_CELLS}>
          {UNDERLAY_LAYER}
          {CELL_LAYER}
        </GeoJSONSource>
        <GeoJSONSource id="coverage-markers" data={markerData} onPress={removeMarker}>
          {MARKER_LAYER}
        </GeoJSONSource>
      </MapStage>
      <ControlStrip>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <StepSlider label="k" min={0} max={K_MAX} value={k} onChange={setK} />
      </ControlStrip>
      <HelpSheet title="Coverage" entries={HELP} visible={help} onClose={() => setHelp(false)} />
    </View>
  )
}
