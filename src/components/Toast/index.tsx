import { useStore } from '@/store/useStore'
import s from './Toast.module.css'

export function Toast() {
  const msg = useStore(st => st.toastMsg)
  const type = useStore(st => st.toastType)
  const visible = useStore(st => st.toastVisible)

  const icon = type === 'error' ? '✖' : type === 'warning' ? '⚠' : '✓'
  const cleanMsg = msg.replace(/^[\s⚠✖✓♥♡⟳⎘]+/, '').trim() || msg

  return (
    <div className={`${s.toast} ${s[type]}${visible ? ' ' + s.visible : ''}`}>
      <span className={s.icon}>{icon}</span>
      <span className={s.text}>{cleanMsg}</span>
    </div>
  )
}
