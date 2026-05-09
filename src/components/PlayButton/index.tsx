import { useState } from 'react'
import { IoIosPlayCircle } from 'react-icons/io'
import { useT } from '@/i18n/useT'
import s from './PlayButton.module.css'

interface Props {
  isPlaying: boolean
  isLoading: boolean
  onToggle: () => void
}

export function PlayButton({ isPlaying, isLoading, onToggle }: Props) {
  const [bursting, setBursting] = useState(false)
  const t = useT()

  const handleToggle = () => {
    setBursting(false)
    requestAnimationFrame(() => setBursting(true))
    window.setTimeout(() => setBursting(false), 520)
    onToggle()
  }

  return (
    <div className={`${s.wrap}${bursting ? ' ' + s.burstWrap : ''}`}>
      <button
        className={`${s.btn}${isPlaying ? ' ' + s.on : ''}${isLoading ? ' ' + s.loading : ''}`}
        onClick={handleToggle}
        title="[Space]"
      >
        <span className={s.icon}>
          <span className={s.sym}>
            <IoIosPlayCircle className={s.playIcon} aria-hidden="true" />
            <span className={s.playText}>{t.play_label}</span>
          </span>
          <span className={s.loadingSpinner} aria-hidden="true" />
          <span className={s.bars}>
            {[0,1,2,3,4,5,6,7].map(i => <span key={i} className={s.bar} />)}
          </span>
        </span>
      </button>
    </div>
  )
}
