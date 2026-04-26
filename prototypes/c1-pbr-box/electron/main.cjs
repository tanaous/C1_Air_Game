const { app, BrowserWindow, ipcMain, screen, dialog } = require('electron')
const path = require('node:path')
const net = require('node:net')

const PIPE_NAME = 'OpenstageAI_server_pipe'
const PIPE_PATH = process.platform === 'win32'
  ? `\\\\?\\pipe\\${PIPE_NAME}`
  : `/tmp/${PIPE_NAME}`
const DEVICE_CONFIG_TIMEOUT_MS = 8000
const REQUIRED_DISPLAY_WIDTH = 1440
const REQUIRED_DISPLAY_HEIGHT = 2560

const OFFICIAL_MONITOR_APP = {
  id: 'inbuilt',
  app_id: '1892196063633854465',
  app_key: '173996967169098',
  app_secret: '1CmV^IMWllERG1z-mSq2',
  app_version: '0.1.0',
}

let mainWindow = null
let debugWindow = null
let pipeClient = null
let reconnectTimer = null
let pipeBuffer = ''
let pipeStatus = 'idle'
let labelList = []
let latestParams = null
let selectedDisplayInfo = null
let latestDiagnostics = null
let startupResolve = null
let startupReject = null
let startupTimer = null

function sendToWindow(channel, payload) {
  for (const win of [mainWindow, debugWindow]) {
    if (!win || win.isDestroyed()) continue
    win.webContents.send(channel, payload)
  }
}

function sendToC1Window(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return
  mainWindow.webContents.send(channel, payload)
}

function setPipeStatus(status, detail = '') {
  pipeStatus = detail ? `${status}: ${detail}` : status
  console.log('[C1 Box] pipe', pipeStatus)
  sendToWindow('pipe-status', pipeStatus)
}

function resolveStartupWhenReady() {
  if (!startupResolve || !latestParams) return
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  const resolve = startupResolve
  startupResolve = null
  startupReject = null
  resolve(latestParams)
}

function rejectStartup(error) {
  if (!startupReject) return
  if (startupTimer) {
    clearTimeout(startupTimer)
    startupTimer = null
  }
  const reject = startupReject
  startupResolve = null
  startupReject = null
  reject(error)
}

function parseJsonObjects(input) {
  const objects = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]

    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }

    if (ch === '{') {
      if (depth === 0) start = i
      depth += 1
      continue
    }

    if (ch === '}') {
      depth -= 1
      if (depth === 0 && start >= 0) {
        objects.push(input.slice(start, i + 1))
        start = -1
      }
    }
  }

  const rest = depth > 0 && start >= 0 ? input.slice(start) : ''
  return { objects, rest }
}

function handlePipeResponse(response) {
  let requestType = ''
  let responseData = null

  if (response.request_type) {
    requestType = response.request_type
    responseData = response.response_data
    if (requestType === 'getDeivice' && responseData?.config) {
      requestType = responseData.type || requestType
      responseData = responseData.config
    }
  } else {
    requestType = response.type
    responseData = response.config
  }

  if (requestType === 'getLabelList' && Array.isArray(responseData)) {
    labelList = responseData
    selectedDisplayInfo = selectDisplayInfo()
    sendToWindow('display-info', selectedDisplayInfo)
    return
  }

  if ((requestType === 'device' || requestType === 'getDeivice') && responseData) {
    const nextParams = {
      obliquity: Number(responseData.obliquity),
      lineNumber: Number(responseData.lineNumber),
      deviation: Number(responseData.deviation),
      deviceId: responseData.deviceId ?? '',
      remark: responseData.remark ?? '',
    }

    if (
      Number.isFinite(nextParams.obliquity) &&
      Number.isFinite(nextParams.lineNumber) &&
      Number.isFinite(nextParams.deviation)
    ) {
      latestParams = nextParams
      console.log('[C1 Box] device params', JSON.stringify(nextParams))
      sendToWindow('device-params', nextParams)
      resolveStartupWhenReady()
    }
  }
}

function flushPipeBuffer() {
  const parsed = parseJsonObjects(pipeBuffer)
  pipeBuffer = parsed.rest

  for (const raw of parsed.objects) {
    try {
      handlePipeResponse(JSON.parse(raw))
    } catch (error) {
      console.warn('[C1 Box] ignored pipe JSON:', error.message)
    }
  }
}

function writePipeRequest(requestType) {
  if (!pipeClient || pipeClient.destroyed) return
  pipeClient.write(JSON.stringify({
    ...OFFICIAL_MONITOR_APP,
    request_type: requestType,
  }))
}

function requestDeviceParams() {
  writePipeRequest('getToken')
  setTimeout(() => writePipeRequest('getLabelList'), 300)
  setTimeout(() => writePipeRequest('getDeivice'), 650)
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    connectPipe()
  }, 3000)
}

function connectPipe() {
  if (process.platform !== 'win32') {
    setPipeStatus('disabled', 'Named Pipe is Windows-only')
    return
  }

  if (pipeClient && !pipeClient.destroyed) {
    pipeClient.destroy()
  }

  pipeBuffer = ''
  setPipeStatus('connecting', PIPE_NAME)
  pipeClient = net.connect(PIPE_PATH)

  pipeClient.on('connect', () => {
    setPipeStatus('connected', PIPE_NAME)
    requestDeviceParams()
  })

  pipeClient.on('data', (chunk) => {
    pipeBuffer += chunk.toString()
    flushPipeBuffer()
  })

  pipeClient.on('error', (error) => {
    setPipeStatus('error', error.message)
    if (!latestParams) rejectStartup(error)
  })

  pipeClient.on('close', () => {
    if (app.isQuitting) return
    if (!latestParams) {
      rejectStartup(new Error('OpenstageAI pipe closed before device parameters were received'))
      return
    }
    setPipeStatus('disconnected', 'retrying')
    scheduleReconnect()
  })
}

function requireOnlineDeviceParams() {
  if (latestParams) return Promise.resolve(latestParams)

  return new Promise((resolve, reject) => {
    startupResolve = resolve
    startupReject = reject
    startupTimer = setTimeout(() => {
      rejectStartup(new Error(`Timed out after ${DEVICE_CONFIG_TIMEOUT_MS}ms waiting for OpenstageAI device parameters`))
    }, DEVICE_CONFIG_TIMEOUT_MS)
    connectPipe()
  })
}

function displayScore(display, index) {
  let score = 0
  const label = display.label || ''
  const size = display.size || display.bounds
  const isPortrait = size.height >= size.width

  if (labelList.includes(label)) score += 100
  if (label === 'TPV-2288-IN') score += 80
  if (isPortrait) score += 20
  if (size.width === 1440 && size.height === 2560) score += 20
  if (size.width === 720 && size.height === 1280) score += 12
  if (index > 0) score += 8

  return score
}

function getPhysicalDisplaySize(display) {
  const bounds = display.bounds
  const size = display.size || bounds
  const byScale = {
    width: Math.round(bounds.width * display.scaleFactor),
    height: Math.round(bounds.height * display.scaleFactor),
  }
  const bySize = {
    width: Math.round(size.width),
    height: Math.round(size.height),
  }
  return {
    byScale,
    bySize,
    matches:
      (byScale.width === REQUIRED_DISPLAY_WIDTH && byScale.height === REQUIRED_DISPLAY_HEIGHT) ||
      (bySize.width === REQUIRED_DISPLAY_WIDTH && bySize.height === REQUIRED_DISPLAY_HEIGHT),
  }
}

function selectDisplayInfo() {
  const displays = screen.getAllDisplays()
  const c1Displays = displays.filter((display) => getPhysicalDisplaySize(display).matches)
  if (c1Displays.length === 0) {
    const seen = displays.map((display) => {
      const physical = getPhysicalDisplaySize(display)
      return `${display.label || 'unknown'} bounds=${display.bounds.width}x${display.bounds.height} scale=${display.scaleFactor} physical=${physical.byScale.width}x${physical.byScale.height} size=${physical.bySize.width}x${physical.bySize.height}`
    }).join('\n')
    throw new Error(`No C1 display with physical ${REQUIRED_DISPLAY_WIDTH}x${REQUIRED_DISPLAY_HEIGHT} was found.\n${seen}`)
  }

  const ranked = c1Displays
    .map((display, index) => ({ display, index, score: displayScore(display, index) }))
    .sort((a, b) => b.score - a.score)

  const selected = ranked[0].display
  const bounds = selected.bounds
  const size = selected.size
  const physical = getPhysicalDisplaySize(selected)

  return {
    id: selected.id,
    label: selected.label || '',
    scaleFactor: selected.scaleFactor,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    size: { width: size.width, height: size.height },
    physical: physical.byScale,
    labelsFromOpenstageAI: labelList,
  }
}

function createWindow() {
  selectedDisplayInfo = selectDisplayInfo()
  const bounds = selectedDisplayInfo.bounds

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    fullscreen: true,
    fullscreenable: true,
    kiosk: false,
    resizable: false,
    movable: false,
    show: false,
    backgroundColor: '#05060a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })

  mainWindow.setMenuBarVisibility(false)
  mainWindow.setBounds(bounds)
  mainWindow.setFullScreenable(true)
  mainWindow.setFullScreen(true)

  const rendererUrl = process.env.C1_BOX_RENDERER_URL
  if (rendererUrl) {
    mainWindow.loadURL(rendererUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[C1 Box] c1 window loaded')
    sendToWindow('pipe-status', pipeStatus)
    sendToWindow('display-info', selectedDisplayInfo)
    if (latestParams) sendToWindow('device-params', latestParams)
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.setBounds(bounds)
    mainWindow.setFullScreen(true)
    mainWindow.show()
  })

  createDebugWindow()
}

function createDebugWindow() {
  console.log('[C1 Box] creating debug window')
  const primary = screen.getPrimaryDisplay()
  const area = primary.workArea
  const width = Math.min(1320, Math.max(980, area.width - 120))
  const height = Math.min(980, Math.max(760, area.height - 100))

  debugWindow = new BrowserWindow({
    x: area.x + Math.max(20, Math.floor((area.width - width) / 2)),
    y: area.y + Math.max(20, Math.floor((area.height - height) / 2)),
    width,
    height,
    title: 'C1 PBR Box Debug',
    frame: true,
    fullscreen: false,
    resizable: true,
    backgroundColor: '#10141c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      backgroundThrottling: false,
    },
  })
  console.log('[C1 Box] debug window bounds', JSON.stringify({ x: debugWindow.getBounds().x, y: debugWindow.getBounds().y, width: debugWindow.getBounds().width, height: debugWindow.getBounds().height }))

  const rendererUrl = process.env.C1_BOX_RENDERER_URL
  if (rendererUrl) {
    const url = new URL(rendererUrl)
    url.searchParams.set('debug', '1')
    debugWindow.loadURL(url.toString())
  } else {
    debugWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), { query: { debug: '1' } })
  }

  debugWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.log('[C1 Box] debug window failed load', errorCode, errorDescription)
  })

  debugWindow.on('closed', () => {
    console.log('[C1 Box] debug window closed')
    debugWindow = null
  })

  debugWindow.webContents.on('did-finish-load', () => {
    console.log('[C1 Box] debug window loaded')
    debugWindow.webContents.send('pipe-status', pipeStatus)
    debugWindow.webContents.send('display-info', selectedDisplayInfo)
    if (latestParams) debugWindow.webContents.send('device-params', latestParams)
    if (latestDiagnostics) debugWindow.webContents.send('renderer-diagnostics', latestDiagnostics)
  })
}

ipcMain.handle('startup-info', () => ({
  pipeName: PIPE_NAME,
  pipeStatus,
  display: selectedDisplayInfo,
  deviceParams: latestParams,
}))

ipcMain.on('request-device-params', () => {
  requestDeviceParams()
})

ipcMain.on('control-command', (_event, command) => {
  sendToC1Window('control-command', command)
})

ipcMain.on('renderer-diagnostics', (_event, diagnostics) => {
  latestDiagnostics = diagnostics
  if (debugWindow && !debugWindow.isDestroyed()) {
    debugWindow.webContents.send('renderer-diagnostics', diagnostics)
  }
})

app.on('ready', async () => {
  try {
    await requireOnlineDeviceParams()
    createWindow()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setPipeStatus('fatal', message)
    dialog.showErrorBox(
      'C1 原型拒绝运行',
      [
        '必须先启动并登录中国区 OpenstageAI，且必须能在线获取当前 C1 设备参数。',
        '',
        `命名管道: ${PIPE_NAME}`,
        `错误: ${message}`,
      ].join('\n'),
    )
    app.quit()
  }
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (pipeClient && !pipeClient.destroyed) pipeClient.destroy()
})

app.on('window-all-closed', () => {
  app.quit()
})
