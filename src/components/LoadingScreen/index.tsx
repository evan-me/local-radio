import { useEffect, useState } from 'react'
import s from './LoadingScreen.module.css'
import { useT } from '@/i18n/useT'

interface Props {
  onDone: () => void
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

export function LoadingScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0)
  const [stepIdx, setStepIdx] = useState(-1)
  const [out, setOut] = useState(false)
  const t = useT()

  const STEPS: [number, string][] = [
    [20, t.loading_connecting],
    [50, t.loading_db],
    [75, t.loading_map],
    [100, t.loading_ready],
  ]

  useEffect(() => {
    let cancelled = false
    async function run() {
      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return
        setProgress(STEPS[i][0])
        setStepIdx(i)
        await sleep(300 + Math.random() * 150)
      }
      await sleep(200)
      if (!cancelled) {
        setOut(true)
        setTimeout(onDone, 500)
      }
    }
    run()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone])

  const msg = stepIdx >= 0 ? STEPS[stepIdx][1] : t.loading_init

  return (
    <div className={`${s.root}${out ? ' ' + s.out : ''}`}>
      <div className={s.logo}>LOCAL RADIO</div>
      <div className={s.barWrap}>
        <div className={s.bar} style={{ width: progress + '%' }} />
      </div>
      <div className={s.msg}>{msg}</div>
    </div>
  )
}
