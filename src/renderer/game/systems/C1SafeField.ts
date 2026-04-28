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
  private readonly stageGate = new THREE.Group()
  private readonly stageGatePieces: THREE.Object3D[] = []
  private readonly biomeDressing = new THREE.Group()
  private readonly items: FieldItem[] = []
  private readonly biomeItems: FieldItem[] = []
  private readonly materials: RoleMaterial[] = []
  private readonly biomeMaterials: RoleMaterial[] = []
  private palette = paletteForBiome('earth_plains')
  private transition: BiomeTransition | null = null
  private stageGateTime = 0
  private stageGateDuration = 0
  private time = 0

  constructor(scene: THREE.Scene) {
    this.scene = scene
    this.root.name = 'c1_safe_field'
    this.scene.add(this.root)
    this.scene.background = this.palette.background.clone()
    this.scene.fog = null
    this.buildField()
    this.buildStageGate()
    this.biomeDressing.name = 'c1_biome_dressing'
    this.root.add(this.biomeDressing)
    this.rebuildBiomeDressing(this.currentBiome)
    this.applyPalette(this.palette)
  }

  update(dt: number): void {
    this.time += dt
    this.totalDistance += FIELD_SCROLL_SPEED * dt
    this.updateTransition(dt)
    this.updateStageGate(dt)
    this.updateFieldItems(this.items, dt)
    this.updateFieldItems(this.biomeItems, dt)
  }

  private updateFieldItems(items: FieldItem[], dt: number): void {
    for (const item of items) {
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
    this.rebuildBiomeDressing(to)
    this.triggerStageGate(duration)
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
    this.biomeItems.length = 0
    this.materials.length = 0
    this.biomeMaterials.length = 0
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

  private rebuildBiomeDressing(biome: BiomeType): void {
    const materialSet = new Set(this.biomeMaterials.map((entry) => entry.material))
    const geometrySet = new Set<THREE.BufferGeometry>()
    this.biomeDressing.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      geometrySet.add(child.geometry)
    })

    this.biomeDressing.clear()
    this.biomeItems.length = 0

    for (const geo of geometrySet) geo.dispose()
    for (const mat of materialSet) mat.dispose()
    for (const entry of this.biomeMaterials) {
      const idx = this.materials.indexOf(entry)
      if (idx >= 0) this.materials.splice(idx, 1)
    }
    this.biomeMaterials.length = 0

    const startY = -SCENE.HEIGHT * 0.78
    for (let i = 0; i < 10; i++) {
      const y = startY + i * 54
      this.addBiomePatternRow(biome, i, y)
      if (i % 4 === 2) this.addBiomeMotif(biome, i, y + 22)
    }
    this.applyPalette(this.palette)
  }

  private addBiomePatternRow(biome: BiomeType, index: number, y: number): void {
    const group = new THREE.Group()
    group.name = `c1_biome_signature_${biome}_${index}`
    const side = index % 2 === 0 ? -1 : 1
    const z = DEPTH_LAYERS.BACKGROUND + 18 + (index % 3) * 8
    const rowSkew = new THREE.Euler(0.04, 0.08 * side, 0.015 * side)

    this.addBiomeBox(group, 'signature_ground_shadow', [134, 5, 12], 'dark', [0, -24, -16], rowSkew)
    this.addBiomeBox(group, 'signature_depth_bar', [104, 6, 14], ['far', 'main', 'accent', 'dark', 'near', 'bright'], [0, -12, -5], rowSkew)

    switch (biome) {
      case 'earth_plains':
        this.addBiomeBox(group, 'plains_plot_left', [34, 20, 9], 'main', [-38, 0, -4], new THREE.Euler(0.04, 0.04, 0.08))
        this.addBiomeBox(group, 'plains_plot_center', [32, 18, 15], 'far', [0, 2, 1], new THREE.Euler(0.03, -0.05, -0.05))
        this.addBiomeBox(group, 'plains_plot_right', [34, 20, 20], 'near', [38, 0, 5], new THREE.Euler(0.05, -0.03, -0.08))
        this.addBiomeBox(group, 'plains_irrigation_line', [112, 4, 10], 'bright', [0, 13, 10], new THREE.Euler(0.02, 0, -0.06 * side))
        this.addBiomeBox(group, 'plains_watch_tower', [10, 34, 28], 'accent', [side * 65, -1, 12], new THREE.Euler(0.08, 0.14 * side, 0.04 * side))
        break
      case 'earth_desert':
        this.addBiomeBox(group, 'desert_dune_wide', [120, 7, 15], 'far', [0, -4, -6], new THREE.Euler(0.04, 0.02 * side, 0.16 * side))
        this.addBiomeBox(group, 'desert_dune_near', [92, 8, 22], 'main', [0, 10, 5], new THREE.Euler(0.06, -0.04 * side, -0.15 * side))
        this.addBiomeMesh(group, 'desert_row_obelisk', new THREE.ConeGeometry(13, 50, 4), 'bright', [side * 17, 4, 22], new THREE.Euler(0.08, 0.12 * side, Math.PI / 4))
        this.addBiomeBox(group, 'desert_obelisk_shadow', [58, 7, 14], 'dark', [-side * 22, -8, 1], new THREE.Euler(0, 0, -0.22 * side))
        break
      case 'earth_ocean':
        this.addBiomeMesh(group, 'ocean_pad_left', new THREE.CylinderGeometry(18, 22, 8, 8), 'near', [-44, -1, 2], new THREE.Euler(0.03, 0, Math.PI / 8))
        this.addBiomeMesh(group, 'ocean_pad_center', new THREE.CylinderGeometry(21, 25, 9, 8), 'main', [0, 2, 8], new THREE.Euler(0.03, 0, Math.PI / 8))
        this.addBiomeMesh(group, 'ocean_pad_right', new THREE.CylinderGeometry(18, 22, 8, 8), 'near', [44, -1, 2], new THREE.Euler(0.03, 0, Math.PI / 8))
        this.addBiomeBox(group, 'ocean_bridge_line', [102, 5, 10], 'bright', [0, 12, 14], new THREE.Euler(0.04, 0, 0.02 * side))
        this.addBiomeBox(group, 'ocean_beacon_fin_large', [6, 40, 28], 'accent', [side * 64, 1, 18], new THREE.Euler(0.1, 0.22 * side, 0.06 * side))
        break
      case 'earth_volcanic':
        this.addBiomeBox(group, 'volcanic_plate_a', [60, 10, 20], 'dark', [-30, -2, -3], new THREE.Euler(0.08, 0.07, 0.09))
        this.addBiomeBox(group, 'volcanic_plate_b', [62, 10, 24], 'main', [30, 2, 2], new THREE.Euler(0.08, -0.08, -0.08))
        this.addBiomeBox(group, 'volcanic_lava_crack_wide', [118, 5, 11], 'bright', [0, 10, 13], new THREE.Euler(0.03, 0, 0.14 * side))
        this.addBiomeMesh(group, 'volcanic_vent_large', new THREE.CylinderGeometry(12, 18, 28, 7), 'dark', [side * 35, -4, 16])
        this.addBiomeBox(group, 'volcanic_vent_core_large', [8, 28, 10], 'bright', [side * 35, -2, 26])
        break
      case 'earth_ruins':
        this.addBiomeBox(group, 'ruins_floor_left', [38, 18, 10], 'far', [-38, 0, -3], new THREE.Euler(0.03, 0.02, 0.06))
        this.addBiomeBox(group, 'ruins_floor_center', [40, 20, 14], 'main', [0, 0, 2], new THREE.Euler(0.03, -0.03, -0.02))
        this.addBiomeBox(group, 'ruins_floor_right', [38, 18, 18], 'near', [38, 0, 5], new THREE.Euler(0.03, -0.02, -0.06))
        this.addBiomeMesh(group, 'ruins_column_left', new THREE.CylinderGeometry(6, 8, 42, 6), 'accent', [-side * 58, 1, 15], new THREE.Euler(0.1, 0.08 * side, 0.04 * side))
        this.addBiomeBox(group, 'ruins_arch_beam_large', [72, 6, 18], 'bright', [0, 20, 18], new THREE.Euler(0.03, 0, -0.04 * side))
        break
      case 'space_orbit':
        this.addBiomeBox(group, 'orbit_panel_bank_left', [58, 9, 5], 'near', [-39, 4, 8], new THREE.Euler(0.18, 0.22 * side, 0.12))
        this.addBiomeBox(group, 'orbit_panel_bank_right', [58, 9, 5], 'near', [39, 4, 8], new THREE.Euler(0.18, -0.22 * side, -0.12))
        this.addBiomeBox(group, 'orbit_panel_spine', [118, 5, 11], 'accent', [0, -6, 13], new THREE.Euler(0.08, 0, 0.02 * side))
        this.addBiomeMesh(group, 'orbit_docking_node', new THREE.OctahedronGeometry(17, 0), 'bright', [0, 8, 25], new THREE.Euler(0.18, 0.12 * side, 0.1))
        this.addBiomeBox(group, 'orbit_antenna_key', [6, 34, 16], 'bright', [side * 67, -3, 18], new THREE.Euler(0.12, 0.18 * side, 0.08 * side))
        break
      case 'space_deep':
        this.addBiomeMesh(group, 'deep_crystal_center_large', new THREE.OctahedronGeometry(20, 0), 'bright', [0, 4, 24], new THREE.Euler(0.22, 0.16 * side, 0.12))
        this.addBiomeMesh(group, 'deep_crystal_left', new THREE.OctahedronGeometry(13, 0), 'accent', [-42, -2, 12], new THREE.Euler(0.18, -0.08, 0.18))
        this.addBiomeMesh(group, 'deep_crystal_right', new THREE.OctahedronGeometry(13, 0), 'accent', [42, -2, 12], new THREE.Euler(0.18, 0.08, -0.18))
        this.addBiomeBox(group, 'deep_spine_large', [7, 58, 10], 'near', [side * 62, 0, 15], new THREE.Euler(0.18, 0.15 * side, 0.3 * side))
        this.addBiomeBox(group, 'deep_anchor_bar_large', [98, 5, 12], 'dark', [0, -16, -4])
        break
      case 'space_asteroid':
        this.addBiomeMesh(group, 'asteroid_mass_large', new THREE.IcosahedronGeometry(23, 0), 'main', [-side * 16, -1, 15], new THREE.Euler(0.24, 0.12 * side, 0.1))
        this.addBiomeMesh(group, 'asteroid_mass_mid', new THREE.IcosahedronGeometry(15, 0), 'near', [side * 42, 7, 23], new THREE.Euler(0.08, -0.1 * side, 0.18))
        this.addBiomeMesh(group, 'asteroid_mass_small', new THREE.IcosahedronGeometry(10, 0), 'far', [-side * 55, 8, 5], new THREE.Euler(0.12, 0.05, -0.12))
        this.addBiomeBox(group, 'asteroid_mining_rail_long', [112, 5, 10], 'bright', [0, -13, 15], new THREE.Euler(0.08, 0, -0.16 * side))
        this.addBiomeBox(group, 'asteroid_warning_post', [9, 34, 16], 'accent', [side * 67, 0, 14], new THREE.Euler(0.08, 0.18 * side, 0.04 * side))
        break
      case 'space_blackhole':
        this.addBiomeMesh(group, 'blackhole_signature_ring', new THREE.TorusGeometry(23, 2.8, 8, 24), 'bright', [0, 2, 22], new THREE.Euler(0.1, 0.06 * side, 0.18 * side))
        this.addBiomeMesh(group, 'blackhole_signature_core', new THREE.DodecahedronGeometry(14, 0), 'dark', [0, 2, 26], new THREE.Euler(0.2, 0.1, 0.08))
        this.addBiomeBox(group, 'blackhole_spoke_long_a', [120, 5, 8], 'accent', [0, 2, 14], new THREE.Euler(0.04, 0.18 * side, 0.38))
        this.addBiomeBox(group, 'blackhole_spoke_long_b', [96, 5, 8], 'near', [0, 2, 8], new THREE.Euler(0.04, -0.14 * side, -0.38))
        this.addBiomeBox(group, 'blackhole_far_anchor', [72, 6, 12], 'dark', [0, -17, -6])
        break
      case 'space_final':
      default:
        this.addBiomeBox(group, 'final_corridor_left', [16, 52, 28], 'dark', [-50, 4, 13], new THREE.Euler(0.08, 0.16, 0.02))
        this.addBiomeBox(group, 'final_corridor_right', [16, 52, 28], 'dark', [50, 4, 13], new THREE.Euler(0.08, -0.16, -0.02))
        this.addBiomeBox(group, 'final_monolith_center_large', [18, 62, 32], ['dark', 'main', 'bright', 'far', 'near', 'accent'], [0, 3, 22], new THREE.Euler(0.08, 0.08 * side, 0))
        this.addBiomeMesh(group, 'final_crown_large', new THREE.OctahedronGeometry(15, 0), 'bright', [0, 38, 39], new THREE.Euler(0.2, 0.1 * side, 0.12))
        this.addBiomeBox(group, 'final_floor_chevron', [118, 5, 14], 'accent', [0, -20, 5], new THREE.Euler(0.02, 0, 0.12 * side))
        break
    }

    group.position.set(0, y, z)
    this.biomeDressing.add(group)
    this.trackBiome(group, 0.66 + (index % 4) * 0.055, biome === 'space_blackhole' ? 0.02 * side : 0, 0.7)
  }

  private addBiomeMotif(biome: BiomeType, index: number, y: number): void {
    const group = new THREE.Group()
    group.name = `c1_biome_${biome}_${index}`
    const side = index % 2 === 0 ? -1 : 1
    const lane = side * (54 + (index % 3) * 10)
    const z = DEPTH_LAYERS.TERRAIN + 5 + (index % 4) * 9

    switch (biome) {
      case 'earth_plains':
        this.addBiomeBox(group, 'plain_farmland_slab', [30, 8, 10], ['main', 'far', 'near', 'dark', 'bright', 'accent'], [0, -7, -8], new THREE.Euler(0.02, 0.08 * side, 0.03 * side))
        this.addBiomeBox(group, 'plain_watch_post', [8, 24, 18], 'near', [side * 5, 8, 6])
        this.addBiomeMesh(group, 'plain_marker_cap', new THREE.CylinderGeometry(7, 9, 6, 6), 'bright', [side * 5, 22, 14], new THREE.Euler(0, 0, Math.PI / 6))
        break
      case 'earth_desert':
        this.addBiomeBox(group, 'desert_dune_ridge', [38, 7, 12], ['far', 'main', 'near', 'dark', 'accent', 'bright'], [0, -9, -10], new THREE.Euler(0.06, 0.12 * side, 0.16 * side))
        this.addBiomeMesh(group, 'desert_obelisk', new THREE.ConeGeometry(7, 34, 4), 'bright', [side * 4, 9, 10], new THREE.Euler(0.08, 0.12 * side, Math.PI / 4))
        this.addBiomeBox(group, 'desert_shadow_key', [14, 6, 20], 'dark', [-side * 11, -4, -2], new THREE.Euler(0, 0, -0.12 * side))
        break
      case 'earth_ocean':
        this.addBiomeBox(group, 'ocean_platform', [34, 9, 14], ['near', 'main', 'bright', 'dark', 'accent', 'far'], [0, -8, -8])
        this.addBiomeMesh(group, 'ocean_pylon', new THREE.CylinderGeometry(5, 7, 30, 8), 'accent', [side * 9, 7, 8], new THREE.Euler(0.06, 0, 0))
        this.addBiomeBox(group, 'ocean_beacon_fin', [4, 26, 18], 'bright', [-side * 9, 8, 12], new THREE.Euler(0.08, 0.2 * side, 0.08 * side))
        break
      case 'earth_volcanic':
        this.addBiomeBox(group, 'volcanic_basal_plate', [32, 10, 18], ['dark', 'far', 'main', 'dark', 'accent', 'near'], [0, -8, -8], new THREE.Euler(0.08, 0.12 * side, -0.06 * side))
        this.addBiomeMesh(group, 'volcanic_vent', new THREE.CylinderGeometry(8, 12, 24, 7), 'dark', [side * 2, 8, 6])
        this.addBiomeBox(group, 'volcanic_lava_core', [7, 20, 8], 'bright', [side * 2, 10, 16])
        break
      case 'earth_ruins':
        this.addBiomeBox(group, 'ruin_floor_piece', [40, 7, 12], ['far', 'dark', 'near', 'main', 'bright', 'accent'], [0, -10, -8], new THREE.Euler(0.03, 0.08 * side, 0.06 * side))
        this.addBiomeMesh(group, 'ruin_column_a', new THREE.CylinderGeometry(5, 6, 30, 6), 'near', [-side * 10, 6, 8], new THREE.Euler(0.12, 0.08 * side, 0.1 * side))
        this.addBiomeBox(group, 'ruin_arch_chunk', [24, 5, 12], 'bright', [side * 7, 23, 12], new THREE.Euler(0.05, 0, -0.16 * side))
        break
      case 'space_orbit':
        this.addBiomeBox(group, 'orbit_panel_left', [26, 5, 3], 'near', [-side * 15, 0, 6], new THREE.Euler(0.18, 0.2 * side, 0.12 * side))
        this.addBiomeBox(group, 'orbit_panel_right', [26, 5, 3], 'near', [side * 15, 0, 6], new THREE.Euler(0.18, -0.2 * side, -0.12 * side))
        this.addBiomeMesh(group, 'orbit_node', new THREE.OctahedronGeometry(8, 0), 'bright', [0, 5, 14])
        break
      case 'space_deep':
        this.addBiomeMesh(group, 'deep_crystal_main', new THREE.OctahedronGeometry(12, 0), 'bright', [0, 7, 14], new THREE.Euler(0.2, 0.2 * side, 0.1))
        this.addBiomeBox(group, 'deep_crystal_spine', [5, 30, 8], 'accent', [side * 12, 0, 4], new THREE.Euler(0.18, 0.18 * side, 0.28 * side))
        this.addBiomeBox(group, 'deep_anchor_shadow', [24, 5, 10], 'dark', [-side * 8, -12, -8])
        break
      case 'space_asteroid':
        this.addBiomeMesh(group, 'asteroid_mass', new THREE.IcosahedronGeometry(15, 0), 'main', [0, 0, 4], new THREE.Euler(0.2, 0.12 * side, 0.1))
        this.addBiomeMesh(group, 'asteroid_near_key', new THREE.IcosahedronGeometry(7, 0), 'near', [side * 18, 10, 16])
        this.addBiomeBox(group, 'asteroid_mining_strut', [30, 4, 8], 'bright', [-side * 8, -11, 10], new THREE.Euler(0.1, 0, -0.28 * side))
        break
      case 'space_blackhole':
        this.addBiomeMesh(group, 'blackhole_anchor_core', new THREE.DodecahedronGeometry(10, 0), 'dark', [0, 4, 10], new THREE.Euler(0.2, 0.1, 0.1))
        this.addBiomeBox(group, 'blackhole_spoke_a', [44, 4, 7], 'bright', [0, 4, 15], new THREE.Euler(0.08, 0.2 * side, 0.42))
        this.addBiomeBox(group, 'blackhole_spoke_b', [34, 4, 7], 'accent', [0, 4, 3], new THREE.Euler(0.04, -0.16 * side, -0.42))
        break
      case 'space_final':
      default:
        this.addBiomeBox(group, 'final_monolith', [13, 44, 22], ['dark', 'main', 'bright', 'far', 'near', 'accent'], [side * 4, 8, 6], new THREE.Euler(0.08, 0.1 * side, 0.02))
        this.addBiomeMesh(group, 'final_crown', new THREE.OctahedronGeometry(9, 0), 'bright', [side * 4, 34, 22])
        this.addBiomeBox(group, 'final_floor_key', [42, 5, 13], 'accent', [-side * 8, -18, -8], new THREE.Euler(0.02, 0, 0.12 * side))
        break
    }

    group.position.set(lane, y, z)
    this.biomeDressing.add(group)
    this.trackBiome(group, 0.74 + (index % 4) * 0.12, 0.015 * side, 2.4)
  }

  private buildStageGate(): void {
    this.stageGate.name = 'c1_stage_transition_gate'
    this.stageGate.visible = false
    this.stageGate.position.set(0, SCENE.HEIGHT * 0.4, DEPTH_LAYERS.TERRAIN + 20)

    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_left', [8, 58, 26], ['near', 'accent', 'bright', 'dark', 'main', 'far'], [-64, 0, 0], new THREE.Euler(0.08, 0.12, -0.02)))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_right', [8, 58, 26], ['near', 'accent', 'bright', 'dark', 'main', 'far'], [64, 0, 0], new THREE.Euler(0.08, -0.12, 0.02)))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_top', [136, 6, 18], ['bright', 'near', 'accent', 'dark', 'main', 'far'], [0, 30, 5]))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_depth_key', [22, 20, 36], 'bright', [0, 18, 18], new THREE.Euler(0.05, 0.2, 0)))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_left_node', [16, 12, 28], 'accent', [-36, 20, 14], new THREE.Euler(0.04, 0.18, 0.12)))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_right_node', [16, 12, 28], 'accent', [36, 20, 14], new THREE.Euler(0.04, -0.18, -0.12)))
    this.stageGatePieces.push(this.addBox(this.stageGate, 'stage_gate_far_bar', [92, 5, 10], 'dark', [0, -28, -10]))

    for (const piece of this.stageGatePieces) {
      piece.userData.baseRotation = piece.rotation.clone()
      piece.userData.baseZ = piece.position.z
    }
    this.root.add(this.stageGate)
  }

  private triggerStageGate(duration: number): void {
    this.stageGateDuration = Math.max(0.75, Math.min(3.4, duration))
    this.stageGateTime = 0
    this.stageGate.visible = true
    this.stageGate.position.set(0, SCENE.HEIGHT * 0.42, DEPTH_LAYERS.TERRAIN + 20)
    this.stageGate.rotation.set(0.08, 0, 0)
    this.stageGate.scale.setScalar(0.88)
    for (const piece of this.stageGatePieces) {
      const baseRotation = piece.userData.baseRotation as THREE.Euler | undefined
      if (baseRotation) piece.rotation.copy(baseRotation)
      if (typeof piece.userData.baseZ === 'number') piece.position.z = piece.userData.baseZ
    }
  }

  private updateStageGate(dt: number): void {
    if (!this.stageGate.visible || this.stageGateDuration <= 0) return

    this.stageGateTime += dt
    const t = THREE.MathUtils.clamp(this.stageGateTime / this.stageGateDuration, 0, 1)
    const eased = THREE.MathUtils.smoothstep(t, 0, 1)
    const pulse = Math.sin(Math.PI * t)

    this.stageGate.position.y = THREE.MathUtils.lerp(SCENE.HEIGHT * 0.42, -SCENE.HEIGHT * 0.18, eased)
    this.stageGate.position.z = DEPTH_LAYERS.TERRAIN + 20 + pulse * 9
    this.stageGate.rotation.y = Math.sin(this.time * 1.45) * 0.07 * pulse
    this.stageGate.rotation.z = (t - 0.5) * 0.045 * pulse
    this.stageGate.scale.setScalar(0.88 + pulse * 0.24)

    for (let i = 0; i < this.stageGatePieces.length; i++) {
      const piece = this.stageGatePieces[i]
      const baseRotation = piece.userData.baseRotation as THREE.Euler | undefined
      const baseZ = typeof piece.userData.baseZ === 'number' ? piece.userData.baseZ : piece.position.z
      if (baseRotation) {
        piece.rotation.z = baseRotation.z + (i % 2 === 0 ? 1 : -1) * 0.08 * pulse
      }
      piece.position.z = baseZ + Math.sin(this.time * 2.2 + i) * 1.2 * pulse
    }

    if (t >= 1) {
      this.stageGate.visible = false
      this.stageGateDuration = 0
    }
  }

  private addBox(
    group: THREE.Group,
    name: string,
    size: [number, number, number],
    role: MaterialRole | MaterialRole[],
    position: [number, number, number],
    rotation: THREE.Euler = new THREE.Euler(),
    materialBucket?: RoleMaterial[],
  ): THREE.Mesh {
    const material = Array.isArray(role)
      ? role.map((entry, index) => this.createMaterial(entry, index === 2 || index === 4 ? 0.22 : 0.08, materialBucket))
      : this.createMaterial(role, role === 'near' || role === 'bright' ? 0.24 : 0.08, materialBucket)
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material)
    mesh.name = name
    mesh.position.set(position[0], position[1], position[2])
    mesh.rotation.copy(rotation)
    mesh.frustumCulled = false
    group.add(mesh)
    return mesh
  }

  private addBiomeBox(
    group: THREE.Group,
    name: string,
    size: [number, number, number],
    role: MaterialRole | MaterialRole[],
    position: [number, number, number],
    rotation: THREE.Euler = new THREE.Euler(),
  ): THREE.Mesh {
    return this.addBox(group, name, size, role, position, rotation, this.biomeMaterials)
  }

  private addBiomeMesh(
    group: THREE.Group,
    name: string,
    geometry: THREE.BufferGeometry,
    role: MaterialRole | MaterialRole[],
    position: [number, number, number],
    rotation: THREE.Euler = new THREE.Euler(),
  ): THREE.Mesh {
    const material = Array.isArray(role)
      ? role.map((entry, index) => this.createMaterial(entry, index === 2 || index === 4 ? 0.22 : 0.08, this.biomeMaterials))
      : this.createMaterial(role, role === 'near' || role === 'bright' ? 0.24 : 0.08, this.biomeMaterials)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(position[0], position[1], position[2])
    mesh.rotation.copy(rotation)
    mesh.frustumCulled = false
    group.add(mesh)
    return mesh
  }

  private createMaterial(role: MaterialRole, emissiveScale: number, materialBucket?: RoleMaterial[]): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
      color: roleColor(this.palette, role),
      roughness: role === 'dark' ? 0.68 : 0.42,
      metalness: role === 'bright' || role === 'near' ? 0.42 : 0.24,
      emissive: this.palette.emissive,
      emissiveIntensity: emissiveScale,
    })
    const entry = { material, role, emissiveScale }
    this.materials.push(entry)
    materialBucket?.push(entry)
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

  private trackBiome(object: THREE.Object3D, speedMul: number, spin: number, wobble: number): void {
    this.biomeItems.push({
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
