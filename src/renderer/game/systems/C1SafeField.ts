import * as THREE from 'three'
import { DEPTH_LAYERS, SCENE, TERRAIN_VISUAL_CONFIG } from '@/game/GameConfig'
import type { BiomeType } from '@shared/types'

const FIELD_SCROLL_SPEED = 58
const FIELD_WRAP = SCENE.HEIGHT * 1.62
const FIELD_MIN_Y = -SCENE.HEIGHT * 0.82

const BIOME_SEQUENCE: BiomeType[] = [
  'earth_plains',
  'earth_desert',
  'earth_ocean',
  'earth_volcanic',
  'earth_ruins',
  'space_orbit',
  'space_deep',
  'space_asteroid',
  'space_blackhole',
  'space_final',
]

type MaterialRole = 'main' | 'far' | 'near' | 'accent' | 'dark' | 'bright'

interface Palette {
  background: THREE.Color
  main: THREE.Color
  far: THREE.Color
  near: THREE.Color
  accent: THREE.Color
  dark: THREE.Color
  bright: THREE.Color
  emissive: THREE.Color
}

interface RoleMaterial {
  material: THREE.MeshStandardMaterial
  role: MaterialRole
  emissiveScale: number
}

interface FieldItem {
  object: THREE.Object3D
  speedMul: number
  spin: number
  wobble: number
  baseX: number
  baseZ: number
  phase: number
}

interface BiomeTransition {
  from: BiomeType
  to: BiomeType
  time: number
  duration: number
}

function paletteForBiome(biome: BiomeType): Palette {
  const cfg = TERRAIN_VISUAL_CONFIG[biome]
  const main = new THREE.Color(cfg.mainColor)
  const far = new THREE.Color(cfg.farColor)
  const near = new THREE.Color(cfg.nearColor)
  return {
    background: far.clone().lerp(main, 0.36),
    main,
    far,
    near,
    accent: main.clone().lerp(near, 0.68),
    dark: far.clone().lerp(new THREE.Color(0x05070a), 0.54),
    bright: near.clone().lerp(new THREE.Color(0xffffff), 0.34),
    emissive: main.clone().lerp(near, 0.48),
  }
}

function mixColor(a: THREE.Color, b: THREE.Color, t: number): THREE.Color {
  return new THREE.Color(
    THREE.MathUtils.lerp(a.r, b.r, t),
    THREE.MathUtils.lerp(a.g, b.g, t),
    THREE.MathUtils.lerp(a.b, b.b, t),
  )
}

function mixPalette(a: Palette, b: Palette, t: number): Palette {
  return {
    background: mixColor(a.background, b.background, t),
    main: mixColor(a.main, b.main, t),
    far: mixColor(a.far, b.far, t),
    near: mixColor(a.near, b.near, t),
    accent: mixColor(a.accent, b.accent, t),
    dark: mixColor(a.dark, b.dark, t),
    bright: mixColor(a.bright, b.bright, t),
    emissive: mixColor(a.emissive, b.emissive, t),
  }
}

function roleColor(palette: Palette, role: MaterialRole): THREE.Color {
  switch (role) {
    case 'far': return palette.far
    case 'near': return palette.near
    case 'accent': return palette.accent
    case 'dark': return palette.dark
    case 'bright': return palette.bright
    case 'main':
    default: return palette.main
  }
}

export class C1SafeField {
  totalDistance = 0
  currentBiome: BiomeType = 'earth_plains'

  private readonly scene: THREE.Scene
  private readonly root = new THREE.Group()
  private readonly items: FieldItem[] = []
  private readonly materials: RoleMaterial[] = []
  private palette = paletteForBiome('earth_plains')
  private transition: BiomeTransition | null = null
  private time = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.root.name = 'c1_safe_field'
    this.scene.add(this.root)
    this.scene.background = this.palette.background.clone()
    this.scene.fog = null
    this.buildField()
    this.applyPalette(this.palette)
  }

  update(dt: number): void {
    this.time += dt
    this.totalDistance += FIELD_SCROLL_SPEED * dt
    this.updateTransition(dt)

    for (const item of this.items) {
      item.object.position.y -= FIELD_SCROLL_SPEED * item.speedMul * dt
      if (item.object.position.y < FIELD_MIN_Y) {
        item.object.position.y += FIELD_WRAP
      }

      item.object.position.x = item.baseX + Math.sin(this.time * 1.15 + item.phase) * item.wobble
      item.object.position.z = item.baseZ + Math.sin(this.time * 1.7 + item.phase) * 0.55
      item.object.rotation.y = Math.sin(this.time * 0.9 + item.phase) * 0.1
      item.object.rotation.z += item.spin * dt
    }
  }

  transitionToBiome(index: number, duration = 2.8): void {
    const to = BIOME_SEQUENCE[Math.min(index, BIOME_SEQUENCE.length - 1)]
    if (to === this.currentBiome) return
    this.transition = {
      from: this.currentBiome,
      to,
      time: 0,
      duration: Math.max(0.05, duration),
    }
  }

  dispose(): void {
    this.scene.remove(this.root)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    this.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      geometries.add(child.geometry)
      const material = child.material
      if (Array.isArray(material)) {
        for (const mat of material) materials.add(mat)
      } else {
        materials.add(material)
      }
    })
    for (const geo of geometries) geo.dispose()
    for (const mat of materials) mat.dispose()
    this.items.length = 0
    this.materials.length = 0
  }

  private buildField(): void {
    const startY = -SCENE.HEIGHT * 0.74
    for (let i = 0; i < 18; i++) {
      const y = startY + i * 32
      this.addRunwayRib(i, y)
      this.addSideMarker(i, y + 12)
      if (i % 3 === 1) this.addDepthGate(i, y + 24)
      if (i % 4 === 2) this.addCenterStack(i, y + 6)
    }
  }

  private addRunwayRib(index: number, y: number): void {
    const group = new THREE.Group()
    group.name = `c1_safe_rib_${index}`
    const z = DEPTH_LAYERS.BACKGROUND + 8 + (index % 3) * 6
    const width = 50 + (index % 4) * 8
    this.addBox(group, 'rib_body', [width, 4, 12 + (index % 3) * 4], ['accent', 'far', 'near', 'dark', 'bright', 'main'], [0, 0, 0])
    this.addBox(group, 'rib_spine', [10, 8, 18], 'bright', [0, 3, 8])
    group.position.set(0, y, z)
    this.root.add(group)
    this.track(group, 0.78 + (index % 3) * 0.06, 0, 0.8)
  }

  private addSideMarker(index: number, y: number): void {
    const side = index % 2 === 0 ? -1 : 1
    const group = new THREE.Group()
    group.name = `c1_safe_side_marker_${index}`
    const h = 18 + (index % 4) * 5
    const d = 26 + (index % 5) * 4
    const zBand = [DEPTH_LAYERS.BACKGROUND + 16, DEPTH_LAYERS.TERRAIN + 7, DEPTH_LAYERS.ENEMY - 6, DEPTH_LAYERS.FOCAL + 6][index % 4]

    this.addBox(group, 'marker_body', [12 + (index % 3) * 2, h, d], ['main', 'dark', 'bright', 'near', 'accent', 'far'], [0, 0, 0], new THREE.Euler(0.06, -0.18 * side, 0.04 * side))
    this.addBox(group, 'marker_cap', [18, 5, Math.max(12, d - 8)], index % 2 === 0 ? 'accent' : 'bright', [0, h * 0.44, 5])
    this.addBox(group, 'marker_depth_key', [5, h + 4, 5], 'near', [0, 0, d * 0.45])

    group.position.set(side * (SCENE.WIDTH * 0.38 + (index % 3) * 3), y, zBand)
    this.root.add(group)
    this.track(group, 0.92 + (index % 4) * 0.08, 0.02 * side, 1.4)
  }

  private addDepthGate(index: number, y: number): void {
    const group = new THREE.Group()
    group.name = `c1_safe_gate_${index}`
    const z = DEPTH_LAYERS.TERRAIN + 8 + (index % 2) * 12
    const role: MaterialRole = index % 2 === 0 ? 'near' : 'accent'
    this.addBox(group, 'gate_left', [7, 30, 18], role, [-42, 0, 0])
    this.addBox(group, 'gate_right', [7, 30, 18], role, [42, 0, 0])
    this.addBox(group, 'gate_top', [90, 5, 12], ['bright', 'near', 'accent', 'dark', 'main', 'far'], [0, 16, 4])
    this.addBox(group, 'gate_floor_key', [34, 4, 18], 'dark', [0, -16, -4])
    group.position.set(0, y, z)
    this.root.add(group)
    this.track(group, 0.86, 0, 0.5)
  }

  private addCenterStack(index: number, y: number): void {
    const group = new THREE.Group()
    group.name = `c1_safe_center_stack_${index}`
    const side = index % 2 === 0 ? -1 : 1
    const z = DEPTH_LAYERS.FOCAL + (index % 3) * 7
    this.addBox(group, 'stack_base', [18, 16, 30], ['main', 'accent', 'near', 'far', 'bright', 'dark'], [0, 0, 0], new THREE.Euler(0.1, 0.16 * side, 0.03))
    this.addBox(group, 'stack_top', [12, 12, 18], 'bright', [0, 12, 9])
    this.addBox(group, 'stack_belly', [10, 14, 10], 'dark', [0, -7, -18])
    group.position.set(side * (18 + (index % 3) * 8), y, z)
    this.root.add(group)
    this.track(group, 1.04, 0.06 * side, 2.2)
  }

  private addBox(
    group: THREE.Group,
    name: string,
    size: [number, number, number],
    role: MaterialRole | MaterialRole[],
    position: [number, number, number],
    rotation: THREE.Euler = new THREE.Euler(),
  ): THREE.Mesh {
    const material = Array.isArray(role)
      ? role.map((entry, index) => this.createMaterial(entry, index === 2 || index === 4 ? 0.22 : 0.08))
      : this.createMaterial(role, role === 'near' || role === 'bright' ? 0.24 : 0.08)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material)
    mesh.name = name
    mesh.position.set(position[0], position[1], position[2])
    mesh.rotation.copy(rotation)
    mesh.frustumCulled = false
    group.add(mesh)
    return mesh
  }

  private createMaterial(role: MaterialRole, emissiveScale: number): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: roleColor(this.palette, role),
      roughness: role === 'dark' ? 0.68 : 0.42,
      metalness: role === 'bright' || role === 'near' ? 0.42 : 0.24,
      emissive: this.palette.emissive,
      emissiveIntensity: emissiveScale,
    })
    this.materials.push({ material, role, emissiveScale })
    return material
  }

  private track(object: THREE.Object3D, speedMul: number, spin: number, wobble: number): void {
    this.items.push({
      object,
      speedMul,
      spin,
      wobble,
      baseX: object.position.x,
      baseZ: object.position.z,
      phase: Math.random() * Math.PI * 2,
    })
  }

  private updateTransition(dt: number): void {
    if (!this.transition) return
    this.transition.time += dt
    const t = THREE.MathUtils.smoothstep(
      Math.min(1, this.transition.time / this.transition.duration),
      0,
      1,
    )
    this.palette = mixPalette(paletteForBiome(this.transition.from), paletteForBiome(this.transition.to), t)
    this.applyPalette(this.palette)

    if (this.transition.time >= this.transition.duration) {
      this.currentBiome = this.transition.to
      this.transition = null
      this.palette = paletteForBiome(this.currentBiome)
      this.applyPalette(this.palette)
    }
  }

  private applyPalette(palette: Palette): void {
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(palette.background)
    } else {
      this.scene.background = palette.background.clone()
    }

    for (const entry of this.materials) {
      entry.material.color.copy(roleColor(palette, entry.role))
      entry.material.emissive.copy(palette.emissive)
      entry.material.emissiveIntensity = entry.emissiveScale
    }
  }
}
