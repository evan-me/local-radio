import type { Lang } from '@/i18n/translations'

export interface SnapshotFilterOption {
  value: string
  label_en: string
  label_zh: string
  count: number
  continent?: string
  keywords?: string[]
}

export interface SnapshotLanguage {
  code?: string
  name_en?: string
  name_zh?: string
}

export interface SnapshotStation {
  station_uuid: string
  name: string
  stream_url?: string
  stream_url_fallback?: string
  favicon?: string
  country_code?: string
  country_name_en?: string
  country_name_zh?: string
  continent?: string
  genre_key?: string
  genre_label_en?: string
  genre_label_zh?: string
  vibes?: string[]
  quality_score?: number | null
  health_status?: string
  click_count?: number
  votes?: number
  click_trend?: number
  is_hls?: boolean
  bitrate_kbps?: number | null
  codec?: string | null
  geo_lat?: number | null
  geo_long?: number | null
  tags?: string[]
  languages?: SnapshotLanguage[]
}

export interface RadioSnapshot {
  snapshot_version: number
  generated_at: string
  meta: {
    total_stations: number
    default_lang?: Lang
    detail_failures?: number
  }
  filters: {
    continents: SnapshotFilterOption[]
    genres: SnapshotFilterOption[]
    countries: SnapshotFilterOption[]
    vibes: SnapshotFilterOption[]
  }
  stations: SnapshotStation[]
}

let snapshotPromise: Promise<RadioSnapshot> | null = null

function getSnapshotUrl(): string {
  if (typeof window === 'undefined') return './data/radio-snapshot.json'
  return new URL('./data/radio-snapshot.json', window.location.href).toString()
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function validateSnapshot(value: unknown): RadioSnapshot {
  if (!isObject(value)) {
    throw new Error('Snapshot 格式非法：根节点不是对象')
  }

  if (!Array.isArray(value.stations)) {
    throw new Error('Snapshot 格式非法：缺少 stations 数组')
  }

  if (!isObject(value.filters)) {
    throw new Error('Snapshot 格式非法：缺少 filters 对象')
  }

  if (!Array.isArray(value.filters.continents) || !Array.isArray(value.filters.genres) || !Array.isArray(value.filters.countries) || !Array.isArray(value.filters.vibes)) {
    throw new Error('Snapshot 格式非法：filters 子结构不完整')
  }

  if (!isObject(value.meta) || typeof value.meta.total_stations !== 'number') {
    throw new Error('Snapshot 格式非法：缺少 meta.total_stations')
  }

  if (typeof value.generated_at !== 'string' || !value.generated_at) {
    throw new Error('Snapshot 格式非法：缺少 generated_at')
  }

  return value as unknown as RadioSnapshot
}

export async function loadSnapshot(): Promise<RadioSnapshot> {
  if (!snapshotPromise) {
    snapshotPromise = (async () => {
      const response = await fetch(getSnapshotUrl())
      if (!response.ok) {
        throw new Error(`无法加载本地快照（HTTP ${response.status}）`)
      }

      const json = await response.json()
      return validateSnapshot(json)
    })()
  }

  return snapshotPromise
}

export function clearSnapshotCache() {
  snapshotPromise = null
}