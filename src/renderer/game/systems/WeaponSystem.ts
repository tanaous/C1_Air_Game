/**
 * 三种武器系统：Shot / Spread / Laser
 * 每种支持 5 级升级
 * Laser 有过热熔断机制
 */

import type { WeaponType } from '@shared/types'
import { DEPTH_LAYERS } from '@/game/GameConfig'
import { degToRad } from '@/utils/math'

export interface BulletSpawn {
  x: number; y: number; z: number
  vx: number; vy: number
  damage: number
  isPlayer: true
  isLaser?: boolean
  width?: number
}

const SHOT_RATES   = [0.10, 0.09, 0.08, 0.07, 0.06]
const SHOT_DMG     = [10, 12, 14, 18, 25]
const SPREAD_RATES = [0.18, 0.16, 0.14, 0.12, 0.10]
const SPREAD_DMG   = [5, 6, 7, 8, 10]
const LASER_DMG    = [3, 4, 5, 7, 10]

const LASER_HEAT_RATE    = 0.4    // heat per second while firing
const LASER_COOL_RATE    = 0.25   // cool per second while not firing
const LASER_OVERHEAT_CD  = 1.5    // forced cooldown seconds after overheat

export class WeaponSystem {
  current: WeaponType = 'shot'
  level   = 1

  /** Laser heat 0-1, overheats at 1 */
  heat       = 0
  overheated = false
  /** true when laser is actively firing this frame */
  laserActive = false

  private fireTimer = 0
  private overheatTimer = 0

  switchWeapon(): void {
    const order: WeaponType[] = ['shot', 'spread', 'laser']
    this.current = order[(order.indexOf(this.current) + 1) % 3]
    this.fireTimer = 0
  }

  upgrade(): void { if (this.level < 5) this.level++ }

  setWeapon(w: WeaponType): void { this.current = w; this.level = 1 }

  tryFire(dt: number, firing: boolean, px: number, py: number): BulletSpawn[] {
    this.laserActive = false

    // Laser heat management
    if (this.current === 'laser') {
      if (this.overheated) {
        this.overheatTimer -= dt
        this.heat = Math.max(0, this.heat - LASER_COOL_RATE * dt * 2)
        if (this.overheatTimer <= 0) { this.overheated = false; this.heat = 0 }
        return []
      }
      if (firing) {
        this.heat = Math.min(1, this.heat + LASER_HEAT_RATE * dt)
        if (this.heat >= 1) {
          this.overheated = true
          this.overheatTimer = LASER_OVERHEAT_CD
          return []
        }
      } else {
        this.heat = Math.max(0, this.heat - LASER_COOL_RATE * dt)
      }
    }

    this.fireTimer -= dt
    if (!firing || this.fireTimer > 0) return []

    const lvl = this.level - 1
    const z = DEPTH_LAYERS.BULLET

    if (this.current === 'shot') {
      this.fireTimer = SHOT_RATES[lvl]
      return this.fireShot(px, py, z, lvl)
    } else if (this.current === 'spread') {
      this.fireTimer = SPREAD_RATES[lvl]
      return this.fireSpread(px, py, z, lvl)
    } else {
      this.fireTimer = 0.03
      this.laserActive = true
      return this.fireLaser(px, py, z, lvl)
    }
  }

  private fireShot(px: number, py: number, z: number, lvl: number): BulletSpawn[] {
    const spd = 500, dmg = SHOT_DMG[lvl]
    const count = [1, 2, 3, 4, 5][lvl], gap = 6
    const out: BulletSpawn[] = []
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * gap
      out.push({ x: px + off, y: py + 12, z, vx: 0, vy: spd, damage: dmg, isPlayer: true })
    }
    return out
  }

  private fireSpread(px: number, py: number, z: number, lvl: number): BulletSpawn[] {
    const spd = 400, dmg = SPREAD_DMG[lvl]
    const count = [3, 5, 7, 9, 12][lvl]
    const totalAngle = [40, 50, 60, 70, 360][lvl]
    const out: BulletSpawn[] = []
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1
      const rad = degToRad(90 + t * (totalAngle / 2))
      out.push({ x: px, y: py + 8, z, vx: Math.cos(rad) * spd, vy: Math.sin(rad) * spd, damage: dmg, isPlayer: true })
    }
    return out
  }

  private fireLaser(px: number, py: number, z: number, lvl: number): BulletSpawn[] {
    const dmg = LASER_DMG[lvl]
    const beams = [1, 2, 1, 2, 3][lvl], width = [5, 5, 10, 10, 16][lvl], gap = 14
    const out: BulletSpawn[] = []
    for (let i = 0; i < beams; i++) {
      const off = (i - (beams - 1) / 2) * gap
      out.push({ x: px + off, y: py + 100, z, vx: 0, vy: 0, damage: dmg, isPlayer: true, isLaser: true, width })
    }
    return out
  }
}
