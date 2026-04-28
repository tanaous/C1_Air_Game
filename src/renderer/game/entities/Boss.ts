/**
 * Boss 基类 — 分层结构 + 状态机 + 阶段视觉参数
 */

import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS, BOSS_PHASE_VISUAL_TEMPLATE, type BossPhaseVisualConfig } from '@/game/GameConfig'
import { BulletEmitter, type EnemyBulletSpawn } from '@/game/systems/BulletEmitter'

export interface BossPhase {
  hpThreshold: number
  emitters: BulletEmitter[]
}

export type BossActionState =
  | 'idle'
  | 'aim'
  | 'charge'
  | 'attack'
  | 'recover'
  | 'phaseTransition'
  | 'breakdown'

type BossSurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial | THREE.MeshPhongMaterial
const C1_SAFE_BOSS_PROXY = false
const C1_FORCE_OPAQUE_BOSS_MATERIALS = true

function isBossSurfaceMaterial(mat: THREE.Material): mat is BossSurfaceMaterial {
  return mat instanceof THREE.MeshStandardMaterial
    || mat instanceof THREE.MeshPhysicalMaterial
    || mat instanceof THREE.MeshPhongMaterial
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function buildVisualConfig(phaseCount: number): BossPhaseVisualConfig[] {
  const out: BossPhaseVisualConfig[] = []
  for (let i = 0; i < phaseCount; i++) {
    const base = BOSS_PHASE_VISUAL_TEMPLATE[Math.min(i, BOSS_PHASE_VISUAL_TEMPLATE.length - 1)]
    out.push({
      ...base,
      phase: i + 1,
      attackTelegraphMs: Math.max(350, base.attackTelegraphMs - Math.max(0, i - 2) * 80),
      transitionDurationMs: Math.max(420, base.transitionDurationMs - Math.max(0, i - 2) * 70),
      screenDarken: clamp01(base.screenDarken + Math.max(0, i - 2) * 0.06),
    })
  }
  return out
}

export abstract class Boss extends Entity {
  name: string
  maxHp: number
  hp: number
  scoreValue: number
  phases: BossPhase[]
  currentPhase = 0
  fightDuration = 0
  defeated = false
  entering = true
  enterSpeed = 40
  targetY: number

  private actionState: BossActionState = 'idle'
  private stateTimer = 0
  private transitionFromPhase = 0
  private transitionTimer = 0
  private transitionDuration = 0.9
  private telegraphStrength = 0
  private screenDarken = 0
  private weakPointExposure = 0.2

  private visualConfigs: BossPhaseVisualConfig[]
  private armorLayer: THREE.Object3D | null = null
  private coreLayer: THREE.Object3D | null = null
  private weaponLayer: THREE.Object3D | null = null
  private weakPointLayer: THREE.Object3D | null = null
  private armorMats: BossSurfaceMaterial[] = []
  private coreMats: BossSurfaceMaterial[] = []
  private weakMats: BossSurfaceMaterial[] = []

  readonly bulletRequests: EnemyBulletSpawn[] = []

  constructor(
    scene: THREE.Scene,
    name: string,
    maxHp: number,
    scoreValue: number,
    phases: BossPhase[],
    visualConfigs?: BossPhaseVisualConfig[],
  ) {
    super()
    this.name = name
    this.maxHp = maxHp
    this.hp = maxHp
    this.scoreValue = scoreValue
    this.phases = phases
    this.hitboxRadius = 30
    this.targetY = SCENE.HEIGHT / 2 - 80
    this.visualConfigs = visualConfigs?.length ? visualConfigs : buildVisualConfig(phases.length)

    // Boss 从更深层入场，强化压迫感
    this.position.set(0, SCENE.HEIGHT / 2 + 60, DEPTH_LAYERS.ENEMY - 3.2)
    scene
  }

  protected bindMesh(scene: THREE.Scene, mesh: THREE.Group): void {
    if (C1_SAFE_BOSS_PROXY) {
      this.disposeDetachedMesh(mesh)
      this.mesh = buildC1SafeBossProxy(this.name)
    } else {
      this.mesh = mesh
    }
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
    this.cacheVisualLayers()
    this.applyVisualConfig(this.getPhaseConfig(0), true)
  }

  updateBoss(dt: number, playerX: number, playerY: number): void {
    this.bulletRequests.length = 0

    if (this.entering) {
      this.position.y -= this.enterSpeed * dt
      this.position.z += 2 * dt
      if (this.position.z > DEPTH_LAYERS.ENEMY) this.position.z = DEPTH_LAYERS.ENEMY
      if (this.position.y <= this.targetY) {
        this.position.y = this.targetY
        this.entering = false
      }
      this.syncMesh()
      return
    }

    this.fightDuration += dt
    this.evaluatePhaseTransition()

    if (this.actionState === 'phaseTransition') {
      this.updatePhaseTransition(dt)
    } else {
      this.updateActionState(dt, playerX, playerY)
      this.applyVisualConfig(this.getPhaseConfig(this.currentPhase), false)
    }

    this.updateMovement(dt)
    this.syncMesh()
  }

  abstract updateMovement(dt: number): void

  takeDamage(amount: number): boolean {
    if (this.entering || this.actionState === 'breakdown') return false
    this.hp -= amount
    if (this.hp <= 0) {
      this.hp = 0
      this.defeated = true
      this.actionState = 'breakdown'
      this.destroy()
      return true
    }
    return false
  }

  getActionState(): BossActionState {
    return this.actionState
  }

  getTelegraphStrength(): number {
    return this.telegraphStrength
  }

  getScreenDarken(): number {
    return this.screenDarken
  }

  getWeakPointExposure(): number {
    return this.weakPointExposure
  }

  private evaluatePhaseTransition(): void {
    const hpPct = this.hp / this.maxHp
    let targetPhase = 0
    for (let i = this.phases.length - 1; i >= 0; i--) {
      if (hpPct <= this.phases[i].hpThreshold) {
        targetPhase = i
        break
      }
    }

    if (targetPhase > this.currentPhase && this.actionState !== 'phaseTransition' && this.actionState !== 'breakdown') {
      this.transitionFromPhase = this.currentPhase
      this.currentPhase = targetPhase
      this.transitionTimer = 0
      this.transitionDuration = Math.max(0.4, this.getPhaseConfig(this.currentPhase).transitionDurationMs / 1000)
      this.setActionState('phaseTransition')
    }
  }

  private updatePhaseTransition(dt: number): void {
    this.transitionTimer += dt
    const t = clamp01(this.transitionTimer / this.transitionDuration)
    const from = this.getPhaseConfig(this.transitionFromPhase)
    const to = this.getPhaseConfig(this.currentPhase)
    this.applyInterpolatedVisual(from, to, t)
    this.telegraphStrength = 0.35 + (1 - t) * 0.45
    this.screenDarken = lerp(from.screenDarken, to.screenDarken, t) * 0.8
    if (t >= 1) this.setActionState('idle')
  }

  private updateActionState(dt: number, playerX: number, playerY: number): void {
    const cfg = this.getPhaseConfig(this.currentPhase)
    this.stateTimer += dt

    switch (this.actionState) {
      case 'idle':
        this.telegraphStrength = 0
        this.screenDarken = cfg.screenDarken * 0.12
        if (this.stateTimer >= 0.55) this.setActionState('aim')
        break
      case 'aim':
        this.telegraphStrength = 0.18
        this.screenDarken = cfg.screenDarken * 0.18
        if (this.mesh) {
          const aimDelta = Math.max(-0.3, Math.min(0.3, (playerX - this.position.x) * 0.003))
          this.mesh.rotation.z = lerp(this.mesh.rotation.z, -aimDelta, 0.18)
          this.mesh.rotation.x = lerp(this.mesh.rotation.x, 0.04 + Math.abs(aimDelta) * 0.2, 0.12)
        }
        if (this.stateTimer >= 0.36) this.setActionState('charge')
        break
      case 'charge': {
        const chargeDur = Math.max(0.35, cfg.attackTelegraphMs / 1000)
        const p = clamp01(this.stateTimer / chargeDur)
        this.telegraphStrength = 0.25 + p * 0.75
        this.screenDarken = cfg.screenDarken * (0.35 + p * 0.65)
        if (this.stateTimer >= chargeDur) this.setActionState('attack')
        break
      }
      case 'attack': {
        this.telegraphStrength = 1
        this.screenDarken = cfg.screenDarken
        const phase = this.phases[this.currentPhase]
        if (phase) {
          for (const emitter of phase.emitters) {
            this.bulletRequests.push(...emitter.update(dt, this.position.x, this.position.y, playerX, playerY))
          }
        }
        if (this.stateTimer >= 0.5) this.setActionState('recover')
        break
      }
      case 'recover':
        this.telegraphStrength = Math.max(0, 1 - this.stateTimer / 0.45)
        this.screenDarken = cfg.screenDarken * 0.2
        if (this.mesh) {
          this.mesh.rotation.z = lerp(this.mesh.rotation.z, 0, 0.15)
          this.mesh.rotation.x = lerp(this.mesh.rotation.x, 0, 0.15)
        }
        if (this.stateTimer >= 0.45) this.setActionState('idle')
        break
      case 'breakdown':
      case 'phaseTransition':
        break
      default:
        this.setActionState('idle')
    }
  }

  private setActionState(next: BossActionState): void {
    this.actionState = next
    this.stateTimer = 0
  }

  private getPhaseConfig(index: number): BossPhaseVisualConfig {
    return this.visualConfigs[Math.min(index, this.visualConfigs.length - 1)]
  }

  private cacheVisualLayers(): void {
    if (!this.mesh) return

    this.armorLayer = this.mesh.getObjectByName('armorLayer') ?? null
    this.coreLayer = this.mesh.getObjectByName('coreLayer') ?? null
    this.weaponLayer = this.mesh.getObjectByName('weaponLayer') ?? null
    this.weakPointLayer = this.mesh.getObjectByName('weakPointLayer') ?? null

    if (!this.armorLayer) this.armorLayer = this.mesh
    if (!this.coreLayer) this.coreLayer = this.mesh
    if (!this.weaponLayer) this.weaponLayer = this.mesh
    if (!this.weakPointLayer) this.weakPointLayer = this.mesh

    this.armorMats = this.collectLayerMaterials(this.armorLayer)
    this.coreMats = this.collectLayerMaterials(this.coreLayer)
    this.weakMats = this.collectLayerMaterials(this.weakPointLayer)
  }

  private collectLayerMaterials(layer: THREE.Object3D): BossSurfaceMaterial[] {
    const set = new Set<BossSurfaceMaterial>()
    layer.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of materials) {
        if (!m) continue
        if (isBossSurfaceMaterial(m)) set.add(m)
      }
    })
    return [...set]
  }

  private applyInterpolatedVisual(from: BossPhaseVisualConfig, to: BossPhaseVisualConfig, t: number): void {
    this.applyVisualConfig(
      {
        phase: to.phase,
        armorOpacity: lerp(from.armorOpacity, to.armorOpacity, t),
        coreEmissive: lerp(from.coreEmissive, to.coreEmissive, t),
        weakPointExposure: lerp(from.weakPointExposure, to.weakPointExposure, t),
        attackTelegraphMs: lerp(from.attackTelegraphMs, to.attackTelegraphMs, t),
        transitionDurationMs: lerp(from.transitionDurationMs, to.transitionDurationMs, t),
        screenDarken: lerp(from.screenDarken, to.screenDarken, t),
      },
      false,
    )
  }

  private applyVisualConfig(cfg: BossPhaseVisualConfig, force: boolean): void {
    if (!force && this.actionState !== 'phaseTransition') {
      this.screenDarken = Math.max(this.screenDarken, cfg.screenDarken * 0.1)
    }

    this.weakPointExposure = cfg.weakPointExposure

    for (const mat of this.armorMats) {
      mat.transparent = !C1_FORCE_OPAQUE_BOSS_MATERIALS && !C1_SAFE_BOSS_PROXY && cfg.armorOpacity < 0.99
      mat.opacity = C1_FORCE_OPAQUE_BOSS_MATERIALS || C1_SAFE_BOSS_PROXY ? 1 : cfg.armorOpacity
      if (mat instanceof THREE.MeshPhongMaterial) {
        mat.shininess = 35 + this.currentPhase * 8
      } else {
        mat.roughness = Math.max(0.2, 0.5 - this.currentPhase * 0.07)
        mat.metalness = Math.min(0.95, 0.45 + this.currentPhase * 0.12)
      }
    }

    for (const mat of this.coreMats) {
      if (mat instanceof THREE.MeshPhongMaterial) {
        mat.emissiveIntensity = cfg.coreEmissive
      } else {
        mat.emissiveIntensity = cfg.coreEmissive
        mat.roughness = Math.max(0.06, 0.3 - this.currentPhase * 0.06)
      }
    }

    for (const mat of this.weakMats) {
      mat.transparent = false
      mat.opacity = 1
      if (mat instanceof THREE.MeshPhongMaterial) {
        mat.emissiveIntensity = 0.9 + cfg.weakPointExposure * 1.6
      } else {
        mat.emissiveIntensity = 0.9 + cfg.weakPointExposure * 1.6
      }
    }

    if (this.weakPointLayer) {
      const s = 0.72 + cfg.weakPointExposure * 0.52
      this.weakPointLayer.scale.set(s, s, s)
      this.weakPointLayer.position.z = 8 + cfg.weakPointExposure * 6
    }

    if (this.coreLayer) {
      const spin = 0.25 + cfg.coreEmissive * 0.03
      this.coreLayer.rotation.z += spin * 0.003
    }
  }

  private disposeDetachedMesh(mesh: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      geometries.add(child.geometry)
      const mat = child.material
      if (Array.isArray(mat)) {
        for (const entry of mat) materials.add(entry)
      } else {
        materials.add(mat)
      }
    })
    for (const geo of geometries) geo.dispose()
    for (const mat of materials) mat.dispose()
  }
}

function bossMat(color: number, emissive = 0x000000, emissiveIntensity = 0.12): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.38,
    metalness: 0.42,
    emissive,
    emissiveIntensity,
  })
}

function addBossBox(
  group: THREE.Group,
  name: string,
  size: [number, number, number],
  material: THREE.Material | THREE.Material[],
  position: [number, number, number],
  rotation: THREE.Euler = new THREE.Euler(),
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material)
  mesh.name = name
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.copy(rotation)
  mesh.frustumCulled = false
  group.add(mesh)
  return mesh
}

function buildC1SafeBossProxy(name: string): THREE.Group {
  const group = new THREE.Group()
  group.name = `boss_${name}_c1_safe_proxy`

  const armorLayer = new THREE.Group()
  armorLayer.name = 'armorLayer'
  const coreLayer = new THREE.Group()
  coreLayer.name = 'coreLayer'
  const weaponLayer = new THREE.Group()
  weaponLayer.name = 'weaponLayer'
  const weakPointLayer = new THREE.Group()
  weakPointLayer.name = 'weakPointLayer'
  group.add(armorLayer, coreLayer, weaponLayer, weakPointLayer)

  const red = bossMat(0xff4f4f, 0x3a0808, 0.22)
  const cyan = bossMat(0x6de9ff, 0x1599ff, 1.1)
  const gold = bossMat(0xffc957, 0x5a2a03, 0.26)
  const dark = bossMat(0x17202a)
  const white = bossMat(0xe8f3ff, 0x182d42, 0.18)
  const faceMats = [red, dark, gold, white, cyan, dark]

  addBossBox(armorLayer, 'boss_armor_main', [72, 42, 58], faceMats, [0, 0, 0], new THREE.Euler(0.04, 0, 0))
  addBossBox(armorLayer, 'boss_armor_left', [32, 34, 44], gold, [-46, -4, -2], new THREE.Euler(0.08, -0.1, 0.12))
  addBossBox(armorLayer, 'boss_armor_right', [32, 34, 44], red, [46, -4, -2], new THREE.Euler(0.08, 0.1, -0.12))
  addBossBox(armorLayer, 'boss_armor_keel', [28, 56, 30], dark, [0, -18, -32])

  addBossBox(coreLayer, 'boss_core_block', [30, 24, 28], cyan, [0, 8, 34], new THREE.Euler(-0.06, 0, 0))
  addBossBox(weakPointLayer, 'boss_weak_point_block', [20, 16, 18], white, [0, 12, 52])

  addBossBox(weaponLayer, 'boss_cannon_left', [11, 34, 14], cyan, [-22, 30, 18], new THREE.Euler(0.08, 0, 0.06))
  addBossBox(weaponLayer, 'boss_cannon_right', [11, 34, 14], cyan, [22, 30, 18], new THREE.Euler(0.08, 0, -0.06))
  addBossBox(weaponLayer, 'boss_engine_left', [16, 16, 18], gold, [-24, -32, -10])
  addBossBox(weaponLayer, 'boss_engine_right', [16, 16, 18], gold, [24, -32, -10])

  group.scale.setScalar(0.88)
  return group
}
