import * as THREE from 'three'
import { SCENE, DEPTH_LAYERS, TERRAIN_VISUAL_CONFIG, type TerrainVisualProfile } from '@/game/GameConfig'
import { randomRange } from '@/utils/math'
import type { BiomeType } from '@shared/types'

const CHUNK_H = SCENE.HEIGHT * 1.24
const SCROLL_SPEED = 60
const TERRAIN_WIDTH = SCENE.WIDTH * 1.42
const TERRAIN_SEG_X = 40
const TERRAIN_SEG_Y = 56
const RAIL_COUNT_PER_SIDE = 4
const STABLE_3D_BASELINE = true
const STABLE_TERRAIN_DEPTH_SCALE = 0.18

const BIOME_SEQUENCE: BiomeType[] = [
  'earth_plains', 'earth_desert', 'earth_ocean', 'earth_volcanic', 'earth_ruins',
  'space_orbit', 'space_deep', 'space_asteroid', 'space_blackhole', 'space_final',
]

interface TerrainShapeDef {
  relief: number
  ridge: number
  waveA: number
  waveB: number
  laneFreq: number
  laneWidth: number
  c1DepthAmp: number
  c1RailGlow: number
  skyDrift: number
}

const TERRAIN_SHAPES: Record<BiomeType, TerrainShapeDef> = {
  earth_plains: {
    relief: 4.4,
    ridge: 0.48,
    waveA: 0.06,
    waveB: 0.075,
    laneFreq: 5.6,
    laneWidth: 0.13,
    c1DepthAmp: 0.28,
    c1RailGlow: 0.85,
    skyDrift: 0.2,
  },
  earth_desert: {
    relief: 8.8,
    ridge: 0.62,
    waveA: 0.075,
    waveB: 0.085,
    laneFreq: 6.5,
    laneWidth: 0.16,
    c1DepthAmp: 0.44,
    c1RailGlow: 0.95,
    skyDrift: 0.26,
  },
  earth_ocean: {
    relief: 2.8,
    ridge: 0.26,
    waveA: 0.045,
    waveB: 0.06,
    laneFreq: 4.3,
    laneWidth: 0.19,
    c1DepthAmp: 0.3,
    c1RailGlow: 0.76,
    skyDrift: 0.22,
  },
  earth_volcanic: {
    relief: 12.5,
    ridge: 0.72,
    waveA: 0.09,
    waveB: 0.11,
    laneFreq: 7.5,
    laneWidth: 0.12,
    c1DepthAmp: 0.56,
    c1RailGlow: 1.15,
    skyDrift: 0.3,
  },
  earth_ruins: {
    relief: 6.2,
    ridge: 0.58,
    waveA: 0.07,
    waveB: 0.08,
    laneFreq: 5.2,
    laneWidth: 0.15,
    c1DepthAmp: 0.4,
    c1RailGlow: 0.92,
    skyDrift: 0.25,
  },
  space_orbit: {
    relief: 3.2,
    ridge: 0.28,
    waveA: 0.052,
    waveB: 0.066,
    laneFreq: 4.9,
    laneWidth: 0.18,
    c1DepthAmp: 0.36,
    c1RailGlow: 0.9,
    skyDrift: 0.34,
  },
  space_deep: {
    relief: 2.6,
    ridge: 0.2,
    waveA: 0.04,
    waveB: 0.055,
    laneFreq: 4.1,
    laneWidth: 0.21,
    c1DepthAmp: 0.34,
    c1RailGlow: 0.98,
    skyDrift: 0.4,
  },
  space_asteroid: {
    relief: 11.8,
    ridge: 0.68,
    waveA: 0.083,
    waveB: 0.105,
    laneFreq: 6.4,
    laneWidth: 0.14,
    c1DepthAmp: 0.54,
    c1RailGlow: 1.05,
    skyDrift: 0.36,
  },
  space_blackhole: {
    relief: 6.5,
    ridge: 0.84,
    waveA: 0.096,
    waveB: 0.13,
    laneFreq: 8.8,
    laneWidth: 0.11,
    c1DepthAmp: 0.7,
    c1RailGlow: 1.32,
    skyDrift: 0.46,
  },
  space_final: {
    relief: 8.1,
    ridge: 0.75,
    waveA: 0.084,
    waveB: 0.105,
    laneFreq: 7.1,
    laneWidth: 0.12,
    c1DepthAmp: 0.64,
    c1RailGlow: 1.22,
    skyDrift: 0.42,
  },
}

interface TerrainData {
  heights: Float32Array
  colors: Float32Array
  accentColors: Float32Array
}

interface RuntimeProfile {
  main: THREE.Color
  far: THREE.Color
  near: THREE.Color
  contrast: number
  fogDensity: number
  emissiveRatio: number
  climate: TerrainVisualProfile['climate']
}

interface MovingDecor {
  object: THREE.Object3D
  speedMul: number
  spin: number
  wobble: number
  baseX: number
  baseZ: number
  phase: number
}

interface DepthRail {
  mesh: THREE.Mesh
  speedMul: number
  side: -1 | 1
  phase: number
}

interface BiomeTransition {
  from: BiomeType
  to: BiomeType
  time: number
  duration: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

function fract(v: number): number {
  return v - Math.floor(v)
}

function colorFromHex(hex: number): THREE.Color {
  return new THREE.Color(hex)
}

function mixColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    lerp(a.r, b.r, t),
    lerp(a.g, b.g, t),
    lerp(a.b, b.b, t),
  )
}

function buildRuntimeProfile(biome: BiomeType): RuntimeProfile {
  const c = TERRAIN_VISUAL_CONFIG[biome]
  return {
    main: colorFromHex(c.mainColor),
    far: colorFromHex(c.farColor),
    near: colorFromHex(c.nearColor),
    contrast: c.contrast,
    fogDensity: c.fogDensity,
    emissiveRatio: c.emissiveRatio,
    climate: c.climate,
  }
}

function mixRuntimeProfile(a: RuntimeProfile, b: RuntimeProfile, t: number): RuntimeProfile {
  return {
    main: mixColor(a.main, b.main, t),
    far: mixColor(a.far, b.far, t),
    near: mixColor(a.near, b.near, t),
    contrast: lerp(a.contrast, b.contrast, t),
    fogDensity: lerp(a.fogDensity, b.fogDensity, t),
    emissiveRatio: lerp(a.emissiveRatio, b.emissiveRatio, t),
    climate: t < 0.5 ? a.climate : b.climate,
  }
}

function mixShape(a: TerrainShapeDef, b: TerrainShapeDef, t: number): TerrainShapeDef {
  return {
    relief: lerp(a.relief, b.relief, t),
    ridge: lerp(a.ridge, b.ridge, t),
    waveA: lerp(a.waveA, b.waveA, t),
    waveB: lerp(a.waveB, b.waveB, t),
    laneFreq: lerp(a.laneFreq, b.laneFreq, t),
    laneWidth: lerp(a.laneWidth, b.laneWidth, t),
    c1DepthAmp: lerp(a.c1DepthAmp, b.c1DepthAmp, t),
    c1RailGlow: lerp(a.c1RailGlow, b.c1RailGlow, t),
    skyDrift: lerp(a.skyDrift, b.skyDrift, t),
  }
}

// 当前相机在 z=300 的俯视距离下，配置表 fogDensity 需要缩放后再使用
function toSceneFogDensity(configDensity: number): number {
  return Math.max(0, configDensity * 0.02)
}

function hashNoise(x: number, y: number, seed: number): number {
  return fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123)
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = x - ix
  const fy = y - iy

  const v00 = hashNoise(ix, iy, seed)
  const v10 = hashNoise(ix + 1, iy, seed)
  const v01 = hashNoise(ix, iy + 1, seed)
  const v11 = hashNoise(ix + 1, iy + 1, seed)

  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const x0 = lerp(v00, v10, ux)
  const x1 = lerp(v01, v11, ux)
  return lerp(x0, x1, uy) * 2 - 1
}

function fbm(x: number, y: number, seed: number): number {
  let amp = 0.5
  let freq = 1
  let sum = 0
  let norm = 0
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x * freq, y * freq, seed + i * 19.37) * amp
    norm += amp
    amp *= 0.5
    freq *= 2.03
  }
  return norm > 0 ? sum / norm : 0
}

export class ScrollMap {
  scrollY = 0
  totalDistance = 0
  currentBiome: BiomeType = 'earth_plains'

  private distancePaused = false
  private chunks: TerrainChunk[] = []
  private farDecor: MovingDecor[] = []
  private midDecor: MovingDecor[] = []
  private nearDecor: MovingDecor[] = []
  private climateDecor: MovingDecor[] = []
  private depthRails: DepthRail[] = []
  private scene: THREE.Scene
  private bgColor = colorFromHex(TERRAIN_VISUAL_CONFIG.earth_plains.mainColor)
  private transition: BiomeTransition | null = null
  private sceneTime = 0
  private activeProfile: RuntimeProfile = buildRuntimeProfile('earth_plains')
  private activeShape: TerrainShapeDef = { ...TERRAIN_SHAPES.earth_plains }

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.scene.background = this.bgColor.clone()
    this.scene.fog = new THREE.FogExp2(
      this.bgColor.getHex(),
      toSceneFogDensity(TERRAIN_VISUAL_CONFIG.earth_plains.fogDensity),
    )

    this.spawnChunk(-CHUNK_H)
    this.spawnChunk(0)
    this.spawnChunk(CHUNK_H)
    if (!STABLE_3D_BASELINE) {
      this.seedFarBackdrop(this.currentBiome)
      this.createDepthRails()
    }
    this.applySceneProfile(this.activeProfile)
  }

  pauseDistance(paused: boolean): void {
    this.distancePaused = paused
  }

  update(dt: number): void {
    this.sceneTime += dt
    this.scrollY += SCROLL_SPEED * dt
    if (!this.distancePaused) this.totalDistance += SCROLL_SPEED * dt

    const transitionSnapshot = this.transition
    const transitionBlend = this.updateBiomeTransition(dt)

    for (const chunk of this.chunks) {
      chunk.root.position.y -= SCROLL_SPEED * dt
      if (transitionSnapshot) chunk.updateTransition(transitionBlend)
      chunk.setMaterialProfile(this.activeProfile)
      chunk.animate(this.sceneTime, this.activeShape)

      if (chunk.root.position.y < -CHUNK_H * 1.5) {
        const top = this.getTopChunkY()
        chunk.root.position.y = top + CHUNK_H
        if (transitionSnapshot) {
          chunk.rebuild(transitionSnapshot.from)
          chunk.startTransition(transitionSnapshot.from, transitionSnapshot.to)
          chunk.updateTransition(transitionBlend)
        } else {
          chunk.rebuild(this.currentBiome)
        }
      }
    }

    if (!STABLE_3D_BASELINE) {
      this.updateDepthRails(dt)
      this.updateDecorList(this.farDecor, dt)
      this.updateDecorList(this.midDecor, dt)
      this.updateDecorList(this.nearDecor, dt)
      this.updateDecorList(this.climateDecor, dt)
      this.spawnDecorByProfile(dt)
    }
  }

  setBiome(index: number): void {
    this.transitionToBiome(index, 0)
  }

  transitionToBiome(index: number, durationSec = 3): void {
    const to = BIOME_SEQUENCE[Math.min(index, BIOME_SEQUENCE.length - 1)]
    if (to === this.currentBiome) return

    if (durationSec <= 0.01) {
      this.currentBiome = to
      this.transition = null
      this.activeProfile = buildRuntimeProfile(to)
      this.activeShape = { ...TERRAIN_SHAPES[to] }
      this.applySceneProfile(this.activeProfile)
      for (const chunk of this.chunks) {
        chunk.rebuild(this.currentBiome)
        chunk.setMaterialProfile(this.activeProfile)
      }
      if (!STABLE_3D_BASELINE) this.seedFarBackdrop(this.currentBiome)
      return
    }

    const from = this.currentBiome
    this.transition = { from, to, time: 0, duration: durationSec }
    for (const chunk of this.chunks) chunk.startTransition(from, to)
  }

  dispose(): void {
    for (const chunk of this.chunks) chunk.dispose(this.scene)
    this.clearDecorList(this.farDecor)
    this.clearDecorList(this.midDecor)
    this.clearDecorList(this.nearDecor)
    this.clearDecorList(this.climateDecor)

    for (const rail of this.depthRails) {
      rail.mesh.traverse((c) => {
        if (!(c instanceof THREE.Mesh)) return
        c.geometry?.dispose()
        const mat = c.material as THREE.Material
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
        else mat?.dispose()
      })
      this.scene.remove(rail.mesh)
    }
    this.depthRails = []
    this.chunks = []
  }

  private spawnChunk(y: number): void {
    const chunk = new TerrainChunk(this.scene, y, this.currentBiome, this.activeProfile)
    this.chunks.push(chunk)
  }

  private getTopChunkY(): number {
    let top = -Infinity
    for (const chunk of this.chunks) {
      if (chunk.root.position.y > top) top = chunk.root.position.y
    }
    return top
  }

  private applySceneProfile(profile: RuntimeProfile): void {
    this.bgColor.copy(profile.main)
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(this.bgColor)
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(profile.main)
      this.scene.fog.density = toSceneFogDensity(profile.fogDensity)
    }
  }

  private updateBiomeTransition(dt: number): number {
    if (!this.transition) return 1

    this.transition.time += dt
    const t = Math.min(1, this.transition.time / this.transition.duration)
    const fromProfile = buildRuntimeProfile(this.transition.from)
    const toProfile = buildRuntimeProfile(this.transition.to)
    this.activeProfile = mixRuntimeProfile(fromProfile, toProfile, t)
    this.activeShape = mixShape(TERRAIN_SHAPES[this.transition.from], TERRAIN_SHAPES[this.transition.to], t)
    this.applySceneProfile(this.activeProfile)

    if (t >= 1) {
      this.currentBiome = this.transition.to
      this.transition = null
      this.activeProfile = buildRuntimeProfile(this.currentBiome)
      this.activeShape = { ...TERRAIN_SHAPES[this.currentBiome] }
      if (!STABLE_3D_BASELINE) this.seedFarBackdrop(this.currentBiome)
    }

    return t
  }

  private clearDecorList(list: MovingDecor[]): void {
    for (const item of list) this.disposeObject(item.object)
    list.length = 0
  }

  private disposeObject(object: THREE.Object3D): void {
    this.scene.remove(object)
    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Points)) return
      child.geometry?.dispose()
      const material = child.material
      if (Array.isArray(material)) {
        for (const mat of material) mat.dispose()
      } else {
        material?.dispose()
      }
    })
  }

  private createDepthRails(): void {
    for (const side of [-1, 1] as const) {
      for (let i = 0; i < RAIL_COUNT_PER_SIDE; i++) {
        const railLen = randomRange(70, 110)
        const thickness = randomRange(0.25, 0.55)
        // 3D box rail — casts depth shadow for C1 stereo reading
        const geo = new THREE.BoxGeometry(thickness, railLen, randomRange(1.4, 2.8))
        const mat = new THREE.MeshStandardMaterial({
          color: this.activeProfile.near,
          roughness: 0.35,
          metalness: 0.72,
          emissive: this.activeProfile.main,
          emissiveIntensity: 0.45,
          transparent: true,
          opacity: 0.72,
          depthWrite: true,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(
          side * (SCENE.WIDTH * 0.42 + randomRange(-5, 4)),
          -SCENE.HEIGHT / 2 + (i / RAIL_COUNT_PER_SIDE) * (CHUNK_H + 70),
          DEPTH_LAYERS.TERRAIN + 0.32,
        )
        mesh.castShadow = false; mesh.receiveShadow = false
        this.scene.add(mesh)

        // Glow overlay strip — additive blended for bloom-like effect
        const glowGeo = new THREE.BoxGeometry(thickness + 0.7, railLen, randomRange(3.2, 5.8))
        const glowMat = new THREE.MeshBasicMaterial({
          color: this.activeProfile.near,
          transparent: true,
          opacity: 0.18,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const glowMesh = new THREE.Mesh(glowGeo, glowMat)
        mesh.add(glowMesh)

        this.depthRails.push({
          mesh,
          side,
          speedMul: randomRange(1.22, 1.64),
          phase: randomRange(0, Math.PI * 2),
        })
      }
    }
  }

  private updateDepthRails(dt: number): void {
    for (const rail of this.depthRails) {
      rail.mesh.position.y -= SCROLL_SPEED * rail.speedMul * dt
      if (rail.mesh.position.y < -SCENE.HEIGHT / 2 - 95) {
        rail.mesh.position.y += CHUNK_H + 190
      }

      const pulse = 0.5 + Math.sin(this.sceneTime * 2.5 + rail.phase) * 0.5
      const railMat = (rail.mesh as THREE.Mesh).material as THREE.MeshStandardMaterial
      rail.mesh.position.z = DEPTH_LAYERS.TERRAIN + 0.24 + pulse * this.activeShape.c1DepthAmp * 0.7
      rail.mesh.rotation.z = Math.sin(this.sceneTime * 1.3 + rail.phase) * 0.06 * this.activeShape.c1DepthAmp
      railMat.emissiveIntensity = 0.35 + pulse * (0.25 + this.activeProfile.emissiveRatio * 0.4)
      railMat.opacity = (0.62 + pulse * 0.28) * this.activeShape.c1RailGlow
      railMat.color.copy(mixColor(this.activeProfile.main, this.activeProfile.near, 0.6 + pulse * 0.28))

      // Update glow child
      const glowChild = rail.mesh.children[0] as THREE.Mesh | undefined
      if (glowChild) {
        const gMat = glowChild.material as THREE.MeshBasicMaterial
        gMat.opacity = (0.13 + pulse * 0.14 + this.activeProfile.emissiveRatio * 0.12) * this.activeShape.c1RailGlow
        gMat.color.copy(mixColor(this.activeProfile.main, this.activeProfile.near, 0.55 + pulse * 0.32))
      }
    }
  }

  private updateDecorList(list: MovingDecor[], dt: number): void {
    for (let i = list.length - 1; i >= 0; i--) {
      const item = list[i]
      item.object.position.y -= SCROLL_SPEED * item.speedMul * dt
      item.object.position.x = item.baseX + Math.sin(this.sceneTime * 1.6 + item.phase) * item.wobble
      item.object.position.z = item.baseZ + Math.sin(this.sceneTime * 2.1 + item.phase) * 0.18

      if (item.spin !== 0) {
        item.object.rotation.z += item.spin * dt
        item.object.rotation.y += item.spin * 0.45 * dt
      }

      if (item.object.position.y < -SCENE.HEIGHT / 2 - 110) {
        this.disposeObject(item.object)
        list.splice(i, 1)
      }
    }
  }

  private pushDecor(
    list: MovingDecor[],
    object: THREE.Object3D,
    speedMul: number,
    spin: number,
    wobble: number,
  ): void {
    this.scene.add(object)
    list.push({
      object,
      speedMul,
      spin,
      wobble,
      baseX: object.position.x,
      baseZ: object.position.z,
      phase: randomRange(0, Math.PI * 2),
    })
  }

  private spawnDecorByProfile(dt: number): void {
    const midRate = 0.96
    const nearRate = 0.72
    const climateRate = this.activeProfile.climate === 'none'
      ? 0.2
      : this.activeProfile.climate === 'warp'
        ? 1.15
        : 0.8

    if (Math.random() < dt * midRate) this.spawnMidDecoration()
    if (Math.random() < dt * nearRate) this.spawnNearFlyby()
    if (Math.random() < dt * climateRate) this.spawnClimate()
  }

  private seedFarBackdrop(biome: BiomeType): void {
    this.clearDecorList(this.farDecor)
    const profile = buildRuntimeProfile(biome)
    const shape = TERRAIN_SHAPES[biome]

    for (let i = 0; i < 7; i++) {
      const width = randomRange(90, 230)
      const height = randomRange(18, 62)
      const blend = randomRange(0.15, 0.8)
      const mat = new THREE.MeshBasicMaterial({
        color: mixColor(profile.far, profile.main, blend),
        transparent: true,
        opacity: randomRange(0.12, 0.34),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      const haze = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat)
      haze.position.set(
        randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2),
        randomRange(-SCENE.HEIGHT / 2, SCENE.HEIGHT / 2),
        DEPTH_LAYERS.BACKGROUND - randomRange(2.2, 4.8),
      )
      haze.rotation.z = randomRange(-0.35, 0.35)
      this.pushDecor(this.farDecor, haze, shape.skyDrift + randomRange(0.06, 0.22), randomRange(-0.05, 0.05), randomRange(2, 7))
    }

    if (biome.startsWith('space_')) {
      for (let i = 0; i < 24; i++) {
        const starMat = new THREE.MeshBasicMaterial({
          color: mixColor(profile.near, new THREE.Color(0xffffff), randomRange(0.4, 0.9)),
          transparent: true,
          opacity: randomRange(0.2, 0.45),
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
        const star = new THREE.Mesh(new THREE.PlaneGeometry(randomRange(0.8, 2.2), randomRange(2.8, 6.5)), starMat)
        star.position.set(
          randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2),
          randomRange(-SCENE.HEIGHT / 2, SCENE.HEIGHT / 2),
          DEPTH_LAYERS.BACKGROUND - randomRange(2.8, 5.6),
        )
        star.rotation.z = randomRange(0, Math.PI * 2)
        this.pushDecor(this.farDecor, star, shape.skyDrift + randomRange(0.14, 0.3), randomRange(-0.1, 0.1), randomRange(1.5, 6))
      }
    }
  }

  private spawnMidDecoration(): void {
    const obj = buildMidDecoration(this.currentBiome, this.activeProfile)
    if (!obj) return
    obj.position.set(
      randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2),
      SCENE.HEIGHT / 2 + 40,
      DEPTH_LAYERS.TERRAIN + randomRange(-0.8, 0.1),
    )
    this.pushDecor(this.midDecor, obj, randomRange(0.86, 1.16), randomRange(-0.45, 0.45), randomRange(1.6, 7))
  }

  private spawnNearFlyby(): void {
    const obj = buildNearFlyby(this.currentBiome, this.activeProfile)
    if (!obj) return
    obj.position.set(
      randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2),
      SCENE.HEIGHT / 2 + 50,
      DEPTH_LAYERS.ENEMY + randomRange(-0.9, -0.2),
    )
    this.pushDecor(this.nearDecor, obj, randomRange(1.42, 1.92), randomRange(-1.05, 1.05), randomRange(2.6, 9))
  }

  private spawnClimate(): void {
    const mat = new THREE.MeshBasicMaterial({
      color: mixColor(this.activeProfile.main, this.activeProfile.near, 0.68),
      transparent: true,
      opacity: this.activeProfile.climate === 'warp' ? 0.34 : 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    let geometry: THREE.BufferGeometry = new THREE.PlaneGeometry(1.6, 7)
    if (this.activeProfile.climate === 'dust') geometry = new THREE.BoxGeometry(1.7, 1.7, 1.7)
    if (this.activeProfile.climate === 'ash') geometry = new THREE.BoxGeometry(1.1, 3.4, 1.1)
    if (this.activeProfile.climate === 'ion') geometry = new THREE.SphereGeometry(1.2, 7, 6)
    if (this.activeProfile.climate === 'warp') geometry = new THREE.CylinderGeometry(0.35, 0.85, 8.5, 6)

    const particle = new THREE.Mesh(geometry, mat)
    particle.position.set(
      randomRange(-SCENE.WIDTH / 2, SCENE.WIDTH / 2),
      SCENE.HEIGHT / 2 + 30,
      DEPTH_LAYERS.BACKGROUND + randomRange(0.5, 2.6),
    )
    this.pushDecor(
      this.climateDecor,
      particle,
      this.activeProfile.climate === 'warp' ? randomRange(1.9, 2.3) : randomRange(1.05, 1.55),
      randomRange(-1.6, 1.6),
      randomRange(0.9, 3.1),
    )
  }
}

class TerrainChunk {
  readonly root: THREE.Group
  private baseGeo: THREE.PlaneGeometry
  private baseMat: THREE.MeshStandardMaterial
  private baseMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>

  private accentGeo: THREE.PlaneGeometry
  private accentMat: THREE.MeshBasicMaterial
  private accentMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>

  private wallMat: THREE.MeshStandardMaterial
  private leftWall: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private rightWall: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>
  private accentBaseOpacity = 0.24

  private seed = Math.random() * 8000
  private fromData: TerrainData | null = null
  private toData: TerrainData | null = null

  constructor(scene: THREE.Scene, y: number, biome: BiomeType, profile: RuntimeProfile) {
    this.root = new THREE.Group()
    this.root.position.set(0, y, 0)

    this.baseGeo = new THREE.PlaneGeometry(TERRAIN_WIDTH, CHUNK_H, TERRAIN_SEG_X, TERRAIN_SEG_Y)
    this.baseMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
      emissive: 0x111111,
      emissiveIntensity: 0.06,
    })
    this.baseMesh = new THREE.Mesh(this.baseGeo, this.baseMat)
    this.baseMesh.position.z = DEPTH_LAYERS.BACKGROUND + 0.8
    this.root.add(this.baseMesh)

    this.accentGeo = new THREE.PlaneGeometry(TERRAIN_WIDTH, CHUNK_H, TERRAIN_SEG_X, TERRAIN_SEG_Y)
    this.accentMat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.accentMesh = new THREE.Mesh(this.accentGeo, this.accentMat)
    this.accentMesh.position.z = DEPTH_LAYERS.BACKGROUND + 1.52
    this.accentMesh.visible = !STABLE_3D_BASELINE
    this.root.add(this.accentMesh)

    this.wallMat = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.86,
      metalness: 0.1,
      emissive: 0x111111,
      emissiveIntensity: 0.08,
    })
    const wallGeo = new THREE.BoxGeometry(14, CHUNK_H, 10, 1, 20, 1)
    this.leftWall = new THREE.Mesh(wallGeo, this.wallMat)
    this.rightWall = new THREE.Mesh(wallGeo, this.wallMat)
    this.leftWall.position.set(-TERRAIN_WIDTH * 0.49, 0, DEPTH_LAYERS.TERRAIN - 0.85)
    this.rightWall.position.set(TERRAIN_WIDTH * 0.49, 0, DEPTH_LAYERS.TERRAIN - 0.85)
    this.root.add(this.leftWall, this.rightWall)

    this.rebuild(biome)
    this.setMaterialProfile(profile)
    scene.add(this.root)
  }

  setMaterialProfile(profile: RuntimeProfile): void {
    this.baseMat.emissive.copy(profile.main)
    this.baseMat.emissiveIntensity = 0.03 + profile.emissiveRatio * 0.1
    this.baseMat.roughness = clamp(0.9 - profile.contrast * 0.35, 0.45, 0.9)
    this.baseMat.metalness = clamp(0.1 + profile.emissiveRatio * 0.24, 0.08, 0.38)

    this.accentBaseOpacity = STABLE_3D_BASELINE ? 0 : 0.2 + profile.emissiveRatio * 0.38
    this.accentMat.opacity = this.accentBaseOpacity

    this.wallMat.color.copy(profile.far)
    this.wallMat.emissive.copy(profile.main)
    this.wallMat.emissiveIntensity = 0.05 + profile.emissiveRatio * 0.12
  }

  animate(time: number, shape: TerrainShapeDef): void {
    if (STABLE_3D_BASELINE) {
      this.baseMesh.position.z = DEPTH_LAYERS.BACKGROUND + 0.78
      this.accentMesh.position.z = DEPTH_LAYERS.BACKGROUND + 1.52
      this.accentMat.opacity = 0
      return
    }

    const pulse = Math.sin(time * 1.8 + this.seed * 0.0007)
    const wobble = pulse * shape.c1DepthAmp
    this.baseMesh.position.z = DEPTH_LAYERS.BACKGROUND + 0.78 + wobble * 0.42
    this.accentMesh.position.z = DEPTH_LAYERS.BACKGROUND + 1.52 + wobble * 0.9
    this.accentMat.opacity = clamp(this.accentBaseOpacity + pulse * 0.06, 0.14, 0.68)
  }

  rebuild(biome: BiomeType): void {
    this.fromData = null
    this.toData = null
    this.applyTerrainData(buildTerrainData(this.baseGeo, biome, this.seed))
  }

  startTransition(from: BiomeType, to: BiomeType): void {
    this.fromData = buildTerrainData(this.baseGeo, from, this.seed)
    this.toData = buildTerrainData(this.baseGeo, to, this.seed + 93.17)
  }

  updateTransition(progress: number): void {
    if (!this.fromData || !this.toData) return
    const posBase = this.baseGeo.attributes.position as THREE.BufferAttribute
    const posAccent = this.accentGeo.attributes.position as THREE.BufferAttribute
    const baseColors = new Float32Array(this.fromData.colors.length)
    const accentColors = new Float32Array(this.fromData.accentColors.length)

    for (let i = 0; i < posBase.count; i++) {
      const h = lerp(this.fromData.heights[i], this.toData.heights[i], progress)
      posBase.setZ(i, h)
      posAccent.setZ(i, h + 0.28)

      const idx = i * 3
      baseColors[idx + 0] = lerp(this.fromData.colors[idx + 0], this.toData.colors[idx + 0], progress)
      baseColors[idx + 1] = lerp(this.fromData.colors[idx + 1], this.toData.colors[idx + 1], progress)
      baseColors[idx + 2] = lerp(this.fromData.colors[idx + 2], this.toData.colors[idx + 2], progress)

      accentColors[idx + 0] = lerp(this.fromData.accentColors[idx + 0], this.toData.accentColors[idx + 0], progress)
      accentColors[idx + 1] = lerp(this.fromData.accentColors[idx + 1], this.toData.accentColors[idx + 1], progress)
      accentColors[idx + 2] = lerp(this.fromData.accentColors[idx + 2], this.toData.accentColors[idx + 2], progress)
    }

    posBase.needsUpdate = true
    posAccent.needsUpdate = true
    this.baseGeo.setAttribute('color', new THREE.BufferAttribute(baseColors, 3))
    this.accentGeo.setAttribute('color', new THREE.BufferAttribute(accentColors, 3))
    this.baseGeo.computeVertexNormals()
  }

  private applyTerrainData(data: TerrainData): void {
    const posBase = this.baseGeo.attributes.position as THREE.BufferAttribute
    const posAccent = this.accentGeo.attributes.position as THREE.BufferAttribute

    for (let i = 0; i < posBase.count; i++) {
      posBase.setZ(i, data.heights[i])
      posAccent.setZ(i, data.heights[i] + 0.28)
    }
    posBase.needsUpdate = true
    posAccent.needsUpdate = true

    this.baseGeo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3))
    this.accentGeo.setAttribute('color', new THREE.BufferAttribute(data.accentColors, 3))
    this.baseGeo.computeVertexNormals()
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.root)
    this.baseGeo.dispose()
    this.accentGeo.dispose()
    this.leftWall.geometry.dispose()
    this.baseMat.dispose()
    this.accentMat.dispose()
    this.wallMat.dispose()
  }
}

function buildTerrainData(
  geo: THREE.PlaneGeometry,
  biome: BiomeType,
  seed: number,
): TerrainData {
  const profile = buildRuntimeProfile(biome)
  const shape = TERRAIN_SHAPES[biome]
  const pos = geo.attributes.position as THREE.BufferAttribute
  const halfWidth = TERRAIN_WIDTH * 0.5

  const heights = new Float32Array(pos.count)
  const colors = new Float32Array(pos.count * 3)
  const accentColors = new Float32Array(pos.count * 3)

  const nearBright = mixColor(profile.near, new THREE.Color(0xffffff), 0.22)
  const mainAccent = mixColor(profile.main, profile.near, 0.58)

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const nx = x / halfWidth
    const ny = y / CHUNK_H

    const nA = fbm(nx * shape.waveA * 82 + seed * 0.003, ny * shape.waveB * 74 - seed * 0.002, seed)
    const nB = fbm(nx * shape.waveA * 138 - seed * 0.001, ny * shape.waveB * 128 + seed * 0.004, seed + 31.7)
    const ridgeMask = smoothstep(0.25, 0.98, Math.abs(nx))

    const laneCenter =
      Math.sin((ny + seed * 0.0012) * shape.laneFreq) * 0.34
      + Math.sin((ny - seed * 0.0007) * (shape.laneFreq * 0.47)) * 0.14
    const laneDist = Math.abs(nx - laneCenter)
    const laneMask = 1 - smoothstep(shape.laneWidth, shape.laneWidth + 0.2, laneDist)
    const sideFlow = Math.max(0, ridgeMask * (0.55 + nB * 0.45))
    const rockMask = smoothstep(0.35, 0.92, Math.abs(nB))
    const scanStripe = Math.pow(1 - Math.abs(Math.sin((ny + seed * 0.0008) * 24 + nx * 5.5)), 8)

    let h = nA * shape.relief * 0.9
    h += nB * shape.relief * 0.48
    h += ridgeMask * shape.relief * shape.ridge
    h -= laneMask * shape.relief * 0.5
    h += rockMask * shape.relief * 0.26
    h += Math.sin((ny * 14 + nx * 5 + seed * 0.0009)) * shape.relief * 0.07
    heights[i] = STABLE_3D_BASELINE ? h * STABLE_TERRAIN_DEPTH_SCALE : h

    const noiseMix = clamp((nA * 0.6 + nB * 0.4 + 1) * 0.5)
    let r = lerp(profile.far.r, profile.main.r, 0.34 + noiseMix * 0.45)
    let g = lerp(profile.far.g, profile.main.g, 0.34 + noiseMix * 0.45)
    let b = lerp(profile.far.b, profile.main.b, 0.34 + noiseMix * 0.45)

    const edgeBlend = clamp(ridgeMask * 0.82 + sideFlow * 0.18)
    r = lerp(r, profile.near.r, edgeBlend)
    g = lerp(g, profile.near.g, edgeBlend)
    b = lerp(b, profile.near.b, edgeBlend)

    const lum = 0.78 + nA * 0.12 + laneMask * 0.08 + rockMask * 0.06
    const idx = i * 3
    colors[idx + 0] = clamp(r * lum)
    colors[idx + 1] = clamp(g * lum)
    colors[idx + 2] = clamp(b * lum)

    const accentStrength =
      laneMask * (0.34 + profile.emissiveRatio * 1.02)
      + sideFlow * 0.14
      + scanStripe * (0.1 + profile.emissiveRatio * 0.28)
    accentColors[idx + 0] = clamp((nearBright.r * 0.55 + mainAccent.r * 0.45) * accentStrength)
    accentColors[idx + 1] = clamp((nearBright.g * 0.55 + mainAccent.g * 0.45) * accentStrength)
    accentColors[idx + 2] = clamp((nearBright.b * 0.55 + mainAccent.b * 0.45) * accentStrength)
  }

  return { heights, colors, accentColors }
}

function buildMidDecoration(biome: BiomeType, profile: RuntimeProfile): THREE.Object3D | null {
  const mainMat = new THREE.MeshStandardMaterial({
    color: profile.near,
    roughness: 0.55,
    metalness: 0.28,
    emissive: profile.main,
    emissiveIntensity: 0.05 + profile.emissiveRatio * 0.09,
  })
  const glowMat = new THREE.MeshStandardMaterial({
    color: mixColor(profile.main, profile.near, 0.55),
    roughness: 0.24,
    metalness: 0.65,
    emissive: profile.near,
    emissiveIntensity: 0.45 + profile.emissiveRatio * 0.55,
    transparent: true,
    opacity: 0.82,
    depthWrite: true,
  })

  switch (biome) {
    case 'earth_plains': {
      const g = new THREE.Group()
      // Main rock mesa
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 7, 8), mainMat))
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.6, 8), mainMat).translateY(3.8).translateZ(2))
      // Glow ring + spire
      g.add(new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.55, 8, 22), glowMat).translateY(2.5).translateZ(5))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(2.4, 9, 7), glowMat).translateY(6).translateZ(4))
      return g
    }
    case 'earth_desert': {
      const g = new THREE.Group()
      // Sandstone obelisk
      g.add(new THREE.Mesh(new THREE.ConeGeometry(8, 22, 5), mainMat))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(5, 10, 5), mainMat).translateY(14).translateZ(2))
      // Glowing crystal top
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(4.5), glowMat).translateY(20).translateZ(4))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(2, 8, 2), glowMat).translateY(24).translateZ(3))
      return g
    }
    case 'earth_ocean': {
      const g = new THREE.Group()
      // Coral spire
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 5, 8), mainMat))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(4, 16, 7), mainMat).translateY(8).translateZ(3))
      g.add(new THREE.Mesh(new THREE.ConeGeometry(2.5, 10, 6), mainMat).translateY(16).translateZ(1))
      // Bioluminescent orbs
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), glowMat).translateY(6).translateZ(6))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 6), glowMat).translateY(14).translateZ(5))
      return g
    }
    case 'earth_volcanic': {
      const g = new THREE.Group()
      // Volcanic spire
      const h = randomRange(18, 28)
      g.add(new THREE.Mesh(new THREE.ConeGeometry(randomRange(7, 12), h, 8), mainMat))
      // Lava glow conduit
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.4, h * 0.6, 7), glowMat).translateY(h * 0.15).translateZ(3))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 6), glowMat).translateY(h * 0.4).translateZ(5))
      return g
    }
    case 'earth_ruins': {
      const g = new THREE.Group()
      // Ruined structure
      g.add(new THREE.Mesh(new THREE.BoxGeometry(12, 8, randomRange(10, 18)), mainMat))
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 10, 7), mainMat).translateX(-4).translateY(8).translateZ(6))
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 10, 7), mainMat).translateX(4).translateY(8).translateZ(6))
      // Architrave glow strip
      g.add(new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 2), glowMat).translateY(2).translateZ(9))
      // Floating relic fragment
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(3.5), glowMat).translateY(14).translateZ(8))
      return g
    }
    case 'space_orbit': {
      const g = new THREE.Group()
      // Orbital platform debris
      g.add(new THREE.Mesh(new THREE.BoxGeometry(20, 4, 10), mainMat))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 16), mainMat).rotateZ(0.5).translateZ(4))
      // Solar panel glow
      g.add(new THREE.Mesh(new THREE.BoxGeometry(30, 0.6, 3), glowMat).translateY(1.5).translateZ(6))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 6), glowMat).translateY(3).translateZ(8))
      return g
    }
    case 'space_deep':
      return new THREE.Mesh(new THREE.IcosahedronGeometry(randomRange(9, 18), 1), glowMat)
    case 'space_asteroid': {
      const g = new THREE.Group()
      const dodec = new THREE.Mesh(new THREE.DodecahedronGeometry(randomRange(8, 15), 1), mainMat)
      g.add(dodec)
      // Crystal vein
      g.add(new THREE.Mesh(new THREE.TetrahedronGeometry(randomRange(3, 6)), glowMat).translateY(5).translateZ(6))
      return g
    }
    case 'space_blackhole': {
      const g = new THREE.Group()
      // Accretion ring fragment
      g.add(new THREE.Mesh(new THREE.TorusGeometry(randomRange(14, 30), 2, 8, 28, Math.PI * randomRange(1.2, 1.8)), mainMat))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(3.5, 10, 8), glowMat))
      g.add(new THREE.Mesh(new THREE.TorusGeometry(randomRange(10, 22), 1.2, 8, 22, Math.PI * randomRange(1.0, 1.5)), glowMat).translateZ(2))
      return g
    }
    case 'space_final': {
      const g = new THREE.Group()
      // Ascended geometry
      g.add(new THREE.Mesh(new THREE.TorusGeometry(randomRange(8, 18), randomRange(2.2, 4.5), 8, 18), mainMat))
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(5.5), mainMat))
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(3.2), glowMat).translateZ(7))
      g.add(new THREE.Mesh(new THREE.TorusGeometry(randomRange(11, 22), 1.6, 8, 22), glowMat).translateZ(3))
      return g
    }
    default:
      return null
  }
}

function buildNearFlyby(biome: BiomeType, profile: RuntimeProfile): THREE.Object3D | null {
  const mainMat = new THREE.MeshStandardMaterial({
    color: profile.near,
    roughness: 0.48,
    metalness: 0.38,
    emissive: profile.main,
    emissiveIntensity: 0.08 + profile.emissiveRatio * 0.14,
    transparent: true,
    opacity: 0.86,
  })
  const glowMat = new THREE.MeshStandardMaterial({
    color: mixColor(profile.main, profile.near, 0.62),
    roughness: 0.18,
    metalness: 0.7,
    emissive: profile.near,
    emissiveIntensity: 0.38 + profile.emissiveRatio * 0.42,
    transparent: true,
    opacity: 0.78,
    depthWrite: true,
  })

  switch (biome) {
    case 'earth_plains':
    case 'earth_desert':
    case 'earth_ruins': {
      const g = new THREE.Group()
      const w = randomRange(7, 15)
      const d = randomRange(12, 22)
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w, randomRange(3.5, 7), d), mainMat))
      // Edge highlight strip
      g.add(new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, 1.4, d * 0.4), glowMat).translateZ(d * 0.35))
      // Corner glow orbs
      for (const cx of [-1, 1]) {
        g.add(new THREE.Mesh(new THREE.SphereGeometry(1.8, 7, 5), glowMat)
          .translateX(cx * w * 0.4).translateZ(d * 0.45))
      }
      return g
    }
    case 'earth_ocean': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(3.5, 7, randomRange(9, 18), 8), mainMat))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 8, 6), glowMat).translateZ(5))
      g.add(new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.5, 8, 14), glowMat).translateZ(7))
      return g
    }
    case 'earth_volcanic': {
      const g = new THREE.Group()
      const h = randomRange(14, 28)
      g.add(new THREE.Mesh(new THREE.ConeGeometry(randomRange(5, 10), h, 7), mainMat))
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 6, 6), glowMat).translateY(h * 0.3).translateZ(4))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2, 6, 5), glowMat).translateY(h * 0.5).translateZ(6))
      return g
    }
    case 'space_orbit':
    case 'space_deep':
    case 'space_asteroid': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(randomRange(5, 12), 1), mainMat))
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.2, randomRange(7, 12), 1.2), glowMat))
      g.add(new THREE.Mesh(new THREE.TetrahedronGeometry(randomRange(2.5, 5)), glowMat).translateZ(6))
      return g
    }
    case 'space_blackhole':
    case 'space_final': {
      const g = new THREE.Group()
      g.add(new THREE.Mesh(new THREE.TorusGeometry(randomRange(7, 16), randomRange(1.2, 2.8), 8, 16), mainMat))
      g.add(new THREE.Mesh(new THREE.SphereGeometry(2.8, 8, 6), glowMat))
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(3), glowMat).translateZ(5))
      return g
    }
    default:
      return null
  }
}
