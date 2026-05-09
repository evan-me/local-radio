import { useEffect, useState } from 'react'
import s from './TitleBar.module.css'
import { useStore } from '@/store/useStore'
import { useT } from '@/i18n/useT'

export function TitleBar() {
  const lang = useStore(st => st.lang)
  const lastSyncTime = useStore(st => st.lastSyncTime)
  const setLang = useStore(st => st.setLang)
  const t = useT()

  const [snapshotLabel, setSnapshotLabel] = useState(t.data_label)

  useEffect(() => {
    if (!lastSyncTime) {
      setSnapshotLabel(t.data_label)
      return
    }

    const locale = lang === 'zh' ? 'zh-CN' : 'en-US'
    const formatted = new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(lastSyncTime))
    setSnapshotLabel(`${t.data_label} ${formatted}`)
  }, [lang, lastSyncTime, t])

  function handleClose() { window.electronAPI?.close() }
  function handleMinimize() { window.electronAPI?.minimize() }

  return (
    <div className={s.titlebar}>
      <div className={s.traffic}>
        <i className={s.tc1} onClick={handleClose} title="Close" />
        <i className={s.tc2} onClick={handleMinimize} title="Minimize" />
      </div>

      <div className={s.title}>LOCAL RADIO</div>

      <div className={s.right}>
        <button
          className={s.langBtn}
          onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
          title={lang === 'zh' ? 'Switch to English' : '切换中文'}
        >
          {t.lang_toggle}
        </button>
        <div className={s.healthInfo}>
          <span className={`${s.healthDot} ${lastSyncTime ? s.ok : s.fail}`} />
          {snapshotLabel}
        </div>
      </div>
    </div>
  )
}
