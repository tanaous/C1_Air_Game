import * as THREE from 'three'
import { Player } from '@/game/entities/Player'
import { Enemy } from '@/game/entities/Enemy'
import { Bullet } from '@/game/entities/Bullet'
import { Boss } from '@/game/entities/Boss'
import { FortressGuardian, SandScorpion, OceanOverlord, FlameDragon, RuinTitan, OrbitalEye, NebulaPhantom, PlanetBreaker, VoidHerald, FinalArchon } from '@/game/entities/BossTypes'
import { PowerUp, type PowerUpType } from '@/game/entities/PowerUp'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import { ScrollMap } from '@/game/systems/ScrollMap'
import { C1SafeField } from '@/game/systems/C1SafeField'
import { WaveSpawner } from '@/game/systems/WaveSpawner'
import { ScoreSystem } from '@/game/systems/ScoreSystem'
import { ExplosionSystem } from '@/game/systems/ExplosionSystem'
import { createStageStatus, getStageCount } from '@/game/StageDirector'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange, randomPick, chance } from '@/utils/math'
import type { InputManager } from '@/game/systems/InputManager'
import type { EnemyBulletSpawn } from '@/game/systems/BulletEmitter'
import type { StageStatus, WeaponType } from '@shared/types'
import { audioManager } from '@/game/audio/AudioManager'

const FIRST_BOSS_AT = 1600
const BOSS_INTERVAL = 2600
const WARNING_TIME  = 3.0
const DROP_TYPES: PowerUpType[] = ['weapon_upgrade','gem_small','gem_large','extra_life','bomb']
const SMALL_ENEMY_DROP_TABLE: Array<[PowerUpType, number]> = [
  ['gem_small', 62],
  ['weapon_upgrade', 18],
  ['gem_large', 10],
  ['bomb', 8],
  ['extra_life', 2],
]
const MEDIUM_ENEMY_DROP_TABLE: Array<[PowerUpType, number]> = [
  ['gem_small', 38],
  ['weapon_upgrade', 26],
  ['gem_large', 18],
  ['bomb', 14],
  ['extra_life', 4],
]
const C1_LOCAL_ADDITIVE_GLOW = true
const LASER_SEGMENT_GEO = new THREE.BoxGeometry(1, 1, 1)
const LASER_SEGMENT_MATS = [
  new THREE.MeshStandardMaterial({
    color: 0x7fefff,
    roughness: 0.18,
    metalness: 0.42,
    emissive: 0x00b7ff,
    emissiveIntensity: 2.6,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.12,
    metalness: 0.36,
    emissive: 0x68eaff,
    emissiveIntensity: 3.2,
  }),
  new THREE.MeshStandardMaterial({
    color: 0x2f8dff,
    roughness: 0.24,
    metalness: 0.48,
    emissive: 0x006dff,
    emissiveIntensity: 1.9,
  }),
]
const LASER_LOCAL_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0x6feaff,
  transparent: true,
  opacity: 0.16,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const LASER_IMPACT_LOCAL_GLOW_MAT = new THREE.MeshBasicMaterial({
  color: 0xffffff,
  transparent: true,
  opacity: 0.2,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
})
const BOSS_TELEGRAPH_BOX_GEO = new THREE.BoxGeometry(1, 1, 1)
const BOSS_TELEGRAPH_CORE_GEO = new THREE.OctahedronGeometry(1, 0)
const BOSS_TELEGRAPH_MATS = [
  new THREE.MeshStandardMaterial({
    color: 0xff4a35,
    roughness: 0.32,
    metalness: 0.42,
    emissive: 0xff2200,
    emissiveIntensity: 1.1,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xffc45f,
    roughness: 0.25,
    metalness: 0.48,
    emissive: 0xff7a10,
    emissiveIntensity: 1.4,
    flatShading: true,
  }),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.18,
    metalness: 0.55,
    emissive: 0xfff0cf,
    emissiveIntensity: 1.7,
    flatShading: true,
  }),
]
const C1_GAMEPLAY_PROBE_ONLY = false
const C1_SAFE_GAMEPLAY_BASELINE = false
const C1_FUSION_SAFE_VISUALS = true
const C1_REAL_GAMEPLAY_ANCHORS = false
const C1_USE_SCROLL_TERRAIN = !C1_FUSION_SAFE_VISUALS
const C1_USE_SCENE_HUD = true
const BASELINE_USE_PRIMITIVE_PLAYER = true
const BASELINE_SCROLL_SPEED = 46
const REAL_GAMEPLAY_ANCHOR_SPEED = 52
const FALLBACK_SCROLL_SPEED = 58
const CAMERA_HIT_PULSE_TIME = 0.55
const CAMERA_BOMB_PULSE_TIME = 1.1
const CAMERA_BOSS_EVENT_PULSE_TIME = 1.15
export const GAMEPLAY_RUNTIME_CAPS = {
  enemies: 28,
  playerBullets: 160,
  enemyBullets: 260,
  powerUps: 36,
  particles: 120,
} as const

export interface GameplayEvents {
  onHUDChange: () => void
  onGameOver:  () => void
  onBossState: (active: boolean) => void
  onCampaignClear: () => void
}

type PatternKind = 'diagonal' | 'grid' | 'rings' | 'dots' | 'cross' | 'stripes'

interface GameplayDepthAnchor {
  object: THREE.Object3D
  speedMul: number
}

type HudDigit = THREE.Mesh[]
type HudWeaponIcon = {
  weapon: WeaponType
  root: THREE.Group
  pieces: THREE.Mesh[]
}

const HUD_DIGIT_SEGMENTS: Record<number, number[]> = {
  0: [0, 1, 2, 3, 4, 5],
  1: [1, 2],
  2: [0, 1, 6, 4, 3],
  3: [0, 1, 6, 2, 3],
  4: [5, 6, 1, 2],
  5: [0, 5, 6, 2, 3],
  6: [0, 5, 6, 4, 2, 3],
  7: [0, 1, 2],
  8: [0, 1, 2, 3, 4, 5, 6],
  9: [0, 1, 2, 3, 5, 6],
}

function createPatternTexture(base: string, accent: string, pattern: PatternKind): THREE.CanvasTexture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Unable to create C1 pattern texture')

  ctx.fillStyle = base
  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 0.84
  ctx.strokeStyle = accent
  ctx.fillStyle = accent
  ctx.lineWidth = 12

  if (pattern === 'diagonal') {
    for (let x = -size; x < size * 2; x += 44) {
      ctx.beginPath()
      ctx.moveTo(x, size)
      ctx.lineTo(x + size, 0)
      ctx.stroke()
    }
  } else if (pattern === 'grid') {
    for (let x = 28; x < size; x += 48) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, x)
      ctx.lineTo(size, x)
      ctx.stroke()
    }
  } else if (pattern === 'rings') {
    for (let r = 28; r < 180; r += 34) {
      ctx.beginPath()
      ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (pattern === 'dots') {
    for (let y = 36; y < size; y += 48) {
      for (let x = 36; x < size; x += 48) {
        ctx.beginPath()
        ctx.arc(x, y, 11, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  } else if (pattern === 'cross') {
    ctx.fillRect(size / 2 - 18, 26, 36, size - 52)
    ctx.fillRect(26, size / 2 - 18, size - 52, 36)
  } else {
    for (let y = 18; y < size; y += 34) ctx.fillRect(0, y, size, 14)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function createPatternMaterial(base: string, accent: string, pattern: PatternKind): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: createPatternTexture(base, accent, pattern),
    roughness: 0.38,
    metalness: 0.26,
    emissive: new THREE.Color(base).multiplyScalar(0.06),
    emissiveIntensity: 0.35,
  })
}

function createBoxFaceMaterials(seed: number): THREE.MeshStandardMaterial[] {
  const palettes = [
    ['#ff4d4d', '#ffe45c', 'diagonal'],
    ['#2f80ff', '#8ff3ff', 'grid'],
    ['#35d07f', '#f8ff7a', 'rings'],
    ['#8b5cff', '#ff9df2', 'dots'],
    ['#ff9a3d', '#ffffff', 'cross'],
    ['#1fd0c4', '#101820', 'stripes'],
  ] as const

  return palettes.map((entry, index) => {
    const p = palettes[(index + seed) % palettes.length]
    return createPatternMaterial(p[0], p[1], p[2])
  })
}

function weightedPowerUp(table: Array<[PowerUpType, number]>): PowerUpType {
  const total = table.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (total <= 0) return randomPick(DROP_TYPES)

  let roll = Math.random() * total
  for (const [type, weight] of table) {
    roll -= Math.max(0, weight)
    if (roll <= 0) return type
  }
  return table[table.length - 1]?.[0] ?? randomPick(DROP_TYPES)
}

function weaponColor(weapon: WeaponType): number {
  if (weapon === 'spread') return 0x7bff74
  if (weapon === 'laser') return 0xd48aff
  return 0xffd166
}

export class GameplayScene {
  readonly scene: THREE.Scene

  private player:        Player
  private enemies:       Enemy[]    = []
  private playerBullets: Bullet[]   = []
  private enemyBullets:  Bullet[]   = []
  private powerUps:      PowerUp[]  = []
  private boss:          Boss | null = null
  private collision:     CollisionSystem
  private scrollMap:     ScrollMap | null = null
  private c1SafeField:   C1SafeField | null = null
  private spawner:       WaveSpawner
  private scoring:       ScoreSystem
  private explosions:    ExplosionSystem
  private events:        GameplayEvents
  private baselineRoot:   THREE.Group | null = null
  private baselineScrollers: THREE.Mesh[] = []
  private baselinePlayerProbe: THREE.Group | null = null
  private gameplayDepthRoot: THREE.Group | null = null
  private gameplayDepthAnchors: GameplayDepthAnchor[] = []
  private sceneHudRoot: THREE.Group | null = null
  private lifePips: THREE.Mesh[] = []
  private bossHpFrame: THREE.Mesh | null = null
  private bossHpBar: THREE.Mesh | null = null
  private heatBar: THREE.Mesh | null = null
  private spinBar: THREE.Mesh | null = null
  private hudScoreDigits: HudDigit[] = []
  private hudStageDigits: HudDigit[] = []
  private hudWeaponIcons: HudWeaponIcon[] = []
  private hudWeaponLevelPips: THREE.Mesh[] = []
  private hudStatusBeacon: THREE.Mesh | null = null
  private sceneHudFailed = false
  private c1GameplayProbe: THREE.Mesh | null = null

  private bossesDefeated = 0
  private warningTimer   = 0
  private nextBossAt     = FIRST_BOSS_AT
  private fallbackDistance = 0
  private safeFieldEnabled = C1_FUSION_SAFE_VISUALS
  private campaignCleared = false

  // 音效节流状态
  private lastShotSfxTime  = 0
  private lastLaserSfxTime = 0
  private lastMuzzleBurstTime = 0
  private lastLaserImpactTime = 0
  private lastGrazeSfxTime = 0
  private lastEnemyMuzzleTime = 0
  private lastBossMuzzleTime = 0
  private lastEnemyHitTime = 0
  private lastBossHitTime  = 0
  private lastPlayerEngineTrailTime = 0
  private lastEnemyEngineTrailTime = 0
  private lastBossEngineTrailTime = 0
  private lastEnemyDamageVentTime = 0
  private lastBossDamageVentTime = 0
  private prevSpinning     = false
  private prevBossPhase    = -1
  private warningAlarmOn   = false
  private lastWaveArrivalTime = 0
  private cameraHitTimer = 0
  private cameraBombTimer = 0
  private cameraBossEventTimer = 0
  private playerKeyLight!:  THREE.PointLight
  private playerFillLight!: THREE.PointLight
  private playerRimLight!:  THREE.PointLight
  private bossDangerMat: THREE.MeshBasicMaterial
  private bossDangerMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private readonly bossTelegraphGroup = new THREE.Group()
  private readonly bossTelegraphPieces: THREE.Mesh[] = []
  private bossScreenDarken = 0
  private debugInvincible = false

  // Laser beam visual
  private laserBeams: THREE.Object3D[] = []

  constructor(events: GameplayEvents) {
    this.events = events
    this.scene  = new THREE.Scene()
    this.scene.background = new THREE.Color(0x050510)

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const dir = new THREE.DirectionalLight(0xffffff, 1.5)
    dir.position.set(50, 100, 300)
    this.scene.add(dir)
    this.scene.add(new THREE.HemisphereLight(0x8888ff, 0x444422, 0.6))
    this.playerKeyLight = new THREE.PointLight(0xe8f3ff, 2.2, 140, 2)
    this.playerFillLight = new THREE.PointLight(0x5ebeff, 1.2, 110, 2)
    this.playerRimLight = new THREE.PointLight(0xff9d52, 1.45, 100, 2)
    this.scene.add(this.playerKeyLight, this.playerFillLight, this.playerRimLight)
    this.bossDangerMat = new THREE.MeshBasicMaterial({
      color: 0xff3f58,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.bossDangerMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, SCENE.HEIGHT + 30), this.bossDangerMat)
    this.bossDangerMesh.visible = false
    this.bossDangerMesh.position.set(0, 0, DEPTH_LAYERS.UI - 0.4)
    this.scene.add(this.bossDangerMesh)
    this.buildBossTelegraphGeometry()

    if (C1_GAMEPLAY_PROBE_ONLY) {
      this.scene.background = new THREE.Color(0x071018)
      this.scene.fog = null
      this.buildC1GameplayProbe()
    } else if (C1_FUSION_SAFE_VISUALS && this.safeFieldEnabled) {
      this.c1SafeField = new C1SafeField(this.scene)
    } else if (C1_SAFE_GAMEPLAY_BASELINE) {
      this.scene.background = new THREE.Color(0x071018)
      this.scene.fog = null
      this.buildStable3DBaseline(true)
    }

    this.player     = new Player(this.scene)
    if ((C1_GAMEPLAY_PROBE_ONLY || C1_SAFE_GAMEPLAY_BASELINE) && BASELINE_USE_PRIMITIVE_PLAYER && this.player.mesh) {
      this.player.mesh.visible = false
    }
    this.collision  = new CollisionSystem()
    this.scrollMap  = C1_USE_SCROLL_TERRAIN ? new ScrollMap(this.scene) : null
    if (!C1_SAFE_GAMEPLAY_BASELINE && !C1_FUSION_SAFE_VISUALS && C1_REAL_GAMEPLAY_ANCHORS) this.buildGameplayDepthAnchors()
    this.spawner    = new WaveSpawner()
    this.scoring    = new ScoreSystem()
    this.explosions = new ExplosionSystem(this.scene)
    if (C1_USE_SCENE_HUD) {
      try {
        this.buildSceneHud()
      } catch (error) {
        console.error('[GameplayScene] C1 scene HUD disabled after build failure', error)
        this.sceneHudFailed = true
        this.clearSceneHud()
      }
    }

    audioManager.playBGM('gameplay')
  }

  setDebugInvincible(enabled: boolean): void {
    this.debugInvincible = enabled
    this.player.infiniteLives = enabled
    this.player.invincibleTimer = enabled ? Number.POSITIVE_INFINITY : 0
  }

  setSafeFieldEnabled(enabled: boolean): void {
    this.safeFieldEnabled = enabled
    if (!C1_FUSION_SAFE_VISUALS) return

    if (enabled) {
      this.clearStable3DBaseline()
      if (!this.c1SafeField) this.c1SafeField = new C1SafeField(this.scene)
      return
    }

    if (this.c1SafeField) {
      this.c1SafeField.dispose()
      this.c1SafeField = null
    }
    if (!this.baselineRoot) {
      this.scene.background = new THREE.Color(0x071018)
      this.scene.fog = null
      this.buildStable3DBaseline(false)
    }
  }

  skipToBoss(): void {
    if (this.boss?.active) return
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    this.warningTimer = 0
    const dist = this.getProgressDistance()
    this.nextBossAt = dist + BOSS_INTERVAL
    this.spawnBoss(this.bossesDefeated)
  }

  advanceStage(): void {
    if (this.boss?.active) {
      this.onBossDefeated()
      return
    }

    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    this.warningTimer = 0
    this.bossesDefeated = Math.min(getStageCount() - 1, this.bossesDefeated + 1)
    this.scrollMap?.transitionToBiome(this.bossesDefeated, 1.4)
    this.c1SafeField?.transitionToBiome(this.bossesDefeated, 1.4)
    this.nextBossAt = this.getProgressDistance() + FIRST_BOSS_AT
    this.spawner.resetForStage(1.2)
    this.explosions.spawnStageAdvance(0, SCENE.HEIGHT * 0.22)
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME * 0.75
    this.events.onHUDChange()
  }

  update(dt: number, input: InputManager): void {
    this.scoring.update(dt)
    this.explosions.update(dt)
    this.cameraHitTimer = Math.max(0, this.cameraHitTimer - dt)
    this.cameraBombTimer = Math.max(0, this.cameraBombTimer - dt)
    this.cameraBossEventTimer = Math.max(0, this.cameraBossEventTimer - dt)

    if (this.campaignCleared) {
      this.updateClearSequence(dt, input)
      return
    }

    if (C1_GAMEPLAY_PROBE_ONLY) {
      if (this.player.mesh) this.player.mesh.visible = false
      this.player.bulletRequests.length = 0
      this.updateC1GameplayProbe(dt)
      this.events.onHUDChange()
      return
    }

    const now = performance.now() / 1000

    // Player
    const wasSpinning = this.prevSpinning
    const weaponBeforeUpdate = this.player.weapon.current
    const levelBeforeUpdate = this.player.weapon.level
    const overheatedBeforeUpdate = this.player.weapon.overheated
    this.player.updatePlayer(dt, input)
    if (C1_SAFE_GAMEPLAY_BASELINE && BASELINE_USE_PRIMITIVE_PLAYER && this.player.mesh) {
      this.player.mesh.visible = false
    }
    if (this.debugInvincible) {
      this.player.lives = Math.max(this.player.lives, 5)
      this.player.invincibleTimer = Number.POSITIVE_INFINITY
    }
    const isSpinning = this.player.isSpinning()
    if (!wasSpinning && isSpinning) {
      this.cameraBombTimer = Math.max(this.cameraBombTimer, CAMERA_BOMB_PULSE_TIME * 0.45)
    }
    if (weaponBeforeUpdate !== this.player.weapon.current) {
      this.explosions.spawnWeaponSwitch(this.player.position.x, this.player.position.y, this.player.weapon.current)
    }
    if (this.player.weapon.level > levelBeforeUpdate) {
      this.explosions.spawnWeaponUpgrade(this.player.position.x, this.player.position.y, this.player.weapon.current, this.player.weapon.level)
    }
    if (!overheatedBeforeUpdate && this.player.weapon.overheated) {
      this.explosions.spawnLaserOverheat(this.player.position.x, this.player.position.y)
    }
    this.updatePlayerHeroLights()
    this.spawnPlayerEngineFeedback(input, now)

    if (C1_SAFE_GAMEPLAY_BASELINE) {
      if (this.player.spinBombReady) this.cameraBombTimer = CAMERA_BOMB_PULSE_TIME
      this.prevSpinning = isSpinning
      this.player.bulletRequests.length = 0
      this.updateStable3DBaseline(dt)
      this.updateSceneHud()
      this.events.onHUDChange()
      this.cleanup()
      return
    }

    // 回旋开始/落地音效
    if (!wasSpinning && isSpinning) audioManager.playSFX('spin_start')
    this.prevSpinning = isSpinning

    // Clear old laser beams
    this.clearLaserBeams()

    let firedThisFrame = false
    let firedLaser = false
    for (const req of this.player.bulletRequests) {
      if (req.isLaser) {
        const impactY = this.handleLaser(req.x, req.y, req.damage, req.width ?? 5, now)
        this.renderLaserBeam(req.x, this.player.position.y, req.width ?? 5, impactY)
        firedLaser = true
      } else if (this.playerBullets.length < GAMEPLAY_RUNTIME_CAPS.playerBullets) {
        this.playerBullets.push(new Bullet(this.scene, req.x, req.y, req.z, req.vx, req.vy, true, req.damage, req.visual ?? 'player_shot'))
        firedThisFrame = true
      }
    }
    // 射击音效节流（避免每帧都响）
    if (firedLaser && now - this.lastLaserSfxTime > 0.15) {
      audioManager.playSFX('laser_start')
      this.explosions.spawnMuzzle(this.player.position.x, this.player.position.y, 'laser', this.player.weapon.level)
      this.lastLaserSfxTime = now
      this.lastMuzzleBurstTime = now
    } else if (firedLaser && now - this.lastMuzzleBurstTime > 0.09) {
      this.explosions.spawnMuzzle(this.player.position.x, this.player.position.y, 'laser', this.player.weapon.level)
      this.lastMuzzleBurstTime = now
    }
    if (firedThisFrame && now - this.lastShotSfxTime > 0.08) {
      const w = this.player.weapon.current
      audioManager.playSFX(w === 'spread' ? 'spread_fire' : 'shot_fire')
      this.explosions.spawnMuzzle(this.player.position.x, this.player.position.y, w === 'spread' ? 'spread' : 'shot', this.player.weapon.level)
      this.lastShotSfxTime = now
      this.lastMuzzleBurstTime = now
    }

    // 托马斯回旋炸弹
    if (this.player.spinBombReady) {
      this.cameraBombTimer = CAMERA_BOMB_PULSE_TIME
      audioManager.playSFX('spin_land')
      this.clearAllEnemyBullets(false)
      this.explosions.spawnSpinBomb(this.player.position.x, this.player.position.y)
      // 对所有敌人造成大伤害
      for (const e of this.enemies) {
        if (e.active) {
          if (e.takeDamage(50)) {
            this.scoring.onEnemyKilled(e.scoreValue)
            this.explosions.spawnEnemyKill(e.position.x, e.position.y)
          }
        }
      }
      if (this.boss?.active) {
        const bossKilled = this.boss.takeDamage(200)
        this.explosions.spawnBossHit(this.boss.position.x, this.boss.position.y)
        if (bossKilled) this.onBossDefeated()
      }
    }

    if (this.player.isSpinning()) {
      // 回旋期间不发射子弹，但仍更新其他系统
    } else {
      if (input.isJustPressed('bomb')) {
        this.cameraBombTimer = Math.max(this.cameraBombTimer, CAMERA_BOMB_PULSE_TIME * 0.75)
        this.clearAllEnemyBullets(true)
      }
    }

    if (this.scrollMap) {
      this.scrollMap.update(dt)
    } else if (this.c1SafeField) {
      this.c1SafeField.update(dt)
    } else {
      this.fallbackDistance += FALLBACK_SCROLL_SPEED * dt
      this.updateStable3DBaseline(dt)
    }
    this.updateGameplayDepthAnchors(dt)
    const dist = this.getProgressDistance()

    this.updateBossLogic(dt, dist)

    if (!this.boss && this.warningTimer <= 0) {
      const enemyCountBeforeSpawn = this.enemies.length
      this.spawner.update(dt, dist, this.bossesDefeated, this.scene, this.enemies, GAMEPLAY_RUNTIME_CAPS.enemies)
      if (this.enemies.length > enemyCountBeforeSpawn) {
        this.spawnWaveArrivalFeedback(this.enemies.slice(enemyCountBeforeSpawn), now)
      }
    }

    const px = this.player.position.x, py = this.player.position.y
    for (const e of this.enemies) {
      if (!e.active) continue
      e.updateEnemy(dt, px, py)
      this.spawnEnemyEngineFeedback(e, now)
      this.spawnEnemyDamageFeedback(e, now)
      const appended = this.appendEnemyBullets(e.bulletRequests)
      if (appended > 0) this.spawnEnemyFireFeedback(e.position.x, e.position.y, appended, now, false)
    }

    if (this.boss?.active) {
      this.boss.updateBoss(dt, px, py)
      this.spawnBossEngineFeedback(this.boss, now)
      this.spawnBossDamageFeedback(this.boss, now)
      const appended = this.appendEnemyBullets(this.boss.bulletRequests, true)
      if (appended > 0) this.spawnEnemyFireFeedback(this.boss.position.x, this.boss.position.y, appended, now, true)

      const phaseNow = this.boss.currentPhase
      if (phaseNow !== this.prevBossPhase && this.prevBossPhase >= 0) {
        audioManager.playSFX('boss_phase_change')
        this.explosions.spawnBossPhaseShift(this.boss.position.x, this.boss.position.y)
        this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
      }
      this.prevBossPhase = phaseNow
    }
    this.updateBossTelegraphVisual(dt)

    for (const b of this.playerBullets) if (b.active) b.update(dt)
    for (const b of this.enemyBullets)  if (b.active) b.update(dt)
    for (const p of this.powerUps) {
      if (!p.active) continue
      p.attractTo(px, py, dt)
      p.update(dt)
    }

    const result = this.collision.check(
      this.player, this.enemies.filter(e => e.active),
      this.playerBullets.filter(b => b.active),
      this.enemyBullets.filter(b => b.active),
      this.powerUps.filter(p => p.active),
      this.boss?.active ? this.boss : null,
    )

    for (const e of result.killedEnemies) {
      this.scoring.onEnemyKilled(e.scoreValue)
      this.explosions.spawnEnemyKill(e.position.x, e.position.y)
      this.tryDropPowerUp(e.position.x, e.position.y, e.scoreValue)
      audioManager.playSFX('enemy_destroy')
    }
    for (const e of result.hitEnemies) {
      this.explosions.spawnEnemyHit(e.position.x, e.position.y)
      if (now - this.lastEnemyHitTime > 0.05) {
        audioManager.playSFX('enemy_hit')
        this.lastEnemyHitTime = now
      }
    }
    if (result.bossHit && now - this.lastBossHitTime > 0.05) {
      this.explosions.spawnBossHit(this.boss!.position.x + randomRange(-20, 20), this.boss!.position.y + randomRange(-20, 20))
      audioManager.playSFX('enemy_hit')
      this.lastBossHitTime = now
    }
    if (result.bossKilled && this.boss) {
      this.onBossDefeated()
    }
    // cleanup 可能把 boss.active=false 但 this.boss 未置 null（spin bomb 击杀走上面路径）
    // 双重保险：若 boss 已 inactive 但引用未清，在此清除
    if (this.boss && !this.boss.active) {
      this.onBossDefeated()
    }
    for (const p of result.collectedPowerUps) {
      this.explosions.spawnPowerUpCollect(p.position.x, p.position.y, p.type)
      this.applyPowerUp(p)
      this.scoring.onPowerUp(p.scoreValue)
      audioManager.playSFX(p.type === 'extra_life' ? 'extra_life' : 'powerup_collect')
    }
    if (result.grazeCount > 0) {
      for (let i = 0; i < result.grazeCount; i++) this.scoring.onGraze()
      if (now - this.lastGrazeSfxTime > 0.1) {
        this.explosions.spawnGraze(this.player.position.x, this.player.position.y, result.grazeCount)
        audioManager.playSFX('graze')
        this.lastGrazeSfxTime = now
      }
    }
    if (result.playerHit) {
      this.cameraHitTimer = CAMERA_HIT_PULSE_TIME
      this.explosions.spawnPlayerHit(this.player.position.x, this.player.position.y)
      if (!this.player.isAlive()) {
        audioManager.playSFX('player_death')
        audioManager.stopBGM()
        this.events.onGameOver()
        return
      }
      audioManager.playSFX('player_hit')
    }

    this.updateSceneHud()
    this.events.onHUDChange()
    this.cleanup()
  }

  private buildStable3DBaseline(includePlayerProbe = true): void {
    const root = new THREE.Group()
    this.baselineRoot = root

    const anchorDefs = [
      { x: -48, y: 92, z: DEPTH_LAYERS.BACKGROUND + 8, size: [30, 32, 52], seed: 0 },
      { x: 0, y: 120, z: DEPTH_LAYERS.TERRAIN + 12, size: [28, 36, 48], seed: 2 },
      { x: 48, y: 82, z: DEPTH_LAYERS.FOCAL + 10, size: [30, 30, 44], seed: 4 },
    ] as const

    for (const anchorDef of anchorDefs) {
      const anchor = new THREE.Mesh(
        new THREE.BoxGeometry(anchorDef.size[0], anchorDef.size[1], anchorDef.size[2]),
        createBoxFaceMaterials(anchorDef.seed),
      )
      anchor.position.set(anchorDef.x, anchorDef.y, anchorDef.z)
      anchor.rotation.set(0.12, 0.28, 0.05)
      root.add(anchor)
    }

    for (let i = 0; i < 12; i++) {
      const y = -SCENE.HEIGHT * 0.66 + i * 34
      const layer = i % 4
      const z = [-44, -22, 0, 18][layer]

      const center = new THREE.Mesh(
        new THREE.BoxGeometry(38, 6, 18 + layer * 5),
        createBoxFaceMaterials(i % 6),
      )
      center.position.set(0, y, z)
      center.rotation.y = 0.08 * (layer - 1.5)
      root.add(center)
      this.baselineScrollers.push(center)

      const sideX = i % 2 === 0 ? -SCENE.WIDTH * 0.31 : SCENE.WIDTH * 0.31
      const block = new THREE.Mesh(
        new THREE.BoxGeometry(18, 18, 30),
        createBoxFaceMaterials((i + 3) % 6),
      )
      block.position.set(sideX, y + 13, z + 10)
      block.rotation.set(0.08, -0.18 * Math.sign(sideX), 0.04)
      root.add(block)
      this.baselineScrollers.push(block)
    }

    if (includePlayerProbe && BASELINE_USE_PRIMITIVE_PLAYER) {
      this.baselinePlayerProbe = this.buildPrimitivePlayerProbe()
      root.add(this.baselinePlayerProbe)
    }

    this.scene.add(root)
  }

  private buildC1GameplayProbe(): void {
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0xff3b30, roughness: 0.42, metalness: 0.18 }),
      new THREE.MeshStandardMaterial({ color: 0x34c759, roughness: 0.42, metalness: 0.18 }),
      new THREE.MeshStandardMaterial({ color: 0x007aff, roughness: 0.42, metalness: 0.18 }),
      new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.42, metalness: 0.18 }),
      new THREE.MeshStandardMaterial({ color: 0xbf5af2, roughness: 0.42, metalness: 0.18 }),
      new THREE.MeshStandardMaterial({ color: 0xff9f0a, roughness: 0.42, metalness: 0.18 }),
    ]
    const cube = new THREE.Mesh(new THREE.BoxGeometry(56, 56, 56), materials)
    cube.name = 'c1_gameplay_probe_box'
    cube.position.set(0, 0, 0)
    cube.rotation.set(0.45, 0.35, 0.08)
    this.c1GameplayProbe = cube
    this.scene.add(cube)
  }

  private updateC1GameplayProbe(dt: number): void {
    if (!this.c1GameplayProbe) return
    this.c1GameplayProbe.rotation.x += dt * 0.28
    this.c1GameplayProbe.rotation.y += dt * 0.42
  }

  private updateStable3DBaseline(dt: number): void {
    const minY = -SCENE.HEIGHT * 0.75
    const wrap = SCENE.HEIGHT * 1.5
    for (const mesh of this.baselineScrollers) {
      mesh.position.y -= BASELINE_SCROLL_SPEED * dt
      if (mesh.position.y < minY) mesh.position.y += wrap
    }
    if (this.baselinePlayerProbe) {
      this.baselinePlayerProbe.position.copy(this.player.position)
      this.baselinePlayerProbe.rotation.z = this.player.mesh?.rotation.z ?? 0
      this.baselinePlayerProbe.rotation.x = this.player.mesh?.rotation.x ?? 0
    }
  }

  private buildGameplayDepthAnchors(): void {
    const root = new THREE.Group()
    root.name = 'c1_gameplay_depth_anchors'
    this.gameplayDepthRoot = root

    const startY = -SCENE.HEIGHT * 0.72
    const spacing = 32
    const sideX = SCENE.WIDTH * 0.44
    const depthBands = [
      DEPTH_LAYERS.BACKGROUND + 8,
      DEPTH_LAYERS.TERRAIN + 6,
      DEPTH_LAYERS.ENEMY - 6,
      DEPTH_LAYERS.FOCAL - 2,
    ]

    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const band = depthBands[i % depthBands.length]
      const y = startY + i * spacing
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(9 + (i % 3) * 3, 18 + (i % 4) * 4, 20 + (i % 5) * 4),
        createBoxFaceMaterials(i),
      )
      marker.name = `c1_depth_side_marker_${i}`
      marker.position.set(side * (sideX - (i % 3) * 5), y, band)
      marker.rotation.set(0.08 + (i % 3) * 0.03, -0.24 * side, 0.06 * side)
      root.add(marker)
      this.gameplayDepthAnchors.push({
        object: marker,
        speedMul: 0.88 + (i % 4) * 0.08,
      })

      if (i % 3 === 0) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(36, 2.4, 8 + (i % 2) * 8),
          createBoxFaceMaterials(i + 2),
        )
        rib.name = `c1_depth_runway_rib_${i}`
        rib.position.set(0, y + spacing * 0.42, DEPTH_LAYERS.BACKGROUND + 12 + (i % 2) * 10)
        rib.rotation.y = 0.08 * side
        root.add(rib)
        this.gameplayDepthAnchors.push({
          object: rib,
          speedMul: 0.72,
        })
      }
    }

    this.scene.add(root)
  }

  private updateGameplayDepthAnchors(dt: number): void {
    if (!this.gameplayDepthRoot) return
    const minY = -SCENE.HEIGHT * 0.78 - 70
    const wrap = SCENE.HEIGHT * 1.66
    for (const anchor of this.gameplayDepthAnchors) {
      anchor.object.position.y -= REAL_GAMEPLAY_ANCHOR_SPEED * anchor.speedMul * dt
      if (anchor.object.position.y < minY) anchor.object.position.y += wrap
    }
  }

  private updateClearSequence(dt: number, input: InputManager): void {
    this.player.updatePlayer(dt, input)
    this.player.bulletRequests.length = 0
    if (this.debugInvincible) {
      this.player.lives = Math.max(this.player.lives, 5)
      this.player.invincibleTimer = Number.POSITIVE_INFINITY
    }
    this.updatePlayerHeroLights()

    if (this.scrollMap) {
      this.scrollMap.update(dt)
    } else if (this.c1SafeField) {
      this.c1SafeField.update(dt)
    } else {
      this.fallbackDistance += FALLBACK_SCROLL_SPEED * dt
      this.updateStable3DBaseline(dt)
    }
    this.updateGameplayDepthAnchors(dt)
    this.updateSceneHud()
    this.events.onHUDChange()
    this.cleanup()
  }

  private clearStable3DBaseline(): void {
    if (!this.baselineRoot) return
    this.scene.remove(this.baselineRoot)
    this.disposeObjectTree(this.baselineRoot)
    this.baselineRoot = null
    this.baselineScrollers = []
    this.baselinePlayerProbe = null
  }

  private buildSceneHud(): void {
    const root = new THREE.Group()
    root.name = 'c1_scene_hud'
    this.sceneHudRoot = root

    const makeBox = (name: string, color: number, x: number, y: number, w: number, h: number, zOffset = 0): THREE.Mesh => {
      const mesh = this.createHudBox(name, color, w, h, 3.2)
      mesh.position.set(x, y, DEPTH_LAYERS.UI + zOffset)
      root.add(mesh)
      return mesh
    }

    const topY = SCENE.HEIGHT * 0.5 - 17
    const bottomY = -SCENE.HEIGHT * 0.5 + 18
    this.hudScoreDigits = this.buildHudNumber(root, 'score', -86, topY - 1, 6, 0.9, 0xffd166)
    this.hudStageDigits = this.buildHudNumber(root, 'stage', SCENE.WIDTH * 0.5 - 31, topY - 1, 2, 0.95, 0x8fe8ff)
    makeBox('score_anchor', 0x2a1d12, -93, topY - 1, 5, 15, -0.8)
    makeBox('stage_anchor', 0x11242c, SCENE.WIDTH * 0.5 - 38, topY - 1, 5, 15, -0.8)

    const leftX = -SCENE.WIDTH * 0.5 + 15
    for (let i = 0; i < 5; i++) {
      this.lifePips.push(makeBox(`life_pip_${i}`, 0x4de2ff, leftX + i * 9, bottomY, 7.2, 7.2, 0.4))
    }

    this.bossHpFrame = makeBox('boss_hp_frame', 0x2a1320, 0, topY - 2, 152, 8.5, -1.2)
    this.bossHpBar = makeBox('boss_hp_bar', 0xff315d, 0, topY - 2, 144, 4.8, 0.4)
    this.bossHpFrame.visible = false
    this.bossHpBar.visible = false
    this.hudStatusBeacon = makeBox('hud_status_beacon', 0x26323a, 0, topY - 13, 42, 4.6, 0.8)
    this.hudStatusBeacon.visible = false

    const rightBarLeft = SCENE.WIDTH * 0.5 - 48
    makeBox('spin_frame', 0x2a2111, rightBarLeft + 19, bottomY + 7, 42, 6.3, -1.0)
    this.spinBar = makeBox('spin_cooldown_bar', 0xffb347, rightBarLeft + 19, bottomY + 7, 38, 3.8, 0.4)
    makeBox('heat_frame', 0x11242c, rightBarLeft + 19, bottomY - 1, 42, 6.3, -1.0)
    this.heatBar = makeBox('laser_heat_bar', 0x48d6ff, rightBarLeft + 19, bottomY - 1, 38, 3.8, 0.4)

    this.hudWeaponIcons = [
      this.buildWeaponIcon(root, 'shot', SCENE.WIDTH * 0.5 - 45, bottomY + 21, 0xffd166),
      this.buildWeaponIcon(root, 'spread', SCENE.WIDTH * 0.5 - 29, bottomY + 21, 0x7bff74),
      this.buildWeaponIcon(root, 'laser', SCENE.WIDTH * 0.5 - 13, bottomY + 21, 0xd48aff),
    ]
    for (let i = 0; i < 5; i++) {
      this.hudWeaponLevelPips.push(makeBox(`weapon_level_pip_${i}`, 0xffffff, SCENE.WIDTH * 0.5 - 48 + i * 7.3, bottomY - 10.5, 5.5, 4.2, 0.6))
    }

    this.scene.add(root)
    this.updateSceneHud()
  }

  private clearSceneHud(): void {
    if (this.sceneHudRoot) {
      this.scene.remove(this.sceneHudRoot)
      this.sceneHudRoot.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const material = obj.material
        const disposeHudMaterial = (mat: THREE.Material): void => {
          const map = (mat as THREE.MeshStandardMaterial).map
          if (map) map.dispose()
          mat.dispose()
        }
        if (Array.isArray(material)) {
          for (const mat of material) disposeHudMaterial(mat)
        } else {
          disposeHudMaterial(material)
        }
      })
    }
    this.sceneHudRoot = null
    this.lifePips = []
    this.bossHpFrame = null
    this.bossHpBar = null
    this.heatBar = null
    this.spinBar = null
    this.hudScoreDigits = []
    this.hudStageDigits = []
    this.hudWeaponIcons = []
    this.hudWeaponLevelPips = []
    this.hudStatusBeacon = null
  }

  private setHudBar(mesh: THREE.Mesh | null, leftX: number, width: number, ratio: number): void {
    if (!mesh) return
    const r = THREE.MathUtils.clamp(ratio, 0.001, 1)
    mesh.scale.x = width * r
    mesh.position.x = leftX + (width * r) * 0.5
  }

  private updateSceneHud(): void {
    if (!this.sceneHudRoot) return
    if (this.sceneHudFailed) return

    try {
      this.setHudNumber(this.hudScoreDigits, this.scoring.score, 6, 0xffd166)
      this.setHudNumber(this.hudStageDigits, this.bossesDefeated + 1, 2, 0x8fe8ff)

      for (let i = 0; i < this.lifePips.length; i++) {
        const pip = this.lifePips[i]
        pip.visible = this.debugInvincible || i < this.player.lives
        this.setHudMeshColor(pip, this.debugInvincible ? 0xffd166 : 0x4de2ff, 1.2)
        const pulse = this.player.invincibleTimer > 0 && Number.isFinite(this.player.invincibleTimer)
          ? 1.0 + Math.sin(performance.now() / 70) * 0.12
          : 1.0
        pip.scale.set(7.2 * pulse, 7.2 * pulse, 1)
      }

      const bossVisible = !!this.boss?.active
      if (this.bossHpFrame) this.bossHpFrame.visible = bossVisible
      if (this.bossHpBar) {
        this.bossHpBar.visible = bossVisible
        if (bossVisible && this.boss) {
          const ratio = this.boss.maxHp > 0 ? this.boss.hp / this.boss.maxHp : 0
          this.setHudBar(this.bossHpBar, -72, 144, ratio)
          this.setHudMeshColor(this.bossHpBar, ratio < 0.35 ? 0xffb347 : 0xff315d, ratio < 0.35 ? 1.55 : 1.2)
        }
      }

      if (this.hudStatusBeacon) {
        const active = this.warningTimer > 0 || bossVisible || this.campaignCleared || this.debugInvincible
        this.hudStatusBeacon.visible = active
        if (active) {
          const color = this.campaignCleared
            ? 0x8fe8ff
            : this.warningTimer > 0
              ? 0xffd166
              : bossVisible
                ? 0xff315d
                : 0x7bff74
          this.setHudMeshColor(this.hudStatusBeacon, color, 1.35)
        }
      }

      const spinReady = 1 - THREE.MathUtils.clamp(this.player.spinCooldown / 8, 0, 1)
      this.setHudBar(this.spinBar, SCENE.WIDTH * 0.5 - 48, 38, spinReady)
      if (this.spinBar) {
        this.setHudMeshColor(this.spinBar, spinReady >= 0.99 ? 0x7bff74 : 0xffb347, spinReady >= 0.99 ? 1.45 : 1.0)
      }

      const heat = THREE.MathUtils.clamp(this.player.weapon.heat, 0, 1)
      this.setHudBar(this.heatBar, SCENE.WIDTH * 0.5 - 48, 38, Math.max(0.001, heat))
      if (this.heatBar) {
        this.heatBar.visible = this.player.weapon.current === 'laser' || heat > 0.02
        this.setHudMeshColor(this.heatBar, this.player.weapon.overheated ? 0xff3f3f : 0x48d6ff, this.player.weapon.overheated ? 1.5 : 1.05)
      }

      for (const icon of this.hudWeaponIcons) {
        const active = icon.weapon === this.player.weapon.current
        icon.root.scale.setScalar(active ? 1.16 : 0.86)
        for (const piece of icon.pieces) {
          this.setHudMeshColor(piece, active ? weaponColor(icon.weapon) : 0x26323a, active ? 1.4 : 0.22)
        }
      }

      for (let i = 0; i < this.hudWeaponLevelPips.length; i++) {
        const pip = this.hudWeaponLevelPips[i]
        const active = i < this.player.weapon.level
        pip.visible = active
        this.setHudMeshColor(pip, weaponColor(this.player.weapon.current), active ? 1.2 : 0.2)
      }
    } catch (error) {
      console.error('[GameplayScene] C1 scene HUD disabled after update failure', error)
      this.sceneHudFailed = true
      this.clearSceneHud()
    }
  }

  private createHudBox(name: string, color: number, width: number, height: number, depth: number): THREE.Mesh {
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.28,
      metalness: 0.46,
      emissive: color,
      emissiveIntensity: 0.85,
      flatShading: true,
    })
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
    mesh.name = name
    mesh.scale.set(width, height, depth)
    mesh.frustumCulled = false
    return mesh
  }

  private buildHudNumber(root: THREE.Group, name: string, x: number, y: number, count: number, scale: number, color: number): HudDigit[] {
    const digits: HudDigit[] = []
    const spacing = 9.2 * scale
    for (let i = 0; i < count; i++) {
      digits.push(this.buildHudDigit(root, `${name}_${i}`, x + i * spacing, y, scale, color))
    }
    return digits
  }

  private buildHudDigit(root: THREE.Group, name: string, x: number, y: number, scale: number, color: number): HudDigit {
    const defs: Array<[number, number, number, number]> = [
      [0, 5.1, 5.5, 1.1],
      [3.25, 2.65, 1.1, 4.7],
      [3.25, -2.65, 1.1, 4.7],
      [0, -5.1, 5.5, 1.1],
      [-3.25, -2.65, 1.1, 4.7],
      [-3.25, 2.65, 1.1, 4.7],
      [0, 0, 5.3, 1.1],
    ]
    const digit: HudDigit = []
    for (let i = 0; i < defs.length; i++) {
      const [sx, sy, sw, sh] = defs[i]
      const seg = this.createHudBox(`${name}_seg_${i}`, color, sw * scale, sh * scale, 2.9)
      seg.position.set(x + sx * scale, y + sy * scale, DEPTH_LAYERS.UI + 1.4)
      root.add(seg)
      digit.push(seg)
    }
    return digit
  }

  private setHudNumber(digits: HudDigit[], value: number, count: number, color: number): void {
    const text = Math.max(0, Math.floor(value)).toString().slice(-count).padStart(count, '0')
    for (let i = 0; i < digits.length; i++) {
      const n = Number(text[i] ?? '0')
      this.setHudDigit(digits[i], Number.isFinite(n) ? n : 0, color)
    }
  }

  private setHudDigit(digit: HudDigit, value: number, color: number): void {
    const activeSegments = new Set(HUD_DIGIT_SEGMENTS[value] ?? HUD_DIGIT_SEGMENTS[0])
    for (let i = 0; i < digit.length; i++) {
      const seg = digit[i]
      const active = activeSegments.has(i)
      seg.visible = active
      if (active) this.setHudMeshColor(seg, color, 1.12)
    }
  }

  private buildWeaponIcon(root: THREE.Group, weapon: WeaponType, x: number, y: number, color: number): HudWeaponIcon {
    const iconRoot = new THREE.Group()
    iconRoot.name = `hud_weapon_${weapon}`
    iconRoot.position.set(x, y, DEPTH_LAYERS.UI + 1.6)
    root.add(iconRoot)
    const pieces: THREE.Mesh[] = []
    const addPiece = (name: string, px: number, py: number, w: number, h: number, rot = 0): void => {
      const mesh = this.createHudBox(name, color, w, h, 2.8)
      mesh.position.set(px, py, 0)
      mesh.rotation.z = rot
      iconRoot.add(mesh)
      pieces.push(mesh)
    }
    if (weapon === 'shot') {
      addPiece('shot_core', 0, 0, 4.2, 11)
      addPiece('shot_tip', 0, 6.8, 7, 3.2)
    } else if (weapon === 'spread') {
      addPiece('spread_mid', 0, 0, 3.3, 11)
      addPiece('spread_left', -4.6, 0, 3, 10, -0.45)
      addPiece('spread_right', 4.6, 0, 3, 10, 0.45)
    } else {
      addPiece('laser_beam', 0, 0, 3.6, 15)
      addPiece('laser_core', 0, 0, 7.2, 3.4)
    }
    return { weapon, root: iconRoot, pieces }
  }

  private setHudMeshColor(mesh: THREE.Mesh, color: number, emissiveIntensity = 1): void {
    const material = mesh.material
    const apply = (mat: THREE.Material): void => {
      if (mat instanceof THREE.MeshStandardMaterial) {
        mat.color.setHex(color)
        mat.emissive.setHex(color)
        mat.emissiveIntensity = emissiveIntensity
      }
    }
    if (Array.isArray(material)) {
      for (const mat of material) apply(mat)
    } else {
      apply(material)
    }
  }

  private buildPrimitivePlayerProbe(): THREE.Group {
    const group = new THREE.Group()
    group.name = 'c1_primitive_player_probe'

    const noseMat = new THREE.MeshStandardMaterial({
      color: 0xff7a32,
      roughness: 0.35,
      metalness: 0.28,
      emissive: 0x291006,
      emissiveIntensity: 0.16,
    })
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x24b8ff,
      roughness: 0.42,
      metalness: 0.25,
      emissive: 0x042233,
      emissiveIntensity: 0.2,
    })
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0x9cff5a,
      roughness: 0.5,
      metalness: 0.12,
      emissive: 0x102c06,
      emissiveIntensity: 0.14,
    })
    const bottomMat = new THREE.MeshStandardMaterial({
      color: 0x333a45,
      roughness: 0.72,
      metalness: 0.1,
    })

    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 30, 34), createBoxFaceMaterials(1))
    body.position.set(0, 0, 0)
    group.add(body)

    const nose = new THREE.Mesh(new THREE.ConeGeometry(4.8, 11, 4), noseMat)
    nose.position.set(0, 16, 0.2)
    nose.rotation.y = Math.PI / 4
    group.add(nose)

    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(24, 7, 12), wingMat)
      wing.position.set(15 * side, -3, -1.5)
      wing.rotation.z = -0.18 * side
      group.add(wing)
    }

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 12), createBoxFaceMaterials(4))
    cockpit.position.set(0, 7, 20)
    cockpit.rotation.x = -0.08
    group.add(cockpit)

    const tail = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 24), tailMat)
    tail.position.set(0, -16, -2)
    group.add(tail)

    const belly = new THREE.Mesh(new THREE.BoxGeometry(10, 18, 8), bottomMat)
    belly.position.set(0, -1, -18)
    group.add(belly)

    group.scale.setScalar(0.74)
    return group
  }

  private buildBossTelegraphGeometry(): void {
    this.bossTelegraphGroup.name = 'c1_safe_boss_attack_telegraph'
    this.bossTelegraphGroup.visible = false

    const addPiece = (
      name: string,
      geometry: THREE.BufferGeometry,
      materialIndex: number,
      position: [number, number, number],
      scale: [number, number, number],
      rotation = new THREE.Euler(),
      order = 0,
    ): void => {
      const mesh = new THREE.Mesh(geometry, BOSS_TELEGRAPH_MATS[materialIndex])
      mesh.name = name
      mesh.position.set(position[0], position[1], position[2])
      mesh.scale.set(scale[0], scale[1], scale[2])
      mesh.rotation.copy(rotation)
      mesh.frustumCulled = false
      mesh.userData.basePosition = mesh.position.clone()
      mesh.userData.baseScale = mesh.scale.clone()
      mesh.userData.order = order
      this.bossTelegraphGroup.add(mesh)
      this.bossTelegraphPieces.push(mesh)
    }

    addPiece('boss_telegraph_core_lock', BOSS_TELEGRAPH_CORE_GEO, 2, [0, 34, 18], [11, 11, 17], new THREE.Euler(0.18, 0.08, 0.12), 0)
    addPiece('boss_telegraph_left_charge_rail', BOSS_TELEGRAPH_BOX_GEO, 0, [-24, 6, 8], [6, 58, 8], new THREE.Euler(0.05, 0.08, 0.04), 0.1)
    addPiece('boss_telegraph_right_charge_rail', BOSS_TELEGRAPH_BOX_GEO, 0, [24, 6, 8], [6, 58, 8], new THREE.Euler(0.05, -0.08, -0.04), 0.1)
    addPiece('boss_telegraph_cross_brace', BOSS_TELEGRAPH_BOX_GEO, 1, [0, 8, 12], [64, 5, 8], new THREE.Euler(0.04, 0, 0.12), 0.18)

    for (let i = 0; i < 5; i++) {
      const y = -24 - i * 26
      const width = 28 + i * 7
      addPiece(
        `boss_telegraph_lane_marker_${i}`,
        BOSS_TELEGRAPH_BOX_GEO,
        i % 2 === 0 ? 1 : 0,
        [0, y, 4 + i * 1.4],
        [width, 5, 7],
        new THREE.Euler(0.03, 0, (i % 2 === 0 ? 1 : -1) * 0.06),
        0.26 + i * 0.1,
      )
    }

    this.scene.add(this.bossTelegraphGroup)
  }

  private renderLaserBeam(x: number, playerY: number, width: number, impactY: number | null): void {
    const startY = playerY + 22
    const endY = impactY === null ? SCENE.HEIGHT * 0.5 + 24 : Math.max(startY + 8, impactY)
    const beamH = Math.max(8, endY - startY)
    const root = new THREE.Group()
    root.name = 'c1_safe_segmented_laser'

    if (C1_FUSION_SAFE_VISUALS) {
      const segmentCount = Math.max(1, Math.min(12, Math.ceil(beamH / 58)))
      const cellH = beamH / segmentCount
      const time = performance.now() * 0.006

      for (let i = 0; i < segmentCount; i++) {
        const phase = time + i * 0.72
        const mat = LASER_SEGMENT_MATS[i % LASER_SEGMENT_MATS.length]
        const mesh = new THREE.Mesh(LASER_SEGMENT_GEO, mat)
        const pulse = 0.92 + Math.sin(phase) * 0.08
        mesh.name = `laser_segment_${i}`
        mesh.scale.set(width * pulse, cellH * 0.82, 5.5 + (i % 3) * 1.6)
        mesh.position.set(
          x + Math.sin(phase * 0.7) * 0.6,
          startY + cellH * (i + 0.5),
          DEPTH_LAYERS.BULLET + (i % 2 === 0 ? 2.8 : -1.6),
        )
        mesh.rotation.z = Math.sin(phase * 0.42) * 0.012
        mesh.frustumCulled = false
        root.add(mesh)

        if (C1_LOCAL_ADDITIVE_GLOW && i % 2 === 0) {
          const glow = new THREE.Mesh(LASER_SEGMENT_GEO, LASER_LOCAL_GLOW_MAT)
          glow.name = `laser_local_glow_${i}`
          glow.scale.set(width * pulse * 2.1, cellH * 0.36, 1.4)
          glow.position.set(mesh.position.x, mesh.position.y, DEPTH_LAYERS.BULLET + 7.8 + (i % 3) * 0.35)
          glow.rotation.z = mesh.rotation.z
          glow.frustumCulled = false
          glow.renderOrder = 3
          root.add(glow)
        }
      }

      const muzzle = new THREE.Mesh(LASER_SEGMENT_GEO, LASER_SEGMENT_MATS[1])
      muzzle.name = 'laser_muzzle_depth_key'
      muzzle.scale.set(width * 1.34, 13, 13)
      muzzle.position.set(x, startY - 8, DEPTH_LAYERS.BULLET + 5)
      muzzle.frustumCulled = false
      root.add(muzzle)

      if (impactY !== null) {
        const cap = new THREE.Mesh(LASER_SEGMENT_GEO, LASER_SEGMENT_MATS[1])
        cap.name = 'laser_impact_stop_cap'
        cap.scale.set(width * 1.5, 7.5, 12)
        cap.position.set(x, endY, DEPTH_LAYERS.BULLET + 6.5)
        cap.rotation.z = Math.sin(time) * 0.08
        cap.frustumCulled = false
        root.add(cap)

        if (C1_LOCAL_ADDITIVE_GLOW) {
          const glowCap = new THREE.Mesh(LASER_SEGMENT_GEO, LASER_IMPACT_LOCAL_GLOW_MAT)
          glowCap.name = 'laser_impact_local_glow'
          glowCap.scale.set(width * 2.4, 10.5, 2.0)
          glowCap.position.set(x, endY, DEPTH_LAYERS.BULLET + 9)
          glowCap.rotation.z = cap.rotation.z
          glowCap.frustumCulled = false
          glowCap.renderOrder = 3
          root.add(glowCap)
        }
      }
    } else {
      const beam = new THREE.Mesh(LASER_SEGMENT_GEO, LASER_SEGMENT_MATS[0])
      beam.scale.set(width, beamH, 2)
      beam.position.set(x, startY + beamH * 0.5, DEPTH_LAYERS.BULLET)
      root.add(beam)
    }

    this.scene.add(root)
    this.laserBeams.push(root)
  }

  private appendEnemyBullets(requests: EnemyBulletSpawn[], boss = false): number {
    const available = GAMEPLAY_RUNTIME_CAPS.enemyBullets - this.enemyBullets.length
    if (available <= 0) return 0

    const count = Math.min(available, requests.length)
    for (let i = 0; i < count; i++) {
      const req = requests[i]
      this.enemyBullets.push(new Bullet(this.scene, req.x, req.y, req.z, req.vx, req.vy, false, 1, boss ? 'boss' : req.visual))
    }
    return count
  }

  private spawnEnemyFireFeedback(x: number, y: number, bulletCount: number, now: number, boss: boolean): void {
    if (boss) {
      if (now - this.lastBossMuzzleTime <= 0.09) return
      this.explosions.spawnBossMuzzle(x, y, bulletCount)
      this.lastBossMuzzleTime = now
      return
    }

    if (now - this.lastEnemyMuzzleTime <= 0.055) return
    this.explosions.spawnEnemyMuzzle(x, y, bulletCount)
    this.lastEnemyMuzzleTime = now
  }

  private spawnPlayerEngineFeedback(input: InputManager, now: number): void {
    const visual = this.player.getVisualState()
    const moving = input.isHeld('moveLeft')
      || input.isHeld('moveRight')
      || input.isHeld('moveUp')
      || input.isHeld('moveDown')
    const active = moving || visual.firing || visual.spinning || visual.focusing
    if (!active) return

    const interval = visual.spinning ? 0.055 : visual.firing ? 0.085 : 0.12
    if (now - this.lastPlayerEngineTrailTime <= interval) return

    const intensity = visual.spinning
      ? 1.65
      : visual.firing
        ? 1.25
        : visual.focusing
          ? 0.88
          : 1.0
    this.explosions.spawnPlayerEngineTrail(this.player.position.x, this.player.position.y, intensity * visual.enginePulse)
    this.lastPlayerEngineTrailTime = now
  }

  private spawnEnemyEngineFeedback(enemy: Enemy, now: number): void {
    const margin = 58
    if (enemy.position.y < -SCENE.HEIGHT / 2 - margin || enemy.position.y > SCENE.HEIGHT / 2 + margin) return

    const heavy = enemy.scoreValue >= 400
    const interval = heavy ? 0.2 : 0.34
    if (now - this.lastEnemyEngineTrailTime <= interval) return

    this.explosions.spawnEnemyEngineTrail(enemy.position.x, enemy.position.y, heavy)
    this.lastEnemyEngineTrailTime = now
  }

  private spawnEnemyDamageFeedback(enemy: Enemy, now: number): void {
    if (enemy.maxHp <= 2 || enemy.hp >= enemy.maxHp) return
    const hpRatio = enemy.hp / enemy.maxHp
    if (hpRatio > 0.55) return

    const heavy = enemy.scoreValue >= 400
    const interval = heavy ? 0.34 : 0.62
    if (now - this.lastEnemyDamageVentTime <= interval) return

    this.explosions.spawnEnemyDamageVent(enemy.position.x, enemy.position.y, heavy)
    this.lastEnemyDamageVentTime = now
  }

  private spawnBossEngineFeedback(boss: Boss, now: number): void {
    if (boss.entering && boss.position.y > SCENE.HEIGHT / 2 + 10) return

    const charge = boss.getTelegraphStrength()
    const interval = charge > 0.2 || boss.getActionState() === 'attack' ? 0.12 : 0.24
    if (now - this.lastBossEngineTrailTime <= interval) return

    this.explosions.spawnBossEngineTrail(boss.position.x, boss.position.y, charge)
    this.lastBossEngineTrailTime = now
  }

  private spawnBossDamageFeedback(boss: Boss, now: number): void {
    if (boss.entering || boss.maxHp <= 0) return
    const hpRatio = boss.hp / boss.maxHp
    const action = boss.getActionState()
    const pressure = Math.max(
      0,
      1 - hpRatio,
      action === 'phaseTransition' ? 0.75 : 0,
      action === 'attack' ? 0.42 : 0,
    )
    if (pressure < 0.34) return

    const interval = action === 'phaseTransition' ? 0.16 : hpRatio < 0.35 ? 0.22 : 0.36
    if (now - this.lastBossDamageVentTime <= interval) return

    this.explosions.spawnBossDamageVent(boss.position.x, boss.position.y, pressure)
    this.lastBossDamageVentTime = now
  }

  private spawnWaveArrivalFeedback(newEnemies: Enemy[], now: number): void {
    const active = newEnemies.filter((enemy) => enemy.active)
    if (active.length === 0 || now - this.lastWaveArrivalTime <= 0.18) return

    let minX = active[0].position.x
    let maxX = active[0].position.x
    let sumX = 0
    let sumY = 0
    for (const enemy of active) {
      minX = Math.min(minX, enemy.position.x)
      maxX = Math.max(maxX, enemy.position.x)
      sumX += enemy.position.x
      sumY += enemy.position.y
    }

    const centerX = sumX / active.length
    const centerY = sumY / active.length
    this.explosions.spawnWaveArrival(centerX, centerY, Math.max(24, maxX - minX), active.length)

    for (const enemy of active.slice(0, 5)) {
      this.explosions.spawnEnemyArrival(enemy.position.x, enemy.position.y, enemy.scoreValue >= 400)
    }
    this.lastWaveArrivalTime = now
  }

  private clearLaserBeams(): void {
    for (const beam of this.laserBeams) {
      this.scene.remove(beam)
    }
    this.laserBeams = []
  }

  private updatePlayerHeroLights(): void {
    const px = this.player.position.x
    const py = this.player.position.y
    const pz = this.player.position.z
    const visual = this.player.getVisualState()

    this.playerKeyLight.position.set(px, py + 18, pz + 18)
    this.playerFillLight.position.set(px - 16, py - 8, pz + 10)
    this.playerRimLight.position.set(px + 12, py - 18, pz - 6)

    let keyBoost = visual.spinning ? 2.9 : visual.focusing ? 2.4 : 2.2
    let fillBoost = visual.spinning ? 1.9 : visual.focusing ? 1.35 : 1.2
    let rimBoost = visual.spinning ? 2.2 : visual.firing ? 1.65 : 1.45

    if (visual.hitPulse > 0) {
      const flash = 1 + visual.hitPulse * 0.42
      keyBoost *= flash
      fillBoost *= flash * 0.9
      rimBoost *= flash * 1.1
    }

    this.playerKeyLight.intensity = keyBoost
    this.playerFillLight.intensity = fillBoost
    this.playerRimLight.intensity = rimBoost

    this.playerFillLight.color.setHex(visual.focusing ? 0x6ccfff : 0x5ebeff)
    this.playerRimLight.color.setHex(visual.firing ? 0xffb067 : 0xff9d52)
  }

  private updateBossTelegraphVisual(dt: number): void {
    if (C1_FUSION_SAFE_VISUALS) {
      this.bossDangerMat.opacity = 0
      this.bossDangerMesh.visible = false
      this.updateC1SafeBossTelegraph(dt)
      return
    }

    if (this.boss?.active) {
      const tele = this.boss.getTelegraphStrength()
      this.bossScreenDarken = this.boss.getScreenDarken()

      if (tele > 0.03) {
        this.bossDangerMesh.visible = true
        this.bossDangerMesh.position.set(
          this.boss.position.x,
          this.boss.position.y - SCENE.HEIGHT * 0.18,
          DEPTH_LAYERS.UI - 0.4,
        )
        const laneW = Math.max(0.9, (this.boss.hitboxRadius * (0.95 + tele * 1.2)) / 26)
        this.bossDangerMesh.scale.set(laneW, 1, 1)
        this.bossDangerMat.opacity = 0.06 + tele * 0.25
        this.bossDangerMat.color.setHex(tele > 0.75 ? 0xff1f45 : 0xff3f58)
      } else {
        this.bossDangerMat.opacity = Math.max(0, this.bossDangerMat.opacity - dt * 0.6)
        if (this.bossDangerMat.opacity <= 0.01) this.bossDangerMesh.visible = false
      }
      return
    }

    this.bossScreenDarken = Math.max(0, this.bossScreenDarken - dt * 1.3)
    this.bossDangerMat.opacity = Math.max(0, this.bossDangerMat.opacity - dt * 0.9)
    if (this.bossDangerMat.opacity <= 0.01) this.bossDangerMesh.visible = false
  }

  private updateC1SafeBossTelegraph(dt: number): void {
    if (!this.boss?.active) {
      this.bossTelegraphGroup.visible = false
      this.bossScreenDarken = Math.max(0, this.bossScreenDarken - dt * 1.3)
      return
    }

    const tele = this.boss.getTelegraphStrength()
    this.bossScreenDarken = Math.max(this.bossScreenDarken, this.boss.getScreenDarken() * 0.18)
    if (tele <= 0.04) {
      this.bossTelegraphGroup.visible = false
      return
    }

    const time = performance.now() * 0.006
    const pulse = 0.86 + Math.sin(time * 2.2) * 0.14
    const laneScale = THREE.MathUtils.clamp((this.boss.hitboxRadius / 30) * (0.82 + tele * 0.58), 0.78, 1.72)

    this.bossTelegraphGroup.visible = true
    this.bossTelegraphGroup.position.set(
      this.boss.position.x,
      this.boss.position.y - 48 - tele * 18,
      DEPTH_LAYERS.ENEMY + 7 + tele * 6,
    )
    this.bossTelegraphGroup.rotation.z = Math.sin(time * 0.7) * 0.03 * tele
    this.bossTelegraphGroup.scale.set(laneScale, 0.8 + tele * 0.34, 1 + tele * 0.24)

    BOSS_TELEGRAPH_MATS[0].emissiveIntensity = 0.85 + tele * 2.0 * pulse
    BOSS_TELEGRAPH_MATS[1].emissiveIntensity = 1.05 + tele * 2.35 * pulse
    BOSS_TELEGRAPH_MATS[2].emissiveIntensity = 1.25 + tele * 2.55 * pulse

    for (const piece of this.bossTelegraphPieces) {
      const basePosition = piece.userData.basePosition as THREE.Vector3
      const baseScale = piece.userData.baseScale as THREE.Vector3
      const order = typeof piece.userData.order === 'number' ? piece.userData.order : 0
      const reveal = THREE.MathUtils.clamp((tele - order) * 3.3, 0, 1)
      const localPulse = 1 + Math.sin(time * 2.6 + order * 8) * 0.06 * tele
      piece.visible = reveal > 0.02
      piece.position.set(
        basePosition.x,
        basePosition.y - tele * order * 22,
        basePosition.z + tele * (4 + order * 3) + Math.sin(time + order * 5) * 0.8,
      )
      piece.scale.set(
        baseScale.x * localPulse,
        baseScale.y * (0.7 + reveal * 0.3),
        baseScale.z * (1 + tele * 0.32),
      )
      piece.rotation.y = Math.sin(time * 0.8 + order * 4) * 0.04 * tele
    }
  }

  private getProgressDistance(): number {
    return this.scrollMap?.totalDistance ?? this.c1SafeField?.totalDistance ?? this.fallbackDistance
  }

  private handleLaser(x: number, _y: number, damage: number, width: number, now: number): number | null {
    const halfW = width / 2
    const startY = this.player.position.y + 22
    const candidates: Array<{
      kind: 'enemy' | 'boss'
      target: Enemy | Boss
      contactY: number
    }> = []

    const considerTarget = (kind: 'enemy' | 'boss', target: Enemy | Boss): void => {
      if (!target.active) return
      if (Math.abs(target.position.x - x) >= halfW + target.hitboxRadius) return
      const contactY = target.position.y - target.hitboxRadius
      if (contactY < startY) return
      candidates.push({ kind, target, contactY })
    }

    for (const enemy of this.enemies) {
      considerTarget('enemy', enemy)
    }
    if (this.boss?.active) considerTarget('boss', this.boss)

    const nearest = candidates.sort((a, b) => a.contactY - b.contactY)[0]
    if (!nearest) return null

    if (nearest.kind === 'enemy') {
      const enemy = nearest.target as Enemy
      const killed = enemy.takeDamage(damage)
      if (killed) {
        this.scoring.onEnemyKilled(enemy.scoreValue)
        this.explosions.spawnEnemyKill(enemy.position.x, enemy.position.y)
        this.tryDropPowerUp(enemy.position.x, enemy.position.y, enemy.scoreValue)
        audioManager.playSFX('enemy_destroy')
      } else if (now - this.lastLaserImpactTime > 0.06) {
        this.explosions.spawnEnemyHit(enemy.position.x, enemy.position.y)
        this.lastLaserImpactTime = now
        if (now - this.lastEnemyHitTime > 0.05) {
          audioManager.playSFX('enemy_hit')
          this.lastEnemyHitTime = now
        }
      }
    } else {
      const boss = nearest.target as Boss
      const killed = boss.takeDamage(damage)
      if (now - this.lastLaserImpactTime > 0.06) {
        this.explosions.spawnBossHit(boss.position.x + randomRange(-20, 20), boss.position.y + randomRange(-20, 20))
        this.lastLaserImpactTime = now
        if (now - this.lastBossHitTime > 0.05) {
          audioManager.playSFX('enemy_hit')
          this.lastBossHitTime = now
        }
      }
      if (killed) this.onBossDefeated()
    }

    return nearest.contactY
  }

  private updateBossLogic(dt: number, dist: number): void {
    // 用 nextBossAt 判断，避免 dist 绝对值受 boss 战时长影响
    if (!this.boss && dist >= this.nextBossAt) {
      if (this.warningTimer <= 0) {
        // 进入 WARNING 阶段
        this.warningTimer = WARNING_TIME
        this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME * 0.65
        this.explosions.spawnBossWarning(0, SCENE.HEIGHT * 0.5 - 34)
        if (!this.warningAlarmOn) {
          audioManager.startWarningAlarm()
          this.warningAlarmOn = true
        }
      } else {
        this.warningTimer -= dt
        if (this.warningTimer <= 0) {
          this.warningTimer = 0
          // 在 boss 出现时将下一个阈值推远，防止立刻再次触发
          this.nextBossAt = dist + BOSS_INTERVAL
          this.spawnBoss(this.bossesDefeated)
        }
      }
    }
  }

  /** boss 战结束公共处理（无论什么方式击杀都走这里） */
  private onBossDefeated(): void {
    if (!this.boss) return
    const defeatedBossIndex = this.bossesDefeated
    const bossX = this.boss.position.x
    const bossY = this.boss.position.y
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
    this.scoring.onBossKilled(this.boss.scoreValue, this.boss.fightDuration)
    this.explosions.spawnBossDefeat(bossX, bossY)
    audioManager.playSFX('boss_destroy')
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    this.bossTelegraphGroup.visible = false
    this.bossesDefeated++
    if (this.boss.mesh) {
      const mesh = this.boss.mesh
      this.scene.remove(mesh)
      this.disposeObjectTree(mesh)
      this.boss.mesh = null
    }
    this.boss = null           // ← 必须置 null，spawner 才能恢复
    this.prevBossPhase = -1
    this.events.onBossState(false)
    if (defeatedBossIndex >= getStageCount() - 1) {
      this.completeCampaign()
      return
    }
    this.spawnBossRewardPack(defeatedBossIndex, bossX, bossY)
    this.explosions.spawnStageAdvance(0, SCENE.HEIGHT * 0.28)
    this.scrollMap?.transitionToBiome(this.bossesDefeated, 2.8)
    this.c1SafeField?.transitionToBiome(this.bossesDefeated, 2.8)
    this.spawner.resetForStage(1.8)
    audioManager.playBGM('gameplay')
  }

  private completeCampaign(): void {
    this.campaignCleared = true
    this.warningTimer = 0
    this.nextBossAt = Number.POSITIVE_INFINITY
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
    this.clearCombatObjects()
    this.scrollMap?.transitionToBiome(getStageCount() - 1, 1.2)
    this.c1SafeField?.transitionToBiome(getStageCount() - 1, 1.2)
    this.explosions.spawnStageAdvance(0, SCENE.HEIGHT * 0.12, true)
    this.spawner.resetForStage(999)
    audioManager.playBGM('title')
    this.events.onCampaignClear()
    this.events.onHUDChange()
  }

  private clearCombatObjects(): void {
    for (const e of this.enemies) e.destroy()
    for (const b of this.playerBullets) b.destroy()
    for (const b of this.enemyBullets) b.destroy()
    for (const p of this.powerUps) p.destroy()
    this.clearLaserBeams()
  }

  private spawnBoss(index: number): void {
    const ctors = [FortressGuardian, SandScorpion, OceanOverlord, FlameDragon, RuinTitan, OrbitalEye, NebulaPhantom, PlanetBreaker, VoidHerald, FinalArchon]
    this.boss = new (ctors[index % ctors.length])(this.scene)
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
    this.explosions.spawnBossIntro(this.boss.position.x, this.boss.targetY + 18)
    this.prevBossPhase = 0
    this.bossScreenDarken = 0
    this.bossDangerMat.opacity = 0
    this.bossDangerMesh.visible = false
    this.bossTelegraphGroup.visible = false
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    audioManager.playBGM('boss')
    this.events.onBossState(true)
    for (const e of this.enemies) e.destroy()
  }

  private clearAllEnemyBullets(showFeedback = true, x = this.player.position.x, y = this.player.position.y): number {
    let cleared = 0
    for (const b of this.enemyBullets) {
      if (!b.active) continue
      b.destroy()
      this.scoring.score += 10
      cleared++
    }
    if (showFeedback && cleared > 0) this.explosions.spawnBulletCancel(x, y, cleared)
    return cleared
  }

  private tryDropPowerUp(x: number, y: number, scoreValue: number): void {
    const stageBonus = Math.min(0.08, this.bossesDefeated * 0.008)
    const dropChance = (scoreValue >= 400 ? 0.16 : 0.09) + stageBonus
    if (!chance(dropChance)) return

    const table = scoreValue >= 400 ? MEDIUM_ENEMY_DROP_TABLE : SMALL_ENEMY_DROP_TABLE
    this.spawnPowerUp(weightedPowerUp(table), x, y)
  }

  private spawnBossRewardPack(stageIndex: number, x: number, y: number): void {
    const rewards: PowerUpType[] = ['weapon_upgrade', 'gem_large', 'gem_large']
    if (stageIndex % 2 === 1) rewards.push('bomb')
    if (stageIndex > 0 && stageIndex % 3 === 2) rewards.push('extra_life')

    const spacing = 18
    for (let i = 0; i < rewards.length; i++) {
      const offset = (i - (rewards.length - 1) / 2) * spacing
      this.spawnPowerUp(rewards[i], x + offset, y - 18 - Math.abs(offset) * 0.18)
    }
  }

  private spawnPowerUp(type: PowerUpType, x: number, y: number): void {
    if (this.powerUps.length >= GAMEPLAY_RUNTIME_CAPS.powerUps) return
    this.powerUps.push(new PowerUp(this.scene, type, x, y))
    this.explosions.spawnPowerUpDrop(x, y, type)
  }

  private applyPowerUp(p: PowerUp): void {
    switch (p.type) {
      case 'weapon_upgrade': {
        const oldLevel = this.player.weapon.level
        this.player.weapon.upgrade()
        if (this.player.weapon.level > oldLevel) {
          this.explosions.spawnWeaponUpgrade(this.player.position.x, this.player.position.y, this.player.weapon.current, this.player.weapon.level)
        }
        break
      }
      case 'weapon_shot':
        this.player.weapon.setWeapon('shot')
        this.explosions.spawnWeaponSwitch(this.player.position.x, this.player.position.y, 'shot')
        break
      case 'weapon_spread':
        this.player.weapon.setWeapon('spread')
        this.explosions.spawnWeaponSwitch(this.player.position.x, this.player.position.y, 'spread')
        break
      case 'weapon_laser':
        this.player.weapon.setWeapon('laser')
        this.explosions.spawnWeaponSwitch(this.player.position.x, this.player.position.y, 'laser')
        break
      case 'extra_life':
        this.player.lives++
        this.explosions.spawnLifeGain(this.player.position.x, this.player.position.y)
        break
      case 'bomb':
        this.explosions.spawnBombReady(this.player.position.x, this.player.position.y)
        this.clearAllEnemyBullets(true, p.position.x, p.position.y)
        break
      default: break
    }
  }

  private cleanup(): void {
    for (const e of this.enemies) {
      if (!e.active && e.mesh) {
        this.scene.remove(e.mesh)
        this.disposeObjectTree(e.mesh)
        e.mesh = null
      }
    }

    const rm = (e: { active: boolean; mesh: THREE.Object3D | null }) => {
      if (!e.active && e.mesh) { this.scene.remove(e.mesh); e.mesh = null }
    }
    this.playerBullets.forEach(rm)
    this.enemyBullets.forEach(rm); this.powerUps.forEach(rm)
    // boss 已由 onBossDefeated() 统一清理，此处仅做安全兜底（不重复调用）
    this.enemies       = this.enemies.filter(e => e.active)
    this.playerBullets = this.playerBullets.filter(b => b.active)
    this.enemyBullets  = this.enemyBullets.filter(b => b.active)
    this.powerUps      = this.powerUps.filter(p => p.active)
  }

  private disposeObjectTree(object: THREE.Object3D): void {
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()

    object.traverse((child) => {
      if (!(child instanceof THREE.Mesh || child instanceof THREE.Points)) return
      if (child.geometry) geometries.add(child.geometry)
      const material = child.material
      if (Array.isArray(material)) {
        for (const mat of material) materials.add(mat)
      } else if (material) {
        materials.add(material)
      }
    })

    for (const geo of geometries) geo.dispose()
    for (const mat of materials) {
      const textured = mat as THREE.Material & {
        map?: THREE.Texture | null
        emissiveMap?: THREE.Texture | null
        normalMap?: THREE.Texture | null
        roughnessMap?: THREE.Texture | null
        metalnessMap?: THREE.Texture | null
        alphaMap?: THREE.Texture | null
      }
      textured.map?.dispose()
      textured.emissiveMap?.dispose()
      textured.normalMap?.dispose()
      textured.roughnessMap?.dispose()
      textured.metalnessMap?.dispose()
      textured.alphaMap?.dispose()
      mat.dispose()
    }
  }

  getPlayerLives(): number   { return this.player.lives }
  getScore():       number   { return this.scoring.score }
  getWeapon():      WeaponType { return this.player.weapon.current }
  getWeaponLevel(): number   { return this.player.weapon.level }
  getCombo():       number   { return this.scoring.killCombo }
  getMultiplier():  number   { return this.scoring.multiplier }
  getBossName():    string   { return this.boss?.name ?? '' }
  getBossHp():      number   { return this.boss?.hp ?? 0 }
  getBossMaxHp():   number   { return this.boss?.maxHp ?? 1 }
  getBossState():   string   { return this.boss?.getActionState() ?? 'idle' }
  getBossTelegraph(): number { return this.boss?.getTelegraphStrength() ?? 0 }
  getBossWeakPointExposure(): number { return this.boss?.getWeakPointExposure() ?? 0 }
  getBossDarken():  number   { return this.bossScreenDarken }
  isWarning():      boolean  { return this.warningTimer > 0 }
  getLaserHeat():   number   { return this.player.weapon.heat }
  isOverheated():   boolean  { return this.player.weapon.overheated }
  getBossPhase():   number   { return this.boss?.currentPhase ?? 0 }
  getSpinCooldown(): number  { return this.player.spinCooldown }
  isSafeFieldEnabled(): boolean { return !!this.c1SafeField && this.safeFieldEnabled }
  getEnemyCount(): number { return this.enemies.length }
  getPlayerBulletCount(): number { return this.playerBullets.length }
  getEnemyBulletCount(): number { return this.enemyBullets.length }
  getPowerUpCount(): number { return this.powerUps.length }
  getLaserBeamCount(): number { return this.laserBeams.length }
  getParticleCount(): number { return this.explosions.getParticleCount() }
  isBossActive(): boolean { return !!this.boss?.active }
  getStageStatus(): StageStatus {
    return createStageStatus(
      this.bossesDefeated,
      this.getProgressDistance(),
      this.nextBossAt,
      this.warningTimer > 0,
      !!this.boss?.active,
      this.campaignCleared,
    )
  }
  getPlayerXNorm(): number { return THREE.MathUtils.clamp(this.player.position.x / (SCENE.WIDTH * 0.5), -1, 1) }
  getPlayerYNorm(): number { return THREE.MathUtils.clamp(this.player.position.y / (SCENE.HEIGHT * 0.5), -1, 1) }
  isPlayerFiring(): boolean { return this.player.getVisualState().firing }
  isPlayerFocusing(): boolean { return this.player.getVisualState().focusing }
  isPlayerSpinning(): boolean { return this.player.isSpinning() }
  getCameraHitPulse(): number { return THREE.MathUtils.clamp(this.cameraHitTimer / CAMERA_HIT_PULSE_TIME, 0, 1) }
  getCameraBombPulse(): number { return THREE.MathUtils.clamp(this.cameraBombTimer / CAMERA_BOMB_PULSE_TIME, 0, 1) }
  getCameraBossEventPulse(): number { return THREE.MathUtils.clamp(this.cameraBossEventTimer / CAMERA_BOSS_EVENT_PULSE_TIME, 0, 1) }

  dispose(): void {
    const disposeMaterial = (material: THREE.Material): void => {
      const map = (material as THREE.MeshStandardMaterial).map
      if (map) map.dispose()
      material.dispose()
    }

    this.clearLaserBeams()
    this.scrollMap?.dispose()
    this.c1SafeField?.dispose()
    this.c1SafeField = null
    if (this.c1GameplayProbe) {
      this.scene.remove(this.c1GameplayProbe)
      this.c1GameplayProbe.geometry.dispose()
      const material = this.c1GameplayProbe.material
      if (Array.isArray(material)) {
        for (const mat of material) disposeMaterial(mat)
      } else {
        disposeMaterial(material)
      }
      this.c1GameplayProbe = null
    }
    this.clearStable3DBaseline()
    if (this.gameplayDepthRoot) {
      this.scene.remove(this.gameplayDepthRoot)
      this.gameplayDepthRoot.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const material = obj.material
        if (Array.isArray(material)) {
          for (const mat of material) disposeMaterial(mat)
        } else {
          disposeMaterial(material)
        }
      })
      this.gameplayDepthRoot = null
      this.gameplayDepthAnchors = []
    }
    this.clearSceneHud()
    this.scene.remove(this.bossTelegraphGroup)
    this.bossTelegraphGroup.clear()
    this.bossTelegraphPieces.length = 0
    this.explosions.dispose()
    this.bossDangerMesh.geometry.dispose()
    this.bossDangerMat.dispose()
    audioManager.stopBGM()
    audioManager.stopWarningAlarm()
  }
}
