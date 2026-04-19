import * as THREE from 'three'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange } from '@/utils/math'
import type { BiomeType } from '@shared/types'

const CHUNK_H = SCENE.HEIGHT * 1.2
const SCROLL_SPEED = 60

interface BiomeDef {
  groundColor: [number, number, number]
  edgeColor:   [number, number, number]
  heightScale: number
  bgColor:     number
}

const BIOMES: Record<string, BiomeDef> = {
  earth_plains:   { groundColor: [0.20, 0.45, 0.12], edgeColor: [0.35, 0.30, 0.15], heightScale: 3,  bgColor: 0x050510 },
  earth_desert:   { groundColor: [0.65, 0.50, 0.25], edgeColor: [0.50, 0.35, 0.15], heightScale: 8,  bgColor: 0x0a0805 },
  earth_ocean:    { groundColor: [0.05, 0.15, 0.40], edgeColor: [0.10, 0.25, 0.50], heightScale: 1,  bgColor: 0x020510 },
  earth_volcanic: { groundColor: [0.15, 0.05, 0.02], edgeColor: [0.50, 0.10, 0.02], heightScale: 12, bgColor: 0x0a0200 },
  earth_ruins:    { groundColor: [0.25, 0.22, 0.20], edgeColor: [0.35, 0.15, 0.10], heightScale: 5,  bgColor: 0x080605 },
  space_orbit:    { groundColor: [0.02, 0.03, 0.08], edgeColor: [0.05, 0.05, 0.12], heightScale: 0,  bgColor: 0x010108 },
  space_deep:     { groundColor: [0.03, 0.01, 0.08], edgeColor: [0.06, 0.02, 0.12], heightScale: 0,  bgColor: 0x020010 },
  space_asteroid: { groundColor: [0.15, 0.12, 0.08], edgeColor: [0.20, 0.15, 0.10], heightScale: 15, bgColor: 0x050403 },
  space_blackhole:{ groundColor: [0.02, 0.01, 0.01], edgeColor: [0.15, 0.05, 0.00], heightScale: 0,  bgColor: 0x000000 },
  space_final:    { groundColor: [0.05, 0.02, 0.10], edgeColor: [0.10, 0.05, 0.15], heightScale: 2,  bgColor: 0x030008 },
}

const BIOME_SEQUENCE: BiomeType[] = [
  'earth_plains', 'earth_desert', 'earth_ocean', 'earth_volcanic', 'earth_ruins',
  'space_orbit', 'space_deep', 'space_asteroid', 'space_blackhole', 'space_final',
]

export class ScrollMap {
  scrollY       = 0
  totalDistance  = 0
  currentBiome: BiomeType = 'earth_plains'

  private distancePaused = false
  private chunks:     TerrainChunk[] = []
  private decorations:THREE.Object3D[] = []
  private scene:      THREE.Scene
  private bgColor:    THREE.Color

  constructor(scene: THREE.Scene) {
    this.scene   = scene
    this.bgColor = new THREE.Color(BIOMES.earth_plains.bgColor)
    this.spawnChunk(0)
    this.spawnChunk(CHUNK_H)
  }

  pauseDistance(paused: boolean): void { this.distancePaused = paused }

  update(dt: number): void {
    this.scrollY += SCROLL_SPEED * dt
    if (!this.distancePaused) this.totalDistance += SCROLL_SPEED * dt

    for (const chunk of this.chunks) {
      chunk.mesh.position.y -= SCROLL_SPEED * dt
      if (chunk.mesh.position.y < -CHUNK_H) {
        const topChunk = this.chunks.reduce((a, b) => a.mesh.position.y > b.mesh.position.y ? a : b)
        chunk.mesh.position.y = topChunk.mesh.position.y + CHUNK_H
        chunk.rebuild(this.currentBiome)
      }
    }

    // Move decorations
    for (let i = this.decorations.length - 1; i >= 0; i--) {
      const d = this.decorations[i]
      d.position.y -= SCROLL_SPEED * dt
      if (d.position.y < -SCENE.HEIGHT / 2 - 50) {
        this.scene.remove(d)
        this.decorations.splice(i, 1)
      }
    }

    // Spawn decorations occasionally
    if (Math.random() < dt * 0.8) this.spawnDecoration()
  }

  setBiome(index: number): void {
    this.currentBiome = BIOME_SEQUENCE[Math.min(index, BIOME_SEQUENCE.length - 1)]
    const def = BIOMES[this.currentBiome] ?? BIOMES.earth_plains
    this.bgColor.set(def.bgColor)
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(this.bgColor)
    }
  }

  private spawnChunk(y: number): void {
    const chunk = new TerrainChunk(this.scene, y, this.currentBiome)
    this.chunks.push(chunk)
  }

  private spawnDecoration(): void {
    const x = randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2)
    const y = SCENE.HEIGHT / 2 + 30
    const biome = this.currentBiome
    const obj = buildDecoration(biome)
    if (!obj) return
    obj.position.set(x, y, DEPTH_LAYERS.TERRAIN + randomRange(-1, 1))
    this.scene.add(obj)
    this.decorations.push(obj)
  }

  dispose(): void {
    for (const c of this.chunks) c.dispose(this.scene)
    for (const d of this.decorations) this.scene.remove(d)
    this.chunks = []
    this.decorations = []
  }
}

class TerrainChunk {
  mesh: THREE.Mesh
  private geo: THREE.PlaneGeometry
  private mat: THREE.MeshPhongMaterial

  constructor(scene: THREE.Scene, y: number, biome: BiomeType) {
    this.geo = new THREE.PlaneGeometry(SCENE.WIDTH, CHUNK_H, 20, 20)
    this.mat = new THREE.MeshPhongMaterial({ vertexColors: true, specular: 0x111111, shininess: 5 })
    this.applyBiome(biome)
    this.mesh = new THREE.Mesh(this.geo, this.mat)
    this.mesh.position.set(0, y, DEPTH_LAYERS.BACKGROUND)
    scene.add(this.mesh)
  }

  rebuild(biome: BiomeType): void {
    this.applyBiome(biome)
  }

  private applyBiome(biome: BiomeType): void {
    const def = BIOMES[biome] ?? BIOMES.earth_plains
    const pos   = this.geo.attributes.position as THREE.BufferAttribute
    const count = pos.count
    const colors = new Float32Array(count * 3)
    const seed = Math.random() * 1000

    for (let i = 0; i < count; i++) {
      const x = pos.getX(i), y = pos.getY(i)
      const h = Math.sin(x * 0.05 + seed) * Math.cos(y * 0.04 + seed) * def.heightScale
      pos.setZ(i, h)

      const t = Math.abs(x) / (SCENE.WIDTH / 2)
      colors[i * 3 + 0] = def.groundColor[0] * (1 - t) + def.edgeColor[0] * t
      colors[i * 3 + 1] = def.groundColor[1] * (1 - t) + def.edgeColor[1] * t
      colors[i * 3 + 2] = def.groundColor[2] * (1 - t) + def.edgeColor[2] * t
    }

    pos.needsUpdate = true
    this.geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    this.geo.computeVertexNormals()
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh)
    this.geo.dispose()
    this.mat.dispose()
  }
}

function buildDecoration(biome: BiomeType): THREE.Object3D | null {
  const mat = (c: number, e = 0) => new THREE.MeshPhongMaterial({ color: c, emissive: e, emissiveIntensity: e ? 0.5 : 0 })

  switch (biome) {
    case 'earth_plains': {
      const g = new THREE.Group()
      // Simple house
      g.add(new THREE.Mesh(new THREE.BoxGeometry(8, 8, 10), mat(0x887766)))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(7, 6, 4), mat(0xaa4422)).translateZ(8))
      return g
    }
    case 'earth_desert': {
      // Pyramid
      return new THREE.Mesh(new THREE.ConeGeometry(12, 18, 4), mat(0xccaa66))
    }
    case 'earth_ocean': {
      // Small island
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(8, 12, 4, 8), mat(0x44aa44)))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(3, 12, 5), mat(0x228822)).translateZ(6))
      return g
    }
    case 'earth_volcanic': {
      // Lava crack (emissive)
      return new THREE.Mesh(new THREE.BoxGeometry(randomRange(3, 8), randomRange(20, 50), 2), mat(0xff4400, 0xff2200))
    }
    case 'earth_ruins': {
      const g = new THREE.Group()
      const h = randomRange(8, 20)
      g.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, h), mat(0x666655)))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(6, 6, 4), mat(0x555544)).translateZ(h / 2).translateX(3))
      return g
    }
    case 'space_orbit': {
      // Space station debris
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.BoxGeometry(15, 6, 6), mat(0x888899, 0x334455)))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(30, 2, 8), mat(0x4466aa, 0x223366)))
      return g
    }
    case 'space_deep': {
      // Nebula cloud (emissive sphere)
      const size = randomRange(10, 30)
      const m = mat(0x6633aa, 0x4422aa)
      m.transparent = true; m.opacity = 0.3
      return new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), m)
    }
    case 'space_asteroid': {
      // Rotating asteroid
      const geo = new THREE.IcosahedronGeometry(randomRange(6, 18), 0)
      const pos = geo.attributes.position as THREE.BufferAttribute
      for (let i = 0; i < pos.count; i++) {
        pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 4)
        pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 4)
        pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 4)
      }
      geo.computeVertexNormals()
      return new THREE.Mesh(geo, mat(0x887766))
    }
    case 'space_blackhole': {
      // Accretion disk ring
      const m = mat(0xff6600, 0xff4400)
      m.transparent = true; m.opacity = 0.5
      const ring = new THREE.Mesh(new THREE.TorusGeometry(randomRange(15, 40), 2, 8, 24), m)
      ring.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.3
      return ring
    }
    case 'space_final': {
      // Energy vortex
      const m = mat(0xff00ff, 0xaa00ff)
      m.transparent = true; m.opacity = 0.4
      return new THREE.Mesh(new THREE.TorusGeometry(randomRange(8, 20), randomRange(2, 5), 6, 16), m)
    }
    default: return null
  }
}
