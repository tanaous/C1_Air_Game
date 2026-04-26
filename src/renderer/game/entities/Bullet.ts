import * as THREE from 'three'
import { Entity } from './Entity'
import { DEPTH_LAYERS, SCENE } from '@/game/GameConfig'
import { attachFresnelRim } from '@/rendering/FresnelRim'

const C1_SAFE_BULLET_VISUALS = true
const PLAYER_BULLET_SAFE_GEO = new THREE.BoxGeometry(3.4, 12, 7)
const ENEMY_BULLET_SAFE_GEO = new THREE.BoxGeometry(6.2, 6.2, 8)
const PLAYER_BULLET_GEO = new THREE.CylinderGeometry(1.2, 1.2, 10, 8)
const PLAYER_BULLET_TRAIL_GEO = new THREE.CylinderGeometry(0.6, 1.4, 14, 8)
const ENEMY_BULLET_GEO = new THREE.SphereGeometry(3.5, 10, 8)
const ENEMY_BULLET_CORE_GEO = new THREE.SphereGeometry(2.2, 8, 6)

const playerBulletMat = new THREE.MeshStandardMaterial({
  color: 0x44ccff, roughness: 0.2, metalness: 0.45,
  emissive: 0x0088ff, emissiveIntensity: 2.2,
})
const playerBulletTrailMat = new THREE.MeshStandardMaterial({
  color: 0x88eeff, roughness: 0.15, metalness: 0.3,
  emissive: 0x44ccff, emissiveIntensity: 1.4,
  transparent: true, opacity: 0.55,
})

const enemyBulletMat = new THREE.MeshStandardMaterial({
  color: 0xff4422, roughness: 0.35, metalness: 0.4,
  emissive: 0xff2200, emissiveIntensity: 1.8,
})
const enemyBulletCoreMat = new THREE.MeshStandardMaterial({
  color: 0xffaa66, roughness: 0.15, metalness: 0.2,
  emissive: 0xff6622, emissiveIntensity: 2.6,
})

attachFresnelRim(playerBulletMat, { color: 0xa0e8ff, power: 2.5, intensity: 0.22 })
attachFresnelRim(enemyBulletMat, { color: 0xff6644, power: 2.0, intensity: 0.18 })

export class Bullet extends Entity {
  isPlayer: boolean
  damage:   number = 1
  grazed = false

  constructor(
    scene: THREE.Scene,
    x: number, y: number, z: number,
    vx: number, vy: number,
    isPlayer: boolean,
    damage: number = 1,
  ) {
    super()
    this.isPlayer = isPlayer
    this.damage   = damage
    this.position.set(x, y, z)
    this.velocity.set(vx, vy, 0)
    this.hitboxRadius = isPlayer ? 3 : 5

    this.mesh = buildBulletMesh(isPlayer)
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)

    const halfH = SCENE.HEIGHT / 2 + 20
    const halfW = SCENE.WIDTH  / 2 + 20
    if (this.position.y > halfH || this.position.y < -halfH ||
        this.position.x > halfW || this.position.x < -halfW) {
      this.destroy()
    }

    this.syncMesh()
  }
}

function buildBulletMesh(isPlayer: boolean): THREE.Object3D {
  if (C1_SAFE_BULLET_VISUALS) {
    const mesh = new THREE.Mesh(isPlayer ? PLAYER_BULLET_SAFE_GEO : ENEMY_BULLET_SAFE_GEO, isPlayer ? playerBulletMat : enemyBulletMat)
    mesh.frustumCulled = false
    return mesh
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
