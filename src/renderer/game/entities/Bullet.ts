import * as THREE from 'three'
import { Entity } from './Entity'
import { DEPTH_LAYERS, SCENE } from '@/game/GameConfig'

export class Bullet extends Entity {
  isPlayer: boolean
  damage:   number = 1

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

    // Despawn off-screen
    const halfH = SCENE.HEIGHT / 2 + 20
    const halfW = SCENE.WIDTH  / 2 + 20
    if (this.position.y > halfH || this.position.y < -halfH ||
        this.position.x > halfW || this.position.x < -halfW) {
      this.destroy()
    }

    this.syncMesh()
  }
}

function buildBulletMesh(isPlayer: boolean): THREE.Mesh {
  if (isPlayer) {
    const geo = new THREE.CylinderGeometry(1.5, 1.5, 10, 6)
    const mat = new THREE.MeshPhongMaterial({
      color: 0x44ccff, emissive: 0x0088ff, emissiveIntensity: 2,
    })
    return new THREE.Mesh(geo, mat)
  } else {
    const geo = new THREE.SphereGeometry(4, 8, 6)
    const mat = new THREE.MeshPhongMaterial({
      color: 0xff4422, emissive: 0xff2200, emissiveIntensity: 1.5,
    })
    return new THREE.Mesh(geo, mat)
  }
}
