// src/hooks/useMapCanvas.ts
// Deck.gl powered map with Natural Earth data + real-time station rendering

import { useEffect, useRef } from 'react'
import { Deck, Layer, FlyToInterpolator } from '@deck.gl/core'
import { LineLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers'
import type { Station } from '@/store/useStore'
import { useStore } from '@/store/useStore'

// ── Map node (with real lat/lon) ──────────────────────────────────────────
export interface MapNode {
  lat: number
  lon: number
  ph: number  // animation phase
  s: Station
}

export function hasMappableLocation(station: Station | null | undefined): boolean {
  if (!station) return false
  const hasGeo = station.geo_lat != null && station.geo_lat !== 0 && station.geo_long != null && station.geo_long !== 0
  if (hasGeo) return true
  const code = station.country_code?.toUpperCase()
  return !!(code && CENTROIDS[code])
}

// ── Data loader (Natural Earth + stations GeoJSON) ────────────────────────
let worldGeojson: any = null
let worldGeojsonSanitized: any = null
let worldGeojsonLoading = false
const worldCallbacks: Array<() => void> = []
type BoundarySegment = { sourcePosition: [number, number]; targetPosition: [number, number] }
let countryBoundarySegments: BoundarySegment[] | null = null

function isFiniteCoord(p: any): p is [number, number] {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
}

function isValidLngLat(p: [number, number]): boolean {
  const [lon, lat] = p
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90
}

function sanitizeRing(ring: any): [number, number][] | null {
  if (!Array.isArray(ring)) return null
  const points = ring.filter(isFiniteCoord) as [number, number][]
  return points.length >= 4 ? points : null
}

function sanitizeWorldGeojson(fc: any): any {
  if (!fc || !Array.isArray(fc.features)) {
    return { type: 'FeatureCollection', features: [] }
  }
  const features = fc.features
    .map((f: any) => {
      const g = f?.geometry
      if (!g || !g.type) return null

      if (g.type === 'Polygon') {
        const rings = (g.coordinates || []).map(sanitizeRing).filter(Boolean)
        if (!rings.length) return null
        return { ...f, geometry: { ...g, coordinates: rings } }
      }

      if (g.type === 'MultiPolygon') {
        const polys = (g.coordinates || [])
          .map((poly: any) => (poly || []).map(sanitizeRing).filter(Boolean))
          .filter((poly: any[]) => poly.length > 0)
        if (!polys.length) return null
        return { ...f, geometry: { ...g, coordinates: polys } }
      }

      return null
    })
    .filter(Boolean)

  return { type: 'FeatureCollection', features }
}

function getCountryBoundarySegments(): BoundarySegment[] {
  if (countryBoundarySegments) return countryBoundarySegments
  const src = worldGeojsonSanitized
  if (!src || !Array.isArray(src.features)) return []

  const out: BoundarySegment[] = []
  const pushRingSegments = (ring: any) => {
    const pts = (ring || [])
      .filter(isFiniteCoord)
      .map((p: [number, number]) => [Number(p[0]), Number(p[1])] as [number, number])
      .filter(isValidLngLat)
    if (pts.length < 2) return
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]
      const b = pts[i]
      if (a[0] === b[0] && a[1] === b[1]) continue
      // Skip pathological segments that can destabilize line tesselation.
      if (Math.abs(a[0] - b[0]) > 180 || Math.abs(a[1] - b[1]) > 90) continue
      out.push({ sourcePosition: a, targetPosition: b })
    }
  }

  for (const f of src.features) {
    const g = f?.geometry
    if (!g) continue

    if (g.type === 'Polygon') {
      for (const ring of g.coordinates || []) {
        pushRingSegments(ring)
      }
      continue
    }

    if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates || []) {
        for (const ring of poly || []) {
          pushRingSegments(ring)
        }
      }
    }
  }

  countryBoundarySegments = out
  return out
}

function ensureWorldGeojson(onReady: () => void): void {
  if (worldGeojson !== null) { onReady(); return }
  worldCallbacks.push(onReady)
  if (worldGeojsonLoading) return
  worldGeojsonLoading = true
  fetch('./geo/countries.geojson')
    .then(r => r.json())
    .then(data => {
      worldGeojson = data
      worldGeojsonSanitized = sanitizeWorldGeojson(data)
      countryBoundarySegments = null
      countryLabels = null  // reset cache so labels are re-extracted from new data
      worldGeojsonLoading = false
      worldCallbacks.splice(0).forEach(cb => cb())
    })
    .catch(() => {
      worldGeojson = { type: 'FeatureCollection', features: [] }
      worldGeojsonSanitized = worldGeojson
      countryBoundarySegments = null
      worldGeojsonLoading = false
      worldCallbacks.splice(0).forEach(cb => cb())
    })
}

// ── Country centroids (fallback if geo_lat/geo_long missing) ──────────────
const CENTROIDS: Record<string, [number, number]> = {
  US: [-98.0, 39.5], GB: [-3.2, 54.0], DE: [10.5, 51.2], FR: [2.2, 46.2],
  CA: [-96.8, 56.1], AU: [133.8, -25.3], JP: [138.3, 36.2], CN: [104.0, 35.5],
  BR: [-51.9, -14.2], RU: [105.3, 61.5], IN: [78.7, 20.6], MX: [-102.6, 23.6],
  IT: [12.6, 42.8], ES: [-3.7, 40.2], NL: [5.3, 52.3], PL: [19.1, 52.1],
  SE: [18.6, 60.1], NO: [10.2, 60.5], DK: [10.0, 56.3], FI: [26.3, 64.0],
  AT: [14.6, 47.7], CH: [8.2, 46.9], BE: [4.5, 50.5], CZ: [15.5, 49.8],
  HU: [19.5, 47.2], RO: [25.0, 45.9], UA: [31.2, 48.4], TR: [35.2, 39.1],
  ZA: [25.1, -29.0], NG: [8.7, 9.1], EG: [30.8, 26.8], AR: [-63.6, -38.4],
  CO: [-74.3, 4.1], CL: [-71.5, -35.7], PE: [-75.0, -9.2], KR: [128.0, 36.0],
  ID: [113.9, -0.8], MY: [109.7, 3.8], TH: [101.0, 15.9], VN: [107.6, 16.6],
  PH: [121.8, 13.0], SG: [103.8, 1.4], NZ: [172.5, -41.8], PT: [-8.0, 39.5],
  GR: [21.8, 39.1], BG: [25.5, 42.7], HR: [16.4, 45.2], SK: [19.7, 48.7],
  LT: [23.9, 55.3], LV: [24.8, 56.9], EE: [25.0, 58.6], BY: [28.0, 53.7],
  GE: [43.4, 42.3], AM: [44.6, 40.1], AZ: [47.6, 40.3], KZ: [66.9, 48.0],
  IL: [34.9, 31.0], IQ: [43.7, 33.2], IR: [53.7, 32.4], SA: [45.1, 24.2],
  AE: [53.8, 23.4], PK: [69.3, 30.4], BD: [90.4, 23.7], MA: [-7.1, 31.8],
  TN: [9.6, 33.9], DZ: [3.1, 28.0], KE: [37.9, 0.0], ET: [39.6, 9.1],
  TZ: [34.9, -6.4], GH: [-1.0, 7.9], CR: [-84.0, 10.0], CU: [-79.5, 22.0],
  DO: [-70.2, 18.7], JM: [-77.3, 18.1], LB: [35.5, 33.9], JO: [37.2, 31.0],
  CY: [33.0, 35.2], IS: [-19.0, 65.0], IE: [-8.2, 53.0], LU: [6.1, 49.8],
  RS: [21.0, 44.0], BA: [17.7, 44.2], ME: [19.4, 42.8], AL: [20.2, 41.2],
  MK: [21.7, 41.6], SI: [14.8, 46.1], UY: [-56.0, -32.5], VE: [-66.6, 7.1],
  BO: [-64.7, -16.3], EC: [-77.8, -1.8], PR: [-66.6, 18.2], SY: [38.4, 34.8],
  UZ: [63.9, 41.4], LY: [17.2, 27.0], MD: [28.4, 47.4], ZW: [30.0, -20.0],
  GT: [-90.2, 15.7], HN: [-86.6, 14.8], SV: [-88.9, 13.8], NI: [-85.2, 13.0],
  PA: [-80.8, 8.4], PY: [-58.4, -23.5], MM: [95.9, 17.1], KH: [104.9, 12.6],
  LK: [80.7, 7.9], NP: [84.2, 28.4], CM: [12.4, 3.9], MT: [14.4, 35.9],
}

// ── Extract country label data from GeoJSON ──────────────────────────────
interface CountryLabel {
  name: string
  coordinates: [number, number]
  rank: number
}
let countryLabels: CountryLabel[] | null = null

function getCountryLabels(): CountryLabel[] {
  if (countryLabels) return countryLabels
  if (!worldGeojson) return []
  countryLabels = worldGeojson.features
    .filter((f: any) => f.geometry && f.properties?.NAME)
    .map((f: any) => {
      const name: string = (f.properties.NAME_EN || f.properties.NAME || '').toUpperCase()
      const rank = Number(f.properties.LABELRANK ?? f.properties.scalerank ?? 10)
      let lon = 0, lat = 0
      const g = f.geometry
      if (g.type === 'Point') {
        ;[lon, lat] = g.coordinates
      } else if (g.type === 'Polygon') {
        const coords: [number, number][] = g.coordinates[0]
        lon = coords.reduce((s: number, c: [number, number]) => s + c[0], 0) / coords.length
        lat = coords.reduce((s: number, c: [number, number]) => s + c[1], 0) / coords.length
      } else if (g.type === 'MultiPolygon') {
        let best: [number, number][] = []
        for (const poly of g.coordinates) {
          if (poly[0].length > best.length) best = poly[0]
        }
        lon = best.reduce((s: number, c: [number, number]) => s + c[0], 0) / (best.length || 1)
        lat = best.reduce((s: number, c: [number, number]) => s + c[1], 0) / (best.length || 1)
      }
      return { name, coordinates: [lon, lat] as [number, number], rank }
    })
    .filter((l: CountryLabel) => l.name.length > 0 && Number.isFinite(l.coordinates[0]) && Number.isFinite(l.coordinates[1]))
  return countryLabels!
}

function getCountryLabelsForZoom(zoom: number): CountryLabel[] {
  const labels = getCountryLabels()
  if (!labels.length) return []

  let maxRank = 10
  let gridDeg = 8
  if (zoom < 1.15) {
    maxRank = 2
    gridDeg = 34
  } else if (zoom < 1.6) {
    maxRank = 4
    gridDeg = 22
  } else if (zoom < 2.2) {
    maxRank = 6
    gridDeg = 14
  }

  const filtered = labels.filter(l => l.rank <= maxRank)
  const picked: CountryLabel[] = []
  const seen = new Set<string>()

  for (const l of filtered) {
    const [lon, lat] = l.coordinates
    const gx = Math.round((lon + 180) / gridDeg)
    const gy = Math.round((lat + 90) / gridDeg)
    const key = `${gx},${gy}`
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(l)
  }

  return picked
}

// ── Deterministic jitter from station_uuid hash (stable across re-renders) ──
function seededRandom(seed: string, salt: number): number {
  let h = salt
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h ^ seed.charCodeAt(i), 2654435761) >>> 0)
    h ^= h >>> 16
  }
  return (h >>> 0) / 0xffffffff // 0..1
}

// ── Build nodes (real coords first, country centroid fallback) ─────────────
export function buildMapNodes(stations: Station[]): MapNode[] {
  const nodes: MapNode[] = []
  for (const s of stations) {
    let lat = (s.geo_lat != null && s.geo_lat !== 0) ? s.geo_lat : null
    let lon = (s.geo_long != null && s.geo_long !== 0) ? s.geo_long : null
    if (lat == null || lon == null) {
      const c = s.country_code ? CENTROIDS[s.country_code.toUpperCase()] : undefined
      if (!c) continue
      ;[lon, lat] = c
      lon += (seededRandom(s.station_uuid, 1) - 0.5) * 8
      lat += (seededRandom(s.station_uuid, 2) - 0.5) * 6
    }
    nodes.push({ lat, lon, ph: seededRandom(s.station_uuid, 3) * Math.PI * 2, s })
  }
  return nodes
}

// ── Hook: Setup Deck.gl instance & viewport management ──────────────────
export function useMapCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  stations: Station[],
  curIdx: number,
  mapMode: string,
  mapNodes: MapNode[],
  onNodeClick?: (station: Station, cssX: number, cssY: number) => void,
): { hitTest: (x: number, y: number, radius?: number) => Station | null } {
  const deckRef = useRef<Deck | null>(null)
  const viewStateRef = useRef({
    longitude: 20,
    latitude: 25,
    zoom: 1.5,
    pitch: 0,
    bearing: 0,
  })
  const nodesRef = useRef(mapNodes)
  const stateRef = useRef({ stations, curIdx, mapMode, onNodeClick })
  const rafIdRef = useRef(0)

  useEffect(() => {
    nodesRef.current = mapNodes
  }, [mapNodes])

  useEffect(() => {
    stateRef.current = { stations, curIdx, mapMode, onNodeClick }
  }, [stations, curIdx, mapMode, onNodeClick])

  function flyToNode(stationId: string): boolean {
    const deck = deckRef.current
    if (!deck) return false
    const node = nodesRef.current.find(n => n.s.station_uuid === stationId)
    if (!node) return false
    const current = viewStateRef.current
    const targetZoom = typeof current.zoom === 'number' ? current.zoom : 1.5
    viewStateRef.current = {
      ...current,
      longitude: node.lon,
      latitude: node.lat,
      zoom: targetZoom,
    }
    deck.setProps({
      initialViewState: {
        longitude: node.lon,
        latitude: node.lat,
        zoom: targetZoom,
        pitch: 0,
        bearing: 0,
        transitionDuration: 1100,
        transitionInterpolator: new FlyToInterpolator({ speed: 1.1 }),
      },
    })
    return true
  }

  // ── Fly-to when focusNodeId changes ──────────────────────────────────────
  const focusNodeId = useStore(st => st.focusNodeId)
  const setFocusNodeId = useStore(st => st.setFocusNodeId)
  useEffect(() => {
    if (!focusNodeId) return
    if (flyToNode(focusNodeId)) setFocusNodeId(null)
  }, [focusNodeId, mapNodes, setFocusNodeId])

  // ── Initialize Deck.gl ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !canvas.parentElement) return

    // Load world data first
    ensureWorldGeojson(() => {
      // Create Deck instance (no built-in event handlers — we use native DOM)
      const deck = new Deck({
        canvas,
        width: canvas.offsetWidth,
        height: canvas.offsetHeight,
        debug: false,
        initialViewState: viewStateRef.current,
        controller: {
          dragRotate: false,
          scrollZoom: true,
          touchZoom: true,
          touchRotate: false,
          keyboard: true,
        },
        layers: [],
        onViewStateChange: ({ viewState }: any) => {
          viewStateRef.current = viewState
        },
      })

      deckRef.current = deck
      if (focusNodeId) {
        if (flyToNode(focusNodeId)) setFocusNodeId(null)
      }

      // ── Native DOM: click → pickObject ──────────────────────────────────
      const handleClick = (e: MouseEvent) => {
        const d = deckRef.current
        if (!d) return
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const info = (d as any).pickObject({ x, y, radius: 10 })
        const cb = stateRef.current.onNodeClick
        if (info?.object && cb) {
          e.stopPropagation()
          cb(info.object as Station, x, y)
        }
      }

      // ── Native DOM: mousemove → cursor ───────────────────────────────────
      const handleMouseMove = (e: MouseEvent) => {
        const d = deckRef.current
        if (!d) return
        const rect = canvas.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        const info = (d as any).pickObject({ x, y, radius: 6 })
        canvas.style.cursor = info?.object ? 'crosshair' : 'grab'
      }

      canvas.addEventListener('click', handleClick)
      canvas.addEventListener('mousemove', handleMouseMove)

      // Animate phase updates
      const animate = () => {
        nodesRef.current.forEach(n => { n.ph += 0.015 })
        deck.setProps({ layers: [...buildStaticLayers(), createCountryLabelLayer(), ...createDynamicLayers()] })
        rafIdRef.current = requestAnimationFrame(animate)
      }
      rafIdRef.current = requestAnimationFrame(animate)

      // store cleanup handles on canvas for later removal
      ;(canvas as any)._deckClickHandler = handleClick
      ;(canvas as any)._deckMoveHandler = handleMouseMove
    })

    // Handle resize
    const handleResize = () => {
      if (deckRef.current && canvas.parentElement) {
        deckRef.current.setProps({
          width: canvas.offsetWidth,
          height: canvas.offsetHeight,
        })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(rafIdRef.current)
      if ((canvas as any)._deckClickHandler) {
        canvas.removeEventListener('click', (canvas as any)._deckClickHandler)
        canvas.removeEventListener('mousemove', (canvas as any)._deckMoveHandler)
      }
      if (deckRef.current) {
        deckRef.current.finalize()
        deckRef.current = null
      }
    }
  }, [canvasRef])

  // ── hitTest: pick station at canvas-relative (x, y) ──────────────────────
  // Called from an overlay div in MapPanel to bypass Deck.gl event interception
  function hitTest(x: number, y: number, radius = 10): Station | null {
    const deck = deckRef.current
    if (!deck) return null
    try {
      const info = (deck as any).pickObject({ x, y, radius })
      if (info?.object && (info.object as any).station_uuid) {
        return info.object as Station
      }
    } catch { /* ignore */ }
    return null
  }

  // ── Static layers: built once after GeoJSON loads ─────────────────────────
  function buildStaticLayers(): Layer[] {
    const layers: Layer[] = []
    if (!worldGeojsonSanitized) return layers
    layers.push(
      new LineLayer({
        id: 'countries-outline-lines',
        data: getCountryBoundarySegments(),
        getSourcePosition: (d: any) => d.sourcePosition,
        getTargetPosition: (d: any) => d.targetPosition,
        getColor: [40, 90, 175, 110] as any,
        getWidth: 1,
        widthUnits: 'pixels',
        widthMinPixels: 0.4,
        pickable: false,
      })
    )
    return layers
  }

  function createCountryLabelLayer(): Layer {
    const zoom = typeof viewStateRef.current.zoom === 'number' ? viewStateRef.current.zoom : 1.5
    const labels = getCountryLabelsForZoom(zoom)
    return new TextLayer({
      id: 'country-labels',
      data: labels,
      getPosition: (d: any) => d.coordinates,
      getText: (d: any) => d.name,
      getSize: zoom < 1.3 ? 9 : zoom < 2 ? 10 : 11,
      getColor: [160, 200, 255, 180] as any,
      fontFamily: 'Arial, sans-serif',
      fontWeight: '500',
      characterSet: 'auto',
      sizeUnits: 'pixels',
      sizeMinPixels: 7,
      sizeMaxPixels: 15,
      getTextAnchor: 'middle' as any,
      getAlignmentBaseline: 'center' as any,
      pickable: false,
    })
  }

  // ── Dynamic layers: rebuilt every animation frame ─────────────────────────
  function createDynamicLayers(): Layer[] {
    const { stations, curIdx, mapMode } = stateRef.current
    const nodes = nodesRef.current

    const visibleNodes = mapMode === 'healthy'
      ? nodes.filter(n => n.s.health_status === 'healthy')
      : mapMode === 'top' ? nodes.slice(0, 20) : nodes

    const stationData = visibleNodes.map(n => ({
      ...n.s,
      coordinates: [n.lon, n.lat] as [number, number],
      _node: n,
      _isActive: curIdx >= 0 && n.s === stations[curIdx],
      _health: n.s.health_status,
    }))

    const layers: Layer[] = []

    // ── Helper: get dot color by health ──────────────────────────────────
    function dotColor(d: any): [number, number, number] {
      if (d._isActive) return [61, 215, 255]
      return [139, 255, 218]
    }

    // ── Layer 3: Outer atmospheric halo (largest, most transparent) ───────
    layers.push(
      new ScatterplotLayer({
        id: 'stations-halo',
        data: stationData,
        getPosition: (d: any) => d.coordinates,
        getRadius: (d: any) => {
          const pulse = 0.55 + 0.45 * Math.sin(d._node.ph)
          if (d._isActive) return 20 + pulse * 6
          if (d._health === 'healthy') return 14 + pulse * 4
          return 9 + pulse * 2
        },
        radiusUnits: 'pixels',
        getFillColor: (d: any) => {
          const [r, g, b] = dotColor(d)
          const a = d._isActive ? 22 : 12
          return [r, g, b, a] as any
        },
        pickable: false,
        updateTriggers: { getRadius: nodesRef.current.map(n => n.ph), getFillColor: nodesRef.current.map(n => n.ph) },
      })
    )

    // ── Layer 4: Mid glow ring ────────────────────────────────────────────
    layers.push(
      new ScatterplotLayer({
        id: 'stations-glow',
        data: stationData,
        getPosition: (d: any) => d.coordinates,
        getRadius: (d: any) => {
          const pulse = 0.5 + 0.5 * Math.sin(d._node.ph + 0.4)
          if (d._isActive) return 9 + pulse * 3
          if (d._health === 'healthy') return 6 + pulse * 2
          return 3.5 + pulse * 1.2
        },
        radiusUnits: 'pixels',
        getFillColor: (d: any) => {
          const [r, g, b] = dotColor(d)
          const a = d._isActive ? 80 : 45
          return [r, g, b, a] as any
        },
        pickable: false,
        updateTriggers: { getRadius: nodesRef.current.map(n => n.ph), getFillColor: nodesRef.current.map(n => n.ph) },
      })
    )

    // ── Layer 5: Core dot (solid, pickable) ───────────────────────────────
    layers.push(
      new ScatterplotLayer({
        id: 'stations-core',
        data: stationData,
        getPosition: (d: any) => d.coordinates,
        getRadius: (d: any) => {
          if (d._isActive) return 5.5
          if (d._health === 'healthy') return 3.5
          return 2.5
        },
        radiusUnits: 'pixels',
        getFillColor: (d: any) => {
          const [r, g, b] = dotColor(d)
          return [r, g, b, 255] as any
        },
        getLineColor: (d: any) => {
          const [r, g, b] = dotColor(d)
          return [r, g, b, 80] as any
        },
        getLineWidth: 2,
        lineWidthUnits: 'pixels',
        stroked: true,
        pickable: true,
        pickingRadius: 8,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        updateTriggers: { getFillColor: nodesRef.current.map(n => n.ph) },
      })
    )

    return layers
  }

  return { hitTest }
}
