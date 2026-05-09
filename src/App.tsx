import { Suspense, lazy, useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { fetchStations, fetchMeta } from '@/services/stationService'
import { LoadingScreen } from '@/components/LoadingScreen'
import { TitleBar } from '@/components/TitleBar'
import { Toast } from '@/components/Toast'
import { SnapshotError } from '@/components/SnapshotError'
import { useT } from '@/i18n/useT'
import { translations } from '@/i18n/translations'
import s from './App.module.css'

const MapPanel = lazy(async () => {
  const module = await import('@/components/MapPanel')
  return { default: module.MapPanel }
})

const PlayerHud = lazy(async () => {
  const module = await import('@/components/PlayerHud')
  return { default: module.PlayerHud }
})

export default function App() {
  const [loading, setLoading] = useState(true)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const hasElectronShell = typeof window !== 'undefined' && !!window.electronAPI

  const mapCollapsed = useStore(st => st.mapCollapsed)
  const curFilters = useStore(st => st.curFilters)
  const lang = useStore(st => st.lang)

  const setStations      = useStore(st => st.setStations)
  const setCurIdx        = useStore(st => st.setCurIdx)
  const setFilterOptions = useStore(st => st.setFilterOptions)
  const setLastSyncTime  = useStore(st => st.setLastSyncTime)
  const showToast        = useStore(st => st.showToast)
  const t = useT()

  const loadStations = useCallback(async (params?: Record<string, string>) => {
    const { stations: data, generatedAt } = await fetchStations({ ...(params as Parameters<typeof fetchStations>[0]), lang })
    setStations(data)
    setLastSyncTime(generatedAt)

    const hasFilters = !!(params?.continent || params?.vibe || params?.genre || params?.q)
    if (data.length === 0) {
      showToast(hasFilters ? t.no_stations_filter : t.no_stations, 'warning')
    }

    return data
  }, [lang, setStations, setLastSyncTime, showToast, t])

  // Initial load
  const onLoadingDone = useCallback(async () => {
    try {
      const [result, meta] = await Promise.all([
        loadStations({ page_size: '500', order_by: 'quality_score' }),
        fetchMeta(lang),
      ])
      if (meta) setFilterOptions(meta)
      if (result.length > 0) {
        const idx = Math.floor(Math.random() * result.length)
        setCurIdx(idx)
      }
    } catch (error) {
      setSnapshotError((error as Error).message || t.data_load_failed)
    } finally {
      setLoading(false)
    }
  }, [loadStations, setFilterOptions, setCurIdx, lang, t])

  // Re-fetch when filters change (debounce 400ms)
  // Re-fetch meta and stations when language changes
  useEffect(() => {
    if (loading || snapshotError) return
    const f = curFilters
    const params: Record<string, string> = { page_size: '500', order_by: 'quality_score' }
    if (f.continent) params.continent = f.continent
    if (f.vibe)    params.vibe = f.vibe
    if (f.genre)   params.genre = f.genre
    if (f.q)       params.q = f.q
    Promise.all([
      fetchMeta(lang).then(meta => { if (meta) setFilterOptions(meta) }),
      loadStations(params),
    ]).catch((error) => {
      setSnapshotError((error as Error).message || t.data_reload_failed)
    })
  }, [lang, snapshotError, t]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterDebounce = useRef<number | null>(null)
  useEffect(() => {
    if (loading || snapshotError) return
    if (filterDebounce.current) clearTimeout(filterDebounce.current)
    filterDebounce.current = window.setTimeout(() => {
      const f = curFilters
      const params: Record<string, string> = {
        page_size: '500', order_by: 'quality_score',
      }
      if (f.continent) params.continent = f.continent
      if (f.vibe)    params.vibe = f.vibe
      if (f.genre)   params.genre = f.genre
      if (f.q)       params.q = f.q
      loadStations({ ...params, lang }).catch((error) => {
        setSnapshotError((error as Error).message || t.data_filter_failed)
      })
    }, 400)
    return () => { if (filterDebounce.current) clearTimeout(filterDebounce.current) }
  }, [curFilters, loading, loadStations, snapshotError, t])

  useEffect(() => {
    window.electronAPI?.setWindowMode?.(mapCollapsed ? 'collapsed' : 'expanded')
  }, [mapCollapsed])

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      const store = useStore.getState()
      switch (e.key) {
        case ' ':
          e.preventDefault()
          window.dispatchEvent(new Event('radio:togglePlay'))
          break
        case 's':
        case 'S': {
          if (!store.stations.length) break
          let i = Math.floor(Math.random() * store.stations.length)
          if (store.stations.length > 1 && i === store.curIdx) {
            i = (i + 1) % store.stations.length
          }
          const st = store.stations[i]
          store.setCurIdx(i)
          if (st) {
            store.setFocusNodeId(st.station_uuid)
          }
          store.setIsPlaying(true)
          store.showToast(translations[store.lang].shuffle_toast(i + 1))
          break
        }
        case 'f':
        case 'F': {
          const st = store.stations[store.curIdx]
          if (st) {
            store.toggleFav(st)
            store.showToast(store.favs.has(st.station_uuid) ? translations[store.lang].removed_fav : translations[store.lang].saved_fav)
          }
          break
        }
        case 'c':
        case 'C': {
          const st = store.stations[store.curIdx]
          if (st?.stream_url) {
            navigator.clipboard.writeText(st.stream_url)
              .then(() => store.showToast(translations[store.lang].copy_ok))
              .catch(() => store.showToast(translations[store.lang].copy_fail))
          } else {
            store.showToast(translations[store.lang].no_url)
          }
          break
        }
        case 'ArrowLeft': {
          const total = store.stations.length
          if (!total) break
          const prev = ((store.curIdx - 1) % total + total) % total
          store.setCurIdx(prev)
          break
        }
        case 'ArrowRight': {
          const total = store.stations.length
          if (!total) break
          const next = (store.curIdx + 1 + total) % total
          store.setCurIdx(next)
          break
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!loading && snapshotError) {
    return <SnapshotError message={snapshotError} />
  }

  return (
    <>
      {loading ? (
        <LoadingScreen onDone={onLoadingDone} />
      ) : (
        <div
          className={`${s.win}${mapCollapsed ? ' ' + s.collapsed : ''}`}
          style={!hasElectronShell && mapCollapsed ? { height: 'var(--win-height-collapsed)' } : undefined}
        >
          <TitleBar />

          <Suspense fallback={<div className={s.layoutFallback} />}>
            <div className={s.layout}>
              <MapPanel />
              <PlayerHud />
            </div>
          </Suspense>
        </div>
      )}

      <Toast />
    </>
  )
}
