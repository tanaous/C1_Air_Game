import { app, BrowserWindow, dialog, ipcMain, screen } from 'electron'
import path from 'path'
import { PipeClient } from './pipe-client'
import { C1_DISPLAY } from '../renderer/game/GameConfig'
import { IPC_EVENTS } from '../shared/types'
import type { C1ControlCommand, C1Diagnostics, DeviceParams, PipeStatus } from '../shared/types'

const DEV_URL = process.argv[2]
const isDev = !!DEV_URL
const PIPE_PARAM_TIMEOUT_MS = 20000

let gameWindow: BrowserWindow | null = null
let debugWindow: BrowserWindow | null = null
let pipeTimeout: NodeJS.Timeout | null = null

const pipeClient = new PipeClient()
const singleInstanceLock = app.requestSingleInstanceLock()

if (!singleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (gameWindow) {
      if (gameWindow.isMinimized()) gameWindow.restore()
      gameWindow.focus()
    }
    if (debugWindow) {
      if (debugWindow.isMinimized()) debugWindow.restore()
      debugWindow.focus()
    }
  })
}

function printDevBanner(): void {
  if (!isDev) return
  console.log('')
  console.log('[Main] C1 Air Game dev mode')
  console.log('[Main] Renderer:', DEV_URL)
  console.log('[Main] Electron:', process.versions.electron)
  console.log('[Main] Node:', process.versions.node)
  console.log('')
}

function displaySizes(display: Electron.Display): Array<[number, number, string]> {
  return [
    [display.size.width, display.size.height, 'size'],
    [display.bounds.width, display.bounds.height, 'bounds'],
    [
      Math.round(display.bounds.width * display.scaleFactor),
      Math.round(display.bounds.height * display.scaleFactor),
      'physical',
    ],
  ]
}

function isC1Display(display: Electron.Display): boolean {
  return (
    display.bounds.width === C1_DISPLAY.OUTPUT_WIDTH &&
    display.bounds.height === C1_DISPLAY.OUTPUT_HEIGHT &&
    Math.abs(display.scaleFactor - 1) < 0.01
  )
}

function logDisplays(displays: Electron.Display[]): void {
  if (!isDev) return
  console.log(`[Main] displays: ${displays.length}`)
  displays.forEach((display, index) => {
    const sizes = displaySizes(display).map(([w, h, name]) => `${name}=${w}x${h}`).join(' ')
    console.log(
      `  [${index}] ${display.label || '(no label)'} ${sizes} scale=${display.scaleFactor} @ ${display.bounds.x},${display.bounds.y}`,
    )
  })
}

function findC1Display(): Electron.Display | null {
  const displays = screen.getAllDisplays()
  logDisplays(displays)
  return displays.find(isC1Display) ?? null
}

function findDebugDisplay(c1Display: Electron.Display): Electron.Display {
  const primary = screen.getPrimaryDisplay()
  if (primary.id !== c1Display.id) return primary
  return screen.getAllDisplays().find((display) => display.id !== c1Display.id) ?? primary
}

function rendererUrl(debug = false): string {
  if (isDev) {
    const url = new URL(DEV_URL!)
    if (debug) url.searchParams.set('debug', '1')
    return url.toString()
  }

  const file = path.join(__dirname, '../renderer/index.html')
  return debug ? `${file}?debug=1` : file
}

function loadRenderer(window: BrowserWindow, debug = false): void {
  if (isDev) {
    window.loadURL(rendererUrl(debug))
  } else {
    const file = path.join(__dirname, '../renderer/index.html')
    window.loadFile(file, debug ? { query: { debug: '1' } } : undefined)
  }
}

function createGameWindow(display: Electron.Display): void {
  const area = display.bounds

  gameWindow = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    fullscreen: true,
    fullscreenable: true,
    frame: false,
    resizable: false,
    movable: false,
    show: false,
    autoHideMenuBar: true,
    useContentSize: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  loadRenderer(gameWindow)

  gameWindow.once('ready-to-show', () => {
    gameWindow?.setBounds(area)
    gameWindow?.setFullScreen(true)
    gameWindow?.show()
    setTimeout(() => bringDebugWindowToFront(), 300)
  })

  if (isDev) {
    gameWindow.webContents.on('console-message', (_event, level, message) => {
      console.log(level === 3 ? '[Game:ERR]' : '[Game]', message)
    })
  }

  gameWindow.on('closed', () => {
    gameWindow = null
  })

  console.log(`[Main] C1 game window: ${area.width}x${area.height} @ ${area.x},${area.y}`)
}

function createDebugWindow(c1Display: Electron.Display): void {
  if (!isDev) return

  const display = findDebugDisplay(c1Display)
  const area = display.workArea
  const width = Math.min(980, Math.max(640, area.width - 80))
  const height = Math.min(860, Math.max(520, area.height - 80))

  debugWindow = new BrowserWindow({
    x: area.x + 40,
    y: area.y + 40,
    width,
    height,
    show: false,
    frame: true,
    resizable: true,
    autoHideMenuBar: true,
    title: 'C1 Debug',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  loadRenderer(debugWindow, true)

  debugWindow.once('ready-to-show', () => {
    debugWindow?.setTitle('C1 Debug')
    bringDebugWindowToFront()
  })

  debugWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
    debugWindow?.setTitle('C1 Debug')
  })

  debugWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(level === 3 ? '[Debug:ERR]' : '[Debug]', message)
  })

  debugWindow.on('closed', () => {
    debugWindow = null
  })

  console.log(`[Main] dev debug window: ${width}x${height} @ ${area.x + 40},${area.y + 40}`)
}

function bringDebugWindowToFront(): void {
  if (!debugWindow || debugWindow.isDestroyed()) return
  if (debugWindow.isMinimized()) debugWindow.restore()
  debugWindow.show()
  debugWindow.moveTop()
  debugWindow.focus()
  debugWindow.setAlwaysOnTop(true, 'floating')
  setTimeout(() => {
    if (!debugWindow || debugWindow.isDestroyed()) return
    debugWindow.setAlwaysOnTop(false)
  }, 1200)
}

function sendToRenderers(channel: string, payload: DeviceParams | PipeStatus | C1Diagnostics): void {
  gameWindow?.webContents.send(channel, payload)
  debugWindow?.webContents.send(channel, payload)
}

function failAndQuit(message: string): void {
  console.error('[Main]', message)
  dialog.showErrorBox('C1 Air Game', message)
  app.quit()
}

function setupIPC(): void {
  ipcMain.on(IPC_EVENTS.REQUEST_DEVICE_PARAMS, (event) => {
    event.sender.send(IPC_EVENTS.PIPE_STATUS_CHANGED, pipeClient.getStatus())
    if (pipeClient.deviceParams) {
      event.sender.send(IPC_EVENTS.DEVICE_PARAMS_UPDATED, pipeClient.deviceParams)
    }
  })

  ipcMain.on(IPC_EVENTS.C1_CONTROL, (_event, command: C1ControlCommand) => {
    gameWindow?.webContents.send(IPC_EVENTS.C1_CONTROL, command)
  })

  ipcMain.on(IPC_EVENTS.C1_DIAGNOSTICS, (_event, diagnostics: C1Diagnostics) => {
    debugWindow?.webContents.send(IPC_EVENTS.C1_DIAGNOSTICS, diagnostics)
  })
}

function startPipeClient(): void {
  pipeTimeout = setTimeout(() => {
    if (!pipeClient.deviceParams) {
      failAndQuit(
        'OpenstageAI online device parameters are required. Start OpenstageAI, connect the C1 display, then launch the game again.',
      )
    }
  }, PIPE_PARAM_TIMEOUT_MS)

  pipeClient.on('deviceParams', (params: DeviceParams) => {
    if (pipeTimeout) {
      clearTimeout(pipeTimeout)
      pipeTimeout = null
    }
    sendToRenderers(IPC_EVENTS.DEVICE_PARAMS_UPDATED, params)
    if (isDev) console.log('[Main] C1 params:', JSON.stringify(params))
  })

  pipeClient.on('statusChanged', (status: PipeStatus) => {
    sendToRenderers(IPC_EVENTS.PIPE_STATUS_CHANGED, status)
    console.log('[Main] OpenstageAI pipe:', status)
  })

  pipeClient.start()
}

if (singleInstanceLock) {
  app.whenReady().then(() => {
    printDevBanner()
    setupIPC()

    const c1Display = findC1Display()
    if (!c1Display) {
      failAndQuit(`C1 display ${C1_DISPLAY.OUTPUT_WIDTH}x${C1_DISPLAY.OUTPUT_HEIGHT} at 100% scale was not found.`)
      return
    }

    createGameWindow(c1Display)
    createDebugWindow(c1Display)
    startPipeClient()
  })
}

app.on('window-all-closed', () => {
  pipeClient.stop()
  if (pipeTimeout) clearTimeout(pipeTimeout)
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const c1Display = findC1Display()
    if (c1Display) {
      createGameWindow(c1Display)
      createDebugWindow(c1Display)
    }
  }
})
