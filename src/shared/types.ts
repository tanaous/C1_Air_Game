export interface DeviceParams {
  /** Lenticular slope reported by OpenstageAI. */
  obliquity: number
  /** Lenticular interval in sub-pixel units. */
  lineNumber: number
  /** Per-device horizontal calibration offset. */
  deviation: number
  /** Optional device id returned by OpenstageAI, for diagnostics only. */
  deviceId?: string
  /** Optional display/device label returned by OpenstageAI. */
  label?: string
}

export interface C1Diagnostics {
  backing: string
  client: string
  css: string
  window: string
  dpr: number
  c1Mode: boolean
  parallax: number
  atlas: string
  output: string
  grating: DeviceParams | null
  projection?: string
  viewOrder?: string
  camera?: string
  gameplayVisuals?: string
  audioMuted?: boolean
  debugInvincible?: boolean
  safeFieldEnabled?: boolean
  domOverlayHidden?: boolean
  cameraRig?: CameraRigSettings
  cameraPreset?: string
  cameraAuto?: boolean
}

export interface CameraRigSettings {
  pitchDeg: number
  yawDeg: number
  distance: number
  targetX: number
  targetY: number
  targetZ: number
}

export type C1ControlCommand =
  | { type: 'set-parallax'; value: number }
  | { type: 'set-muted'; value: boolean }
  | { type: 'set-invincible'; value: boolean }
  | { type: 'set-safe-field'; value: boolean }
  | { type: 'set-camera-rig'; value: Partial<CameraRigSettings> }
  | { type: 'reset-camera-rig' }
  | { type: 'set-camera-preset'; value: string }
  | { type: 'set-camera-auto'; value: boolean }
  | { type: 'request-diagnostics' }

export interface PipeResponse {
  request_type: string
  response_data?: {
    config?: DeviceParams
    labelList?: string[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export const IPC_EVENTS = {
  DEVICE_PARAMS_UPDATED: 'device-params-updated',
  PIPE_STATUS_CHANGED: 'pipe-status-changed',
  REQUEST_DEVICE_PARAMS: 'request-device-params',
  C1_CONTROL: 'c1-control',
  C1_DIAGNOSTICS: 'c1-diagnostics',
} as const

export type PipeStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export type WeaponType = 'shot' | 'spread' | 'laser'

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

export type GameState = 'title' | 'playing' | 'paused' | 'boss' | 'gameover' | 'transition'

export type Difficulty = 'easy' | 'normal' | 'hard'
