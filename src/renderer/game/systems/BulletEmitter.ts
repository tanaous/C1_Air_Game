/**
 * 弹幕模式系统 — 敌机和 Boss 使用
 * 支持复杂几何弹幕
 */

import { degToRad } from '@/utils/math'
import { DEPTH_LAYERS } from '@/game/GameConfig'

export type BulletPattern = 'aimed' | 'ring' | 'spiral' | 'fan' | 'curtain' | 'stream' | 'cross' | 'rose' | 'helix'

export interface EnemyBulletSpawn {
  x: number; y: number; z: number
  vx: number; vy: number
  isPlayer: false
}

export class BulletEmitter {
  pattern:       BulletPattern
  bulletSpeed:   number
  fireRate:      number
  bulletCount:   number
  angleSpread:   number
  rotationSpeed: number

  private timer = 0
  private spiralAngle = 0
  private burstCount  = 0

  constructor(pattern: BulletPattern, speed = 180, rate = 0.8, count = 8, spread = 360, rotSpeed = 60) {
    this.pattern       = pattern
    this.bulletSpeed   = speed
    this.fireRate      = rate
    this.bulletCount   = count
    this.angleSpread   = spread
    this.rotationSpeed = rotSpeed
  }

  update(dt: number, ex: number, ey: number, px: number, py: number): EnemyBulletSpawn[] {
    this.timer -= dt
    if (this.timer > 0) return []
    this.timer = this.fireRate
    this.burstCount++

    const z = DEPTH_LAYERS.BULLET, spd = this.bulletSpeed
    switch (this.pattern) {
      case 'aimed':   return this.aimed(ex, ey, z, spd, px, py)
      case 'ring':    return this.ring(ex, ey, z, spd)
      case 'spiral':  return this.spiral(ex, ey, z, spd)
      case 'fan':     return this.fan(ex, ey, z, spd, px, py)
      case 'curtain': return this.curtainP(ex, ey, z, spd)
      case 'stream':  return this.stream(ex, ey, z, spd, px, py)
      case 'cross':   return this.cross(ex, ey, z, spd)
      case 'rose':    return this.rose(ex, ey, z, spd)
      case 'helix':   return this.helix(ex, ey, z, spd)
      default:        return []
    }
  }

  private aimed(ex: number, ey: number, z: number, spd: number, px: number, py: number): EnemyBulletSpawn[] {
    const dx = px - ex, dy = py - ey, len = Math.sqrt(dx * dx + dy * dy) || 1
    return [{ x: ex, y: ey, z, vx: (dx / len) * spd, vy: (dy / len) * spd, isPlayer: false }]
  }

  private ring(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    const out: EnemyBulletSpawn[] = []
    const offset = this.burstCount * 0.15
    for (let i = 0; i < this.bulletCount; i++) {
      const a = (i / this.bulletCount) * Math.PI * 2 + offset
      out.push({ x: ex, y: ey, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, isPlayer: false })
    }
    return out
  }

  private spiral(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    this.spiralAngle += degToRad(this.rotationSpeed) * this.fireRate
    const out: EnemyBulletSpawn[] = []
    const arms = 3
    for (let i = 0; i < arms; i++) {
      const a = this.spiralAngle + (i * Math.PI * 2) / arms
      out.push({ x: ex, y: ey, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, isPlayer: false })
    }
    return out
  }

  private fan(ex: number, ey: number, z: number, spd: number, px: number, py: number): EnemyBulletSpawn[] {
    const dx = px - ex, dy = py - ey
    const base = Math.atan2(dy, dx)
    const half = degToRad(this.angleSpread / 2)
    const out: EnemyBulletSpawn[] = []
    for (let i = 0; i < this.bulletCount; i++) {
      const t = this.bulletCount === 1 ? 0 : (i / (this.bulletCount - 1)) * 2 - 1
      const a = base + t * half
      out.push({ x: ex, y: ey, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, isPlayer: false })
    }
    return out
  }

  private curtainP(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    const out: EnemyBulletSpawn[] = []
    const wave = Math.sin(this.burstCount * 0.5) * 15
    for (let i = 0; i < this.bulletCount; i++) {
      const off = (i - (this.bulletCount - 1) / 2) * 14 + wave
      out.push({ x: ex + off, y: ey, z, vx: 0, vy: -spd, isPlayer: false })
    }
    return out
  }

  private stream(ex: number, ey: number, z: number, spd: number, px: number, py: number): EnemyBulletSpawn[] {
    const dx = px - ex, dy = py - ey, len = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / len, ny = dy / len
    return [
      { x: ex, y: ey, z, vx: nx * spd, vy: ny * spd, isPlayer: false },
      { x: ex, y: ey, z, vx: nx * spd * 0.95 + ny * 15, vy: ny * spd * 0.95 - nx * 15, isPlayer: false },
    ]
  }

  /** 十字弹幕 — 4 方向 + 旋转 */
  private cross(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    const out: EnemyBulletSpawn[] = []
    const rot = this.burstCount * 0.2
    for (let arm = 0; arm < 4; arm++) {
      const base = (arm * Math.PI / 2) + rot
      for (let j = 0; j < 3; j++) {
        const a = base + (j - 1) * 0.08
        out.push({ x: ex, y: ey, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, isPlayer: false })
      }
    }
    return out
  }

  /** 玫瑰曲线弹幕 */
  private rose(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    const out: EnemyBulletSpawn[] = []
    const k = 3
    for (let i = 0; i < this.bulletCount; i++) {
      const theta = (i / this.bulletCount) * Math.PI * 2 + this.burstCount * 0.3
      const r = Math.cos(k * theta)
      const a = theta
      const s = spd * (0.5 + Math.abs(r) * 0.5)
      out.push({ x: ex, y: ey, z, vx: Math.cos(a) * s, vy: Math.sin(a) * s, isPlayer: false })
    }
    return out
  }

  /** 双螺旋弹幕 */
  private helix(ex: number, ey: number, z: number, spd: number): EnemyBulletSpawn[] {
    this.spiralAngle += degToRad(this.rotationSpeed) * this.fireRate
    const out: EnemyBulletSpawn[] = []
    for (let arm = 0; arm < 2; arm++) {
      const a = this.spiralAngle + arm * Math.PI
      out.push({ x: ex, y: ey, z, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, isPlayer: false })
      out.push({ x: ex, y: ey, z, vx: Math.cos(a + 0.15) * spd * 0.9, vy: Math.sin(a + 0.15) * spd * 0.9, isPlayer: false })
    }
    return out
  }
}
