/**
 * Boss 1-3 具体实现
 */

import * as THREE from 'three'
import { Boss, type BossPhase } from './Boss'
import { BulletEmitter } from '@/game/systems/BulletEmitter'

// ─── Boss 1: 要塞守卫 ────────────────────────────────────────────────────────

export class FortressGuardian extends Boss {
  private sway = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [
        new BulletEmitter('fan', 160, 1.5, 5, 60),
      ]},
      { hpThreshold: 0.6, emitters: [
        new BulletEmitter('fan', 180, 1.2, 7, 80),
        new BulletEmitter('aimed', 200, 2.0, 1),
      ]},
      { hpThreshold: 0.3, emitters: [
        new BulletEmitter('ring', 150, 0.8, 12),
        new BulletEmitter('aimed', 220, 1.0, 1),
      ]},
    ]
    super(scene, '要塞守卫', 1500, 5000, phases)
    this.hitboxRadius = 40
    this.mesh = buildFortressMesh()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  updateMovement(dt: number): void {
    this.sway += dt * 0.8
    this.position.x = Math.sin(this.sway) * 30
  }
}

// ─── Boss 2: 沙暴蝎 ──────────────────────────────────────────────────────────

export class SandScorpion extends Boss {
  private phase2Timer = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [
        new BulletEmitter('fan', 170, 1.0, 5, 50),
        new BulletEmitter('aimed', 200, 1.8, 1),
      ]},
      { hpThreshold: 0.5, emitters: [
        new BulletEmitter('spiral', 140, 0.15, 3, 360, 90),
        new BulletEmitter('aimed', 220, 1.2, 1),
      ]},
      { hpThreshold: 0.2, emitters: [
        new BulletEmitter('ring', 180, 0.6, 16),
        new BulletEmitter('stream', 250, 0.3, 2),
      ]},
    ]
    super(scene, '沙暴蝎', 2500, 8000, phases)
    this.hitboxRadius = 35
    this.mesh = buildScorpionMesh()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  updateMovement(dt: number): void {
    this.phase2Timer += dt
    // Aggressive side-to-side + slight forward/back
    this.position.x = Math.sin(this.phase2Timer * 1.2) * 50
    this.position.y = this.targetY + Math.sin(this.phase2Timer * 0.7) * 15
  }
}

// ─── Boss 3: 深海霸王 ────────────────────────────────────────────────────────

export class OceanOverlord extends Boss {
  private moveTimer = 0

  constructor(scene: THREE.Scene) {
    const phases: BossPhase[] = [
      { hpThreshold: 1.0, emitters: [
        new BulletEmitter('curtain', 140, 1.8, 9),
        new BulletEmitter('aimed', 180, 2.5, 1),
      ]},
      { hpThreshold: 0.6, emitters: [
        new BulletEmitter('curtain', 160, 1.2, 11),
        new BulletEmitter('fan', 200, 1.5, 7, 70),
      ]},
      { hpThreshold: 0.25, emitters: [
        new BulletEmitter('ring', 170, 0.7, 20),
        new BulletEmitter('spiral', 150, 0.12, 3, 360, 120),
      ]},
    ]
    super(scene, '深海霸王', 4000, 12000, phases)
    this.hitboxRadius = 45
    this.mesh = buildCarrierMesh()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  updateMovement(dt: number): void {
    this.moveTimer += dt
    this.position.x = Math.sin(this.moveTimer * 0.5) * 40
  }
}

// ─── Mesh builders ────────────────────────────────────────────────────────────

function buildFortressMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshPhongMaterial({ color: 0x667788, specular: 0x99aabb, shininess: 40 })
  // Base platform
  g.add(new THREE.Mesh(new THREE.BoxGeometry(80, 80, 12), mat))
  // 4 corner turrets
  const tMat = new THREE.MeshPhongMaterial({ color: 0x556677, emissive: 0x223344, emissiveIntensity: 0.3 })
  for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 16, 6), tMat)
    t.position.set(sx * 30, sy * 30, 10)
    g.add(t)
  }
  // Core (weak point)
  const core = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), new THREE.MeshPhongMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1.5 }))
  core.position.z = 8
  g.add(core)
  return g
}

function buildScorpionMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshPhongMaterial({ color: 0xaa8844, specular: 0xccaa66, shininess: 50 })
  // Body
  g.add(new THREE.Mesh(new THREE.SphereGeometry(20, 8, 6), mat).translateZ(0))
  // Claws
  const clawMat = new THREE.MeshPhongMaterial({ color: 0x886633, specular: 0xaa8855, shininess: 40 })
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(12, 30, 6), clawMat)
    arm.position.set(side * 28, 15, 0)
    arm.rotation.z = side * 0.3
    g.add(arm)
    const claw = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 4), clawMat)
    claw.position.set(side * 35, 32, 0)
    g.add(claw)
  }
  // Tail
  const tailMat = new THREE.MeshPhongMaterial({ color: 0xcc6622, emissive: 0x882200, emissiveIntensity: 0.5 })
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, 40, 6), tailMat)
  tail.position.set(0, -30, 8)
  tail.rotation.x = -0.4
  g.add(tail)
  const stinger = new THREE.Mesh(new THREE.ConeGeometry(6, 12, 4), new THREE.MeshPhongMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 1 }))
  stinger.position.set(0, -48, 16)
  g.add(stinger)
  return g
}

function buildCarrierMesh(): THREE.Group {
  const g = new THREE.Group()
  const hullMat = new THREE.MeshPhongMaterial({ color: 0x445566, specular: 0x667788, shininess: 40 })
  g.add(new THREE.Mesh(new THREE.BoxGeometry(100, 40, 12), hullMat))
  const deck = new THREE.Mesh(new THREE.BoxGeometry(90, 35, 3), new THREE.MeshPhongMaterial({ color: 0x556677 }))
  deck.position.z = 8; g.add(deck)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(15, 12, 20), new THREE.MeshPhongMaterial({ color: 0x667788 }))
  tower.position.set(35, 0, 16); g.add(tower)
  const mlMat = new THREE.MeshPhongMaterial({ color: 0x888888, emissive: 0x333333, emissiveIntensity: 0.3 })
  for (const side of [-1, 1]) {
    const ml = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 12, 6), mlMat)
    ml.position.set(side * 40, -15, 10); g.add(ml)
  }
  return g
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
    this.mesh = buildDragonMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
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
    this.mesh = buildTitanMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
  }
  updateMovement(dt: number): void { this.t += dt; this.position.x = Math.sin(this.t * 0.6) * 35 }
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
    this.mesh = buildEyeMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
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
    this.mesh = buildPhantomMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
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
    this.mesh = buildBreakerMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
  }
  updateMovement(dt: number): void { this.t += dt; this.position.x = Math.sin(this.t * 0.5) * 40 }
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
    this.mesh = buildHeraldMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
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
    this.mesh = buildArchonMesh(); this.mesh.position.copy(this.position); scene.add(this.mesh)
  }
  updateMovement(dt: number): void {
    this.t += dt
    const phase = this.currentPhase
    const speed = 0.5 + phase * 0.3
    this.position.x = Math.sin(this.t * speed) * (40 + phase * 10)
    this.position.y = this.targetY + Math.cos(this.t * speed * 0.7) * (15 + phase * 5)
  }
}

// ─── Mesh builders for Boss 4-10 ──────────────────────────────────────────────

const pm = (c: number, e = 0, ei = 0.5) => new THREE.MeshPhongMaterial({ color: c, emissive: e || undefined, emissiveIntensity: e ? ei : 0, specular: 0x888888, shininess: 50 })

function buildDragonMesh(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.SphereGeometry(18, 8, 6), pm(0xcc4400, 0xff2200, 1)))
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(40, 20, 3), pm(0x882200, 0x441100))
    wing.position.set(s * 35, 5, 0); wing.rotation.z = s * 0.3; g.add(wing)
  }
  // Tail segments
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(8 - i, 6, 4), pm(0xaa3300, 0x661100))
    seg.position.set(0, -20 - i * 14, 0); g.add(seg)
  }
  return g
}

function buildTitanMesh(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.BoxGeometry(40, 60, 20), pm(0x666655)))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(15, 8, 6), pm(0x777766)).translateY(35))
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(12, 50, 10), pm(0x555544))
    arm.position.set(s * 30, 10, 0); g.add(arm)
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 3, 20, 6), pm(0x44ff44, 0x22aa22, 1)).translateX(s * 35).translateY(-20))
  }
  return g
}

function buildEyeMesh(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.TorusGeometry(30, 6, 8, 24), pm(0x556688, 0x334466)))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(16, 12, 8), pm(0xff4400, 0xff2200, 2)))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    const node = new THREE.Mesh(new THREE.OctahedronGeometry(5), pm(0x8888ff, 0x4444ff, 1))
    node.position.set(Math.cos(a) * 30, Math.sin(a) * 30, 0); g.add(node)
  }
  return g
}

function buildPhantomMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = pm(0x6644aa, 0x4422aa, 1.5)
  mat.transparent = true; mat.opacity = 0.7
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(25, 1), mat))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(10, 8, 6), pm(0xffffff, 0xaaaaff, 2)))
  return g
}

function buildBreakerMesh(): THREE.Group {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(new THREE.ConeGeometry(20, 50, 8), pm(0x888877, 0x444433)).translateY(25))
  g.add(new THREE.Mesh(new THREE.BoxGeometry(50, 80, 15), pm(0x666655)))
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(15, 40, 8), pm(0x777766))
    arm.position.set(s * 35, -10, 0); g.add(arm)
  }
  return g
}

function buildHeraldMesh(): THREE.Group {
  const g = new THREE.Group()
  const mat = pm(0x442266, 0x6633aa, 1.5)
  mat.transparent = true; mat.opacity = 0.8
  g.add(new THREE.Mesh(new THREE.TorusKnotGeometry(20, 6, 64, 8), mat))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(12, 10, 8), pm(0xff00ff, 0xaa00aa, 2)))
  return g
}

function buildArchonMesh(): THREE.Group {
  const g = new THREE.Group()
  // Multi-layered final boss
  g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(30, 1), pm(0x222222, 0x111111)))
  g.add(new THREE.Mesh(new THREE.OctahedronGeometry(20), pm(0xff6600, 0xff4400, 2)))
  const ring = new THREE.Mesh(new THREE.TorusGeometry(35, 3, 8, 24), pm(0x00ffff, 0x00aaaa, 1.5))
  g.add(ring)
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(40, 2, 8, 24), pm(0xff00ff, 0xaa00aa, 1))
  ring2.rotation.x = Math.PI / 2; g.add(ring2)
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const orb = new THREE.Mesh(new THREE.SphereGeometry(5, 6, 4), pm(0xffaa00, 0xff6600, 1.5))
    orb.position.set(Math.cos(a) * 40, Math.sin(a) * 40, 0); g.add(orb)
  }
  return g
}
