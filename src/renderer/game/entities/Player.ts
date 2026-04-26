import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { clamp } from '@/utils/math'
import type { InputManager } from '@/game/systems/InputManager'
import { WeaponSystem, type BulletSpawn } from '@/game/systems/WeaponSystem'
import { buildPlayerShipV2 } from './player-ship/PlayerShipFactory'
import { createPlayerShipMaterials } from './player-ship/PlayerShipMaterials'
import { getFresnelRimHandle, type FresnelRimHandle } from '@/rendering/FresnelRim'

const MOVE_SPEED = 120
const FOCUS_SPEED = 50
const INVINCIBLE_TIME = 2.0
const HALF_W = SCENE.WIDTH / 2 - 8
const HALF_H = SCENE.HEIGHT / 2 - 8

const SPIN_RISE_TIME = 0.6
const SPIN_HANG_TIME = 0.3
const SPIN_FALL_TIME = 0.5
const SPIN_TOTAL = SPIN_RISE_TIME + SPIN_HANG_TIME + SPIN_FALL_TIME
const SPIN_MAX_Z = 8
const SPIN_COOLDOWN = 8
const HIT_FEEDBACK_TIME = 0.24
const USE_C1_SAFE_PLAYER_PROXY = true

type PlayerVisualMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial
type PlayerStateMode = 'idle' | 'firing' | 'focus' | 'hit' | 'spin'

export interface PlayerVisualState {
  mode: PlayerStateMode
  firing: boolean
  focusing: boolean
  spinning: boolean
  hitPulse: number
  enginePulse: number
}

export class Player extends Entity {
  lives = 5
  infiniteLives = false
  invincibleTimer = 0
  hitboxRadius = 4
  grazeRadius = 20

  readonly weapon = new WeaponSystem()
  readonly bulletRequests: BulletSpawn[] = []

  spinTimer = 0
  spinCooldown = 0
  spinBombReady = false

  private baseZ = DEPTH_LAYERS.PLAYER
  private savedY = 0
  private visualTime = 0
  private hitFeedbackTimer = 0

  private engineCoreMats: PlayerVisualMaterial[] = []
  private energyMats: PlayerVisualMaterial[] = []
  private hullMats: PlayerVisualMaterial[] = []
  private cockpitMat: PlayerVisualMaterial | null = null
  private hullRimHandles: FresnelRimHandle[] = []
  private cockpitRimHandle: FresnelRimHandle | null = null

  readonly visualState: PlayerVisualState = {
    mode: 'idle',
    firing: false,
    focusing: false,
    spinning: false,
    hitPulse: 0,
    enginePulse: 0.78,
  }

  constructor(scene: THREE.Scene) {
    super()
    this.position.set(0, -SCENE.HEIGHT / 2 + 40, DEPTH_LAYERS.PLAYER)
    this.mesh = buildPlayerMesh()
    this.mesh.position.copy(this.position)
    this.cacheVisualMaterials()
    scene.add(this.mesh)
  }

  updatePlayer(dt: number, input: InputManager): void {
    this.bulletRequests.length = 0
    this.spinBombReady = false

    this.visualTime += dt
    if (this.hitFeedbackTimer > 0) this.hitFeedbackTimer = Math.max(0, this.hitFeedbackTimer - dt)
    this.updateVisualState(input)

    if (this.spinCooldown > 0) this.spinCooldown -= dt

    if (this.invincibleTimer > 0) {
      if (Number.isFinite(this.invincibleTimer)) {
        this.invincibleTimer -= dt
        if (this.mesh) this.mesh.visible = Math.floor(this.invincibleTimer * 10) % 2 === 0
      } else if (this.mesh) {
        this.mesh.visible = true
      }
    } else if (this.mesh) {
      this.mesh.visible = true
    }

    if (this.spinTimer > 0) {
      this.updateSpin(dt)
      this.syncMesh()
      return
    }

    if (input.isJustPressed('bomb') && this.spinCooldown <= 0) {
      this.startSpin()
      this.updateVisualState(input)
      this.syncMesh()
      return
    }

    const speed = input.isHeld('focus') ? FOCUS_SPEED : MOVE_SPEED
    let dx = 0
    let dy = 0

    if (input.isHeld('moveLeft')) dx -= 1
    if (input.isHeld('moveRight')) dx += 1
    if (input.isHeld('moveUp')) dy += 1
    if (input.isHeld('moveDown')) dy -= 1
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707
      dy *= 0.707
    }

    this.position.x = clamp(this.position.x + dx * speed * dt, -HALF_W, HALF_W)
    this.position.y = clamp(this.position.y + dy * speed * dt, -HALF_H, HALF_H)

    if (this.mesh) {
      this.mesh.rotation.z = -dx * 0.36
      this.mesh.rotation.x = dy * 0.08
    }

    if (input.isJustPressed('weaponNext')) this.weapon.switchWeapon()

    const spawns = this.weapon.tryFire(dt, input.isHeld('fire'), this.position.x, this.position.y)
    this.bulletRequests.push(...spawns)

    this.syncMesh()
  }

  hit(): boolean {
    if (this.invincibleTimer > 0 || this.spinTimer > 0) return false
    if (!this.infiniteLives) this.lives--
    this.invincibleTimer = INVINCIBLE_TIME
    this.hitFeedbackTimer = HIT_FEEDBACK_TIME
    return true
  }

  isAlive(): boolean {
    return this.lives > 0 || this.infiniteLives
  }

  isSpinning(): boolean {
    return this.spinTimer > 0
  }

  getVisualState(): Readonly<PlayerVisualState> {
    return this.visualState
  }

  private startSpin(): void {
    this.spinTimer = SPIN_TOTAL
    this.spinCooldown = SPIN_COOLDOWN
    this.savedY = this.position.y
    this.invincibleTimer = SPIN_TOTAL + 0.5
  }

  private updateSpin(dt: number): void {
    this.spinTimer -= dt
    const elapsed = SPIN_TOTAL - this.spinTimer

    if (this.mesh) {
      this.mesh.rotation.z += dt * 20
      this.mesh.rotation.x += dt * 8
    }

    if (elapsed < SPIN_RISE_TIME) {
      const t = elapsed / SPIN_RISE_TIME
      this.position.y = this.savedY + t * 60
      this.position.z = this.baseZ + t * SPIN_MAX_Z
      return
    }

    if (elapsed < SPIN_RISE_TIME + SPIN_HANG_TIME) {
      this.position.y = this.savedY + 60
      this.position.z = this.baseZ + SPIN_MAX_Z
      return
    }

    const t = (elapsed - SPIN_RISE_TIME - SPIN_HANG_TIME) / SPIN_FALL_TIME
    this.position.y = this.savedY + 60 * (1 - t)
    this.position.z = this.baseZ + SPIN_MAX_Z * (1 - t * t)

    if (this.spinTimer <= 0) {
      this.spinTimer = 0
      this.position.y = this.savedY
      this.position.z = this.baseZ
      this.spinBombReady = true
      if (this.mesh) {
        this.mesh.rotation.z = 0
        this.mesh.rotation.x = 0
      }
    }
  }

  private cacheVisualMaterials(): void {
    if (!this.mesh) return

    const engineSet = new Set<PlayerVisualMaterial>()
    const energySet = new Set<PlayerVisualMaterial>()
    const hullSet = new Set<PlayerVisualMaterial>()
    const rimSet = new Set<FresnelRimHandle>()

    this.mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      if (!(obj.material instanceof THREE.MeshStandardMaterial || obj.material instanceof THREE.MeshPhysicalMaterial)) return

      const name = obj.name.toLowerCase()
      if (name.includes('engine_core')) {
        engineSet.add(obj.material)
      } else if (name.includes('rail') || name.includes('blade')) {
        energySet.add(obj.material)
      } else if (name.includes('cockpit')) {
        this.cockpitMat = obj.material
      } else if (name.includes('nose') || name.includes('spine') || name.includes('wing') || name.includes('armor')) {
        hullSet.add(obj.material)
      }

      const rim = getFresnelRimHandle(obj.material)
      if (rim) {
        if (name.includes('cockpit')) this.cockpitRimHandle = rim
        if (name.includes('nose') || name.includes('spine') || name.includes('wing') || name.includes('armor')) {
          rimSet.add(rim)
        }
      }
    })

    this.engineCoreMats = [...engineSet]
    this.energyMats = [...energySet]
    this.hullMats = [...hullSet]
    this.hullRimHandles = [...rimSet]
  }

  private updateVisualState(input: InputManager): void {
    const firing = input.isHeld('fire')
    const focusing = input.isHeld('focus')
    const spinning = this.spinTimer > 0
    const hitPulse = this.hitFeedbackTimer > 0
      ? 0.68 + Math.sin(this.visualTime * 40) * 0.32
      : 0
    const hitBoost = this.hitFeedbackTimer > 0 ? 1.35 + hitPulse * 0.4 : 1
    const spinBoost = spinning ? 1.24 : 1
    const pulse = 0.78 + Math.sin(this.visualTime * 14) * 0.22

    this.visualState.firing = firing
    this.visualState.focusing = focusing
    this.visualState.spinning = spinning
    this.visualState.hitPulse = hitPulse
    this.visualState.enginePulse = pulse
    this.visualState.mode = spinning
      ? 'spin'
      : this.hitFeedbackTimer > 0
        ? 'hit'
        : focusing
          ? 'focus'
          : firing
            ? 'firing'
            : 'idle'

    for (const mat of this.engineCoreMats) {
      mat.emissiveIntensity = (firing ? 2.8 + pulse * 0.9 : 1.85 + pulse * 0.45) * hitBoost * spinBoost
      mat.color.setHex(this.hitFeedbackTimer > 0 ? 0xffd59e : focusing ? 0xffaa63 : 0xff8d44)
      mat.emissive.setHex(this.hitFeedbackTimer > 0 ? 0xffa74f : focusing ? 0xff7b2f : 0xff541c)
      mat.roughness = focusing ? 0.18 : 0.24
    }

    for (const mat of this.energyMats) {
      mat.emissiveIntensity = (firing ? 1.45 + pulse * 0.65 : 0.78 + pulse * 0.35) * hitBoost * spinBoost
      mat.emissive.setHex(this.hitFeedbackTimer > 0 ? 0x9fe2ff : focusing ? 0x49d4ff : 0x1e90ff)
      mat.color.setHex(this.hitFeedbackTimer > 0 ? 0xcff2ff : focusing ? 0x8ce2ff : 0x63bfff)
      mat.roughness = focusing ? 0.12 : 0.2
    }

    if (this.cockpitMat) {
      this.cockpitMat.emissiveIntensity = (focusing ? 1.05 : 0.5) * hitBoost
      this.cockpitMat.opacity = (focusing ? 0.96 : 0.92) + (spinning ? 0.02 : 0)
      this.cockpitMat.color.setHex(this.hitFeedbackTimer > 0 ? 0xc9f5ff : focusing ? 0xaee6ff : 0x7fd6ff)
      this.cockpitMat.roughness = focusing ? 0.06 : 0.1
      if (this.cockpitMat instanceof THREE.MeshPhysicalMaterial) {
        this.cockpitMat.clearcoat = focusing ? 1 : 0.9
        this.cockpitMat.clearcoatRoughness = focusing ? 0.05 : 0.08
      }
    }

    for (const mat of this.hullMats) {
      mat.roughness = focusing ? 0.3 : 0.42
      mat.metalness = focusing ? 0.76 : 0.62
      mat.emissiveIntensity = this.hitFeedbackTimer > 0 ? 0.05 + hitPulse * 0.15 : 0
      mat.emissive.setHex(this.hitFeedbackTimer > 0 ? 0xbadfff : 0x000000)
      if (mat instanceof THREE.MeshPhysicalMaterial) {
        mat.clearcoat = focusing ? 1.0 : 0.9
        mat.clearcoatRoughness = focusing ? 0.12 : 0.18
      }
    }

    if (this.cockpitRimHandle) {
      this.cockpitRimHandle.setIntensity(
        0.34
        + (focusing ? 0.22 : 0)
        + (spinning ? 0.28 : 0)
        + (this.hitFeedbackTimer > 0 ? 0.26 * hitPulse : 0),
      )
      this.cockpitRimHandle.setPower(spinning ? 2.0 : focusing ? 2.2 : 2.6)
    }

    for (const rim of this.hullRimHandles) {
      rim.setIntensity(
        0.09
        + (focusing ? 0.08 : 0)
        + (spinning ? 0.16 : 0)
        + (this.hitFeedbackTimer > 0 ? 0.16 * hitPulse : 0),
      )
      rim.setPower(spinning ? 2.4 : 2.9)
    }
  }
}

function buildPlayerMesh(): THREE.Group {
  return USE_C1_SAFE_PLAYER_PROXY ? buildC1SafePlayerProxy() : buildPlayerShipV2()
}

function addSafePlayerPart(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position: [number, number, number],
  rotation: THREE.Euler = new THREE.Euler(),
): void {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(position[0], position[1], position[2])
  mesh.rotation.copy(rotation)
  mesh.frustumCulled = false
  group.add(mesh)
}

function buildC1SafePlayerProxy(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'player_ship_c1_safe_proxy'

  const mats = createPlayerShipMaterials()
  mats.canopy.transparent = false
  mats.canopy.opacity = 1
  mats.canopy.transmission = 0
  mats.canopy.thickness = 0

  const sideMats = [
    mats.hero,
    mats.hull,
    new THREE.MeshStandardMaterial({ color: 0x4de2ff, roughness: 0.34, metalness: 0.42, emissive: 0x0b3b52, emissiveIntensity: 0.25 }),
    new THREE.MeshStandardMaterial({ color: 0xffa24a, roughness: 0.36, metalness: 0.32, emissive: 0x3b1405, emissiveIntensity: 0.18 }),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.5 }),
    mats.dark,
  ]

  addSafePlayerPart(
    group,
    'player_armor_body',
    new THREE.BoxGeometry(16, 32, 34),
    sideMats,
    [0, 0, 0],
    new THREE.Euler(0.04, 0, 0),
  )
  addSafePlayerPart(
    group,
    'player_nose_block',
    new THREE.BoxGeometry(11, 18, 26),
    mats.hero,
    [0, 22, 1.5],
    new THREE.Euler(-0.05, 0, 0),
  )
  addSafePlayerPart(
    group,
    'player_cockpit_c1',
    new THREE.BoxGeometry(8, 12, 18),
    mats.canopy,
    [0, 9, 21],
    new THREE.Euler(-0.08, 0, 0),
  )
  addSafePlayerPart(
    group,
    'player_armor_belly',
    new THREE.BoxGeometry(12, 22, 12),
    mats.dark,
    [0, -2, -22],
  )

  for (const side of [-1, 1]) {
    addSafePlayerPart(
      group,
      `player_wing_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(30, 8, 16),
      side < 0 ? mats.hull : mats.hero,
      [21 * side, -4, 0],
      new THREE.Euler(0.08, 0.04 * side, -0.18 * side),
    )
    addSafePlayerPart(
      group,
      `player_rail_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(3, 26, 7),
      mats.rail,
      [9.5 * side, 4, 17],
      new THREE.Euler(0.06, 0, -0.05 * side),
    )
    addSafePlayerPart(
      group,
      `player_engine_core_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(7, 9, 12),
      mats.engineCore,
      [7 * side, -21, -1],
    )
  }

  group.scale.setScalar(0.74)
  return group
}
