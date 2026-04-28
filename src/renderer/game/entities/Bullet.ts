import * as THREE from 'three'
import { Entity } from './Entity'
import { DEPTH_LAYERS, SCENE } from '@/game/GameConfig'
import { attachFresnelRim } from '@/rendering/FresnelRim'

const C1_SAFE_BULLET_VISUALS = true
const C1_LOCAL_ADDITIVE_GLOW = true
const PLAYER_BULLET_SAFE_GEO = new THREE.OctahedronGeometry(1, 0).scale(2.4, 8.2, 4.8)
const PLAYER_BULLET_SHOT_GEO = new THREE.OctahedronGeometry(1, 0).scale(2.8, 9.4, 5.2)
const PLAYER_BULLET_SPREAD_GEO = new THREE.TetrahedronGeometry(3.4, 0).scale(1.35, 1.75, 1.4)
const ENEMY_BULLET_SAFE_GEO = new THREE.OctahedronGeometry(1, 0).scale(4.8, 4.8, 6.2)
const ENEMY_BULLET_AIMED_GEO = new THREE.OctahedronGeometry(1, 0).scale(4.2, 6.8, 6.0)
const ENEMY_BULLET_FAN_GEO = new THREE.TetrahedronGeometry(4.8, 0).scale(1.0, 1.25, 1.35)
const ENEMY_BULLET_RING_GEO = new THREE.DodecahedronGeometry(4.8, 0).scale(1.0, 1.0, 1.25)
const ENEMY_BULLET_CURTAIN_GEO = new THREE.BoxGeometry(7.2, 4.8, 6.4)
const ENEMY_BULLET_SPIRAL_GEO = new THREE.OctahedronGeometry(1, 0).scale(3.8, 7.6, 5.8)
const ENEMY_BULLET_BOSS_GEO = new THREE.OctahedronGeometry(1, 0).scale(5.8, 7.8, 8.2)
const PLAYER_BULLET_GEO = new THREE.CylinderGeometry(1.2, 1.2, 10, 8)
const PLAYER_BULLET_TRAIL_GEO = new THREE.CylinderGeometry(0.6, 1.4, 14, 8)
const ENEMY_BULLET_GEO = new THREE.SphereGeometry(3.5, 10, 8)
const ENEMY_BULLET_CORE_GEO = new THREE.SphereGeometry(2.2, 8, 6)

const playerBulletMat = new THREE.MeshStandardMaterial({
  color: 0x44ccff, roughness: 0.2, metalness: 0.45,
  emissive: 0x0088ff, emissiveIntensity: 2.2,
  flatShading: true,
})
const playerSpreadBulletMat = new THREE.MeshStandardMaterial({
  color: 0x8cff6a,
  roughness: 0.24,
  metalness: 0.48,
  emissive: 0x28d95a,
  emissiveIntensity: 2.0,
  flatShading: true,
})
const playerBulletTrailMat = new THREE.MeshStandardMaterial({
  color: 0x88eeff, roughness: 0.15, metalness: 0.3,
  emissive: 0x44ccff, emissiveIntensity: 1.4,
  transparent: true, opacity: 0.55,
})

const enemyBulletMat = new THREE.MeshStandardMaterial({
  color: 0xff4422, roughness: 0.35, metalness: 0.4,
  emissive: 0xff2200, emissiveIntensity: 1.8,
  flatShading: true,
})
const enemyBulletCoreMat = new THREE.MeshStandardMaterial({
  color: 0xffaa66, roughness: 0.15, metalness: 0.2,
  emissive: 0xff6622, emissiveIntensity: 2.6,
})

const playerShotGlowMat = new THREE.MeshBasicMaterial({
  color: 0x76e8ff,
  transparent: true,
  opacity: 0.22,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const playerSpreadGlowMat = new THREE.MeshBasicMaterial({
  color: 0xa6ff78,
  transparent: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const bossBulletGlowMat = new THREE.MeshBasicMaterial({
  color: 0xffb066,
  transparent: true,
  opacity: 0.18,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const playerShotTrailMat = new THREE.MeshBasicMaterial({
  color: 0x76e8ff,
  transparent: true,
  opacity: 0.14,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const playerSpreadTrailMat = new THREE.MeshBasicMaterial({
  color: 0xa6ff78,
  transparent: true,
  opacity: 0.13,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const bossBulletTrailMat = new THREE.MeshBasicMaterial({
  color: 0xffb066,
  transparent: true,
  opacity: 0.12,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})

export type EnemyBulletVisual =
  | 'aimed'
  | 'fan'
  | 'ring'
  | 'spiral'
  | 'curtain'
  | 'stream'
  | 'cross'
  | 'rose'
  | 'helix'
  | 'boss'

export type PlayerBulletVisual = 'player_shot' | 'player_spread'
type BulletVisual = EnemyBulletVisual | PlayerBulletVisual

const enemyBulletMaterials: Record<EnemyBulletVisual, THREE.MeshStandardMaterial> = {
  aimed: enemyBulletMat,
  fan: new THREE.MeshStandardMaterial({
    color: 0xff8a35,
    roughness: 0.34,
    metalness: 0.42,
    emissive: 0xff3a12,
    emissiveIntensity: 1.9,
    flatShading: true,
  }),
  ring: new THREE.MeshStandardMaterial({
    color: 0xffd166,
    roughness: 0.28,
    metalness: 0.48,
    emissive: 0xff7c18,
    emissiveIntensity: 2.05,
    flatShading: true,
  }),
  spiral: new THREE.MeshStandardMaterial({
    color: 0xff66c8,
    roughness: 0.28,
    metalness: 0.48,
    emissive: 0xd42284,
    emissiveIntensity: 2.0,
    flatShading: true,
  }),
  curtain: new THREE.MeshStandardMaterial({
    color: 0xff3f4f,
    roughness: 0.38,
    metalness: 0.35,
    emissive: 0xff1225,
    emissiveIntensity: 1.85,
    flatShading: true,
  }),
  stream: new THREE.MeshStandardMaterial({
    color: 0xfff0a8,
    roughness: 0.25,
    metalness: 0.52,
    emissive: 0xffa52d,
    emissiveIntensity: 2.05,
    flatShading: true,
  }),
  cross: new THREE.MeshStandardMaterial({
    color: 0x88e8ff,
    roughness: 0.22,
    metalness: 0.55,
    emissive: 0x26a8ff,
    emissiveIntensity: 1.95,
    flatShading: true,
  }),
  rose: new THREE.MeshStandardMaterial({
    color: 0xd58cff,
    roughness: 0.24,
    metalness: 0.56,
    emissive: 0x8d36ff,
    emissiveIntensity: 2.05,
    flatShading: true,
  }),
  helix: new THREE.MeshStandardMaterial({
    color: 0x9cff74,
    roughness: 0.26,
    metalness: 0.5,
    emissive: 0x46d84a,
    emissiveIntensity: 1.9,
    flatShading: true,
  }),
  boss: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.62,
    emissive: 0xff8840,
    emissiveIntensity: 2.45,
    flatShading: true,
  }),
}

attachFresnelRim(playerBulletMat, { color: 0xa0e8ff, power: 2.5, intensity: 0.22 })
attachFresnelRim(playerSpreadBulletMat, { color: 0xcaff92, power: 2.3, intensity: 0.22 })
attachFresnelRim(enemyBulletMat, { color: 0xff6644, power: 2.0, intensity: 0.18 })
for (const [visual, material] of Object.entries(enemyBulletMaterials) as Array<[EnemyBulletVisual, THREE.MeshStandardMaterial]>) {
  if (visual === 'aimed') continue
  attachFresnelRim(material, { color: visual === 'boss' ? 0xffffff : material.color.getHex(), power: 2.1, intensity: visual === 'boss' ? 0.28 : 0.18 })
}

export class Bullet extends Entity {
  isPlayer: boolean
  damage:   number = 1
  grazed = false
  private readonly visual: BulletVisual
  private readonly baseScale = new THREE.Vector3()
  private visualTime = 0

  constructor(
    scene: THREE.Scene,
    x: number, y: number, z: number,
    vx: number, vy: number,
    isPlayer: boolean,
    damage: number = 1,
    visual: BulletVisual = 'aimed',
  ) {
    super()
    this.isPlayer = isPlayer
    this.damage   = damage
    this.visual = visual
    this.position.set(x, y, z)
    this.velocity.set(vx, vy, 0)
    this.hitboxRadius = isPlayer ? 3 : visual === 'boss' ? 6 : 5

    this.mesh = buildBulletMesh(isPlayer, visual)
    this.mesh.position.copy(this.position)
    this.mesh.rotation.z = Math.atan2(vy, vx) - Math.PI / 2
    this.baseScale.copy(this.mesh.scale)
    scene.add(this.mesh)
  }

  update(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)
    this.visualTime += dt

    const halfH = SCENE.HEIGHT / 2 + 20
    const halfW = SCENE.WIDTH  / 2 + 20
    if (this.position.y > halfH || this.position.y < -halfH ||
        this.position.x > halfW || this.position.x < -halfW) {
      this.destroy()
    }

    if (this.mesh) {
      const pulse = 1 + Math.sin(this.visualTime * (this.visual === 'boss' ? 9.5 : 7.5)) * (this.visual === 'boss' ? 0.06 : 0.04)
      if (this.isPlayer) {
        const powerScale = 1 + Math.min(0.22, Math.max(0, this.damage - 5) * 0.006)
        this.mesh.scale.set(this.baseScale.x * powerScale * pulse, this.baseScale.y * powerScale, this.baseScale.z * (1 + (pulse - 1) * 0.5))
        this.mesh.rotation.y += dt * (this.visual === 'player_spread' ? 3.1 : 1.8)
      } else {
        this.mesh.scale.set(this.baseScale.x * pulse, this.baseScale.y, this.baseScale.z * (1 + (pulse - 1) * 0.7))
        this.mesh.rotation.y += dt * (this.visual === 'boss' ? 3.4 : 2.2)
      }
      if (this.visual === 'spiral' || this.visual === 'helix' || this.visual === 'rose' || this.visual === 'player_spread') {
        this.mesh.rotation.x += dt * 2.6
      }
    }

    this.syncMesh()
  }
}

function buildBulletMesh(isPlayer: boolean, visual: BulletVisual): THREE.Object3D {
  if (C1_SAFE_BULLET_VISUALS) {
    const geometry = isPlayer ? playerBulletGeometry(visual) : enemyBulletGeometry(visual as EnemyBulletVisual)
    const mesh = new THREE.Mesh(
      geometry,
      isPlayer ? playerBulletMaterial(visual) : enemyBulletMaterials[visual as EnemyBulletVisual],
    )
    mesh.name = 'bullet_solid_core'
    mesh.frustumCulled = false

    if (!C1_LOCAL_ADDITIVE_GLOW || !usesLocalGlow(isPlayer, visual)) return mesh

    const group = new THREE.Group()
    group.name = 'bullet_local_glow_group'
    const glow = new THREE.Mesh(geometry, bulletGlowMaterial(isPlayer, visual))
    glow.name = 'bullet_local_additive_glow'
    glow.scale.setScalar(isPlayer ? 1.28 : 1.18)
    glow.frustumCulled = false
    glow.renderOrder = 2
    const trail = new THREE.Mesh(PLAYER_BULLET_TRAIL_GEO, bulletTrailMaterial(isPlayer, visual))
    trail.name = 'bullet_local_additive_trail'
    trail.position.y = isPlayer ? -8.5 : -10.5
    trail.scale.setScalar(isPlayer ? 0.72 : 0.95)
    trail.frustumCulled = false
    trail.renderOrder = 1
    group.add(mesh, trail, glow)
    return group
  }

  if (isPlayer) {
    const group = new THREE.Group()
    const main = new THREE.Mesh(PLAYER_BULLET_GEO, playerBulletMat)
    main.rotation.x = Math.PI / 2
    const trail = new THREE.Mesh(PLAYER_BULLET_TRAIL_GEO, playerBulletTrailMat)
    trail.rotation.x = Math.PI / 2
    trail.position.y = -8
    trail.scale.set(0.85, 1, 0.85)
    group.add(main, trail)
    return group
  } else {
    const group = new THREE.Group()
    const outer = new THREE.Mesh(ENEMY_BULLET_GEO, enemyBulletMat)
    const core = new THREE.Mesh(ENEMY_BULLET_CORE_GEO, enemyBulletCoreMat)
    group.add(outer, core)
    return group
  }
}

function usesLocalGlow(isPlayer: boolean, visual: BulletVisual): boolean {
  return isPlayer || visual === 'boss'
}

function bulletGlowMaterial(isPlayer: boolean, visual: BulletVisual): THREE.Material {
  if (!isPlayer && visual === 'boss') return bossBulletGlowMat
  return visual === 'player_spread' ? playerSpreadGlowMat : playerShotGlowMat
}

function bulletTrailMaterial(isPlayer: boolean, visual: BulletVisual): THREE.Material {
  if (!isPlayer && visual === 'boss') return bossBulletTrailMat
  return visual === 'player_spread' ? playerSpreadTrailMat : playerShotTrailMat
}

function playerBulletGeometry(visual: BulletVisual): THREE.BufferGeometry {
  switch (visual) {
    case 'player_spread':
      return PLAYER_BULLET_SPREAD_GEO
    case 'player_shot':
      return PLAYER_BULLET_SHOT_GEO
    default:
      return PLAYER_BULLET_SAFE_GEO
  }
}

function playerBulletMaterial(visual: BulletVisual): THREE.Material {
  return visual === 'player_spread' ? playerSpreadBulletMat : playerBulletMat
}

function enemyBulletGeometry(visual: EnemyBulletVisual): THREE.BufferGeometry {
  switch (visual) {
    case 'fan':
      return ENEMY_BULLET_FAN_GEO
    case 'ring':
      return ENEMY_BULLET_RING_GEO
    case 'spiral':
    case 'rose':
    case 'helix':
      return ENEMY_BULLET_SPIRAL_GEO
    case 'curtain':
    case 'cross':
      return ENEMY_BULLET_CURTAIN_GEO
    case 'stream':
    case 'aimed':
      return ENEMY_BULLET_AIMED_GEO
    case 'boss':
      return ENEMY_BULLET_BOSS_GEO
    default:
      return ENEMY_BULLET_SAFE_GEO
  }
}
