/**
 * 爆炸粒子系统 — 利用 C1 景深实现碎片弹出效果
 */

import * as THREE from 'three'
import { DEPTH_LAYERS } from '@/game/GameConfig'

interface Particle {
  mesh:     THREE.Mesh
  vx: number; vy: number; vz: number
  life:     number
  maxLife:  number
  rotSpeed: number
}

const PARTICLE_MAT_YELLOW = new THREE.MeshPhongMaterial({ color: 0xffcc00, emissive: 0xff8800, emissiveIntensity: 2 })
const PARTICLE_MAT_RED    = new THREE.MeshPhongMaterial({ color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 2 })
const PARTICLE_MAT_WHITE  = new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3 })
const PARTICLE_MAT_BLUE   = new THREE.MeshPhongMaterial({ color: 0x44aaff, emissive: 0x0066ff, emissiveIntensity: 2 })

const SHARD_GEO = new THREE.TetrahedronGeometry(2)
const SPARK_GEO = new THREE.SphereGeometry(1.5, 4, 3)

export class ExplosionSystem {
  private particles: Particle[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) { this.scene = scene }

  /** Small explosion (enemy death) */
  spawnSmall(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 8, 80, 0.4, [PARTICLE_MAT_YELLOW, PARTICLE_MAT_RED])
  }

  /** Medium explosion (medium enemy) */
  spawnMedium(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 20, 120, 0.7, [PARTICLE_MAT_YELLOW, PARTICLE_MAT_RED, PARTICLE_MAT_WHITE])
  }

  /** Boss explosion — large, with C1 depth shards flying toward viewer */
  spawnBoss(x: number, y: number): void {
    // Main burst
    this.emit(x, y, DEPTH_LAYERS.BULLET, 50, 160, 1.5, [PARTICLE_MAT_WHITE, PARTICLE_MAT_YELLOW, PARTICLE_MAT_RED])
    // Depth shards — fly toward camera (positive Z = toward viewer on C1)
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 40 + Math.random() * 80
      const mesh = new THREE.Mesh(SHARD_GEO, [PARTICLE_MAT_YELLOW, PARTICLE_MAT_RED, PARTICLE_MAT_WHITE][Math.floor(Math.random() * 3)])
      mesh.position.set(x, y, DEPTH_LAYERS.BULLET)
      mesh.scale.setScalar(1 + Math.random() * 2)
      this.scene.add(mesh)
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        vz: 2 + Math.random() * 4,   // fly toward viewer
        life: 1.5 + Math.random(),
        maxLife: 2.5,
        rotSpeed: (Math.random() - 0.5) * 10,
      })
    }
  }

  /** Hit spark */
  spawnSpark(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 4, 60, 0.15, [PARTICLE_MAT_WHITE, PARTICLE_MAT_BLUE])
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
      p.mesh.position.x += p.vx * dt
      p.mesh.position.y += p.vy * dt
      p.mesh.position.z += p.vz * dt
      p.mesh.rotation.x += p.rotSpeed * dt
      p.mesh.rotation.y += p.rotSpeed * dt * 0.7
      // Fade out
      const alpha = p.life / p.maxLife
      p.mesh.scale.setScalar(alpha * 1.5)
    }
  }

  private emit(x: number, y: number, z: number, count: number, speed: number, life: number, mats: THREE.Material[]): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const spd = speed * (0.3 + Math.random() * 0.7)
      const geo = Math.random() > 0.5 ? SHARD_GEO : SPARK_GEO
      const mat = mats[Math.floor(Math.random() * mats.length)]
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, z)
      mesh.scale.setScalar(0.5 + Math.random())
      this.scene.add(mesh)
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.3) * 2,
        life: life * (0.5 + Math.random() * 0.5),
        maxLife: life,
        rotSpeed: (Math.random() - 0.5) * 8,
      })
    }
  }

  dispose(): void {
    for (const p of this.particles) this.scene.remove(p.mesh)
    this.particles = []
  }
}
