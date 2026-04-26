/**
 * Boss 1-10 具体实现
 */

import * as THREE from 'three'
import { Boss, type BossPhase } from './Boss'
import { BulletEmitter } from '@/game/systems/BulletEmitter'
import { buildBossShip } from './boss-ship/BossShipFactory'

// ─── Boss 1: 要塞守卫 ────────────────────────────────────────────────────────

export class FortressGuardian extends Boss {
  private sway = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('fan', 160, 1.5, 5, 60)] },
      { hpThreshold: 0.6, emitters: [new BulletEmitter('fan', 180, 1.2, 7, 80), new BulletEmitter('aimed', 200, 2.0, 1)] },
      { hpThreshold: 0.3, emitters: [new BulletEmitter('ring', 150, 0.8, 12), new BulletEmitter('aimed', 220, 1.0, 1)] },
    ]
    super(scene, '要塞守卫', 1500, 5000, phases)
    this.hitboxRadius = 40
    this.bindMesh(scene, buildBossShip('fortress'))
  }

  updateMovement(dt: number): void {
    this.sway += dt * 0.8
    this.position.x = Math.sin(this.sway) * 30
  }
}

// ─── Boss 2: 沙暴蝎 ──────────────────────────────────────────────────────────

export class SandScorpion extends Boss {
  private t = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('fan', 170, 1.0, 5, 50), new BulletEmitter('aimed', 200, 1.8, 1)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('spiral', 140, 0.15, 3, 360, 90), new BulletEmitter('aimed', 220, 1.2, 1)] },
      { hpThreshold: 0.2, emitters: [new BulletEmitter('ring', 180, 0.6, 16), new BulletEmitter('stream', 250, 0.3, 2)] },
    ]
    super(scene, '沙暴蝎', 2500, 8000, phases)
    this.hitboxRadius = 35
    this.bindMesh(scene, buildBossShip('scorpion'))
  }

  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 1.2) * 50
    this.position.y = this.targetY + Math.sin(this.t * 0.7) * 15
  }
}

// ─── Boss 3: 深海霸王 ────────────────────────────────────────────────────────

export class OceanOverlord extends Boss {
  private moveTimer = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('curtain', 140, 1.8, 9), new BulletEmitter('aimed', 180, 2.5, 1)] },
      { hpThreshold: 0.6, emitters: [new BulletEmitter('curtain', 160, 1.2, 11), new BulletEmitter('fan', 200, 1.5, 7, 70)] },
      { hpThreshold: 0.25, emitters: [new BulletEmitter('ring', 170, 0.7, 20), new BulletEmitter('spiral', 150, 0.12, 3, 360, 120)] },
    ]
    super(scene, '深海霸王', 4000, 12000, phases)
    this.hitboxRadius = 45
    this.bindMesh(scene, buildBossShip('carrier'))
  }

  updateMovement(dt: number): void {
    this.moveTimer += dt
    this.position.x = Math.sin(this.moveTimer * 0.5) * 40
  }
}

// ─── Boss 4: 炎龙机甲 ────────────────────────────────────────────────────────

export class FlameDragon extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('spiral', 160, 0.12, 3, 360, 100), new BulletEmitter('aimed', 200, 1.5, 1)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('helix', 180, 0.08, 4, 360, 140), new BulletEmitter('fan', 220, 0.8, 9, 90)] },
      { hpThreshold: 0.2, emitters: [new BulletEmitter('rose', 150, 0.1, 16), new BulletEmitter('ring', 200, 0.5, 20)] },
    ]
    super(scene, '炎龙机甲', 5000, 16000, phases)
    this.hitboxRadius = 35
    this.bindMesh(scene, buildBossShip('dragon'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 1.5) * 55
    this.position.y = this.targetY + Math.sin(this.t * 0.8) * 25
  }
}

// ─── Boss 5: 废铁泰坦 ────────────────────────────────────────────────────────

export class RuinTitan extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('cross', 170, 0.3, 12), new BulletEmitter('aimed', 210, 1.0, 1)] },
      { hpThreshold: 0.6, emitters: [new BulletEmitter('cross', 190, 0.2, 12), new BulletEmitter('curtain', 160, 1.0, 11)] },
      { hpThreshold: 0.35, emitters: [new BulletEmitter('helix', 200, 0.06, 4, 360, 160), new BulletEmitter('ring', 180, 0.6, 16)] },
      { hpThreshold: 0.1, emitters: [new BulletEmitter('rose', 220, 0.05, 20), new BulletEmitter('spiral', 180, 0.08, 3, 360, 200)] },
    ]
    super(scene, '废铁泰坦', 6500, 20000, phases)
    this.hitboxRadius = 40
    this.bindMesh(scene, buildBossShip('titan'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 0.6) * 35
  }
}

// ─── Boss 6: 轨道之眼 ────────────────────────────────────────────────────────

export class OrbitalEye extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('ring', 160, 0.7, 16), new BulletEmitter('spiral', 140, 0.1, 3, 360, 80)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('ring', 180, 0.5, 24), new BulletEmitter('helix', 160, 0.07, 4, 360, 120)] },
      { hpThreshold: 0.2, emitters: [new BulletEmitter('rose', 200, 0.04, 24), new BulletEmitter('cross', 180, 0.15, 12)] },
    ]
    super(scene, '轨道之眼', 8000, 25000, phases)
    this.hitboxRadius = 38
    this.bindMesh(scene, buildBossShip('eye'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.cos(this.t * 0.4) * 45
    this.position.y = this.targetY + Math.sin(this.t * 0.6) * 20
  }
}

// ─── Boss 7: 星云幻影 ────────────────────────────────────────────────────────

export class NebulaPhantom extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('spiral', 150, 0.08, 3, 360, 100), new BulletEmitter('fan', 180, 1.0, 7, 70)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('rose', 170, 0.06, 20), new BulletEmitter('helix', 160, 0.07, 4, 360, 150)] },
      { hpThreshold: 0.2, emitters: [new BulletEmitter('ring', 200, 0.3, 30), new BulletEmitter('spiral', 180, 0.05, 3, 360, 200)] },
    ]
    super(scene, '星云幻影', 10000, 30000, phases)
    this.hitboxRadius = 35
    this.bindMesh(scene, buildBossShip('phantom'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 2) * 60
    this.position.y = this.targetY + Math.cos(this.t * 1.3) * 30
  }
}

// ─── Boss 8: 碎星者 ──────────────────────────────────────────────────────────

export class PlanetBreaker extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('curtain', 180, 0.8, 13), new BulletEmitter('aimed', 220, 0.8, 1)] },
      { hpThreshold: 0.65, emitters: [new BulletEmitter('cross', 200, 0.2, 12), new BulletEmitter('fan', 200, 0.7, 11, 100)] },
      { hpThreshold: 0.35, emitters: [new BulletEmitter('ring', 190, 0.4, 24), new BulletEmitter('helix', 180, 0.06, 4, 360, 180)] },
      { hpThreshold: 0.1, emitters: [new BulletEmitter('rose', 220, 0.03, 24), new BulletEmitter('spiral', 200, 0.04, 3, 360, 240)] },
    ]
    super(scene, '碎星者', 12000, 35000, phases)
    this.hitboxRadius = 45
    this.bindMesh(scene, buildBossShip('breaker'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 0.5) * 40
  }
}

// ─── Boss 9: 虚空使者 ────────────────────────────────────────────────────────

export class VoidHerald extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('helix', 170, 0.06, 4, 360, 130), new BulletEmitter('ring', 160, 0.8, 20)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('rose', 190, 0.04, 24), new BulletEmitter('cross', 200, 0.15, 12)] },
      { hpThreshold: 0.15, emitters: [new BulletEmitter('spiral', 210, 0.03, 3, 360, 250), new BulletEmitter('ring', 200, 0.3, 30), new BulletEmitter('aimed', 250, 0.5, 1)] },
    ]
    super(scene, '虚空使者', 15000, 40000, phases)
    this.hitboxRadius = 42
    this.bindMesh(scene, buildBossShip('herald'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    this.position.x = Math.sin(this.t * 1.8) * 50 + Math.cos(this.t * 3) * 15
    this.position.y = this.targetY + Math.sin(this.t * 1.1) * 25
  }
}

// ─── Boss 10: 终极执政官 ──────────────────────────────────────────────────────

export class FinalArchon extends Boss {
  private t = 0
  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [new BulletEmitter('fan', 180, 0.8, 9, 80), new BulletEmitter('spiral', 160, 0.1, 3, 360, 100)] },
      { hpThreshold: 0.75, emitters: [new BulletEmitter('cross', 200, 0.18, 12), new BulletEmitter('helix', 180, 0.06, 4, 360, 150)] },
      { hpThreshold: 0.5, emitters: [new BulletEmitter('rose', 200, 0.04, 24), new BulletEmitter('ring', 190, 0.4, 24)] },
      { hpThreshold: 0.25, emitters: [new BulletEmitter('spiral', 220, 0.03, 3, 360, 250), new BulletEmitter('curtain', 200, 0.5, 15), new BulletEmitter('aimed', 260, 0.4, 1)] },
      { hpThreshold: 0.08, emitters: [new BulletEmitter('rose', 240, 0.02, 30), new BulletEmitter('helix', 220, 0.04, 4, 360, 300), new BulletEmitter('ring', 210, 0.25, 32)] },
    ]
    super(scene, '终极执政官', 20000, 60000, phases)
    this.hitboxRadius = 50
    this.bindMesh(scene, buildBossShip('archon'))
  }
  updateMovement(dt: number): void {
    this.t += dt
    const phase = this.currentPhase
    const speed = 0.5 + phase * 0.3
    this.position.x = Math.sin(this.t * speed) * (40 + phase * 10)
    this.position.y = this.targetY + Math.cos(this.t * speed * 0.7) * (15 + phase * 5)
  }
}
