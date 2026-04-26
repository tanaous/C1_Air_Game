import { contextBridge, ipcRenderer } from 'electron'
import type { C1ControlCommand, C1Diagnostics, DeviceParams, PipeStatus } from '../shared/types'
import { IPC_EVENTS } from '../shared/types'

contextBridge.exposeInMainWorld('electronAPI', {
  onDeviceParamsUpdated: (callback: (params: DeviceParams) => void) => {
    ipcRenderer.on(IPC_EVENTS.DEVICE_PARAMS_UPDATED, (_event, params: DeviceParams) => callback(params))
  },

  onPipeStatusChanged: (callback: (status: PipeStatus) => void) => {
    ipcRenderer.on(IPC_EVENTS.PIPE_STATUS_CHANGED, (_event, status: PipeStatus) => callback(status))
  },

  requestDeviceParams: () => {
    ipcRenderer.send(IPC_EVENTS.REQUEST_DEVICE_PARAMS)
  },

  sendC1Control: (command: C1ControlCommand) => {
    ipcRenderer.send(IPC_EVENTS.C1_CONTROL, command)
  },

  onC1Control: (callback: (command: C1ControlCommand) => void) => {
    ipcRenderer.on(IPC_EVENTS.C1_CONTROL, (_event, command: C1ControlCommand) => callback(command))
  },

  publishC1Diagnostics: (diagnostics: C1Diagnostics) => {
    ipcRenderer.send(IPC_EVENTS.C1_DIAGNOSTICS, diagnostics)
  },

  onC1Diagnostics: (callback: (diagnostics: C1Diagnostics) => void) => {
    ipcRenderer.on(IPC_EVENTS.C1_DIAGNOSTICS, (_event, diagnostics: C1Diagnostics) => callback(diagnostics))
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners(IPC_EVENTS.DEVICE_PARAMS_UPDATED)
    ipcRenderer.removeAllListeners(IPC_EVENTS.PIPE_STATUS_CHANGED)
    ipcRenderer.removeAllListeners(IPC_EVENTS.C1_CONTROL)
    ipcRenderer.removeAllListeners(IPC_EVENTS.C1_DIAGNOSTICS)
  },
})

export type ElectronAPI = {
  onDeviceParamsUpdated: (callback: (params: DeviceParams) => void) => void
  onPipeStatusChanged: (callback: (status: PipeStatus) => void) => void
  requestDeviceParams: () => void
  sendC1Control: (command: C1ControlCommand) => void
  onC1Control: (callback: (command: C1ControlCommand) => void) => void
  publishC1Diagnostics: (diagnostics: C1Diagnostics) => void
  onC1Diagnostics: (callback: (diagnostics: C1Diagnostics) => void) => void
  removeAllListeners: () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
