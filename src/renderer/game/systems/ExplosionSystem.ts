import * as THREE from 'three'
import { DEPTH_LAYERS } from '@/game/GameConfig'
import type { PowerUpType } from '@/game/entities/PowerUp'
import type { WeaponType } from '@shared/types'

const C1_SAFE_EXPLOSIONS = true
const MAX_C1_SAFE_PARTICLES = 120
const MAX_FULL_PARTICLES = 260

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

const MAT_GOLD = new THREE.MeshStandardMaterial({
  color: 0xffdf7d,
  emissive: 0xff7a18,
  emissiveIntensity: 2.4,
  roughness: 0.28,
  metalness: 0.5,
  flatShading: true,
})

const MAT_IMPACT = new THREE.MeshStandardMaterial({
  color: 0xeef8ff,
  emissive: 0x8fe8ff,
  emissiveIntensity: 2.7,
  roughness: 0.2,
  metalness: 0.55,
  flatShading: true,
})

const MAT_PLAYER_GUARD = new THREE.MeshStandardMaterial({
  color: 0xa8f4ff,
  emissive: 0x27c8ff,
  emissiveIntensity: 2.2,
  roughness: 0.18,
  metalness: 0.58,
  flatShading: true,
})

const SHARD_GEO = new THREE.IcosahedronGeometry(1.7, 0)
const CHUNK_GEO = new THREE.TetrahedronGeometry(2.1)
const SPARK_GEO = new THREE.SphereGeometry(1.2, 5, 4)
const SLIVER_GEO = new THREE.BoxGeometry(0.9, 3.2, 0.9)
const MUZZLE_GEO = new THREE.OctahedronGeometry(1, 0).scale(1.8, 5.4, 3.2)
const IMPACT_CORE_GEO = new THREE.OctahedronGeometry(1, 0).scale(3.2, 3.2, 4.8)
const BURST_CHUNK_GEO = new THREE.TetrahedronGeometry(2.8, 0)
const GUARD_CORE_GEO = new THREE.OctahedronGeometry(1, 0).scale(5.0, 5.0, 8.0)
const GUARD_RAY_GEO = new THREE.BoxGeometry(1.2, 7.5, 2.4)
const PICKUP_GEO = new THREE.OctahedronGeometry(1, 0).scale(2.4, 2.4, 3.6)
const WARNING_BEACON_GEO = new THREE.OctahedronGeometry(1, 0).scale(3.8, 3.8, 7.5)
const WARNING_RAY_GEO = new THREE.BoxGeometry(1.2, 11.0, 2.8)
const BOSS_CORE_BURST_GEO = new THREE.DodecahedronGeometry(2.7, 0)

const POWERUP_COLORS: Record<PowerUpType, number> = {
  weapon_upgrade: 0xffaa00,
  weapon_shot: 0x4488ff,
  weapon_spread: 0x44ff44,
  weapon_laser: 0xff44ff,
  extra_life: 0xffdd00,
  bomb: 0xff8800,
  gem_small: 0x44ff88,
  gem_large: 0xffcc00,
}

function buildPowerUpMaterials(emissiveIntensity: number): Record<PowerUpType, THREE.MeshStandardMaterial> {
  return Object.fromEntries(
    (Object.entries(POWERUP_COLORS) as Array<[PowerUpType, number]>).map(([type, color]) => [
      type,
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity,
        roughness: 0.22,
        metalness: 0.55,
        flatShading: true,
      }),
    ]),
  ) as Record<PowerUpType, THREE.MeshStandardMaterial>
}

const POWERUP_DROP_MATS = buildPowerUpMaterials(1.35)
const POWERUP_COLLECT_MATS = buildPowerUpMaterials(1.55)
const POWERUP_VALUABLE_MATS = buildPowerUpMaterials(2.1)

const WEAPON_FEEDBACK_MATS: Record<WeaponType, THREE.MeshStandardMaterial> = {
  shot: new THREE.MeshStandardMaterial({
    color: 0xffd06a,
    emissive: 0xff8a18,
    emissiveIntensity: 1.8,
    roughness: 0.22,
    metalness: 0.55,
    flatShading: true,
  }),
  spread: new THREE.MeshStandardMaterial({
    color: 0x7bff8a,
    emissive: 0x22d85a,
    emissiveIntensity: 1.7,
    roughness: 0.22,
    metalness: 0.55,
    flatShading: true,
  }),
  laser: new THREE.MeshStandardMaterial({
    color: 0xd48aff,
    emissive: 0x9936ff,
    emissiveIntensity: 1.9,
    roughness: 0.22,
    metalness: 0.55,
    flatShading: true,
  }),
}

export class ExplosionSystem {
  private particles: Particle[] = []
  private scene: THREE.Scene

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  spawnEnemyHit(x: number, y: number): void {
    this.emitDirected(x, y, DEPTH_LAYERS.BULLET + 1.4, 2, 44, 0.12, [MAT_IMPACT], 1.0, 1.2, [IMPACT_CORE_GEO], Math.PI / 2, 0.35)
    this.emitDirected(x, y - 1, DEPTH_LAYERS.BULLET, 5, 82, 0.2, [MAT_WHITE, MAT_CYAN], 1.2, 3.0, [SPARK_GEO, SLIVER_GEO], Math.PI / 2, 0.9)
  }

  spawnEnemyKill(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET + 1.8, 4, 36, 0.16, [MAT_WHITE, MAT_GOLD], 1.2, 2.0, [IMPACT_CORE_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 18, 116, 0.55, [MAT_ORANGE, MAT_RED, MAT_WHITE], 2.2, 7.0, [CHUNK_GEO, SHARD_GEO, SLIVER_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.BULLET + 1.2, 84, 0.34, [MAT_GOLD, MAT_ORANGE], 2.2, 5.5, [BURST_CHUNK_GEO, SLIVER_GEO])
    this.emitDirected(x, y - 2, DEPTH_LAYERS.BULLET + 2, 5, 74, 0.24, [MAT_CYAN, MAT_WHITE], 1.4, 3.0, [SPARK_GEO], Math.PI / 2, 1.6)
  }

  spawnSmall(x: number, y: number): void {
    this.spawnEnemyKill(x, y)
  }

  spawnMedium(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 28, 136, 0.8, [MAT_ORANGE, MAT_RED, MAT_WHITE], 2.3, 8.8, [CHUNK_GEO, SHARD_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 10, 80, 0.45, [MAT_CYAN, MAT_WHITE], 1.4, 4.4, [SPARK_GEO, SLIVER_GEO])
  }

  spawnBoss(x: number, y: number): void {
    this.spawnBossDefeat(x, y)
  }

  spawnBossWarning(x: number, y: number): void {
    for (const offset of [-42, 0, 42]) {
      this.emit(x + offset, y, DEPTH_LAYERS.ENEMY + 8, 3, 34, 0.22, [MAT_RED, MAT_GOLD, MAT_WHITE], 1.5, 3.5, [WARNING_BEACON_GEO])
      this.emitDirected(x + offset, y + 10, DEPTH_LAYERS.ENEMY + 7, 2, 82, 0.26, [MAT_GOLD, MAT_RED], 2.2, 3.5, [WARNING_RAY_GEO], -Math.PI / 2, 0.2)
    }
    this.emitBurstRing(x, y, DEPTH_LAYERS.ENEMY + 6, 66, 0.24, [MAT_RED, MAT_GOLD], 2.2, 10, [WARNING_RAY_GEO, SLIVER_GEO])
  }

  spawnBossIntro(x: number, y: number): void {
    this.emit(x, y + 4, DEPTH_LAYERS.ENEMY + 7, 12, 62, 0.42, [MAT_VIOLET, MAT_CYAN, MAT_WHITE], 3.2, 13, [WARNING_BEACON_GEO, IMPACT_CORE_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.ENEMY + 6, 96, 0.36, [MAT_CYAN, MAT_VIOLET, MAT_WHITE], 3.4, 15, [WARNING_RAY_GEO, BURST_CHUNK_GEO])
    this.emitDirected(x, y + 20, DEPTH_LAYERS.ENEMY + 8, 9, 92, 0.34, [MAT_WHITE, MAT_CYAN], 3.5, 18, [SLIVER_GEO, WARNING_RAY_GEO], -Math.PI / 2, 0.55)
  }

  spawnBossDefeat(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET + 4, 10, 78, 0.32, [MAT_WHITE, MAT_GOLD, MAT_CYAN], 4.2, 8, [IMPACT_CORE_GEO, BOSS_CORE_BURST_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.BULLET + 3, 126, 0.5, [MAT_GOLD, MAT_ORANGE, MAT_WHITE], 4.5, 18, [BOSS_CORE_BURST_GEO, BURST_CHUNK_GEO, SLIVER_GEO])
    this.emit(x, y, DEPTH_LAYERS.BULLET, 46, 178, 1.25, [MAT_WHITE, MAT_ORANGE, MAT_RED], 5.0, 20, [CHUNK_GEO, SHARD_GEO, SLIVER_GEO])
    this.emitDirected(x, y - 4, DEPTH_LAYERS.BULLET + 2, 10, 118, 0.56, [MAT_CYAN, MAT_VIOLET, MAT_WHITE], 4.0, 14, [SPARK_GEO, SHARD_GEO], Math.PI / 2, Math.PI * 1.25)
  }

  spawnBossPhaseShift(x: number, y: number): void {
    this.emit(x, y + 2, DEPTH_LAYERS.BULLET + 4, 6, 58, 0.24, [MAT_VIOLET, MAT_CYAN, MAT_WHITE], 2.8, 6, [IMPACT_CORE_GEO, WARNING_BEACON_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.BULLET + 3, 96, 0.34, [MAT_VIOLET, MAT_CYAN, MAT_WHITE], 3.2, 10, [WARNING_RAY_GEO, SLIVER_GEO])
    this.emitDirected(x, y + 4, DEPTH_LAYERS.BULLET + 4, 8, 112, 0.34, [MAT_WHITE, MAT_CYAN], 3.0, 10, [SPARK_GEO, SLIVER_GEO], Math.PI / 2, Math.PI * 1.15)
  }

  spawnBossHit(x: number, y: number): void {
    this.emitDirected(x, y, DEPTH_LAYERS.BULLET + 2.2, 4, 74, 0.18, [MAT_IMPACT, MAT_CYAN], 1.6, 4.4, [IMPACT_CORE_GEO, SPARK_GEO], Math.PI / 2, 1.2)
    this.emitDirected(x, y - 2, DEPTH_LAYERS.BULLET + 1.2, 4, 96, 0.24, [MAT_WHITE, MAT_CYAN], 2.0, 5.5, [SLIVER_GEO, SPARK_GEO], Math.PI / 2, 1.5)
  }

  spawnEnemyDamageVent(x: number, y: number, heavy = false): void {
    const side = Math.random() < 0.5 ? -1 : 1
    this.emitDirected(x + side * (heavy ? 12 : 8), y + (Math.random() - 0.5) * 10, DEPTH_LAYERS.ENEMY + 3, heavy ? 3 : 2, heavy ? 70 : 54, 0.18, [MAT_ORANGE, MAT_RED, MAT_WHITE], heavy ? 2.2 : 1.4, heavy ? 4.8 : 3.2, [SLIVER_GEO, SPARK_GEO], side < 0 ? Math.PI : 0, heavy ? 0.68 : 0.52)
  }

  spawnBossDamageVent(x: number, y: number, pressure = 0): void {
    const p = THREE.MathUtils.clamp(pressure, 0, 1)
    const side = Math.random() < 0.5 ? -1 : 1
    this.emitDirected(x + side * (18 + Math.random() * 24), y + (Math.random() - 0.4) * 32, DEPTH_LAYERS.ENEMY + 7.5, 3 + Math.ceil(p * 2), 68 + p * 38, 0.22, [MAT_RED, MAT_ORANGE, MAT_GOLD, MAT_WHITE], 3.4, 9 + p * 8, [WARNING_RAY_GEO, SLIVER_GEO, BURST_CHUNK_GEO], side < 0 ? Math.PI : 0, 0.78 + p * 0.28)
  }

  spawnPlayerHit(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.PLAYER + 4.8, 4, 36, 0.18, [MAT_PLAYER_GUARD, MAT_WHITE], 1.2, 2.2, [GUARD_CORE_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.PLAYER + 5.2, 74, 0.22, [MAT_PLAYER_GUARD, MAT_CYAN, MAT_WHITE], 1.8, 4.8, [GUARD_RAY_GEO, SPARK_GEO])
  }

  spawnSpinBomb(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.PLAYER + 8, 5, 42, 0.22, [MAT_PLAYER_GUARD, MAT_WHITE], 2.2, 3.0, [GUARD_CORE_GEO, IMPACT_CORE_GEO])
    this.emitBurstRing(x, y + 6, DEPTH_LAYERS.PLAYER + 7, 104, 0.38, [MAT_PLAYER_GUARD, MAT_CYAN, MAT_VIOLET], 3.2, 8.5, [GUARD_RAY_GEO, BURST_CHUNK_GEO])
    this.emitDirected(x, y + 2, DEPTH_LAYERS.PLAYER + 9, 6, 112, 0.32, [MAT_WHITE, MAT_CYAN], 2.4, 5.2, [SLIVER_GEO, SPARK_GEO], Math.PI / 2, Math.PI * 1.4)
  }

  spawnPlayerEngineTrail(x: number, y: number, intensity = 1): void {
    const t = THREE.MathUtils.clamp(intensity, 0.75, 1.8)
    const count = t > 1.35 ? 4 : t > 1.05 ? 3 : 2
    this.emitDirected(x, y - 16, DEPTH_LAYERS.PLAYER + 5.5, count, 62 + t * 18, 0.18, [MAT_ORANGE, MAT_GOLD, MAT_WHITE], 1.8, 5.5, [SLIVER_GEO, SPARK_GEO], -Math.PI / 2, 0.52)
  }

  spawnEnemyEngineTrail(x: number, y: number, heavy = false): void {
    this.emitDirected(x, y + 11, DEPTH_LAYERS.ENEMY + 1.5, heavy ? 3 : 2, heavy ? 64 : 50, 0.16, [MAT_ORANGE, MAT_RED, MAT_GOLD], heavy ? 2.1 : 1.4, heavy ? 6.5 : 4.2, [SLIVER_GEO, SPARK_GEO], Math.PI / 2, heavy ? 0.48 : 0.34)
  }

  spawnBossEngineTrail(x: number, y: number, charge = 0): void {
    const c = THREE.MathUtils.clamp(charge, 0, 1)
    this.emitDirected(x, y + 30, DEPTH_LAYERS.ENEMY + 6.5, 4 + Math.ceil(c * 2), 58 + c * 42, 0.2, [MAT_RED, MAT_ORANGE, MAT_GOLD], 3.1, 20, [WARNING_RAY_GEO, SLIVER_GEO], Math.PI / 2, 0.75)
  }

  spawnEnemyMuzzle(x: number, y: number, bulletCount: number): void {
    const count = Math.min(5, Math.max(2, Math.ceil(bulletCount * 0.55)))
    this.emitDirected(x, y - 8, DEPTH_LAYERS.ENEMY + 3.5, count, 82, 0.15, [MAT_ORANGE, MAT_RED, MAT_GOLD], 1.8, 5.0, [MUZZLE_GEO, SLIVER_GEO], -Math.PI / 2, 0.36)
  }

  spawnEnemyArrival(x: number, y: number, heavy = false): void {
    this.emitDirected(x, y + 8, DEPTH_LAYERS.ENEMY + 4, heavy ? 4 : 3, heavy ? 74 : 58, 0.18, [MAT_CYAN, MAT_WHITE, MAT_VIOLET], heavy ? 2.4 : 1.6, heavy ? 6.5 : 4.2, [WARNING_BEACON_GEO, SLIVER_GEO], -Math.PI / 2, heavy ? 0.42 : 0.28)
    if (heavy) {
      this.emit(x, y, DEPTH_LAYERS.ENEMY + 3, 3, 34, 0.16, [MAT_VIOLET, MAT_CYAN], 1.6, 3.2, [IMPACT_CORE_GEO])
    }
  }

  spawnWaveArrival(x: number, y: number, width: number, count: number): void {
    const size = Math.min(1, count / 8)
    const spread = Math.max(12, Math.min(64, width * 0.45))
    this.emitDirected(x, y + 12, DEPTH_LAYERS.ENEMY + 6, Math.min(6, Math.max(3, count)), 66 + size * 28, 0.22, [MAT_CYAN, MAT_VIOLET, MAT_WHITE], 2.6, spread, [WARNING_RAY_GEO, SLIVER_GEO], -Math.PI / 2, 0.5)
  }

  spawnBossMuzzle(x: number, y: number, bulletCount: number): void {
    const count = Math.min(8, Math.max(3, Math.ceil(bulletCount * 0.42)))
    this.emitDirected(x, y - 20, DEPTH_LAYERS.ENEMY + 8, count, 96, 0.2, [MAT_RED, MAT_GOLD, MAT_WHITE], 3.0, 16, [WARNING_RAY_GEO, MUZZLE_GEO], -Math.PI / 2, 0.62)
    this.emitBurstRing(x, y - 10, DEPTH_LAYERS.ENEMY + 7, 68, 0.2, [MAT_GOLD, MAT_ORANGE], 2.4, 8, [SLIVER_GEO, BURST_CHUNK_GEO])
  }

  spawnStageAdvance(x: number, y: number, final = false): void {
    const radiusSpeed = final ? 132 : 104
    this.emit(x, y, DEPTH_LAYERS.ENEMY + 8, final ? 8 : 5, 52, 0.28, [MAT_WHITE, MAT_CYAN, MAT_GOLD], final ? 4.2 : 3.0, final ? 8 : 5, [WARNING_BEACON_GEO, IMPACT_CORE_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.ENEMY + 7, radiusSpeed, final ? 0.46 : 0.34, [MAT_CYAN, MAT_VIOLET, MAT_WHITE, MAT_GOLD], final ? 5.4 : 3.6, final ? 18 : 12, [WARNING_RAY_GEO, BURST_CHUNK_GEO, SLIVER_GEO])
    if (final) {
      this.emitDirected(x, y + 14, DEPTH_LAYERS.ENEMY + 10, 8, 118, 0.42, [MAT_WHITE, MAT_CYAN], 4.2, 18, [SLIVER_GEO, WARNING_RAY_GEO], Math.PI / 2, Math.PI * 1.2)
    }
  }

  spawnGraze(x: number, y: number, count: number): void {
    const emitCount = Math.min(5, Math.max(2, count + 1))
    const side = Math.random() < 0.5 ? -1 : 1
    this.emitDirected(x + side * 12, y + 2, DEPTH_LAYERS.PLAYER + 7, emitCount, 62, 0.14, [MAT_PLAYER_GUARD, MAT_WHITE, MAT_CYAN], 1.4, 4.2, [SLIVER_GEO, SPARK_GEO], side < 0 ? Math.PI : 0, 0.8)
  }

  spawnBulletCancel(x: number, y: number, clearedCount: number): void {
    if (clearedCount <= 0) return
    const coreCount = Math.min(6, Math.max(3, Math.ceil(clearedCount / 28)))
    const ringSpeed = clearedCount > 80 ? 116 : 92
    this.emit(x, y, DEPTH_LAYERS.PLAYER + 7, coreCount, 44, 0.18, [MAT_PLAYER_GUARD, MAT_WHITE], 2.0, 3.0, [GUARD_CORE_GEO, IMPACT_CORE_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.PLAYER + 6, ringSpeed, 0.28, [MAT_CYAN, MAT_WHITE, MAT_PLAYER_GUARD], 2.4, 7.5, [GUARD_RAY_GEO, SLIVER_GEO])
  }

  spawnPowerUpDrop(x: number, y: number, type: PowerUpType): void {
    const mat = POWERUP_DROP_MATS[type]
    this.emitDirected(x, y + 2, DEPTH_LAYERS.BULLET + 3, type === 'gem_small' ? 2 : 3, 44, 0.2, [mat, MAT_WHITE], 1.0, 3.0, [PICKUP_GEO, SPARK_GEO], Math.PI * 0.5, 0.9)
  }

  spawnPowerUpCollect(x: number, y: number, type: PowerUpType): void {
    const valuable = type === 'extra_life' || type === 'bomb' || type === 'weapon_upgrade' || type === 'gem_large'
    const mat = valuable ? POWERUP_VALUABLE_MATS[type] : POWERUP_COLLECT_MATS[type]
    this.emit(x, y, DEPTH_LAYERS.PLAYER + 7, valuable ? 4 : 3, 38, 0.16, [mat, MAT_WHITE], 1.2, 2.2, [PICKUP_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.PLAYER + 6, valuable ? 82 : 62, valuable ? 0.28 : 0.2, [mat, MAT_WHITE], 1.5, valuable ? 5.2 : 3.6, [PICKUP_GEO, SPARK_GEO])
  }

  spawnWeaponSwitch(x: number, y: number, weapon: WeaponType): void {
    const mat = WEAPON_FEEDBACK_MATS[weapon]
    const cone = weapon === 'spread' ? 1.35 : weapon === 'laser' ? 0.42 : 0.62
    this.emitDirected(x, y + 12, DEPTH_LAYERS.PLAYER + 9, 4, 68, 0.18, [mat, MAT_WHITE], 1.8, 5.6, [PICKUP_GEO, SLIVER_GEO], Math.PI / 2, cone)
  }

  spawnWeaponUpgrade(x: number, y: number, weapon: WeaponType, level: number): void {
    const lvl = THREE.MathUtils.clamp(Math.floor(level), 1, 5)
    const mat = WEAPON_FEEDBACK_MATS[weapon]
    this.emit(x, y + 8, DEPTH_LAYERS.PLAYER + 9, 3 + lvl, 38 + lvl * 6, 0.18, [mat, MAT_GOLD, MAT_WHITE], 2.0, 3.8 + lvl, [PICKUP_GEO, IMPACT_CORE_GEO])
    this.emitBurstRing(x, y + 8, DEPTH_LAYERS.PLAYER + 8, 72 + lvl * 10, 0.22, [mat, MAT_WHITE], 2.2, 4.6 + lvl, [SLIVER_GEO, SPARK_GEO])
  }

  spawnLifeGain(x: number, y: number): void {
    this.emit(x, y + 6, DEPTH_LAYERS.PLAYER + 9, 4, 34, 0.18, [MAT_GOLD, MAT_WHITE], 1.8, 3.2, [PICKUP_GEO, GUARD_CORE_GEO])
    this.emitDirected(x, y + 8, DEPTH_LAYERS.PLAYER + 10, 5, 74, 0.22, [MAT_GOLD, MAT_WHITE, MAT_PLAYER_GUARD], 2.4, 6.2, [GUARD_RAY_GEO, SLIVER_GEO], Math.PI / 2, Math.PI * 0.8)
  }

  spawnBombReady(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.PLAYER + 9, 5, 44, 0.22, [MAT_ORANGE, MAT_GOLD, MAT_WHITE], 2.4, 4.6, [BOSS_CORE_BURST_GEO, PICKUP_GEO])
    this.emitBurstRing(x, y, DEPTH_LAYERS.PLAYER + 8, 92, 0.26, [MAT_ORANGE, MAT_GOLD], 2.8, 7.0, [BURST_CHUNK_GEO, SLIVER_GEO])
  }

  spawnLaserOverheat(x: number, y: number): void {
    this.emitDirected(x, y + 4, DEPTH_LAYERS.PLAYER + 9, 6, 82, 0.24, [MAT_RED, MAT_ORANGE, MAT_WHITE], 2.4, 6.0, [SLIVER_GEO, SPARK_GEO], -Math.PI / 2, Math.PI * 0.95)
    this.emit(x, y + 2, DEPTH_LAYERS.PLAYER + 8, 3, 32, 0.18, [MAT_RED, MAT_ORANGE], 1.6, 3.2, [IMPACT_CORE_GEO])
  }

  spawnSpark(x: number, y: number): void {
    this.emit(x, y, DEPTH_LAYERS.BULLET, 6, 70, 0.2, [MAT_WHITE, MAT_CYAN], 1.0, 2.8, [SPARK_GEO])
  }

  spawnMuzzle(x: number, y: number, weapon: 'shot' | 'spread' | 'laser', level = 1): void {
    const lvl = THREE.MathUtils.clamp(Math.floor(level), 1, 5)
    if (weapon === 'laser') {
      const count = [2, 2, 3, 3, 4][lvl - 1]
      const speed = 72 + lvl * 7
      this.emitDirected(x, y + 9, DEPTH_LAYERS.PLAYER + 9, count, speed, 0.14, [MAT_CYAN, MAT_WHITE], 1.2, 5, [MUZZLE_GEO, SPARK_GEO], Math.PI / 2, 0.14 + lvl * 0.025)
      return
    }

    const count = weapon === 'spread'
      ? [3, 4, 5, 6, 7][lvl - 1]
      : [2, 3, 3, 4, 5][lvl - 1]
    const cone = weapon === 'spread'
      ? 0.16 + lvl * 0.055
      : 0.12 + lvl * 0.025
    const speed = weapon === 'spread' ? 78 + lvl * 8 : 74 + lvl * 7
    this.emitDirected(x, y + 10, DEPTH_LAYERS.PLAYER + 10, count, speed, 0.13 + lvl * 0.01, [MAT_GOLD, MAT_WHITE], 1.0, 5.2, [MUZZLE_GEO, SPARK_GEO], Math.PI / 2, cone)
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
      p.mesh.rotation.z += p.rotSpeed * dt * 0.35

      const t = Math.max(0, p.life / p.maxLife)
      const fade = Math.pow(t, p.fadePower)
      const scale = p.scaleTo + (p.scaleFrom - p.scaleTo) * fade
      p.mesh.scale.setScalar(scale)
    }
  }

  getParticleCount(): number {
    return this.particles.length
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
    const maxParticles = C1_SAFE_EXPLOSIONS ? MAX_C1_SAFE_PARTICLES : MAX_FULL_PARTICLES
    if (this.particles.length >= maxParticles) return

    const emitCount = C1_SAFE_EXPLOSIONS
      ? Math.max(3, Math.min(count, Math.ceil(count * 0.35)))
      : count
    const allowedCount = Math.min(emitCount, maxParticles - this.particles.length)
    const lifeMul = C1_SAFE_EXPLOSIONS ? 0.72 : 1

    for (let i = 0; i < allowedCount; i++) {
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

  private emitDirected(
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
    heading: number,
    cone: number,
  ): void {
    const maxParticles = C1_SAFE_EXPLOSIONS ? MAX_C1_SAFE_PARTICLES : MAX_FULL_PARTICLES
    if (this.particles.length >= maxParticles) return

    const emitCount = C1_SAFE_EXPLOSIONS
      ? Math.max(1, Math.min(count, Math.ceil(count * 0.55)))
      : count
    const allowedCount = Math.min(emitCount, maxParticles - this.particles.length)
    const lifeMul = C1_SAFE_EXPLOSIONS ? 0.78 : 1

    for (let i = 0; i < allowedCount; i++) {
      const angle = heading + (Math.random() - 0.5) * cone
      const spd = speed * (0.55 + Math.random() * 0.55)
      const geo = geometries[Math.floor(Math.random() * geometries.length)]
      const mat = mats[Math.floor(Math.random() * mats.length)]
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.35) * spread,
        z + (Math.random() - 0.5) * depthKick,
      )
      mesh.rotation.z = angle - Math.PI / 2
      const scaleFrom = 0.78 + Math.random() * 0.9
      mesh.scale.setScalar(scaleFrom)
      this.scene.add(mesh)

      this.particles.push({
        mesh,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: (Math.random() - 0.38) * depthKick * 1.8,
        life: life * lifeMul * (0.65 + Math.random() * 0.45),
        maxLife: life,
        rotSpeed: (Math.random() - 0.5) * 8,
        drag: 2.8 + Math.random() * 1.8,
        scaleFrom,
        scaleTo: 0.04 + Math.random() * 0.18,
        fadePower: 0.9 + Math.random() * 0.7,
      })
    }
  }

  private emitBurstRing(
    x: number,
    y: number,
    z: number,
    speed: number,
    life: number,
    mats: THREE.Material[],
    depthKick: number,
    spread: number,
    geometries: THREE.BufferGeometry[],
  ): void {
    const directions = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]
    for (const direction of directions) {
      this.emitDirected(x, y, z, 2, speed, life, mats, depthKick, spread, geometries, direction, 0.28)
    }
  }

  dispose(): void {
    for (const p of this.particles) this.scene.remove(p.mesh)
    this.particles = []
  }
}
