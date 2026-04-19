/**
 * 主进程与渲染进程共享的类型定义
 */

/** C1 光栅参数（从 OpenstageAI 获取） */
export interface DeviceParams {
  obliquity: number   // slope  — 柱透镜倾斜角正切值（典型值 ~0.1057）
  lineNumber: number  // interval — 柱透镜间距，亚像素单位（典型值 ~19.625）
  deviation: number   // x0 — 水平起始偏移（每台设备独立校准）
}

/** OpenstageAI 平台响应结构 */
export interface PipeResponse {
  request_type: string
  response_data?: {
    config?: DeviceParams
    labelList?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

/** IPC 事件名称常量 */
export const IPC_EVENTS = {
  /** 主进程→渲染进程：C1 参数更新 */
  DEVICE_PARAMS_UPDATED: 'device-params-updated',
  /** 主进程→渲染进程：连接状态变化 */
  PIPE_STATUS_CHANGED: 'pipe-status-changed',
  /** 渲染进程→主进程：请求刷新参数 */
  REQUEST_DEVICE_PARAMS: 'request-device-params',
} as const

/** Pipe 连接状态 */
export type PipeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/** 武器类型 */
export type WeaponType = 'shot' | 'spread' | 'laser'

/** 地貌类型 */
export type BiomeType =
  | 'earth_plains'
  | 'earth_desert'
  | 'earth_ocean'
  | 'earth_volcanic'
  | 'earth_ruins'
  | 'space_orbit'
  | 'space_deep'
  | 'space_asteroid'
  | 'space_blackhole'
  | 'space_final'

/** 游戏状态 */
export type GameState = 'title' | 'playing' | 'paused' | 'boss' | 'gameover' | 'transition'

/** 难度设置 */
export type Difficulty = 'easy' | 'normal' | 'hard'
