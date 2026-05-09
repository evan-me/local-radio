// src/i18n/useT.ts
import { useStore } from '@/store/useStore'
import { translations } from './translations'

export function useT() {
  const lang = useStore(st => st.lang)
  return translations[lang]
}
