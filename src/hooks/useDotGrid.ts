// src/hooks/useDotGrid.ts
// Canvas dot-grid with beat waves, mouse proximity, click shocks
// Animation loop for the player HUD background

import { useEffect, useRef } from 'react'

const DOT_GAP = 18
const BEAT_MS = 60000 / 110

interface Dot {
  x: number; y: number; ph: number
  vx: number; vy: number; ox: number; oy: number
}

interface BeatWave { t: number; e: number }
interface Shock { cx: number; cy: number; t: number; str: number }

export function useDotGrid(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isPlaying: boolean,
  getEnergy: () => number
) {
  const stateRef = useRef({
    dots: [] as Dot[],
    beatWaves: [] as BeatWave[],
    shocks: [] as Shock[],
    lastBeat: 0,
    energy: 0.3,
    mouse: { x: -9999, y: -9999 },
    rafId: 0,
    isPlaying,
    getEnergy,
  })

  // Keep refs in sync without re-creating the loop
  useEffect(() => { stateRef.current.isPlaying = isPlaying }, [isPlaying])
  useEffect(() => { stateRef.current.getEnergy = getEnergy }, [getEnergy])

  // Build dots on resize
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const host = cv.parentElement ?? cv
    let rafResize = 0
    let timeoutResize = 0

    function buildDots(W: number, H: number) {
      const cols = Math.ceil(W / DOT_GAP) + 1
      const rows = Math.ceil(H / DOT_GAP) + 1
      const ox = (W - (cols - 1) * DOT_GAP) / 2
      const oy = (H - (rows - 1) * DOT_GAP) / 2
      stateRef.current.dots = []
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          stateRef.current.dots.push({
            x: ox + c * DOT_GAP, y: oy + r * DOT_GAP,
            ph: (c + r) * 0.22, vx: 0, vy: 0, ox: 0, oy: 0,
          })
    }

    function resize() {
      const rect = host.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      cv!.width  = Math.floor(rect.width  * (window.devicePixelRatio || 1))
      cv!.height = Math.floor(rect.height * (window.devicePixelRatio || 1))
      buildDots(cv!.width, cv!.height)
    }

    resize()
    rafResize = requestAnimationFrame(resize)
    timeoutResize = window.setTimeout(resize, 60)
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    window.addEventListener('resize', resize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafResize)
      window.clearTimeout(timeoutResize)
    }
  }, [canvasRef])

  // Mouse + click events
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return

    const onMove = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      stateRef.current.mouse.x = (e.clientX - r.left) * dpr
      stateRef.current.mouse.y = (e.clientY - r.top)  * dpr
    }
    const onLeave = () => { stateRef.current.mouse.x = -9999; stateRef.current.mouse.y = -9999 }
    const onClick = (e: MouseEvent) => {
      const r = cv.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      stateRef.current.shocks.push({
        cx: (e.clientX - r.left) * dpr,
        cy: (e.clientY - r.top)  * dpr,
        t: performance.now(),
        str: 4,
      })
    }

    const parent = cv.parentElement
    parent?.addEventListener('mousemove',  onMove,  { passive: true })
    parent?.addEventListener('mouseleave', onLeave)
    parent?.addEventListener('click',      onClick)
    return () => {
      parent?.removeEventListener('mousemove',  onMove)
      parent?.removeEventListener('mouseleave', onLeave)
      parent?.removeEventListener('click',      onClick)
    }
  }, [canvasRef])

  // Animation loop
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    let ctx: CanvasRenderingContext2D | null = null

    function loop(now: number) {
      if (!ctx) ctx = cv!.getContext('2d')
      if (!ctx || !cv!.width) { stateRef.current.rafId = requestAnimationFrame(loop); return }

      const st = stateRef.current
      const W = cv!.width, H = cv!.height
      ctx.clearRect(0, 0, W, H)

      // Beat tick
      const rawEnergy = st.isPlaying ? st.getEnergy() : 0
      const fallbackEnergy = st.isPlaying
        ? 0.22 + 0.08 * (0.5 + 0.5 * Math.sin(now * 0.006))
        : 0.26
      const targetEnergy = st.isPlaying
        ? Math.min(
            Math.max(rawEnergy * 1.18 + 0.22, rawEnergy > 0.02 ? 0 : fallbackEnergy),
            0.56,
          )
        : 0.26
      st.energy += (targetEnergy - st.energy) * (st.isPlaying ? 0.09 : 0.11)
      const energy = st.energy

      if (now - st.lastBeat > BEAT_MS * (st.isPlaying ? 0.88 : 1.58)) {
        st.beatWaves.push({ t: now, e: energy })
        st.lastBeat = now
      }
      st.beatWaves = st.beatWaves.filter(w => now - w.t < 1600)
      st.shocks    = st.shocks.filter(s => now - s.t < 700)

      const cx = W / 2, cy = H / 2
      const dpr = window.devicePixelRatio || 1
      const PROX = 110 * dpr
      const PROX_SQ = PROX * PROX

      // Shock impulses
      for (const sh of st.shocks) {
        const age = now - sh.t
        const front = age * 0.38
        for (const d of st.dots) {
          const dx = d.x - sh.cx, dy = d.y - sh.cy
          const dist = Math.sqrt(dx * dx + dy * dy)
          const diff = Math.abs(dist - front)
          if (diff < 28) {
            const t = (1 - diff / 28) * sh.str * (1 - age / 700)
            const ang = Math.atan2(dy, dx)
            d.vx += Math.cos(ang) * t * 1.8
            d.vy += Math.sin(ang) * t * 1.8
          }
        }
      }

      // Two-pass rendering
      const basePath = new Path2D()
      const activeList: { rx: number; ry: number; r: number; useR: number; useG: number; useB: number; bright: number }[] = []

      for (const d of st.dots) {
        d.vx *= 0.87; d.vy *= 0.87
        d.ox += d.vx;  d.oy += d.vy
        d.ox *= 0.91;  d.oy *= 0.91

        const rx = d.x + d.ox, ry = d.y + d.oy
        const ddx = rx - cx, ddy = ry - cy
        const dist = Math.sqrt(ddx * ddx + ddy * ddy)

        const phaseSpeed = st.isPlaying ? 0.0008 : 0.00031
        let bright = (st.isPlaying ? 0.15 : 0.19) + 0.08 * Math.sin(now * phaseSpeed + d.ph)
        let scale  = 1

        for (const w of st.beatWaves) {
          const age = now - w.t
          const front = age * 0.33
          const width = 35 + w.e * 55
          const diff = Math.abs(dist - front)
          if (diff < width) {
            const t = (1 - diff / width) ** 2 * w.e
            bright += t * (st.isPlaying ? 0.54 : 0.74)
            scale  += t * (st.isPlaying ? 1.08 : 1.32)
          }
        }

        let useR = 141, useG = 219, useB = 255, proxActive = false
        const mdx = rx - st.mouse.x, mdy = ry - st.mouse.y
        const msq = mdx * mdx + mdy * mdy
        if (msq < PROX_SQ) {
          const t = 1 - Math.sqrt(msq) / PROX
          useR = Math.round(141 + (61 - 141) * t)
          useG = Math.round(219 + (215 - 219) * t)
          bright = Math.min(bright + t * 0.55, 0.95)
          scale  += t * 0.7
          proxActive = true
        }

        bright = Math.min(bright, 0.95)
        scale  = Math.min(scale, st.isPlaying ? 2.18 : 2.55)
        const r = 1.1 * scale

        if (proxActive || scale > 1.25) {
          activeList.push({ rx, ry, r, useR, useG, useB, bright })
        } else {
          basePath.arc(rx, ry, r, 0, Math.PI * 2)
          basePath.moveTo(rx + r + 0.1, ry)
        }
      }

      // Pass 1: batch base dots
      const baseBright = st.isPlaying ? 0.075 : 0.34
      ctx.fillStyle = st.isPlaying
        ? `rgba(102,176,224,${baseBright})`
        : `rgba(128,198,242,${baseBright})`
      ctx.fill(basePath)

      // Pass 2: active dots
      for (const a of activeList) {
        ctx.beginPath()
        ctx.arc(a.rx, a.ry, a.r, 0, Math.PI * 2)
        const cb = st.isPlaying
          ? Math.min(a.bright * 0.46, 0.54)
          : Math.min(a.bright * 1.52, 1)
        ctx.shadowBlur = st.isPlaying ? 10 : 8
        ctx.shadowColor = `rgba(${a.useR},${a.useG},${a.useB},${st.isPlaying ? 0.30 : 0.3})`
        ctx.fillStyle = `rgba(${a.useR},${a.useG},${a.useB},${cb.toFixed(2)})`
        ctx.fill()
        if (st.isPlaying) {
          ctx.beginPath()
          ctx.arc(a.rx, a.ry, Math.max(a.r * 0.48, 1), 0, Math.PI * 2)
          ctx.fillStyle = `rgba(235,255,255,${Math.min(cb + 0.06, 0.68).toFixed(2)})`
          ctx.fill()
        }
        ctx.shadowBlur = 0
      }

      stateRef.current.rafId = requestAnimationFrame(loop)
    }

    stateRef.current.rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(stateRef.current.rafId)
  }, [canvasRef])
}
