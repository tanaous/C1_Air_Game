/**
 * 全局游戏配置常量
 * 此文件定义所有可配置的游戏参数
 */

import type { WeaponType, Difficulty } from '@shared/types'

/** C1 显示器固定参数（不可修改） */
export const C1_DISPLAY = {
  OUTPUT_WIDTH:  1440,   // 物理输出宽度（像素）
  OUTPUT_HEIGHT: 2560,   // 物理输出高度（像素）
  VIEW_COLS:     8,      // 水平子视角数
  VIEW_ROWS:     5,      // 垂直子视角数
  VIEW_COUNT:    40,     // 总视角数
  SUB_WIDTH:     288,    // 每个子视角宽度（= 1440/5，性能不足可降为 180）
  SUB_HEIGHT:    512,    // 每个子视角高度（= 2560/5，性能不足可降为 320）
} as const

/** 中国区 OpenstageAI 管道配置（不是国际版 Cubestage） */
export const PIPE_CONFIG = {
  PIPE_NAME: 'OpenstageAI_server_pipe',                        // 中国区管道名
  PIPE_PATH: '\\\\.\\pipe\\OpenstageAI_server_pipe',           // Windows 命名管道完整路径
  APP_ID:    'game_c1_fighter',
  APP_KEY:   'c1_fighter_key',
  APP_SECRET:'c1_fighter_secret',
  APP_VER:   '0.1.0',
  RECONNECT_INTERVAL_MS: 3000,                                  // 断线重连间隔
} as const

/** C1 默认光栅参数（连接失败时的降级默认值） */
export const DEFAULT_GRATING_PARAMS = {
  slope:    0.1057,
  interval: 19.625,
  x0:       8.89,
} as const

/** 游戏性配置（可由用户在设置中修改） */
export interface GameplayConfig {
  initialLives:       number          // 初始生命数（默认 5）
  infiniteLivesMode:  boolean         // 无限生命模式
  startingWeapon:     WeaponType      // 初始武器
  difficulty:         Difficulty      // 难度
}

/** 显示配置 */
export interface DisplayConfig {
  c1Mode:       boolean              // C1 3D 模式开关（关闭时显示单视角）
  viewCount:    40 | 20 | 10        // 视角数量（影响性能）
  targetFPS:    30 | 60             // 目标帧率
  showFPS:      boolean             // 显示帧率
  showHitbox:   boolean             // 显示碰撞框（调试用）
}

/** 音频配置 */
export interface AudioConfig {
  masterVolume: number   // 总音量 0~1
  bgmVolume:    number   // 音乐音量
  sfxVolume:    number   // 音效音量
}

/** 完整游戏配置 */
export interface GameConfig {
  gameplay: GameplayConfig
  display:  DisplayConfig
  audio:    AudioConfig
}

/** 默认配置 */
export const DEFAULT_CONFIG: GameConfig = {
  gameplay: {
    initialLives:      5,
    infiniteLivesMode: false,
    startingWeapon:    'shot',
    difficulty:        'normal',
  },
  display: {
    c1Mode:     true,
    viewCount:  40,
    targetFPS:  30,
    showFPS:    false,
    showHitbox: false,
  },
  audio: {
    masterVolume: 0.8,
    bgmVolume:    0.7,
    sfxVolume:    1.0,
  },
}

/** 游戏场景坐标系 */
export const SCENE = {
  WIDTH:        200,       // 游戏区域宽度（游戏单位）
  HEIGHT:       356,       // 游戏区域高度（宽高比匹配 1440:2560）
  CAMERA_Z:     300,       // 相机距离场景的默认 Z 值
  FOCAL_PLANE:  100,       // 焦平面距离（用于多视角偏移计算）
  TOTAL_ANGLE:  40,        // 总视角范围（度）
} as const

/** 景深层配置（单位：厘米，正值=屏幕前方弹出，负值=凹入）*/
export const DEPTH_LAYERS = {
  UI:         3.0,    // UI / 弹幕
  BULLET:     2.5,    // 子弹 / 爆炸特效
  PLAYER:     1.5,    // 玩家飞机
  FOCAL:      0.0,    // 焦平面（主战场）
  ENEMY:     -0.5,    // 敌机
  TERRAIN:   -2.0,    // 地形细节
  BACKGROUND:-4.0,    // 远景背景
} as const
