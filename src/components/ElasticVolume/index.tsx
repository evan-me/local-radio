import { useRef, useCallback, useEffect } from 'react'
import s from './ElasticVolume.module.css'

const ES_MAX_OVERFLOW = 50
const MUTE_TOGGLE_ZONE_PX = 12
const DEFAULT_RESTORE_VOLUME = 50

function esDecay(val: number, max: number) {
  if (!max) return 0
  const entry = val / max
  return (2 / (1 + Math.exp(-entry)) - 1) * max
}

interface Props {
  value: number           // 0–100
  onChange: (v: number) => void
}

export function ElasticVolume({ value, onChange }: Props) {
  const overflowRef = useRef(0)
  const velocityRef = useRef(0)
  const draggingRef = useRef(false)
  const regionRef   = useRef<'left' | 'middle' | 'right'>('middle')
  const animRef     = useRef(0)
  const lastNonZeroRef = useRef(DEFAULT_RESTORE_VOLUME)
  const trackRef    = useRef<HTMLDivElement>(null)
  const outerRef    = useRef<HTMLDivElement>(null)

  const label = value === 0 ? 'MUT' : value < 35 ? 'LOW' : value < 70 ? 'VOL' : 'MAX'
  const labelColor = value >= 90 ? 'var(--accent)' : 'var(--blue-dim)'

  // Spring animation
  const springTick = useCallback(() => {
    const stiffness = 0.22, damping = 0.72
    velocityRef.current = velocityRef.current * damping - overflowRef.current * stiffness
    overflowRef.current += velocityRef.current

    if (Math.abs(overflowRef.current) < 0.2 && Math.abs(velocityRef.current) < 0.2) {
      overflowRef.current = 0
      velocityRef.current = 0
      applyTransform(0)
      animRef.current = 0
      return
    }
    applyTransform(overflowRef.current)
    animRef.current = requestAnimationFrame(springTick)
  }, [])

  const applyTransform = (overflow: number) => {
    const track = trackRef.current
    const outer = outerRef.current
    if (!track) return
    if (overflow !== 0) {
      const w = outer?.offsetWidth || 70
      const sx = 1 + Math.abs(overflow) / w * 0.7
      const sy = Math.max(0.65, 1 - Math.abs(overflow) / (w * 2.5))
      const origin = regionRef.current === 'left' ? 'right center' : 'left center'
      track.style.transform = `scaleX(${sx.toFixed(3)}) scaleY(${sy.toFixed(3)})`
      track.style.transformOrigin = origin
    } else {
      track.style.transform = ''
    }
  }

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return
    const outer = outerRef.current
    if (!outer) return
    const rect = outer.getBoundingClientRect()
    const x = e.clientX

    if (x < rect.left) {
      regionRef.current = 'left'
      overflowRef.current = -esDecay(rect.left - x, ES_MAX_OVERFLOW)
      onChange(0)
    } else if (x > rect.right) {
      regionRef.current = 'right'
      overflowRef.current = esDecay(x - rect.right, ES_MAX_OVERFLOW)
      onChange(100)
    } else {
      regionRef.current = 'middle'
      overflowRef.current = 0
      onChange(Math.round(((x - rect.left) / rect.width) * 100))
    }
    applyTransform(overflowRef.current)
  }, [onChange])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const outer = outerRef.current
    if (outer) {
      const rect = outer.getBoundingClientRect()
      const localX = e.clientX - rect.left
      if (localX <= MUTE_TOGGLE_ZONE_PX) {
        if (value === 0) onChange(lastNonZeroRef.current || DEFAULT_RESTORE_VOLUME)
        else {
          lastNonZeroRef.current = Math.max(value, 1)
          onChange(0)
        }
        return
      }
    }

    draggingRef.current = true
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = 0 }
    velocityRef.current = 0
    onPointerMove(e.nativeEvent)
  }, [onPointerMove, onChange, value])

  const onPointerUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    regionRef.current = 'middle'
    if (animRef.current) cancelAnimationFrame(animRef.current)
    animRef.current = requestAnimationFrame(springTick)
  }, [springTick])

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('lostpointercapture', onPointerUp)
    return () => {
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('lostpointercapture', onPointerUp)
    }
  }, [onPointerMove, onPointerUp])

  useEffect(() => {
    if (value > 0) {
      lastNonZeroRef.current = value
    }
  }, [value])

  return (
    <div className={s.wrapper}>
      <span className={s.label} style={{ color: labelColor }}>{label}</span>
      <div className={s.trackOuter} ref={outerRef} onPointerDown={onPointerDown}>
        <div className={s.track} ref={trackRef}>
          <div className={s.fill} style={{ width: value + '%' }} />
        </div>
      </div>
      <span className={s.value}>{value}</span>
    </div>
  )
}
