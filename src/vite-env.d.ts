/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

declare module '*.module.scss' {
  const classes: Record<string, string>
  export default classes
}

declare module 'hls.js/light' {
  import Hls from 'hls.js'
  export default Hls
}

interface Window {
  electronAPI?: {
    minimize: () => void
    maximize: () => void
    close: () => void
    setWindowMode?: (mode: 'expanded' | 'collapsed') => void
    getVersion?: () => Promise<string>
    startupWindowMode?: 'expanded' | 'collapsed'
    platform: string
  }
}
