import * as THREE from 'three'
import { SCENE } from './GameConfig'
import type { CameraRigSettings } from '@shared/types'

type CameraPreset = CameraRigSettings & { name: string }

export interface CameraDirectorContext {
  gameState: string
  playerXNorm?: number
  playerYNorm?: number
  playerFiring?: boolean
  playerFocusing?: boolean
  playerSpinning?: boolean
  hitPulse?: number
  bombPulse?: number
  bossEventPulse?: number
  warning?: boolean
  bossActive?: boolean
  bossTelegraph?: number
  bossPhase?: number
}

const CAMERA_DISTANCE_MIN = 1600
const CAMERA_DISTANCE_MAX = 1735
const LOCKED_TARGET_Y = SCENE.CAMERA_GAMEPLAY_TARGET_Y

const DEFAULT_RIG: CameraRigSettings = {
  pitchDeg: 12.4,
  yawDeg: 0,
  distance: 1677,
  targetX: 0,
  targetY: LOCKED_TARGET_Y,
  targetZ: 0,
}

const PRESETS: Record<string, CameraPreset> = {
  baseline: {
    name: 'baseline',
    ...DEFAULT_RIG,
  },
  canyon: {
    name: 'canyon',
    pitchDeg: 18,
    yawDeg: -8,
    distance: 1680,
    targetX: 0,
    targetY: LOCKED_TARGET_Y,
    targetZ: 0,
  },
  orbital: {
    name: 'orbital',
    pitchDeg: 9,
    yawDeg: 14,
    distance: 1735,
    targetX: 0,
    targetY: LOCKED_TARGET_Y,
    targetZ: 0,
  },
  boss: {
    name: 'boss',
    pitchDeg: 22,
    yawDeg: 0,
    distance: 1720,
    targetX: 0,
    targetY: LOCKED_TARGET_Y,
    targetZ: 4,
  },
}

function clampRig(value: CameraRigSettings): CameraRigSettings {
  return {
    pitchDeg: THREE.MathUtils.clamp(value.pitchDeg, 0, 28),
    yawDeg: THREE.MathUtils.clamp(value.yawDeg, -24, 24),
    distance: THREE.MathUtils.clamp(value.distance, CAMERA_DISTANCE_MIN, CAMERA_DISTANCE_MAX),
    targetX: THREE.MathUtils.clamp(value.targetX, -80, 80),
    targetY: LOCKED_TARGET_Y,
    targetZ: THREE.MathUtils.clamp(value.targetZ, -60, 80),
  }
}

function lerpRig(current: CameraRigSettings, target: CameraRigSettings, alpha: number): CameraRigSettings {
  return {
    pitchDeg: THREE.MathUtils.lerp(current.pitchDeg, target.pitchDeg, alpha),
    yawDeg: THREE.MathUtils.lerp(current.yawDeg, target.yawDeg, alpha),
    distance: THREE.MathUtils.lerp(current.distance, target.distance, alpha),
    targetX: THREE.MathUtils.lerp(current.targetX, target.targetX, alpha),
    targetY: THREE.MathUtils.lerp(current.targetY, target.targetY, alpha),
    targetZ: THREE.MathUtils.lerp(current.targetZ, target.targetZ, alpha),
  }
}

function blendRig(current: CameraRigSettings, target: CameraRigSettings, amount: number): CameraRigSettings {
  return lerpRig(current, target, THREE.MathUtils.clamp(amount, 0, 1))
}

function easePulse(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export class CameraDirector {
  private current: CameraRigSettings = { ...DEFAULT_RIG }
  private target: CameraRigSettings = { ...DEFAULT_RIG }
  private presetName = 'director'
  private autoEnabled = true

  get settings(): CameraRigSettings {
    return { ...this.target }
  }

  get activePreset(): string {
    return this.presetName
  }

  get isAutoEnabled(): boolean {
    return this.autoEnabled
  }

  get presetNames(): string[] {
    return Object.keys(PRESETS)
  }

  update(dt: number, context: CameraDirectorContext): void {
    if (this.autoEnabled) this.updateDirectorTarget(context)
    const eventStrength = Math.max(context.hitPulse ?? 0, context.bombPulse ?? 0, context.bossEventPulse ?? 0)
    const responseSpeed = 6.8 + eventStrength * 3.4
    const alpha = 1 - Math.exp(-dt * responseSpeed)
    this.current = lerpRig(this.current, this.target, alpha)
  }

  applyGameplayCamera(camera: THREE.PerspectiveCamera): void {
    const rig = this.current
    const pitch = THREE.MathUtils.degToRad(rig.pitchDeg)
    const yaw = THREE.MathUtils.degToRad(rig.yawDeg)
    const lateral = Math.sin(pitch) * rig.distance
    const z = Math.cos(pitch) * rig.distance
    const target = new THREE.Vector3(rig.targetX, rig.targetY, rig.targetZ)

    camera.up.set(0, 1, 0)
    camera.position.set(
      target.x + Math.sin(yaw) * lateral,
      target.y - Math.cos(yaw) * lateral,
      target.z + z,
    )
    camera.lookAt(target)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
  }

  setPartial(value: Partial<CameraRigSettings>): void {
    this.autoEnabled = false
    this.presetName = 'custom'
    this.target = clampRig({ ...this.target, ...value })
  }

  setPreset(name: string): void {
    this.autoEnabled = false
    const preset = PRESETS[name] ?? PRESETS.baseline
    this.presetName = preset.name
    this.target = clampRig(preset)
  }

  setAutoEnabled(enabled: boolean): void {
    this.autoEnabled = enabled
    this.presetName = enabled ? 'director' : this.presetName
  }

  reset(): void {
    this.current = { ...DEFAULT_RIG }
    this.target = { ...DEFAULT_RIG }
    this.presetName = 'director'
    this.autoEnabled = true
  }

  private updateDirectorTarget(context: CameraDirectorContext): void {
    const playerX = THREE.MathUtils.clamp(context.playerXNorm ?? 0, -1, 1)
    const playerY = THREE.MathUtils.clamp(context.playerYNorm ?? 0, -1, 1)
    const forward = Math.max(0, playerY)
    const rear = Math.max(0, -playerY)
    const firing = context.playerFiring === true
    const focusing = context.playerFocusing === true
    const spinning = context.playerSpinning === true
    const hitPulse = easePulse(context.hitPulse ?? 0)
    const bombPulse = easePulse(context.bombPulse ?? 0)
    const bossEventPulse = easePulse(context.bossEventPulse ?? 0)
    const telegraph = THREE.MathUtils.clamp(context.bossTelegraph ?? 0, 0, 1)
    const bossPhase = THREE.MathUtils.clamp(context.bossPhase ?? 0, 0, 4)

    let rig: CameraRigSettings = {
      pitchDeg: DEFAULT_RIG.pitchDeg + forward * 2.8 - rear * 1.0,
      yawDeg: playerX * (focusing ? 4.2 : 7.2),
      distance: DEFAULT_RIG.distance + forward * 4 - rear * 6,
      targetX: playerX * (focusing ? 6 : 12),
      targetY: LOCKED_TARGET_Y,
      targetZ: forward * 7 - rear * 3,
    }

    if (firing) {
      rig = {
        ...rig,
        pitchDeg: rig.pitchDeg + 1.4,
        yawDeg: rig.yawDeg + playerX * 1.4,
        distance: rig.distance - 10,
        targetX: rig.targetX + playerX * 3,
        targetZ: rig.targetZ + 4,
      }
    }

    if (focusing) {
      rig = {
        ...rig,
        pitchDeg: rig.pitchDeg - 2.2,
        yawDeg: rig.yawDeg * 0.55,
        distance: rig.distance + 9,
        targetX: rig.targetX * 0.5,
        targetZ: rig.targetZ - 3,
      }
    }

    if (spinning) {
      rig = blendRig(rig, {
        pitchDeg: 21,
        yawDeg: playerX * 3,
        distance: 1712,
        targetX: playerX * 4,
        targetY: LOCKED_TARGET_Y,
        targetZ: 22,
      }, 0.78)
    }

    if (hitPulse > 0) {
      const side = playerX < 0 ? -1 : 1
      rig = {
        ...rig,
        pitchDeg: rig.pitchDeg + hitPulse * 4.8,
        yawDeg: rig.yawDeg + side * hitPulse * 5.5,
        distance: rig.distance + hitPulse * 24,
        targetZ: rig.targetZ + hitPulse * 16,
      }
    }

    if (bombPulse > 0) {
      rig = blendRig(rig, {
        pitchDeg: 24,
        yawDeg: playerX * 2,
        distance: 1730,
        targetX: playerX * 3,
        targetY: LOCKED_TARGET_Y,
        targetZ: 42,
      }, 0.72 * bombPulse)
    }

    if (context.warning) {
      rig = blendRig(rig, {
        pitchDeg: 20,
        yawDeg: 0,
        distance: 1718,
        targetX: 0,
        targetY: LOCKED_TARGET_Y,
        targetZ: 18,
      }, 0.7)
    }

    if (context.bossActive) {
      rig = blendRig(rig, {
        pitchDeg: 20 + bossPhase * 1.1 + telegraph * 5,
        yawDeg: playerX * 3,
        distance: 1712 + telegraph * 18,
        targetX: 0,
        targetY: LOCKED_TARGET_Y,
        targetZ: 12 + bossPhase * 3 + telegraph * 22,
      }, 0.82)
    }

    if (bossEventPulse > 0) {
      rig = blendRig(rig, {
        pitchDeg: 24,
        yawDeg: 0,
        distance: 1735,
        targetX: 0,
        targetY: LOCKED_TARGET_Y,
        targetZ: 36,
      }, 0.55 * bossEventPulse)
    }

    if (context.gameState === 'gameover') {
      rig = {
        pitchDeg: 8,
        yawDeg: 0,
        distance: 1730,
        targetX: 0,
        targetY: LOCKED_TARGET_Y,
        targetZ: 4,
      }
    }

    this.presetName = 'director'
    this.target = clampRig(rig)
  }
}
