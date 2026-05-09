import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'

// Suppress harmless Autofill DevTools protocol warnings
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication')
// Allow HTTP radio streams (many Chinese stations use plain HTTP)
app.commandLine.appendSwitch('allow-running-insecure-content')
app.commandLine.appendSwitch('disable-web-security')

const isDev = !app.isPackaged
const WINDOW_WIDTH = 540
const WINDOW_HEIGHT = 680
const WINDOW_HEIGHT_COLLAPSED = 344
const WINDOW_MODE_ENV_KEY = 'LOCAL_RADIO_WINDOW_MODE'

type WindowMode = 'expanded' | 'collapsed'

interface WindowState {
  x?: number
  y?: number
  mode?: WindowMode
}

const WINDOW_STATE_FILE = path.join(app.getPath('userData'), 'window-state.json')

function readWindowState(): WindowState {
  try {
    if (!fs.existsSync(WINDOW_STATE_FILE)) return {}
    const raw = fs.readFileSync(WINDOW_STATE_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as WindowState
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeWindowState(state: WindowState) {
  try {
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state), 'utf-8')
  } catch {
    // ignore persistence errors
  }
}

const persistedWindowState = readWindowState()
let currentWindowMode: WindowMode =
  // In packaged app, always boot expanded to avoid stale persisted collapsed state after reinstall/upgrade.
  (!isDev)
    ? 'expanded'
    : (persistedWindowState.mode
      ?? (process.env[WINDOW_MODE_ENV_KEY] === 'collapsed' ? 'collapsed' : 'expanded'))
process.env[WINDOW_MODE_ENV_KEY] = currentWindowMode
const INITIAL_WINDOW_HEIGHT =
  currentWindowMode === 'collapsed' ? WINDOW_HEIGHT_COLLAPSED : WINDOW_HEIGHT

function saveCurrentWindowState(win: BrowserWindow) {
  const bounds = win.getBounds()
  writeWindowState({
    x: bounds.x,
    y: bounds.y,
    mode: currentWindowMode,
  })
}

function getMainWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
}

function createWindow() {
  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: INITIAL_WINDOW_HEIGHT,
    ...(typeof persistedWindowState.x === 'number' && typeof persistedWindowState.y === 'number'
      ? { x: persistedWindowState.x, y: persistedWindowState.y }
      : {}),
    minWidth: WINDOW_WIDTH,
    minHeight: WINDOW_HEIGHT_COLLAPSED,
    maxWidth: WINDOW_WIDTH,
    maxHeight: WINDOW_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: false,
    titleBarStyle: process.platform === 'darwin' ? 'hidden' : 'default',
    backgroundColor: '#07111f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
  })

  if (process.platform === 'darwin') {
    win.setWindowButtonVisibility(false)
  }

  win.once('ready-to-show', () => {
    if (currentWindowMode === 'collapsed') {
      win.setContentSize(WINDOW_WIDTH, WINDOW_HEIGHT_COLLAPSED)
    }
    win.show()
  })

  win.on('move', () => saveCurrentWindowState(win))
  win.on('close', () => saveCurrentWindowState(win))

  if (isDev) {
    const devUrl = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173'
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Window control IPC
ipcMain.on('win:minimize', () => BrowserWindow.getFocusedWindow()?.minimize())
ipcMain.on('win:maximize', () => {
  const win = BrowserWindow.getFocusedWindow()
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
})
ipcMain.on('win:close', () => BrowserWindow.getFocusedWindow()?.close())
ipcMain.on('win:set-mode', (_event, mode: 'expanded' | 'collapsed') => {
  const win = getMainWindow()
  if (!win) return
  currentWindowMode = mode
  const nextHeight = mode === 'collapsed' ? WINDOW_HEIGHT_COLLAPSED : WINDOW_HEIGHT
  win.setContentSize(WINDOW_WIDTH, nextHeight)
  saveCurrentWindowState(win)
})
ipcMain.handle('app:get-version', () => app.getVersion())
