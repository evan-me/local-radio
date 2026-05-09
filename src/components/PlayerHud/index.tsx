import { useRef, useCallback, useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { useDotGrid } from '@/hooks/useDotGrid'
import { hasMappableLocation } from '@/hooks/useMapCanvas'
import { PlayButton } from '@/components/PlayButton'
import { ElasticVolume } from '@/components/ElasticVolume'
import { FaRandom } from 'react-icons/fa'
import { IoMdHeartEmpty } from 'react-icons/io'
import { LuLocateFixed } from 'react-icons/lu'
import { useT } from '@/i18n/useT'
import s from './PlayerHud.module.css'

declare global {
  interface Window {
    __LOCAL_RADIO_AUDIO__?: HTMLAudioElement
  }
}

// Audio singleton (survives HMR and guarantees only one playback source)
const audio = (() => {
  if (typeof window !== 'undefined' && window.__LOCAL_RADIO_AUDIO__) {
    return window.__LOCAL_RADIO_AUDIO__
  }
  const a = new Audio()
  if (typeof window !== 'undefined') {
    window.__LOCAL_RADIO_AUDIO__ = a
  }
  return a
})()

audio.crossOrigin = 'anonymous'
audio.volume = 0.5

// HLS singleton — reused across station switches
type HlsConstructor = typeof import('hls.js').default

interface HlsModule {
  default: HlsConstructor
}

let hlsInstance: { destroy: () => void } | null = null
let hlsModulePromise: Promise<HlsModule> | null = null

function loadHlsModule(): Promise<HlsModule> {
  if (!hlsModulePromise) {
    hlsModulePromise = import('hls.js/light') as Promise<HlsModule>
  }
  return hlsModulePromise
}

async function attachHls(url: string): Promise<void> {
  const { default: Hls } = await loadHlsModule()
  return new Promise((resolve, reject) => {
    if (!Hls.isSupported()) { reject(new Error('hls not supported')); return }
    if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
    const hls = new Hls({ enableWorker: false, lowLatencyMode: true })
    hlsInstance = hls
    hls.loadSource(url)
    hls.attachMedia(audio)
    hls.once(Hls.Events.MANIFEST_PARSED, () => resolve())
    hls.once(Hls.Events.ERROR, (_evt, data) => {
      if (data.fatal) reject(new Error(data.type))
    })
  })
}

function detachHls() {
  if (hlsInstance) { hlsInstance.destroy(); hlsInstance = null }
}

let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let audioSrc: MediaElementAudioSourceNode | null = null
let analyserConnected = false
const ENABLE_AUDIO_ANALYSER = false
const AUDIO_DEBUG = false

function initAudio() {
  if (!ENABLE_AUDIO_ANALYSER) return
  try {
    if (!audioCtx) audioCtx = new AudioContext()
    if (!analyser) { analyser = audioCtx.createAnalyser(); analyser.fftSize = 64 }
    // MediaElementSource can only be created once per HTMLMediaElement.
    if (!audioSrc) {
      audioSrc = audioCtx.createMediaElementSource(audio)
      audioSrc.connect(analyser)
    }
    if (!analyserConnected) {
      analyser.connect(audioCtx.destination)
      analyserConnected = true
    }
  } catch {}
}

async function ensureAudioContextRunning() {
  if (!ENABLE_AUDIO_ANALYSER) return
  try {
    initAudio()
    if (audioCtx && audioCtx.state !== 'running') {
      await audioCtx.resume()
    }
  } catch {}
}

function getEnergy() {
  if (!ENABLE_AUDIO_ANALYSER) return 0
  if (!analyser) return 0
  const d = new Uint8Array(analyser.frequencyBinCount)
  analyser.getByteFrequencyData(d)
  return d.slice(0, 4).reduce((a, v) => a + v, 0) / (4 * 255)
}

export function PlayerHud() {
  const stations    = useStore(st => st.stations)
  const curIdx      = useStore(st => st.curIdx)
  const isPlaying   = useStore(st => st.isPlaying)
  const favs        = useStore(st => st.favs)
  const volume      = useStore(st => st.volume)
  const setIsPlaying= useStore(st => st.setIsPlaying)
  const toggleFav   = useStore(st => st.toggleFav)
  const setVolume   = useStore(st => st.setVolume)
  const showToast   = useStore(st => st.showToast)
  const lang        = useStore(st => st.lang)
  const setMapCollapsed = useStore(st => st.setMapCollapsed)
  const setFocusNodeId  = useStore(st => st.setFocusNodeId)
  const t = useT()

  const canvasRef = useRef<HTMLCanvasElement>(null)

  const getEnergyFn = useCallback(() => getEnergy(), [])
  useDotGrid(canvasRef, isPlaying, getEnergyFn)

  const station = curIdx >= 0 ? stations[curIdx] : null
  const isFav = station ? favs.has(station.station_uuid) : false

  // Tele state (async loaded)
  const [tele, setTele] = useState({ codec: '---', br: '---', trend: '---', trendClass: 'cd' })
  const [playDuration, setPlayDuration] = useState('00:00')
  const [isLoadingStream, setIsLoadingStream] = useState(false)
  const playReqRef = useRef(0)
  const shuffleRetryQueueRef = useRef<number[] | null>(null)

  const resetShuffleRetry = useCallback(() => {
    shuffleRetryQueueRef.current = null
  }, [])

  const tryNextShuffleCandidate = useCallback(() => {
    const queue = shuffleRetryQueueRef.current
    if (!queue || queue.length === 0) {
      resetShuffleRetry()
      setIsLoadingStream(false)
      setIsPlaying(false)
      showToast(t.stream_error)
      return false
    }
    const nextIdx = queue.shift()
    if (typeof nextIdx !== 'number') {
      resetShuffleRetry()
      setIsLoadingStream(false)
      setIsPlaying(false)
      showToast(t.stream_error)
      return false
    }
    useStore.getState().setCurIdx(nextIdx)
    const nextStation = useStore.getState().stations[nextIdx]
    if (nextStation) {
      useStore.getState().setFocusNodeId(nextStation.station_uuid)
    }
    showToast(t.shuffle_toast(nextIdx + 1))
    return true
  }, [resetShuffleRetry, setIsPlaying, showToast, t])

  const hardStopAudio = useCallback(() => {
    playReqRef.current += 1
    resetShuffleRetry()
    audio.pause()
    detachHls()
    audio.removeAttribute('src')
    audio.load()
    setIsLoadingStream(false)
    setIsPlaying(false)
  }, [setIsPlaying, resetShuffleRetry])

  const formatDuration = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [])

  const logAudioEvent = useCallback((event: string, extra?: Record<string, unknown>) => {
    if (!AUDIO_DEBUG) return
    console.info('[audio]', event, {
      src: audio.currentSrc || audio.src || '',
      paused: audio.paused,
      muted: audio.muted,
      volume: audio.volume,
      currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(2)) : audio.currentTime,
      readyState: audio.readyState,
      networkState: audio.networkState,
      errorCode: audio.error?.code,
      errorMessage: audio.error?.message,
      audioCtxState: audioCtx?.state,
      ...extra,
    })
  }, [])

  // Derive telemetry directly from the current station to avoid extra snapshot reads.
  useEffect(() => {
    if (!station) return
    const trend = station.click_trend
    setTele({
      codec: station.codec || station._streamInfo?.codec || '—',
      br: station.bitrate_kbps ? `${station.bitrate_kbps}k` : (station._streamInfo?.bitrate_kbps ? `${station._streamInfo.bitrate_kbps}k` : '—'),
      trend: trend == null ? '—' : trend > 0 ? `↑${trend}` : trend < 0 ? `↓${Math.abs(trend)}` : '→',
      trendClass: trend == null ? 'cd' : trend > 0 ? 'cg' : trend < 0 ? 'cr' : 'cd',
    })
  }, [station])

  // Sync volume to audio element
  useEffect(() => { audio.volume = volume / 100 }, [volume])

  // Audio event listeners
  useEffect(() => {
    const onLoadStart = () => logAudioEvent('loadstart')
    const onCanPlay = () => logAudioEvent('canplay')
    const onCanPlayThrough = () => logAudioEvent('canplaythrough')
    const onWaiting = () => logAudioEvent('waiting')
    const onStalled = () => logAudioEvent('stalled')
    const onSuspend = () => logAudioEvent('suspend')
    const onAbort = () => logAudioEvent('abort')
    const onEmptied = () => logAudioEvent('emptied')
    const onEnded = () => logAudioEvent('ended')

    const onPlaying = () => {
      logAudioEvent('playing')
      resetShuffleRetry()
      setIsLoadingStream(false)
      setIsPlaying(true)
    }
    const onPause  = () => {
      logAudioEvent('pause')
      setIsPlaying(false)
      setIsLoadingStream(false)
      setPlayDuration('00:00')
    }
    const onTime   = () => setPlayDuration(formatDuration(audio.currentTime || 0))
    const onError  = () => {
      logAudioEvent('error')
      if (tryNextShuffleCandidate()) return
      setIsLoadingStream(false)
      showToast('⚠ STREAM ERROR')
      setIsPlaying(false)
    }
    audio.addEventListener('loadstart', onLoadStart)
    audio.addEventListener('canplay', onCanPlay)
    audio.addEventListener('canplaythrough', onCanPlayThrough)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('stalled', onStalled)
    audio.addEventListener('suspend', onSuspend)
    audio.addEventListener('abort', onAbort)
    audio.addEventListener('emptied', onEmptied)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('loadstart', onLoadStart)
      audio.removeEventListener('canplay', onCanPlay)
      audio.removeEventListener('canplaythrough', onCanPlayThrough)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('stalled', onStalled)
      audio.removeEventListener('suspend', onSuspend)
      audio.removeEventListener('abort', onAbort)
      audio.removeEventListener('emptied', onEmptied)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('error', onError)
    }
  }, [setIsPlaying, showToast, formatDuration, resetShuffleRetry, tryNextShuffleCandidate, logAudioEvent])

  // Play a station (with HLS support)
  const playSt = useCallback((idx: number) => {
    const st = stations[idx]
    if (!st) return
    const si = st._streamInfo
    const url = si?.stream_url || st.stream_url
    if (!url) {
      if (!tryNextShuffleCandidate()) {
        showToast(t.no_stream_url)
        setIsPlaying(false)
        setIsLoadingStream(false)
      }
      return
    }

    const isHls = si?.is_hls || st.is_hls ||
      url.includes('.m3u8') || url.includes('/chunklist') || url.includes('/playlist')

    const reqId = ++playReqRef.current
    audio.pause()
    detachHls()
    setIsLoadingStream(true)
    setPlayDuration('00:00')
    logAudioEvent('play:attempt', { station: st.station_uuid, url, isHls })

    const doPlay = isHls
      ? attachHls(url).then(() => audio.play())
      : (ensureAudioContextRunning(), (audio.src = url), audio.play())

    Promise.resolve(doPlay)
      .then(() => {
        if (reqId !== playReqRef.current) return
        logAudioEvent('play:ok', { station: st.station_uuid })
      })
      .catch(() => {
        if (reqId !== playReqRef.current) return
        const fb = si?.stream_url_fallback || st.stream_url_fallback
        if (fb && fb !== url) {
          audio.pause()
          detachHls()
          const fbIsHls = fb.includes('.m3u8') || fb.includes('/chunklist')
          const doFb = fbIsHls
            ? attachHls(fb).then(() => audio.play())
            : (ensureAudioContextRunning(), (audio.src = fb), audio.play())
          logAudioEvent('play:fallback-attempt', { station: st.station_uuid, fallback: fb })
          Promise.resolve(doFb)
            .then(() => {
              if (reqId !== playReqRef.current) return
              logAudioEvent('play:fallback-ok', { station: st.station_uuid })
              showToast(t.fallback_stream)
            })
            .catch(() => {
              if (reqId !== playReqRef.current) return
              logAudioEvent('play:fallback-failed', { station: st.station_uuid })
              if (tryNextShuffleCandidate()) return
              setIsLoadingStream(false)
              showToast(t.stream_error)
              setIsPlaying(false)
            })
        } else {
          logAudioEvent('play:failed', { station: st.station_uuid })
          if (tryNextShuffleCandidate()) return
          setIsLoadingStream(false)
          showToast(t.stream_error)
          setIsPlaying(false)
        }
      })
  }, [stations, setIsPlaying, showToast, t.no_stream_url, t.stream_error, tryNextShuffleCandidate])

  // Keep playing when user switches station while already playing
  useEffect(() => {
    if (!isPlaying || curIdx < 0) return
    playSt(curIdx)
  }, [curIdx])

  const handleTogglePlay = useCallback(() => {
    if (!stations.length) return
    if (isPlaying) {
      hardStopAudio()
    }
    else playSt(curIdx)
  }, [isPlaying, curIdx, stations, playSt, hardStopAudio])

  // Allow global keyboard Space to trigger actual audio toggle
  useEffect(() => {
    const onToggle = () => handleTogglePlay()
    window.addEventListener('radio:togglePlay', onToggle as EventListener)
    return () => window.removeEventListener('radio:togglePlay', onToggle as EventListener)
  }, [handleTogglePlay])

  const handleShuffle = useCallback(() => {
    if (!stations.length) return
    hardStopAudio()

    const indices = Array.from({ length: stations.length }, (_, idx) => idx)
    for (let k = indices.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1))
      ;[indices[k], indices[j]] = [indices[j], indices[k]]
    }
    if (stations.length > 1 && indices[0] === curIdx) {
      ;[indices[0], indices[1]] = [indices[1], indices[0]]
    }

    const firstIdx = indices[0]
    shuffleRetryQueueRef.current = indices.slice(1)

    const st = stations[firstIdx]
    useStore.getState().setCurIdx(firstIdx)
    if (st) {
      useStore.getState().setFocusNodeId(st.station_uuid)
    }
    useStore.getState().setIsPlaying(true)
    showToast(t.shuffle_toast(firstIdx + 1))
  }, [stations, curIdx, showToast, hardStopAudio])

  const handleFav = useCallback(() => {
    if (!station) return
    toggleFav(station)
    showToast(favs.has(station.station_uuid) ? t.removed_fav : t.saved_fav)
  }, [station, favs, toggleFav, showToast, t])

  const handleVolume = useCallback((v: number) => {
    setVolume(v)
    audio.volume = v / 100
  }, [setVolume])

  const handleTrendDoubleClick = useCallback(async () => {
    try {
      const version = await window.electronAPI?.getVersion?.()
      showToast(t.app_version(version ?? 'unknown'))
    } catch {
      showToast(t.version_unavailable, 'warning')
    }
  }, [showToast, t])

  // Favicon
  const [faviconLoaded, setFaviconLoaded] = useState(false)
  useEffect(() => setFaviconLoaded(false), [curIdx])

  const country = station?.country_code || '?'
  const genre   = (station?.genre_primary || '?').toUpperCase()
  const loc     = station?.country_name || station?.country_code || '—'
  const nodeCountryLabel = lang === 'zh' ? (station?.country_name || station?.country_code || '?') : country

  return (
    <div className={s.zone}>
      <div className={s.hud}>
        <canvas ref={canvasRef} className={s.dotCanvas} />
        <div className={s.scanline} />
        <div className={s.inner}>

          {/* Top: node info + duration */}
          <div className={`${s.top} ${s.topFx}`} key={`top-${station?.station_uuid ?? 'none'}`}>
            <div className={s.node}>
              <span className={s.nodeCountry}>{nodeCountryLabel}</span>
              <span className={s.nodeSep}>/</span>
              <span className={s.nodeGenre}>{genre}</span>
            </div>
            <div className={s.playDur}>{playDuration}</div>
          </div>

          {/* Station name row */}
          <div className={`${s.nameRow} ${s.nameFx}`} key={`name-${station?.station_uuid ?? 'none'}`}>
            <div className={s.favWrap}>
              {station?.favicon && (
                <img
                  className={s.favIcon}
                  src={station.favicon}
                  alt=""
                  style={{ display: faviconLoaded ? 'block' : 'none' }}
                  onLoad={() => setFaviconLoaded(true)}
                  onError={() => setFaviconLoaded(false)}
                />
              )}
              {!faviconLoaded && <span>📻</span>}
            </div>
            <div className={s.nameGroup}>
              <div className={s.stationName}>
                {station?.name || t.scanning}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className={`${s.tags} ${s.tagsFx}`} key={`tags-${station?.station_uuid ?? 'none'}`}>
            <div className={s.tagsLeft}>
              {station?.vibes?.slice(0, 4).map(v => (
                <span key={v} className={`${s.tag} ${s.tagVibe}`}>{v.toUpperCase()}</span>
              ))}
            </div>
            <div className={s.tagsVolume}>
              <ElasticVolume value={volume} onChange={handleVolume} />
            </div>
          </div>

          {/* Controls */}
          <div className={`${s.controls} ${s.controlsFx}`} key={`ctrl-${station?.station_uuid ?? 'none'}`}>
            <PlayButton isPlaying={isPlaying} isLoading={isLoadingStream} onToggle={handleTogglePlay} />

            <button className={`${s.btn} ${s.shuffleBtn}`} onClick={handleShuffle} title={t.shuffle_title}>
              <FaRandom className={s.btnIcon} aria-hidden="true" />
            </button>

            <div className={s.actionButtons}>
              <button
                className={`${s.btn} ${s.favBtn}${isFav ? ' ' + s.on : ''}`}
                onClick={handleFav}
                title={t.fav_title}
              >
                <IoMdHeartEmpty className={s.btnIcon} aria-hidden="true" />
              </button>

              <button
                className={`${s.btn} ${s.locateBtn}`}
                onClick={() => {
                  if (!station) return
                  if (!hasMappableLocation(station)) {
                    showToast(t.no_location, 'warning')
                    return
                  }
                  setMapCollapsed(false)
                  setFocusNodeId(station.station_uuid)
                }}
                disabled={!station}
                title={t.locate_title}
              >
                <LuLocateFixed className={s.btnIcon} aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Telemetry */}
          <div className={`${s.tele} ${s.teleFx}`} key={`tele-${station?.station_uuid ?? 'none'}`}>
            <div className={s.tc}><div className={s.tl}>{t.plays}</div><div className={`${s.tv} ${s.ca}`}>{station?.click_count ?? '---'}</div></div>
            <div className={s.tc}><div className={s.tl}>{t.votes}</div><div className={`${s.tv} ${s.c2}`}>{station?.votes ?? '---'}</div></div>
            <div className={s.tc}><div className={s.tl}>{t.codec}</div><div className={`${s.tv} ${s.c1}`}>{tele.codec}</div></div>
            <div className={s.tc}><div className={s.tl}>{t.kbps}</div><div className={`${s.tv} ${s.c1}`}>{tele.br}</div></div>
            <div
              className={s.tc}
              onDoubleClick={handleTrendDoubleClick}
              title="Double click to show version"
            >
              <div className={s.tl}>{t.trend}</div>
              <div className={`${s.tv} ${s[tele.trendClass as keyof typeof s] ?? s.cd}`}>{tele.trend}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
