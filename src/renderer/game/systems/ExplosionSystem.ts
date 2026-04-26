import * as THREE from 'three'
import { DEPTH_LAYERS } from '@/game/GameConfig'

const C1_SAFE_EXPLOSIONS = true

interface Particle {
  mesh: THREE.Mesh
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  rotSpeed: number
  drag: number
  scaleFrom: number
  scaleTo: number
  fadePower: number
}

const MAT_ORANGE = new THREE.MeshStandardMaterial({
  color: 0xffcb76,
  emissive: 0xff8a2d,
  emissiveIntensity: 2.3,
  roughness: 0.42,
  metalness: 0.42,
})

const MAT_RED = new THREE.MeshStandardMaterial({
  color: 0xff7242,
  emissive: 0xff2f1a,
  emissiveIntensity: 2.0,
  roughness: 0.5,
  metalness: 0.35,
})

const MAT_WHITE = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0xeef8ff,
  emissiveIntensity: 2.8,
  roughness: 0.2,
  metalness: 0.65,
})

const MAT_CYAN = new THREE.MeshStandardMaterial({
  color: 0x7fe2ff,
  emissive: 0x26b0ff,
  emissiveIntensity: 2.0,
  roughness: 0.26,
  metalness: 0.58,
})

const MAT_VIOLET = new THREE.MeshStandardMaterial({
  color: 0xc395ff,
  emissive: 0x7f53ff,
  emissiveIntensity: 1.8,
  roughness: 0.3,
  metalness: 0.55,
})

const SHARD_GEO = new THREE.IcosahedronGeometry(1.7, 0)
const CHUNK_GEO = new THREE.TetrahedronGeometry(2.1)
const SPARK_GEO = new THREE.SphereGeometry(1.2, 5, 4)
const SLIVER_GEO = new THREE.BoxGeometry(0.9, 3.2, 0.9)

export class ExplosionSystem {
  private particles: Particle[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawnEnemyHit(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 8, 72, 0.22, [MAT_WHITE, MAT_CYAN], 1.1, 2.2, [SPARK_GEO, SLIVER_GEO])
  }

  spawnEnemyKill(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 20, 118, 0.58, [MAT_ORANGE, MAT_RED, MAT_WHITE], 1.9, 7.2, [CHUNK_GEO, SHARD_GEO, SLIVER_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 6, 64, 0.3, [MAT_CYAN], 1.2, 2.5, [SPARK_GEO])
  }

  spawnSmall(x: number, y: number): void {
    this.spawnEnemyKill(x, y)
  }

  spawnMedium(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 28, 136, 0.8, [MAT_ORANGE, MAT_RED, MAT_WHITE], 2.3, 8.8, [CHUNK_GEO, SHARD_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 10, 80, 0.45, [MAT_CYAN, MAT_WHITE], 1.4, 4.4, [SPARK_GEO, SLIVER_GEO])
  }

  spawnBoss(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 66, 190, 1.7, [MAT_WHITE, MAT_ORANGE, MAT_RED], 3.5, 12, [CHUNK_GEO, SHARD_GEO, SLIVER_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 28, 128, 1.05, [MAT_CYAN, MAT_VIOLET, MAT_WHITE], 2.5, 9, [SPARK_GEO, SHARD_GEO])
  }

  spawnBossPhaseShift(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 34, 110, 0.9, [MAT_VIOLET, MAT_CYAN, MAT_WHITE], 2.6, 7, [SLIVER_GEO, SPARK_GEO])
  }

  spawnSpark(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 6, 70, 0.2, [MAT_WHITE, MAT_CYAN], 1.0, 2.8, [SPARK_GEO])
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.life -= dt
      if (p.life <= 0) {
        this.scene.remove(p.mesh)
        this.particles.splice(i, 1)
        continue
      }

      const friction = Math.max(0, 1 - p.drag * dt)
      p.vx *= friction
      p.vy *= friction
      p.vz *= Math.max(0, 1 - p.drag * 0.7 * dt)
      p.vy -= 24 * dt

      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
      p.mesh.rotation.x += p.rotSpeed * dt
      p.mesh.rotation.y += p.rotSpeed * dt * 0.6

      const t = Math.max(0, p.life / p.maxLife)
      const fade = Math.pow(t, p.fadePower)
      const scale = p.scaleTo + (p.scaleFrom - p.scaleTo) * fade
      p.mesh.scale.setScalar(scale)
    }
  }

  private emit(
    x: number,
    y: number,
    z: number,
    count: number,
    speed: number,
    life: number,
    mats: THREE.Material[],
    depthKick: number,
    spread: number,
    geometries: THREE.BufferGeometry[],
  ): void {
    const emitCount = C1_SAFE_EXPLOSIONS
      ? Math.max(3, Math.min(count, Math.ceil(count * 0.35)))
      : count
    const lifeMul = C1_SAFE_EXPLOSIONS ? 0.72 : 1

    for (let i = 0; i < emitCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const spd = speed * (0.35 + Math.random() * 0.75)
      const geo = geometries[Math.floor(Math.random() * geometries.length)]
      const mat = mats[Math.floor(Math.random() * mats.length)]
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread,
        z,
      )
      const scaleFrom = 0.45 + Math.random() * 1.2
      mesh.scale.setScalar(scaleFrom)
      this.scene.add(mesh)

      this.particles.push({
        mesh,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.42) * depthKick,
        life: life * lifeMul * (0.55 + Math.random() * 0.55),
        maxLife: life,
        rotSpeed: (Math.random() - 0.5) * 10,
        drag: 1.6 + Math.random() * 1.5,
        scaleFrom,
        scaleTo: 0.06 + Math.random() * 0.24,
        fadePower: 0.7 + Math.random() * 0.9,
      })
    }
  }

  dispose(): void {
    for (const p of this.particles) this.scene.remove(p.mesh)
    this.particles = []
  }
}
