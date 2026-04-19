/**
 * OpenstageAI 命名管道客户端
 * 负责连接中国区 C1 平台软件，获取光栅参数
 * 参考自 CubeVi/3DMonitor 开源项目
 *
 * ⚠️  注意：本项目为中国区版本，使用 OpenstageAI_server_pipe
 *           国际版使用 Cubestage_server_pipe（本项目不适用）
 */

import * as net from 'net'
import { EventEmitter } from 'events'
import type { DeviceParams, PipeResponse, PipeStatus } from '../shared/types'
import { PIPE_CONFIG } from '../renderer/game/GameConfig'

export class PipeClient extends EventEmitter {
  private client: net.Socket | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private status: PipeStatus = 'disconnected'
  private buffer: string = ''

  /** 当前已获取的光栅参数 */
  public deviceParams: DeviceParams | null = null

  constructor() {
    super()
  }

  /** 启动连接（主进程启动时调用） */
  start(): void {
    this.connect()
  }

  /** 停止并清理 */
  stop(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.client) {
      this.client.destroy()
      this.client = null
    }
    this.setStatus('disconnected')
  }

  private connect(): void {
    this.setStatus('connecting')
    this.buffer = ''

    const client = net.connect(PIPE_CONFIG.PIPE_PATH)
    this.client = client

    client.on('connect', () => {
      this.setStatus('connected')
      console.log('[PipeClient] 已连接到 OpenstageAI')
      this.requestDeviceParams()
    })

    client.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      // 尝试解析完整 JSON 包
      this.parseBuffer()
    })

    client.on('error', (err) => {
      console.warn('[PipeClient] 连接错误:', err.message)
      this.setStatus('error')
      this.scheduleReconnect()
    })

    client.on('close', () => {
      console.log('[PipeClient] 连接断开，将自动重连...')
      this.setStatus('disconnected')
      this.scheduleReconnect()
    })
  }

  /** 向 OpenstageAI 发送获取设备参数的请求 */
  private requestDeviceParams(): void {
    if (!this.client || this.status !== 'connected') return

    const baseParams = {
      id:           'inbuilt',
      app_id:       PIPE_CONFIG.APP_ID,
      app_key:      PIPE_CONFIG.APP_KEY,
      app_secret:   PIPE_CONFIG.APP_SECRET,
      app_version:  PIPE_CONFIG.APP_VER,
    }

    // 参考 background.ts: 先 getToken，再 getLabelList，再 getDeivice
    this.client.write(JSON.stringify({ ...baseParams, request_type: 'getToken' }))
    setTimeout(() => {
      this.client?.write(JSON.stringify({ ...baseParams, request_type: 'getLabelList' }))
    }, 500)
    setTimeout(() => {
      this.client?.write(JSON.stringify({ ...baseParams, request_type: 'getDeivice' }))
    }, 1000)
  }

  /** 解析接收到的数据缓冲区 */
  private parseBuffer(): void {
    // OpenstageAI 可能一次发送完整 JSON，也可能分片发送
    // 尝试直接解析整个 buffer（参考 background.ts 的做法）
    const raw = this.buffer.trim()
    if (!raw) return

    try {
      const response: PipeResponse = JSON.parse(raw)
      this.buffer = ''
      this.handleResponse(response)
    } catch {
      // JSON 不完整，等待更多数据
      // 但如果 buffer 中包含多条消息（以换行分隔），逐条尝试
      if (raw.includes('\n')) {
        const lines = this.buffer.split('\n')
        this.buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            this.handleResponse(JSON.parse(trimmed))
          } catch {
            // 忽略
          }
        }
      }
    }
  }

  /** 处理平台响应 — 兼容新旧 API 格式 */
  private handleResponse(response: any): void {
    let requestType = ''
    let config: any = null

    // 新版 API: response.request_type + response.response_data.config
    if (response.request_type === 'getDeivice') {
      const rd = response.response_data
      if (rd?.config) {
        config = rd.config
        requestType = rd.type || 'getDeivice'
      }
    }
    // 旧版 API: response.type + response.config
    else if (response.type === 'device' || response.type === 'getDeivice') {
      config = response.config
      requestType = response.type
    }

    if (config && typeof config.obliquity === 'number') {
      this.deviceParams = {
        obliquity:  config.obliquity,
        lineNumber: config.lineNumber,
        deviation:  config.deviation,
      }
      console.log('[PipeClient] 获取到光栅参数:', this.deviceParams)
      this.emit('deviceParams', this.deviceParams)
    }
  }

  private setStatus(status: PipeStatus): void {
    this.status = status
    this.emit('statusChanged', status)
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, PIPE_CONFIG.RECONNECT_INTERVAL_MS)
  }

  getStatus(): PipeStatus {
    return this.status
  }
}
