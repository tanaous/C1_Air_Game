/**
 * Electron Preload 脚本
 * 通过 contextBridge 向渲染进程安全暴露主进程 API
 * 参考自 CubeVi/3DMonitor 开源项目
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { DeviceParams, PipeStatus } from '../shared/types'
import { IPC_EVENTS } from '../shared/types'

/**
 * 暴露给渲染进程的 API
 * 在渲染进程中通过 window.electronAPI 访问
 */
contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * 监听 C1 设备参数更新
   * 当 OpenstageAI 管道返回新的光栅参数时触发
   */
  onDeviceParamsUpdated: (callback: (params: DeviceParams) => void) => {
    ipcRenderer.on(IPC_EVENTS.DEVICE_PARAMS_UPDATED, (_event, params: DeviceParams) => {
      callback(params)
    })
  },

  /**
   * 监听管道连接状态变化
   */
  onPipeStatusChanged: (callback: (status: PipeStatus) => void) => {
    ipcRenderer.on(IPC_EVENTS.PIPE_STATUS_CHANGED, (_event, status: PipeStatus) => {
      callback(status)
    })
  },

  /**
   * 主动请求刷新设备参数
   */
  requestDeviceParams: () => {
    ipcRenderer.send(IPC_EVENTS.REQUEST_DEVICE_PARAMS)
  },

  /**
   * 移除所有监听器（组件卸载时调用）
   */
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners(IPC_EVENTS.DEVICE_PARAMS_UPDATED)
    ipcRenderer.removeAllListeners(IPC_EVENTS.PIPE_STATUS_CHANGED)
  },
})

/** TypeScript 类型声明（在 renderer 进程中可获得 window.electronAPI 的类型提示）*/
export type ElectronAPI = {
  onDeviceParamsUpdated: (callback: (params: DeviceParams) => void) => void
  onPipeStatusChanged:   (callback: (status: PipeStatus) => void) => void
  requestDeviceParams:   () => void
  removeAllListeners:    () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
