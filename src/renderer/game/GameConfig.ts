import type { BiomeType, Difficulty, WeaponType } from '@shared/types'

export const C1_DISPLAY = {
  OUTPUT_WIDTH: 1440,
  OUTPUT_HEIGHT: 2560,
  VIEW_COLS: 8,
  VIEW_ROWS: 5,
  VIEW_COUNT: 40,
  SUB_WIDTH: 540,
  SUB_HEIGHT: 960,
  FOCAL_LENGTH: 3806,
} as const

export const PIPE_CONFIG = {
  PIPE_NAME: 'OpenstageAI_server_pipe',
  PIPE_PATH: '\\\\.\\pipe\\OpenstageAI_server_pipe',
  APP_ID: '1892196063633854465',
  APP_KEY: '173996967169098',
  APP_SECRET: '1CmV^IMWllERG1z-mSq2',
  APP_VER: '0.1.0',
  RECONNECT_INTERVAL_MS: 3000,
} as const

export const DEFAULT_GRATING_PARAMS = {
  slope: 0.1057,
  interval: 19.625,
  x0: 8.89,
} as const

export interface GameplayConfig {
  initialLives: number
  infiniteLivesMode: boolean
  startingWeapon: WeaponType
  difficulty: Difficulty
}

export interface DisplayConfig {
  c1Mode: boolean
  viewCount: 40 | 20 | 10
  targetFPS: 30 | 60
  showFPS: boolean
  showHitbox: boolean
}

export interface AudioConfig {
  masterVolume: number
  bgmVolume: number
  sfxVolume: number
}

export interface GameConfig {
  gameplay: GameplayConfig
  display: DisplayConfig
  audio: AudioConfig
}

export const DEFAULT_CONFIG: GameConfig = {
  gameplay: {
    initialLives: 5,
    infiniteLivesMode: false,
    startingWeapon: 'shot',
    difficulty: 'normal',
  },
  display: {
    c1Mode: true,
    viewCount: 40,
    targetFPS: 30,
    showFPS: false,
    showHitbox: false,
  },
  audio: {
    masterVolume: 0.8,
    bgmVolume: 0.7,
    sfxVolume: 1.0,
  },
}

export const SCENE = {
  WIDTH: 200,
  HEIGHT: 356,
  CAMERA_Z: 1638,
  CAMERA_GAMEPLAY_Y: -360,
  CAMERA_GAMEPLAY_TARGET_Y: 0,
  FOCAL_PLANE: 1638,
  TOTAL_ANGLE: 40,
  PARALLAX_BOOST: 1.0,
  CAMERA_SAFE_VIEW_SCALE: 1.16,
} as const

export const DEPTH_LAYERS = {
  UI: 32.0,
  BULLET: 24.0,
  PLAYER: 16.0,
  FOCAL: 0.0,
  ENEMY: -12.0,
  TERRAIN: -32.0,
  BACKGROUND: -58.0,
} as const

export interface BossPhaseVisualConfig {
  phase: number
  armorOpacity: number
  coreEmissive: number
  weakPointExposure: number
  attackTelegraphMs: number
  transitionDurationMs: number
  screenDarken: number
}

export const BOSS_PHASE_VISUAL_TEMPLATE: BossPhaseVisualConfig[] = [
  {
    phase: 1,
    armorOpacity: 0.98,
    coreEmissive: 1.2,
    weakPointExposure: 0.2,
    attackTelegraphMs: 900,
    transitionDurationMs: 1000,
    screenDarken: 0.32,
  },
  {
    phase: 2,
    armorOpacity: 0.78,
    coreEmissive: 1.9,
    weakPointExposure: 0.55,
    attackTelegraphMs: 700,
    transitionDurationMs: 900,
    screenDarken: 0.42,
  },
  {
    phase: 3,
    armorOpacity: 0.52,
    coreEmissive: 2.7,
    weakPointExposure: 0.85,
    attackTelegraphMs: 520,
    transitionDurationMs: 760,
    screenDarken: 0.56,
  },
]

export interface TerrainVisualProfile {
  mainColor: number
  farColor: number
  nearColor: number
  contrast: number
  fogDensity: number
  emissiveRatio: number
  climate: 'none' | 'ash' | 'ion' | 'dust' | 'warp'
}

export const TERRAIN_VISUAL_CONFIG: Record<BiomeType, TerrainVisualProfile> = {
  earth_plains: {
    mainColor: 0x2c6620,
    farColor: 0x1a2b0f,
    nearColor: 0x466e2b,
    contrast: 0.55,
    fogDensity: 0.006,
    emissiveRatio: 0.15,
    climate: 'none',
  },
  earth_desert: {
    mainColor: 0xa77d3e,
    farColor: 0x4a3621,
    nearColor: 0xc49a57,
    contrast: 0.62,
    fogDensity: 0.007,
    emissiveRatio: 0.16,
    climate: 'dust',
  },
  earth_ocean: {
    mainColor: 0x163e88,
    farColor: 0x081832,
    nearColor: 0x2e73b8,
    contrast: 0.45,
    fogDensity: 0.005,
    emissiveRatio: 0.2,
    climate: 'ion',
  },
  earth_volcanic: {
    mainColor: 0x3b1308,
    farColor: 0x1a0502,
    nearColor: 0x7a220c,
    contrast: 0.74,
    fogDensity: 0.01,
    emissiveRatio: 0.36,
    climate: 'ash',
  },
  earth_ruins: {
    mainColor: 0x5b5349,
    farColor: 0x1e1b18,
    nearColor: 0x7f7361,
    contrast: 0.58,
    fogDensity: 0.0085,
    emissiveRatio: 0.18,
    climate: 'dust',
  },
  space_orbit: {
    mainColor: 0x141a2f,
    farColor: 0x05070f,
    nearColor: 0x2d3d68,
    contrast: 0.5,
    fogDensity: 0.0025,
    emissiveRatio: 0.24,
    climate: 'ion',
  },
  space_deep: {
    mainColor: 0x1c1235,
    farColor: 0x05030a,
    nearColor: 0x49307c,
    contrast: 0.63,
    fogDensity: 0.0018,
    emissiveRatio: 0.34,
    climate: 'none',
  },
  space_asteroid: {
    mainColor: 0x4b4030,
    farColor: 0x130f0a,
    nearColor: 0x7d6648,
    contrast: 0.68,
    fogDensity: 0.0035,
    emissiveRatio: 0.25,
    climate: 'dust',
  },
  space_blackhole: {
    mainColor: 0x0b0606,
    farColor: 0x000000,
    nearColor: 0x4a1706,
    contrast: 0.82,
    fogDensity: 0.0012,
    emissiveRatio: 0.44,
    climate: 'warp',
  },
  space_final: {
    mainColor: 0x220f35,
    farColor: 0x06020d,
    nearColor: 0x5a2c7c,
    contrast: 0.72,
    fogDensity: 0.002,
    emissiveRatio: 0.4,
    climate: 'warp',
  },
}
