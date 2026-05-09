import { contextBridge, ipcRenderer } from 'electron'

const startupWindowMode = process.env['LOCAL_RADIO_WINDOW_MODE']

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),
  setWindowMode: (mode: 'expanded' | 'collapsed') => ipcRenderer.send('win:set-mode', mode),
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<string>,
  startupWindowMode: startupWindowMode === 'collapsed' ? 'collapsed' : 'expanded',
  platform: process.platform,
})
