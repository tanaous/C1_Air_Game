/**
 * Boss 基类 — 多阶段 HP 系统
 */

import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { BulletEmitter, type EnemyBulletSpawn } from '@/game/systems/BulletEmitter'

export interface BossPhase {
  hpThreshold: number   // 0-1, enter this phase when hp% drops below
  emitters:    BulletEmitter[]
}

export abstract class Boss extends Entity {
  name:          string
  maxHp:         number
  hp:            number
  scoreValue:    number
  phases:        BossPhase[]
  currentPhase   = 0
  fightDuration  = 0
  defeated       = false
  entering       = true
  enterSpeed     = 40
  targetY:       number

  readonly bulletRequests: EnemyBulletSpawn[] = []

  constructor(scene: THREE.Scene, name: string, maxHp: number, scoreValue: number, phases: BossPhase[]) {
    super()
    this.name       = name
    this.maxHp      = maxHp
    this.hp         = maxHp
    this.scoreValue = scoreValue
    this.phases     = phases
    this.hitboxRadius = 30
    this.targetY    = SCENE.HEIGHT / 2 - 80

    // Start off-screen top, enter from far depth
    this.position.set(0, SCENE.HEIGHT / 2 + 60, DEPTH_LAYERS.ENEMY - 3)
  }

  updateBoss(dt: number, playerX: number, playerY: number): void {
    this.bulletRequests.length = 0

    if (this.entering) {
      this.position.y -= this.enterSpeed * dt
      // Animate depth from far to normal
      this.position.z += 2 * dt
      if (this.position.z > DEPTH_LAYERS.ENEMY) this.position.z = DEPTH_LAYERS.ENEMY
      if (this.position.y <= this.targetY) {
        this.position.y = this.targetY
        this.entering = false
      }
      this.syncMesh()
      return
    }

    this.fightDuration += dt

    // Check phase transitions
    const hpPct = this.hp / this.maxHp
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (hpPct <= this.phases[i].hpThreshold && this.currentPhase < i) {
        this.currentPhase = i
        break
      }
    }

    // Fire current phase emitters
    const phase = this.phases[this.currentPhase]
    if (phase) {
      for (const emitter of phase.emitters) {
        this.bulletRequests.push(...emitter.update(dt, this.position.x, this.position.y, playerX, playerY))
      }
    }

    // Boss-specific movement
    this.updateMovement(dt)
    this.syncMesh()
  }

  abstract updateMovement(dt: number): void

  takeDamage(amount: number): boolean {
    if (this.entering) return false
    this.hp -= amount
    if (this.hp <= 0) {
      this.hp = 0
      this.defeated = true
      this.destroy()
      return true
    }
    return false
  }
}
