import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'

export type PowerUpType =
  | 'weapon_upgrade' | 'weapon_shot' | 'weapon_spread' | 'weapon_laser'
  | 'extra_life' | 'bomb' | 'gem_small' | 'gem_large'

const COLORS: Record<PowerUpType, number> = {
  weapon_upgrade: 0xffaa00,
  weapon_shot:    0x4488ff,
  weapon_spread:  0x44ff44,
  weapon_laser:   0xff44ff,
  extra_life:     0xffdd00,
  bomb:           0xff8800,
  gem_small:      0x44ff88,
  gem_large:      0xffcc00,
}

const SCORE_VALUES: Record<PowerUpType, number> = {
  weapon_upgrade: 200, weapon_shot: 200, weapon_spread: 200, weapon_laser: 200,
  extra_life: 500, bomb: 300, gem_small: 100, gem_large: 500,
}

export class PowerUp extends Entity {
  type:       PowerUpType
  scoreValue: number
  hitboxRadius = 14

  constructor(scene: THREE.Scene, type: PowerUpType, x: number, y: number) {
    super()
    this.type       = type
    this.scoreValue = SCORE_VALUES[type]
    this.position.set(x, y, DEPTH_LAYERS.BULLET)
    this.velocity.set(0, -40, 0)

    this.mesh = buildPowerUpMesh(type)
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  update(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)
    if (this.mesh) {
      this.mesh.rotation.y += dt * 3
      this.mesh.rotation.z += dt * 1.5
    }
    if (this.position.y < -SCENE.HEIGHT / 2 - 20) this.destroy()
    this.syncMesh()
  }
}

function buildPowerUpMesh(type: PowerUpType): THREE.Mesh {
  const color = COLORS[type]
  if (type === 'extra_life') {
    const geo = new THREE.OctahedronGeometry(7)
    return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.8 }))
  }
  if (type === 'gem_small' || type === 'gem_large') {
    const size = type === 'gem_large' ? 8 : 5
    const geo = new THREE.OctahedronGeometry(size)
    return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 1.0, transparent: true, opacity: 0.85 }))
  }
  // Default capsule shape for weapon items
  const geo = new THREE.CapsuleGeometry(5, 8, 4, 8)
  return new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.6 }))
}
