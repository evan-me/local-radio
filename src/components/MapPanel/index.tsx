import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { useMapCanvas, buildMapNodes } from '@/hooks/useMapCanvas'
import type { Station } from '@/store/useStore'
import { fetchStationDetail } from '@/services/stationService'
import { FaCirclePlay } from 'react-icons/fa6'
import { FaHeart, FaSearch } from 'react-icons/fa'
import { useT } from '@/i18n/useT'
import s from './MapPanel.module.css'

type FilterType = 'continent' | 'genre'

interface PopupState {
  station: Station
  cssX: number
  cssY: number
}

export function MapPanel() {
  const stations     = useStore(st => st.stations)
  const curIdx       = useStore(st => st.curIdx)
  const mapMode      = useStore(st => st.mapMode)
  const mapCollapsed = useStore(st => st.mapCollapsed)
  const curFilters   = useStore(st => st.curFilters)
  const filterOptions= useStore(st => st.filterOptions)
  const setCurFilters= useStore(st => st.setCurFilters)
  const setMapCollapsed = useStore(st => st.setMapCollapsed)
  const setCurIdx = useStore(st => st.setCurIdx)
  const setIsPlaying = useStore(st => st.setIsPlaying)
  const setFocusNodeId = useStore(st => st.setFocusNodeId)
  const setStations = useStore(st => st.setStations)
  const showToast = useStore(st => st.showToast)
  const favItems = useStore(st => st.favItems)
  const lang = useStore(st => st.lang)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const zoneRef   = useRef<HTMLDivElement>(null)
  const [openFilterRow, setOpenFilterRow] = useState<FilterType | null>(null)
  const [popup, setPopup] = useState<PopupState | null>(null)
  const [cursor, setCursor] = useState<'grab' | 'pointer'>('grab')
  const [searchOpen, setSearchOpen] = useState(false)
  const [favOpen, setFavOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchResults, setSearchResults] = useState<Station[]>([])
  const mapNodes = useMemo(() => buildMapNodes(stations), [stations])
  const chipsWrapRefs = useRef<Record<FilterType, HTMLDivElement | null>>({ continent: null, genre: null })
  const t = useT()
  useEffect(() => {
    if (!openFilterRow) return
    const wrap = chipsWrapRefs.current[openFilterRow]
    if (!wrap) return
    const selected = wrap.querySelector(`button.${s.on}`) as HTMLButtonElement | null
    if (!selected) return
    selected.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [openFilterRow, curFilters])

  const scoreStation = useCallback((st: Station, q: string) => {
    const nq = q.trim().toLowerCase()
    if (!nq) return -1
    const name = (st.name || '').toLowerCase()
    const country = (st.country_name || st.country_code || '').toLowerCase()
    const genre = (st.genre_primary || '').toLowerCase()
    let score = 0
    if (name === nq) score += 120
    if (name.startsWith(nq)) score += 90
    const idx = name.indexOf(nq)
    if (idx >= 0) score += 70 - Math.min(idx, 30)
    if (country.includes(nq)) score += 25
    if (genre.includes(nq)) score += 15
    return score
  }, [])

  const onNodeClick = useCallback((station: Station, cssX: number, cssY: number) => {
    // Always open/update popup. Toggling here can close immediately when click is emitted twice.
    setPopup({ station, cssX, cssY })
  }, [])

  const { hitTest } = useMapCanvas(canvasRef, stations, curIdx, mapMode, mapNodes, onNodeClick)

  // ── Forward wheel/pointer events from overlay → canvas (keep Deck.gl controls working) ──
  const handleOverlayWheel = useCallback((e: React.WheelEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.dispatchEvent(new WheelEvent('wheel', {
      deltaX: e.deltaX, deltaY: e.deltaY, deltaZ: e.deltaZ,
      deltaMode: e.deltaMode, bubbles: true, cancelable: true,
      clientX: e.clientX, clientY: e.clientY,
      ctrlKey: false,
      shiftKey: e.shiftKey,
      altKey: false,
      metaKey: false,
    }))
  }, [])

  const forwardPointer = useCallback((e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.dispatchEvent(new PointerEvent(e.type, {
      pointerId: e.pointerId, pointerType: e.pointerType,
      clientX: e.clientX, clientY: e.clientY,
      button: e.button, buttons: e.buttons,
      pressure: e.pressure, bubbles: true, cancelable: true,
      ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, altKey: e.altKey,
      movementX: e.movementX, movementY: e.movementY,
    }))
  }, [])

  // ── Overlay event handlers ────────────────────────────────────────────
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.' + s.popup)) return
    setPopup(null)
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const station = hitTest(x, y, 10)
    if (station) {
      e.stopPropagation()
      onNodeClick(station, x, y)
    }
  }, [hitTest, onNodeClick])

  const handleOverlayMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const station = hitTest(x, y, 6)
    setCursor(station ? 'pointer' : 'grab')
  }, [hitTest])

  const handleToggle = () => { setMapCollapsed(!mapCollapsed); setPopup(null) }

  const applyFilter = useCallback((type: FilterType, value: string) => {
    setCurFilters({ [type]: value })
    setOpenFilterRow(null)
  }, [setCurFilters])

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const q = searchText.trim()
    if (!q) {
      setSearchResults([])
      return
    }
    const ranked = stations
      .map(st => ({ st, score: scoreStation(st, q) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => item.st)
    setSearchResults(ranked)
  }, [scoreStation, searchText, stations])

  const handleSearchSelect = useCallback((station: Station) => {
    const idx = stations.findIndex(st => st.station_uuid === station.station_uuid)
    if (idx >= 0) setCurIdx(idx)
    setFocusNodeId(station.station_uuid)
    setMapCollapsed(false)
  }, [setCurIdx, setFocusNodeId, stations])

  const handleFavoriteSelect = useCallback(async (favId: string) => {
    let idx = stations.findIndex(st => st.station_uuid === favId)

    if (idx < 0) {
      const detail = await fetchStationDetail(favId, lang)
      if (!detail || !detail.station_uuid || !detail.name) {
        showToast(t.fav_not_found, 'warning')
        return
      }
      const injected: Station = {
        station_uuid: detail.station_uuid,
        name: detail.name,
        favicon: detail.favicon,
        stream_url: detail.stream_url,
        stream_url_fallback: detail.stream_url_fallback,
        country_code: detail.country_code,
        country_name: detail.country_name,
        genre_primary: detail.genre_primary,
        vibes: detail.vibes,
        quality_score: detail.quality_score,
        health_status: detail.health_status,
        click_count: detail.click_count,
        votes: detail.votes,
        click_trend: detail.click_trend,
        is_hls: detail.is_hls,
        bitrate_kbps: detail.bitrate_kbps,
        codec: detail.codec,
        geo_lat: detail.geo_lat,
        geo_long: detail.geo_long,
        tags: detail.tags,
        languages: detail.languages,
        _streamInfo: detail._streamInfo,
      }
      const nextStations = [injected, ...stations]
      setStations(nextStations)
      idx = 0
    }

    setCurIdx(idx)
    setIsPlaying(true)
    setFocusNodeId(favId)
    setMapCollapsed(false)
    setFavOpen(false)
    setSearchOpen(false)
    setSearchText('')
    setSearchResults([])
  }, [setCurIdx, setIsPlaying, setFocusNodeId, setMapCollapsed, setStations, showToast, stations])

  const handlePopupPlay = useCallback((station: Station) => {
    const idx = stations.findIndex(st => st.station_uuid === station.station_uuid)
    if (idx < 0) return
    setCurIdx(idx)
    setIsPlaying(true)
    setPopup(null)
  }, [stations, setCurIdx, setIsPlaying])

  // Clamp popup so it stays within the zone
  const popupStyle = useMemo(() => {
    if (!popup) return {}
    const POPUP_W = 280, POPUP_H = 106
    const zone = zoneRef.current
    const zW = zone?.clientWidth  ?? 540
    const zH = zone?.clientHeight ?? 300
    const left = Math.min(
      Math.max(popup.cssX - POPUP_W / 2, 8),
      zW - POPUP_W - 8,
    )
    const preferredTop = popup.cssY - POPUP_H - 14
    const top = preferredTop >= 8
      ? preferredTop
      : Math.min(popup.cssY + 14, zH - POPUP_H - 8)
    return { left, top }
  }, [popup])

  const onlineLabel = stations.length ? String(stations.length) : '—'

  return (
    <div className={s.zone} ref={zoneRef}>
      {/* Collapse header */}
      <div className={s.header} onClick={handleToggle}>
        <div className={s.headerLabel}>
          <span className={s.onlineCount}>{t.online_count(onlineLabel)}</span>
        </div>
        <div className={s.toggleControl}>
          <span className={`${s.toggleChevron}${mapCollapsed ? ' ' + s.rotated : ''}`}>▼</span>
          <span className={s.mapTitle}>MAP</span>
        </div>
      </div>

      {/* Map canvas */}
      <canvas
        ref={canvasRef}
        className={`${s.canvas}${mapCollapsed ? ' ' + s.canvasHidden : ''}`}
      />

      {/* Transparent overlay: captures all pointer events above the canvas */}
      {!mapCollapsed && (
        <div
          className={s.overlay}
          style={{ cursor }}
          onClick={handleOverlayClick}
          onMouseMove={handleOverlayMouseMove}
          onMouseLeave={() => setCursor('grab')}
          onWheel={handleOverlayWheel}
          onPointerDown={forwardPointer}
          onPointerMove={forwardPointer}
          onPointerUp={forwardPointer}
        />
      )}

      {/* Station popup */}
      {popup && !mapCollapsed && (
        <div className={s.popup} style={popupStyle}>
          {popup.station.favicon ? (
            <img className={s.popupFavicon} src={popup.station.favicon} alt="" />
          ) : (
            <span className={s.popupFaviconFallback}>📻</span>
          )}

          <div className={s.popupMain}>
            <span className={s.popupName}>{popup.station.name}</span>
            <div className={s.popupMeta}>
              <span className={s.popupCountry}>{popup.station.country_code ?? '—'}</span>
              {popup.station.genre_primary && (
                <span className={s.popupGenre}> · {popup.station.genre_primary.toUpperCase()}</span>
              )}
            </div>
          </div>

          <button
            className={s.popupPlay}
            onClick={() => handlePopupPlay(popup.station)}
            title="Play"
          >
            <FaCirclePlay aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Three-row filters (each row expands horizontally) */}
      <div className={`${s.filters}${mapCollapsed ? ' ' + s.filtersHidden : ''}`}>
        {(['continent', 'genre'] as const).map(type => {
          const isOpen = openFilterRow === type
          const current = curFilters[type]

          return (
            <div className={s.filterRow} key={type}>
              <button
                className={`${s.filterToggle}${isOpen ? ' ' + s.filterToggleOn : ''}${current ? ' ' + s.filterToggleActive : ''}`}
                onClick={e => { e.stopPropagation(); setOpenFilterRow(prev => (prev === type ? null : type)) }}
              >
                <span className={s.filterLabel}>{type === 'continent' ? t.filter_country : t.filter_genre}</span>
                <span className={`${s.rowChevron}${isOpen ? ' ' + s.rowChevronOpen : ''}`}>▸</span>
              </button>

              <div className={`${s.chipsWrap}${isOpen ? ' ' + s.chipsWrapOpen : ''}`}>
                <div
                  ref={el => {
                    chipsWrapRefs.current[type] = el
                  }}
                  className={s.chips}
                >
                  {(filterOptions[type] || []).map(opt => (
                    <button
                      key={opt.value}
                      className={`${s.chip}${curFilters[type] === opt.value ? ' ' + s.on : ''}`}
                      onClick={e => { e.stopPropagation(); applyFilter(type, opt.value) }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Top search results */}
      {!mapCollapsed && searchResults.length > 0 && (
        <div className={s.searchResults}>
          {searchResults.map(st => (
            <button
              key={st.station_uuid}
              className={s.searchResultItem}
              onClick={() => handleSearchSelect(st)}
            >
              <span className={s.searchResultName}>{st.name}</span>
              <span className={s.searchResultMeta}>{(st.country_code || '--')} · {(st.genre_primary || '--').toUpperCase()}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search: icon first, expand on click */}
      <div className={`${s.searchWrap}${mapCollapsed ? ' ' + s.searchHidden : ''}`} onClick={e => e.stopPropagation()}>
        {favOpen && (
          <div className={s.favPanel}>
            {favItems.length === 0 ? (
              <div className={s.favEmpty}>{t.no_favorites}</div>
            ) : (
              favItems.map(item => (
                <button
                  key={item.station_uuid}
                  className={s.favItem}
                  onClick={() => handleFavoriteSelect(item.station_uuid)}
                >
                  {item.favicon ? (
                    <img className={s.favItemIcon} src={item.favicon} alt="" />
                  ) : (
                    <span className={s.favItemIconFallback}>📻</span>
                  )}
                  <span className={s.favItemName}>{item.name}</span>
                </button>
              ))
            )}
          </div>
        )}

        {!searchOpen ? (
          <div className={s.searchActions}>
            <button
              className={s.searchIconBtn}
              onClick={() => setFavOpen(v => !v)}
              title={t.favorites_title}
            >
              <FaHeart aria-hidden="true" />
            </button>
            <button
              className={s.searchIconBtn}
              onClick={() => {
                setSearchOpen(true)
                setFavOpen(false)
              }}
              title={t.search_title}
            >
              <FaSearch aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className={s.search}>
            <button
              className={s.searchFavInline}
              onClick={() => setFavOpen(v => !v)}
              title={t.favorites_title}
            >
              <FaHeart aria-hidden="true" />
            </button>
            <span className={s.searchIcon}><FaSearch aria-hidden="true" /></span>
            <input
              autoFocus
              type="text"
              className={s.searchInput}
              placeholder={t.search_placeholder}
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button
              className={s.searchClose}
              onClick={() => {
                setSearchOpen(false)
                setFavOpen(false)
                setSearchText('')
                setSearchResults([])
              }}
              title={t.close}
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  )
}



