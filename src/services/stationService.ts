import type { Lang } from '@/i18n/translations'
import type { Station } from '@/store/useStore'
import { loadSnapshot, type RadioSnapshot, type SnapshotStation } from './snapshotService'

interface FilterOption {
  value: string
  label: string
}

interface FetchParams {
  continent?: string
  vibe?: string
  genre?: string
  q?: string
  lang?: string
}

function normalizeStationForUi(station: SnapshotStation, lang: Lang): Station {
  const countryName = lang === 'zh'
    ? (station.country_name_zh || station.country_name_en || station.country_code)
    : (station.country_name_en || station.country_name_zh || station.country_code)

  const genreLabel = lang === 'zh'
    ? (station.genre_label_zh || station.genre_label_en || station.genre_key)
    : (station.genre_label_en || station.genre_label_zh || station.genre_key)

  return {
    station_uuid: station.station_uuid,
    name: station.name,
    stream_url: station.stream_url,
    stream_url_fallback: station.stream_url_fallback,
    favicon: station.favicon,
    genre_primary: genreLabel,
    vibes: station.vibes ?? [],
    quality_score: station.quality_score ?? undefined,
    health_status: station.health_status,
    click_count: station.click_count,
    votes: station.votes,
    click_trend: station.click_trend,
    is_hls: station.is_hls,
    bitrate_kbps: station.bitrate_kbps ?? null,
    codec: station.codec ?? null,
    geo_lat: station.geo_lat ?? null,
    geo_long: station.geo_long ?? null,
    country_code: station.country_code,
    country_name: countryName,
    tags: (station.tags ?? []).map((tag) => ({
      name: tag,
      name_norm: tag.toLowerCase(),
    })),
    languages: (station.languages ?? []).map((language) => ({
      code: language.code,
      name: lang === 'zh'
        ? (language.name_zh || language.name_en)
        : (language.name_en || language.name_zh),
    })),
    _streamInfo: station.stream_url ? {
      stream_url: station.stream_url,
      stream_url_fallback: station.stream_url_fallback,
      codec: station.codec ?? undefined,
      bitrate_kbps: station.bitrate_kbps ?? undefined,
      is_hls: station.is_hls,
    } : undefined,
  }
}

function matchStation(station: SnapshotStation, params: FetchParams): boolean {
  if (params.continent && station.continent !== params.continent) return false
  if (params.genre && station.genre_key !== params.genre) return false
  if (params.vibe && !(station.vibes ?? []).includes(params.vibe)) return false

  if (params.q) {
    const query = params.q.trim().toLowerCase()
    if (!query) return true

    const haystack = [
      station.name,
      station.country_name_en,
      station.country_name_zh,
      station.country_code,
      station.genre_key,
      station.genre_label_en,
      station.genre_label_zh,
      ...(station.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(query)) return false
  }

  return true
}

function filterOptionsFromSnapshot(snapshot: RadioSnapshot, key: keyof RadioSnapshot['filters'], lang: Lang): FilterOption[] {
  const allLabel = lang === 'zh' ? '全部' : 'ALL'
  const options = snapshot.filters[key].map((item) => ({
    value: item.value,
    label: lang === 'zh' ? item.label_zh : item.label_en,
  }))
  return [{ value: '', label: allLabel }, ...options]
}

export async function fetchStations(params: FetchParams = {}): Promise<{
  stations: Station[]
  isDemo: boolean
  generatedAt: string
}> {
  const snapshot = await loadSnapshot()
  const lang = params.lang === 'en' ? 'en' : 'zh'
  const stations = snapshot.stations
    .filter((station) => matchStation(station, params))
    .map((station) => normalizeStationForUi(station, lang))

  return {
    stations,
    isDemo: false,
    generatedAt: snapshot.generated_at,
  }
}

export async function fetchStationDetail(uuid: string, lang = 'en'): Promise<Partial<Station> | null> {
  const snapshot = await loadSnapshot()
  const station = snapshot.stations.find((item) => item.station_uuid === uuid)
  if (!station) return null
  return normalizeStationForUi(station, lang === 'en' ? 'en' : 'zh')
}

export async function fetchMeta(lang = 'en'): Promise<{
  continent: FilterOption[]
  vibe: FilterOption[]
  genre: FilterOption[]
}> {
  const snapshot = await loadSnapshot()
  const safeLang = lang === 'en' ? 'en' : 'zh'

  return {
    continent: filterOptionsFromSnapshot(snapshot, 'continents', safeLang),
    vibe: filterOptionsFromSnapshot(snapshot, 'vibes', safeLang),
    genre: filterOptionsFromSnapshot(snapshot, 'genres', safeLang),
  }
}
