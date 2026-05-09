import { useEffect } from 'react'
import s from './TitleBar.module.css'
import { useStore } from '@/store/useStore'
import { useT } from '@/i18n/useT'

export function TitleBar() {
  const lang = useStore(st => st.lang)
  const setLang = useStore(st => st.setLang)
  const t = useT()

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
      </div>
    </div>
  )
}
