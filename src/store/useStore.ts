// Global UI and playback state for the desktop app

import { create } from 'zustand'
import type { Lang } from '@/i18n/translations'

const startupWindowMode =
  typeof window !== 'undefined' && window.electronAPI?.startupWindowMode === 'collapsed'

const PREF_STORAGE_KEY = 'local-radio:prefs'

interface UserPrefs {
  lang?: Lang
  volume?: number
  mapCollapsed?: boolean
}

function readPrefs(): UserPrefs {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(PREF_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as UserPrefs
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePrefs(next: UserPrefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREF_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore localStorage write errors
  }
}

const initialPrefs = readPrefs()
const initialLang: Lang = initialPrefs.lang === 'en' ? 'en' : 'zh'
const initialVolume =
  typeof initialPrefs.volume === 'number'
    ? Math.max(0, Math.min(100, Math.round(initialPrefs.volume)))
    : 50
const initialMapCollapsed =
  typeof initialPrefs.mapCollapsed === 'boolean'
    ? initialPrefs.mapCollapsed
    : startupWindowMode
const resolvedInitialMapCollapsed = import.meta.env.DEV ? initialMapCollapsed : false

export interface Station {
  station_uuid: string
  name: string
  stream_url?: string
  stream_url_fallback?: string
  favicon?: string
  genre_primary?: string
  vibes?: string[]
  quality_score?: number
  health_status?: string
  click_count?: number
  votes?: number
  click_trend?: number
  is_hls?: boolean
  bitrate_kbps?: number | null
  codec?: string | null
  geo_lat?: number | null
  geo_long?: number | null
  country_code?: string
  country_name?: string
  tags?: { name: string; name_norm?: string }[]
  languages?: { code?: string; name?: string }[]
  _streamInfo?: StreamInfo
}

interface StreamInfo {
  stream_url: string
  stream_url_fallback?: string
  codec?: string
  bitrate_kbps?: number
  is_hls?: boolean
}

interface FavoriteStation {
  station_uuid: string
  name: string
  favicon?: string
}

interface FilterOption {
  value: string
  label: string
}

interface FilterOptions {
  continent: FilterOption[]
  vibe: FilterOption[]
  genre: FilterOption[]
}

interface CurFilters {
  continent: string
  vibe: string
  genre: string
  q: string
}

type ToastType = 'success' | 'warning' | 'error'

interface StoreState {
  // Station data
  stations: Station[]
  curIdx: number
  isPlaying: boolean
  favs: Set<string>
  favItems: FavoriteStation[]

  // Map
  mapMode: 'all' | 'healthy' | 'top'
  mapCollapsed: boolean

  // Filters
  curFilters: CurFilters
  filterOptions: FilterOptions

  // Snapshot info
  lastSyncTime: Date | string | null

  // Toast
  toastMsg: string
  toastType: ToastType
  toastVisible: boolean

  // Volume (0–100)
  volume: number

  // Map focus
  focusNodeId: string | null
  focusNodeVersion: number

  // Language
  lang: Lang

  // Actions
  setStations: (stations: Station[]) => void
  setCurIdx: (idx: number) => void
  setIsPlaying: (v: boolean) => void
  toggleFav: (station: Pick<Station, 'station_uuid' | 'name' | 'favicon'>) => void
  setMapCollapsed: (v: boolean) => void
  setLastSyncTime: (t: Date | string) => void
  setCurFilters: (f: Partial<CurFilters>) => void
  setFilterOptions: (opts: Partial<FilterOptions>) => void
  updateStation: (idx: number, patch: Partial<Station>) => void
  showToast: (msg: string, type?: ToastType) => void
  setVolume: (v: number) => void
  setFocusNodeId: (id: string | null) => void
  setLang: (lang: Lang) => void
}

const FAV_STORAGE_KEY = 'local-radio:favorites'

function readFavItems(): FavoriteStation[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(FAV_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((it): it is FavoriteStation => {
        return !!it && typeof it.station_uuid === 'string' && typeof it.name === 'string'
      })
      .map(it => ({ station_uuid: it.station_uuid, name: it.name, favicon: it.favicon }))
  } catch {
    return []
  }
}

function writeFavItems(items: FavoriteStation[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(items))
  } catch {
    // ignore localStorage write errors
  }
}

const initialFavItems = readFavItems()
const initialFavSet = new Set(initialFavItems.map(it => it.station_uuid))

export const useStore = create<StoreState>((set) => ({
  stations: [],
  curIdx: -1,
  isPlaying: false,
  favs: initialFavSet,
  favItems: initialFavItems,
  mapMode: 'all',
  mapCollapsed: resolvedInitialMapCollapsed,
  curFilters: { continent: '', vibe: '', genre: '', q: '' },
  filterOptions: { continent: [], vibe: [], genre: [] },
  lastSyncTime: null,
  toastMsg: '',
  toastType: 'success',
  toastVisible: false,
  volume: initialVolume,
  focusNodeId: null,
  focusNodeVersion: 0,
  lang: initialLang,

  setStations: (stations) => set({ stations }),
  setCurIdx: (curIdx) => set({ curIdx }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleFav: (station) =>
    set((s) => {
      const favs = new Set(s.favs)
      let favItems = s.favItems
      if (favs.has(station.station_uuid)) {
        favs.delete(station.station_uuid)
        favItems = s.favItems.filter(it => it.station_uuid !== station.station_uuid)
      } else {
        favs.add(station.station_uuid)
        const next: FavoriteStation = {
          station_uuid: station.station_uuid,
          name: station.name,
          favicon: station.favicon,
        }
        favItems = [next, ...s.favItems.filter(it => it.station_uuid !== station.station_uuid)]
      }
      writeFavItems(favItems)
      return { favs, favItems }
    }),
  setMapCollapsed: (mapCollapsed) =>
    set((s) => {
      writePrefs({
        lang: s.lang,
        volume: s.volume,
        mapCollapsed,
      })
      return { mapCollapsed }
    }),
  setLastSyncTime: (lastSyncTime) => set({ lastSyncTime }),
  setCurFilters: (f) => set((s) => ({ curFilters: { ...s.curFilters, ...f } })),
  setFilterOptions: (opts) =>
    set((s) => ({ filterOptions: { ...s.filterOptions, ...opts } })),
  updateStation: (idx, patch) =>
    set((s) => {
      const stations = [...s.stations]
      stations[idx] = { ...stations[idx], ...patch }
      return { stations }
    }),
  showToast: (msg, type) => {
    const inferred: ToastType = type
      ?? (msg.includes('⚠') ? 'warning' : msg.includes('✖') || msg.includes('ERROR') ? 'error' : 'success')
    set({ toastMsg: msg, toastType: inferred, toastVisible: true })
    setTimeout(() => set({ toastVisible: false }), 2000)
  },
  setVolume: (volume) =>
    set((s) => {
      const safeVolume = Math.max(0, Math.min(100, Math.round(volume)))
      writePrefs({
        lang: s.lang,
        volume: safeVolume,
        mapCollapsed: s.mapCollapsed,
      })
      return { volume: safeVolume }
    }),
  setFocusNodeId: (focusNodeId) =>
    set((s) => ({
      focusNodeId,
      focusNodeVersion: s.focusNodeVersion + 1,
    })),
  setLang: (lang) =>
    set((s) => {
      writePrefs({
        lang,
        volume: s.volume,
        mapCollapsed: s.mapCollapsed,
      })
      return { lang }
    }),
}))
