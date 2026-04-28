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
  stage?: StageStatus
  domOverlayHidden?: boolean
  cameraRig?: CameraRigSettings
  cameraPreset?: string
  cameraAuto?: boolean
  performance?: PerformanceDiagnostics
  render?: RenderDiagnostics
  scene?: SceneDiagnostics
}

export interface PerformanceDiagnostics {
  fps: number
  logicFps: number
  frameMs: number
  fpsTarget: number
}

export interface RenderDiagnostics {
  views: number
  calls: number
  triangles: number
  lines: number
  points: number
  geometries: number
  textures: number
  programs: number
}

export interface SceneDiagnostics {
  objects: number
  meshes: number
  visibleMeshes: number
  lights: number
  materials: number
  sourceTriangles: number
  visibleTriangles: number
  enemies: number
  playerBullets: number
  enemyBullets: number
  powerUps: number
  laserBeams: number
  particles: number
  bossActive: boolean
  caps?: RuntimeCaps
}

export interface RuntimeCaps {
  enemies: number
  playerBullets: number
  enemyBullets: number
  powerUps: number
  particles: number
}

export interface CameraRigSettings {
  pitchDeg: number
  yawDeg: number
  distance: number
  targetX: number
  targetY: number
  targetZ: number
}

export interface StageStatus {
  index: number
  number: number
  name: string
  biome: BiomeType
  bossesDefeated: number
  distance: number
  nextBossAt: number
  distanceToBoss: number
  warning: boolean
  bossActive: boolean
  cleared: boolean
}

export type C1ControlCommand =
  | { type: 'set-parallax'; value: number }
  | { type: 'set-muted'; value: boolean }
  | { type: 'set-invincible'; value: boolean }
  | { type: 'set-safe-field'; value: boolean }
  | { type: 'start-run' }
  | { type: 'restart-run' }
  | { type: 'skip-to-boss' }
  | { type: 'advance-stage' }
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

export type GameState = 'title' | 'playing' | 'paused' | 'boss' | 'gameover' | 'clear' | 'transition'

export type Difficulty = 'easy' | 'normal' | 'hard'
