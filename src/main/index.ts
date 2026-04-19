/**
 * Electron 主进程入口
 * 负责：窗口管理、OpenstageAI 管道通信、IPC 桥接
 * 参考自 CubeVi/3DMonitor 开源项目
 */

import { app, BrowserWindow, screen, ipcMain } from 'electron'
import path from 'path'
import { PipeClient } from './pipe-client'
import { IPC_EVENTS } from '../shared/types'

// 是否为开发模式（vite dev server 启动时传入 URL 参数）
const DEV_URL = process.argv[2]
const isDev = !!DEV_URL

let mainWindow: BrowserWindow | null = null       // 控制窗口（可选）
let gameWindow: BrowserWindow | null = null        // C1 游戏全屏窗口
const pipeClient = new PipeClient()

// ─── 窗口管理 ─────────────────────────────────────────────

/** 检测 C1 显示器并创建对应全屏游戏窗口 */
function checkAndCreateGameWindow(): void {
  const displays = screen.getAllDisplays()
  let targetDisplay = displays[0]  // 默认使用主显示器

  if (displays.length > 1) {
    // 尝试找到 C1 显示器（标识为 TPV-2288-IN 或来自 OpenstageAI 的 labelList）
    const c1 = displays.find(d =>
      d.label?.includes('TPV-2288-IN') ||
      d.size.width === 1440 && d.size.height === 2560
    )
    if (c1) {
      targetDisplay = c1
      console.log('[Main] 检测到 C1 显示器:', c1.label)
    } else {
      // 使用第二块显示器
      targetDisplay = displays[1]
      console.log('[Main] 未找到 C1，使用第二块显示器')
    }
  }

  createGameWindow(targetDisplay.workArea)
}

/** 创建游戏全屏窗口 */
function createGameWindow(area: Electron.Rectangle): void {
  gameWindow = new BrowserWindow({
    x:      area.x,
    y:      area.y,
    width:  area.width,
    height: area.height,
    fullscreen:      true,
    fullscreenable:  true,
    frame:           false,
    resizable:       true,
    webPreferences: {
      nodeIntegration:       false,
      contextIsolation:      true,
      backgroundThrottling:  false,   // 防止后台降帧，关键！
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isDev) {
    gameWindow.loadURL(DEV_URL)
    // gameWindow.webContents.openDevTools()  // 需要调试时取消注释
  } else {
    gameWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  gameWindow.setFullScreen(true)

  gameWindow.on('closed', () => {
    gameWindow = null
  })
}

// ─── IPC 通信 ─────────────────────────────────────────────

/** 设置 IPC 消息处理 */
function setupIPC(): void {
  // 渲染进程请求刷新设备参数
  ipcMain.on(IPC_EVENTS.REQUEST_DEVICE_PARAMS, () => {
    if (pipeClient.deviceParams) {
      gameWindow?.webContents.send(
        IPC_EVENTS.DEVICE_PARAMS_UPDATED,
        pipeClient.deviceParams
      )
    }
  })
}

/** 启动 OpenstageAI 管道客户端 */
function startPipeClient(): void {
  pipeClient.on('deviceParams', (params) => {
    // 将参数推送到游戏窗口的渲染进程
    gameWindow?.webContents.send(IPC_EVENTS.DEVICE_PARAMS_UPDATED, params)
  })

  pipeClient.on('statusChanged', (status) => {
    gameWindow?.webContents.send(IPC_EVENTS.PIPE_STATUS_CHANGED, status)
    console.log('[Main] OpenstageAI 管道状态:', status)
  })

  pipeClient.start()
}

// ─── App 生命周期 ─────────────────────────────────────────

app.whenReady().then(() => {
  setupIPC()
  checkAndCreateGameWindow()
  startPipeClient()
})

app.on('window-all-closed', () => {
  pipeClient.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    checkAndCreateGameWindow()
  }
})
