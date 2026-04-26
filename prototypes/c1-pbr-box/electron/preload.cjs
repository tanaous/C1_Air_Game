const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('c1Api', {
  getStartupInfo: () => ipcRenderer.invoke('startup-info'),
  requestDeviceParams: () => ipcRenderer.send('request-device-params'),
  sendControl: (command) => ipcRenderer.send('control-command', command),
  publishDiagnostics: (diagnostics) => ipcRenderer.send('renderer-diagnostics', diagnostics),
  onControl: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('control-command', listener)
    return () => ipcRenderer.removeListener('control-command', listener)
  },
  onDiagnostics: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('renderer-diagnostics', listener)
    return () => ipcRenderer.removeListener('renderer-diagnostics', listener)
  },
  onDeviceParams: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('device-params', listener)
    return () => ipcRenderer.removeListener('device-params', listener)
  },
  onPipeStatus: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('pipe-status', listener)
    return () => ipcRenderer.removeListener('pipe-status', listener)
  },
  onDisplayInfo: (callback) => {
    const listener = (_event, value) => callback(value)
    ipcRenderer.on('display-info', listener)
    return () => ipcRenderer.removeListener('display-info', listener)
  },
})
