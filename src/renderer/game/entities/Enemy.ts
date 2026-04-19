import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange } from '@/utils/math'
import { BulletEmitter, type EnemyBulletSpawn, type BulletPattern } from '@/game/systems/BulletEmitter'

export type EnemyType = 'scout' | 'fighter' | 'swooper' | 'gunship' | 'bomber' | 'carrier'

interface EnemyConfig {
  hp: number; speed: number; scoreValue: number; hitboxRadius: number
  pattern: BulletPattern | null; fireRate: number; bulletCount: number
  behavior: 'straight' | 'swoop' | 'hover' | 'zigzag'
}

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  scout:   { hp: 1,  speed: 80,  scoreValue: 100, hitboxRadius: 10, pattern: null,     fireRate: 0,   bulletCount: 0, behavior: 'straight' },
  fighter: { hp: 2,  speed: 60,  scoreValue: 200, hitboxRadius: 12, pattern: 'aimed',  fireRate: 2.0, bulletCount: 1, behavior: 'straight' },
  swooper: { hp: 1,  speed: 100, scoreValue: 150, hitboxRadius: 10, pattern: null,     fireRate: 0,   bulletCount: 0, behavior: 'swoop' },
  gunship: { hp: 8,  speed: 30,  scoreValue: 500, hitboxRadius: 18, pattern: 'fan',    fireRate: 1.2, bulletCount: 5, behavior: 'hover' },
  bomber:  { hp: 6,  speed: 40,  scoreValue: 400, hitboxRadius: 20, pattern: 'curtain',fireRate: 1.5, bulletCount: 7, behavior: 'straight' },
  carrier: { hp: 10, speed: 25,  scoreValue: 600, hitboxRadius: 22, pattern: 'ring',   fireRate: 2.5, bulletCount: 8, behavior: 'hover' },
}

export class Enemy extends Entity {
  type:       EnemyType
  hp:         number
  scoreValue: number
  readonly bulletRequests: EnemyBulletSpawn[] = []

  private emitter: BulletEmitter | null = null
  private swoopAngle = 0
  private swoopDir   = 1
  private hoverY     = 0
  private hoverTimer = 0

  constructor(scene: THREE.Scene, type: EnemyType, x: number, y: number) {
    super()
    this.type = type
    const cfg = CONFIGS[type]
    this.hp           = cfg.hp
    this.scoreValue   = cfg.scoreValue
    this.hitboxRadius = cfg.hitboxRadius

    this.position.set(x, y, DEPTH_LAYERS.ENEMY)

    if (cfg.pattern) {
      this.emitter = new BulletEmitter(cfg.pattern, 180, cfg.fireRate, cfg.bulletCount, 50)
    }

    if (cfg.behavior === 'swoop') {
      this.swoopDir = x > 0 ? -1 : 1
      this.velocity.set(cfg.speed * this.swoopDir, -cfg.speed * 0.5, 0)
    } else if (cfg.behavior === 'hover') {
      this.hoverY = SCENE.HEIGHT / 2 - randomRange(60, 140)
      this.velocity.set(0, -cfg.speed, 0)
    } else {
      this.velocity.set(0, -cfg.speed, 0)
    }

    this.mesh = buildEnemyMesh(type)
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  updateEnemy(dt: number, playerX: number, playerY: number): void {
    this.bulletRequests.length = 0
    const cfg = CONFIGS[this.type]

    // Movement behavior
    if (cfg.behavior === 'swoop') {
      this.swoopAngle += dt * 2.5
      this.velocity.x = Math.cos(this.swoopAngle) * cfg.speed * this.swoopDir
      this.velocity.y = -cfg.speed * 0.6
    } else if (cfg.behavior === 'hover') {
      if (this.position.y > this.hoverY) {
        this.position.addScaledVector(this.velocity, dt)
      } else {
        // Hover: slight horizontal drift
        this.hoverTimer += dt
        this.position.x += Math.sin(this.hoverTimer * 1.5) * 20 * dt
      }
    }

    if (cfg.behavior !== 'hover' || this.position.y > this.hoverY) {
      this.position.addScaledVector(this.velocity, dt)
    }

    if (this.position.y < -SCENE.HEIGHT / 2 - 30) this.destroy()

    // Shooting
    if (this.emitter) {
      const spawns = this.emitter.update(dt, this.position.x, this.position.y, playerX, playerY)
      this.bulletRequests.push(...spawns)
    }

    this.syncMesh()
  }

  takeDamage(amount: number = 1): boolean {
    this.hp -= amount
    if (this.hp <= 0) { this.destroy(); return true }
    return false
  }
}

// ─── Procedural enemy meshes ──────────────────────────────────────────────────

function buildEnemyMesh(type: EnemyType): THREE.Group {
  const group = new THREE.Group()

  switch (type) {
    case 'scout': {
      const geo = new THREE.ConeGeometry(7, 16, 5)
      group.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0xcc3333, specular: 0xff4444, shininess: 40 })))
      const wGeo = new THREE.BoxGeometry(20, 4, 2)
      group.add(new THREE.Mesh(wGeo, new THREE.MeshPhongMaterial({ color: 0xaa2222 })))
      break
    }
    case 'fighter': {
      const geo = new THREE.OctahedronGeometry(9)
      const body = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x33aa33, specular: 0x44ff44, shininess: 50 }))
      body.scale.set(1, 1.4, 0.5)
      group.add(body)
      const bGeo = new THREE.CylinderGeometry(1, 1, 14, 6)
      const bMat = new THREE.MeshPhongMaterial({ color: 0x666666 })
      const bL = new THREE.Mesh(bGeo, bMat); bL.position.set(-7, -4, 0); group.add(bL)
      const bR = bL.clone(); bR.position.x = 7; group.add(bR)
      break
    }
    case 'swooper': {
      const geo = new THREE.TorusGeometry(10, 3, 6, 12, Math.PI * 1.2)
      const mesh = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: 0x9944cc, emissive: 0x440088, emissiveIntensity: 0.6, specular: 0xaa66ff, shininess: 60 }))
      mesh.rotation.z = Math.PI / 2
      group.add(mesh)
      break
    }
    case 'gunship': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 6, 6), new THREE.MeshPhongMaterial({ color: 0x556677, specular: 0x8899aa, shininess: 40 }))
      group.add(base)
      const turret = new THREE.Mesh(new THREE.SphereGeometry(6, 8, 6), new THREE.MeshPhongMaterial({ color: 0x778899, emissive: 0x334455, emissiveIntensity: 0.3 }))
      turret.position.y = 5
      group.add(turret)
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 12, 6), new THREE.MeshPhongMaterial({ color: 0x444444 }))
      barrel.position.set(0, 5, 6); barrel.rotation.x = Math.PI / 2
      group.add(barrel)
      break
    }
    case 'bomber': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 10), new THREE.MeshPhongMaterial({ color: 0x556633, specular: 0x889966, shininess: 30 }))
      group.add(body)
      const wing = new THREE.Mesh(new THREE.BoxGeometry(50, 6, 3), new THREE.MeshPhongMaterial({ color: 0x445522 }))
      wing.position.y = -2
      group.add(wing)
      // Warning stripes
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(28, 2, 11), new THREE.MeshPhongMaterial({ color: 0xccaa00, emissive: 0x886600, emissiveIntensity: 0.5 }))
      stripe.position.y = -8
      group.add(stripe)
      break
    }
    case 'carrier': {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(50, 22, 8), new THREE.MeshPhongMaterial({ color: 0x445566, specular: 0x667788, shininess: 40 }))
      group.add(hull)
      const deck = new THREE.Mesh(new THREE.BoxGeometry(46, 18, 2), new THREE.MeshPhongMaterial({ color: 0x556677 }))
      deck.position.z = 5
      group.add(deck)
      const tower = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 12), new THREE.MeshPhongMaterial({ color: 0x667788 }))
      tower.position.set(18, 0, 8)
      group.add(tower)
      break
    }
  }

  group.rotation.z = Math.PI
  return group
}
