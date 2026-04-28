import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange } from '@/utils/math'
import { BulletEmitter, type EnemyBulletSpawn, type BulletPattern } from '@/game/systems/BulletEmitter'
import { buildEnemyShip } from './enemy-ship/EnemyShipFactory'

export type EnemyType = 'scout' | 'fighter' | 'swooper' | 'gunship' | 'bomber' | 'carrier'

type EnemySurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
const USE_C1_SAFE_ENEMY_PROXY = false

interface EnemyConfig {
  hp: number
  speed: number
  scoreValue: number
  hitboxRadius: number
  pattern: BulletPattern | null
  fireRate: number
  bulletCount: number
  behavior: 'straight' | 'swoop' | 'hover' | 'zigzag'
  depthBias: number
}

const CONFIGS: Record<EnemyType, EnemyConfig> = {
  scout: {
    hp: 1, speed: 88, scoreValue: 100, hitboxRadius: 10,
    pattern: null, fireRate: 0, bulletCount: 0, behavior: 'straight', depthBias: 6,
  },
  fighter: {
    hp: 2, speed: 64, scoreValue: 200, hitboxRadius: 12,
    pattern: 'aimed', fireRate: 2.0, bulletCount: 1, behavior: 'straight', depthBias: 2,
  },
  swooper: {
    hp: 1, speed: 104, scoreValue: 150, hitboxRadius: 11,
    pattern: null, fireRate: 0, bulletCount: 0, behavior: 'swoop', depthBias: 8,
  },
  gunship: {
    hp: 8, speed: 32, scoreValue: 500, hitboxRadius: 19,
    pattern: 'fan', fireRate: 1.2, bulletCount: 5, behavior: 'hover', depthBias: -4,
  },
  bomber: {
    hp: 6, speed: 44, scoreValue: 400, hitboxRadius: 21,
    pattern: 'curtain', fireRate: 1.5, bulletCount: 7, behavior: 'straight', depthBias: -8,
  },
  carrier: {
    hp: 10, speed: 26, scoreValue: 600, hitboxRadius: 24,
    pattern: 'ring', fireRate: 2.5, bulletCount: 8, behavior: 'hover', depthBias: -12,
  },
}

export class Enemy extends Entity {
  type: EnemyType
  hp: number
  maxHp: number
  scoreValue: number
  readonly bulletRequests: EnemyBulletSpawn[] = []

  private emitter: BulletEmitter | null = null
  private swoopAngle = 0
  private swoopDir = 1
  private hoverY = 0
  private hoverTimer = 0
  private spawnTimer = 0.42
  private visualTime = 0
  private hitFlash = 0
  private glowMats: EnemySurfaceMaterial[] = []
  private hullMats: EnemySurfaceMaterial[] = []
  private thrusterNodes: THREE.Mesh[] = []

  constructor(scene: THREE.Scene, type: EnemyType, x: number, y: number) {
    super()
    this.type = type
    const cfg = CONFIGS[type]
    this.hp = cfg.hp
    this.maxHp = cfg.hp
    this.scoreValue = cfg.scoreValue
    this.hitboxRadius = cfg.hitboxRadius

    this.position.set(x, y, DEPTH_LAYERS.ENEMY + cfg.depthBias)

    if (cfg.pattern) {
      this.emitter = new BulletEmitter(cfg.pattern, 180, cfg.fireRate, cfg.bulletCount, 50)
    }

    if (cfg.behavior === 'swoop') {
      this.swoopDir = x > 0 ? -1 : 1
      this.velocity.set(cfg.speed * this.swoopDir, -cfg.speed * 0.56, 0)
    } else if (cfg.behavior === 'hover') {
      this.hoverY = SCENE.HEIGHT / 2 - randomRange(56, 130)
      this.velocity.set(0, -cfg.speed, 0)
    } else {
      this.velocity.set(0, -cfg.speed, 0)
    }

    this.mesh = USE_C1_SAFE_ENEMY_PROXY ? buildC1SafeEnemyProxy(type) : buildEnemyShip(type)
    this.mesh.position.copy(this.position)
    this.mesh.scale.setScalar(0.72)
    this.collectVisualNodes()
    scene.add(this.mesh)
  }

  updateEnemy(dt: number, playerX: number, playerY: number): void {
    this.bulletRequests.length = 0
    const cfg = CONFIGS[this.type]

    this.visualTime += dt
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt)
    if (this.spawnTimer > 0) this.spawnTimer = Math.max(0, this.spawnTimer - dt)
    this.updateVisualState()

    let moved = false

    if (cfg.behavior === 'swoop') {
      this.swoopAngle += dt * 2.8
      this.velocity.x = Math.cos(this.swoopAngle) * cfg.speed * this.swoopDir
      this.velocity.y = -cfg.speed * 0.62
      if (this.mesh) this.mesh.rotation.z = this.velocity.x * -0.008
      this.position.addScaledVector(this.velocity, dt)
      moved = true
    } else if (cfg.behavior === 'hover') {
      if (this.position.y > this.hoverY) {
        this.position.addScaledVector(this.velocity, dt)
        moved = true
      } else {
        this.hoverTimer += dt
        this.position.x += Math.sin(this.hoverTimer * 1.45) * 22 * dt
        this.position.y += Math.cos(this.hoverTimer * 1.2) * 4 * dt
        moved = true
      }
    }

    if (!moved) {
      this.position.addScaledVector(this.velocity, dt)
    }

    if (this.position.y < -SCENE.HEIGHT / 2 - 36) this.destroy()

    if (this.emitter && this.spawnTimer <= 0.08) {
      const spawns = this.emitter.update(dt, this.position.x, this.position.y, playerX, playerY)
      this.bulletRequests.push(...spawns)
    }

    this.syncMesh()
  }

  takeDamage(amount: number = 1): boolean {
    this.hp -= amount
    this.hitFlash = 0.16
    if (this.hp <= 0) {
      this.destroy()
      return true
    }
    return false
  }

  private collectVisualNodes(): void {
    if (!this.mesh) return
    const hullSet = new Set<EnemySurfaceMaterial>()
    const glowSet = new Set<EnemySurfaceMaterial>()

    this.mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        const name = obj.name.toLowerCase()
        if (
          name.includes('thruster') ||
          name.includes('core') ||
          name.includes('cannon') ||
          name.includes('muzzle') ||
          name.includes('bay') ||
          name.includes('launcher')
        ) {
          glowSet.add(mat)
        } else {
          hullSet.add(mat)
        }
      }
      if (
        obj.name.toLowerCase().includes('thruster') ||
        obj.name.toLowerCase().includes('core') ||
        obj.name.toLowerCase().includes('cannon')
      ) {
        this.thrusterNodes.push(obj)
      }
    })

    this.hullMats = [...hullSet]
    this.glowMats = [...glowSet]
  }

  private updateVisualState(): void {
    const hpRatio = this.maxHp > 0 ? this.hp / this.maxHp : 1
    const lowHp = hpRatio < 0.35 ? (0.35 - hpRatio) / 0.35 : 0
    const spawnBoost = this.spawnTimer > 0
      ? 1 + (this.spawnTimer / 0.42) * 1.8
      : 1
    const hitFlash = this.hitFlash > 0
      ? 1.5 + Math.sin(this.visualTime * 38) * 0.5
      : 0
    const pulse = 0.62 + Math.sin(this.visualTime * 9) * 0.38
    const criticalPulse = lowHp > 0
      ? (0.6 + Math.sin(this.visualTime * 20) * 0.4) * lowHp
      : 0
    const emissiveScale = spawnBoost * (1 + hitFlash * 0.8) * (1 + criticalPulse * 1.2)

    for (const mat of this.hullMats) {
      mat.emissive.setHex(this.hitFlash > 0 ? 0xff8833 : 0x000000)
      mat.emissiveIntensity = this.hitFlash > 0
        ? 0.22 + criticalPulse * 0.38
        : criticalPulse * 0.25
    }

    for (const mat of this.glowMats) {
      mat.emissiveIntensity = (0.7 + pulse * 0.45) * emissiveScale
    }

    for (const thruster of this.thrusterNodes) {
      const s = 0.8 + pulse * 0.24 + criticalPulse * 0.16 + hitFlash * 0.12
      thruster.scale.set(1, s, 1)
    }

    if (this.mesh) {
      const spawnP = this.spawnTimer > 0 ? 1 - this.spawnTimer / 0.42 : 1
      const spawnScale = 0.6 + Math.min(1, spawnP * 1.2) * 0.2
      this.mesh.scale.setScalar(spawnScale)
      if (this.hitFlash > 0) {
        this.mesh.rotation.z = Math.sin(this.visualTime * 55) * 0.06
      } else {
        this.mesh.rotation.y = Math.sin(this.visualTime * 3.5) * 0.05
      }
    }
  }
}

function makeSafeEnemyMat(color: number, emissive = 0x000000, emissiveIntensity = 0.12): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.42,
    metalness: 0.32,
    emissive,
    emissiveIntensity,
  })
}

function safeEnemyFaceMats(type: EnemyType): THREE.MeshStandardMaterial[] {
  const palettes: Record<EnemyType, number[]> = {
    scout: [0xff4d4d, 0xffb347, 0xfff1a8, 0x203040, 0x55d6ff, 0x131820],
    fighter: [0x6ce4ff, 0x2678ff, 0xffffff, 0x1c2635, 0xff6a3d, 0x071018],
    swooper: [0x8fff7a, 0x28b870, 0xf3ff9c, 0x102418, 0xff70c8, 0x09100d],
    gunship: [0xffc14d, 0xff623d, 0xfff0c2, 0x2b1d18, 0x62f3ff, 0x151515],
    bomber: [0xb58cff, 0x6742d9, 0xffffff, 0x211936, 0xffd166, 0x0f0a18],
    carrier: [0x8da3ff, 0x3f4f8f, 0xdce5ff, 0x151b2e, 0xff6b6b, 0x090b12],
  }
  const colors = palettes[type]
  return colors.map((color, index) => makeSafeEnemyMat(color, index === 4 ? color : 0x000000, index === 4 ? 0.9 : 0.1))
}

function addSafeEnemyPart(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position: [number, number, number],
  rotation: THREE.Euler = new THREE.Euler(),
): void {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.copy(rotation)
  mesh.frustumCulled = false
  group.add(mesh)
}

function buildC1SafeEnemyProxy(type: EnemyType): THREE.Group {
  const group = new THREE.Group()
  group.name = `enemy_${type}_c1_safe_proxy`

  const faceMats = safeEnemyFaceMats(type)
  const glow = makeSafeEnemyMat(0xff7a34, 0xff4b12, 1.65)
  const dark = makeSafeEnemyMat(0x141b24, 0x000000, 0.05)
  const cyan = makeSafeEnemyMat(0x71e5ff, 0x1ca7ff, 1.1)

  const cfg = {
    scout: { body: [12, 22, 26], wing: [16, 5, 11], pod: [5, 7, 10] },
    fighter: { body: [15, 26, 30], wing: [20, 6, 12], pod: [6, 8, 12] },
    swooper: { body: [18, 18, 30], wing: [22, 5, 12], pod: [7, 7, 14] },
    gunship: { body: [28, 20, 34], wing: [16, 7, 14], pod: [8, 9, 14] },
    bomber: { body: [22, 30, 36], wing: [42, 8, 16], pod: [8, 10, 16] },
    carrier: { body: [42, 24, 38], wing: [18, 8, 18], pod: [9, 10, 16] },
  }[type]

  addSafeEnemyPart(
    group,
    'enemy_armor_body',
    new THREE.BoxGeometry(cfg.body[0], cfg.body[1], cfg.body[2]),
    faceMats,
    [0, 0, 0],
    new THREE.Euler(0.06, 0, 0),
  )
  addSafeEnemyPart(
    group,
    'enemy_core_bridge',
    new THREE.BoxGeometry(Math.max(7, cfg.body[0] * 0.46), Math.max(8, cfg.body[1] * 0.34), 14),
    cyan,
    [0, 5, cfg.body[2] * 0.48],
    new THREE.Euler(-0.05, 0, 0),
  )
  addSafeEnemyPart(
    group,
    'enemy_belly_block',
    new THREE.BoxGeometry(Math.max(8, cfg.body[0] * 0.62), Math.max(8, cfg.body[1] * 0.44), 12),
    dark,
    [0, -4, -cfg.body[2] * 0.48],
  )

  for (const side of [-1, 1]) {
    addSafeEnemyPart(
      group,
      `enemy_wing_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(cfg.wing[0], cfg.wing[1], cfg.wing[2]),
      side < 0 ? faceMats[1] : faceMats[0],
      [(cfg.body[0] * 0.42 + cfg.wing[0] * 0.36) * side, -2, 0],
      new THREE.Euler(0.08, 0.05 * side, -0.16 * side),
    )
    addSafeEnemyPart(
      group,
      `enemy_thruster_core_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(cfg.pod[0], cfg.pod[1], cfg.pod[2]),
      glow,
      [Math.max(4, cfg.body[0] * 0.28) * side, -cfg.body[1] * 0.56, -1],
    )
  }

  if (type === 'gunship' || type === 'carrier' || type === 'bomber') {
    addSafeEnemyPart(
      group,
      'enemy_cannon_block',
      new THREE.BoxGeometry(Math.max(8, cfg.body[0] * 0.34), 16, 9),
      glow,
      [0, cfg.body[1] * 0.48, 13],
      new THREE.Euler(0.08, 0, 0),
    )
  }

  return group
}
