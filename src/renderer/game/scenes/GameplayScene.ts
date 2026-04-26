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
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange, randomPick, chance } from '@/utils/math'
import type { InputManager } from '@/game/systems/InputManager'
import type { WeaponType } from '@shared/types'
import { audioManager } from '@/game/audio/AudioManager'

const FIRST_BOSS_AT = 1600
const BOSS_INTERVAL = 2600
const WARNING_TIME  = 3.0
const DROP_TYPES: PowerUpType[] = ['weapon_upgrade','gem_small','gem_large','extra_life','bomb']
const C1_GAMEPLAY_PROBE_ONLY = false
const C1_SAFE_GAMEPLAY_BASELINE = false
const C1_FUSION_SAFE_VISUALS = true
const C1_REAL_GAMEPLAY_ANCHORS = false
const C1_USE_SCROLL_TERRAIN = !C1_FUSION_SAFE_VISUALS
const C1_USE_SCENE_HUD = !C1_FUSION_SAFE_VISUALS
const BASELINE_USE_PRIMITIVE_PLAYER = true
const BASELINE_SCROLL_SPEED = 46
const REAL_GAMEPLAY_ANCHOR_SPEED = 52
const FALLBACK_SCROLL_SPEED = 58
const CAMERA_HIT_PULSE_TIME = 0.55
const CAMERA_BOMB_PULSE_TIME = 1.1
const CAMERA_BOSS_EVENT_PULSE_TIME = 1.15

export interface GameplayEvents {
  onHUDChange: () => void
  onGameOver:  () => void
  onBossState: (active: boolean) => void
}

type PatternKind = 'diagonal' | 'grid' | 'rings' | 'dots' | 'cross' | 'stripes'

interface GameplayDepthAnchor {
  object: THREE.Object3D
  speedMul: number
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
  private c1GameplayProbe: THREE.Mesh | null = null

  private bossesDefeated = 0
  private warningTimer   = 0
  private nextBossAt     = FIRST_BOSS_AT
  private fallbackDistance = 0
  private safeFieldEnabled = C1_FUSION_SAFE_VISUALS

  // 音效节流状态
  private lastShotSfxTime  = 0
  private lastLaserSfxTime = 0
  private lastGrazeSfxTime = 0
  private lastEnemyHitTime = 0
  private lastBossHitTime  = 0
  private prevSpinning     = false
  private prevBossPhase    = -1
  private warningAlarmOn   = false
  private cameraHitTimer = 0
  private cameraBombTimer = 0
  private cameraBossEventTimer = 0
  private playerKeyLight!:  THREE.PointLight
  private playerFillLight!: THREE.PointLight
  private playerRimLight!:  THREE.PointLight
  private bossDangerMat: THREE.MeshBasicMaterial
  private bossDangerMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private bossScreenDarken = 0
  private debugInvincible = false

  // Laser beam visual
  private laserBeams: THREE.Mesh[] = []
  private laserMat = new THREE.MeshStandardMaterial({
    color: 0x00ffff, roughness: 0.1, metalness: 0.3,
    emissive: 0x00ccff, emissiveIntensity: 3,
    transparent: !C1_FUSION_SAFE_VISUALS,
    opacity: C1_FUSION_SAFE_VISUALS ? 1 : 0.88,
  })

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
    if (C1_USE_SCENE_HUD) this.buildSceneHud()
    this.collision  = new CollisionSystem()
    this.scrollMap  = C1_USE_SCROLL_TERRAIN ? new ScrollMap(this.scene) : null
    if (!C1_SAFE_GAMEPLAY_BASELINE && !C1_FUSION_SAFE_VISUALS && C1_REAL_GAMEPLAY_ANCHORS) this.buildGameplayDepthAnchors()
    this.spawner    = new WaveSpawner()
    this.scoring    = new ScoreSystem()
    this.explosions = new ExplosionSystem(this.scene)

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

  update(dt: number, input: InputManager): void {
    this.scoring.update(dt)
    this.explosions.update(dt)
    this.cameraHitTimer = Math.max(0, this.cameraHitTimer - dt)
    this.cameraBombTimer = Math.max(0, this.cameraBombTimer - dt)
    this.cameraBossEventTimer = Math.max(0, this.cameraBossEventTimer - dt)

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
    this.updatePlayerHeroLights()

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
        this.handleLaser(req.x, req.y, req.damage, req.width ?? 5)
        this.renderLaserBeam(req.x, this.player.position.y, req.width ?? 5)
        firedLaser = true
      } else {
        this.playerBullets.push(new Bullet(this.scene, req.x, req.y, req.z, req.vx, req.vy, true, req.damage))
        firedThisFrame = true
      }
    }
    // 射击音效节流（避免每帧都响）
    if (firedLaser && now - this.lastLaserSfxTime > 0.15) {
      audioManager.playSFX('laser_start')
      this.lastLaserSfxTime = now
    }
    if (firedThisFrame && now - this.lastShotSfxTime > 0.08) {
      const w = this.player.weapon.current
      audioManager.playSFX(w === 'spread' ? 'spread_fire' : 'shot_fire')
      this.lastShotSfxTime = now
    }

    // 托马斯回旋炸弹
    if (this.player.spinBombReady) {
      this.cameraBombTimer = CAMERA_BOMB_PULSE_TIME
      audioManager.playSFX('spin_land')
      this.clearAllEnemyBullets()
      this.explosions.spawnBoss(this.player.position.x, this.player.position.y)
      // 对所有敌人造成大伤害
      for (const e of this.enemies) {
        if (e.active) {
          if (e.takeDamage(50)) {
            this.scoring.onEnemyKilled(e.scoreValue)
            this.explosions.spawnMedium(e.position.x, e.position.y)
          }
        }
      }
      if (this.boss?.active) {
        const bossKilled = this.boss.takeDamage(200)
        this.explosions.spawnMedium(this.boss.position.x, this.boss.position.y)
        if (bossKilled) this.onBossDefeated()
      }
    }

    if (this.player.isSpinning()) {
      // 回旋期间不发射子弹，但仍更新其他系统
    } else {
      if (input.isJustPressed('bomb')) {
        this.cameraBombTimer = Math.max(this.cameraBombTimer, CAMERA_BOMB_PULSE_TIME * 0.75)
        this.clearAllEnemyBullets()
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
    const dist = this.scrollMap?.totalDistance ?? this.c1SafeField?.totalDistance ?? this.fallbackDistance

    this.updateBossLogic(dt, dist)

    if (!this.boss && this.warningTimer <= 0) {
      this.spawner.update(dt, dist, this.scene, this.enemies)
    }

    const px = this.player.position.x, py = this.player.position.y
    for (const e of this.enemies) {
      if (!e.active) continue
      e.updateEnemy(dt, px, py)
      for (const req of e.bulletRequests)
        this.enemyBullets.push(new Bullet(this.scene, req.x, req.y, req.z, req.vx, req.vy, false))
    }

    if (this.boss?.active) {
      this.boss.updateBoss(dt, px, py)
      for (const req of this.boss.bulletRequests)
        this.enemyBullets.push(new Bullet(this.scene, req.x, req.y, req.z, req.vx, req.vy, false))

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
      this.tryDropPowerUp(e.position.x, e.position.y)
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
      this.explosions.spawnSpark(this.boss!.position.x + randomRange(-20, 20), this.boss!.position.y + randomRange(-20, 20))
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
      this.applyPowerUp(p)
      this.scoring.onPowerUp(p.scoreValue)
      audioManager.playSFX(p.type === 'extra_life' ? 'extra_life' : 'powerup_collect')
    }
    if (result.grazeCount > 0 && now - this.lastGrazeSfxTime > 0.1) {
      for (let i = 0; i < result.grazeCount; i++) this.scoring.onGraze()
      audioManager.playSFX('graze')
      this.lastGrazeSfxTime = now
    }
    if (result.playerHit) {
      this.cameraHitTimer = CAMERA_HIT_PULSE_TIME
      this.explosions.spawnMedium(this.player.position.x, this.player.position.y)
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

    const makeBox = (
      name: string,
      color: number,
      x: number,
      y: number,
      w: number,
      h: number,
      opacity = 0.92,
    ): THREE.Mesh => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false,
      })
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 2), mat)
      mesh.name = name
      mesh.position.set(x, y, DEPTH_LAYERS.UI)
      mesh.scale.set(w, h, 1)
      root.add(mesh)
      return mesh
    }

    const bottomY = -SCENE.HEIGHT * 0.5 + 15
    const leftX = -SCENE.WIDTH * 0.5 + 14
    for (let i = 0; i < 5; i++) {
      this.lifePips.push(makeBox(`life_pip_${i}`, 0x4de2ff, leftX + i * 7.5, bottomY, 5.4, 5.4))
    }

    this.bossHpFrame = makeBox('boss_hp_frame', 0x2a1320, 0, SCENE.HEIGHT * 0.5 - 14, 132, 5.8, 0.74)
    this.bossHpBar = makeBox('boss_hp_bar', 0xff315d, 0, SCENE.HEIGHT * 0.5 - 14, 128, 3.2)
    this.bossHpFrame.visible = false
    this.bossHpBar.visible = false

    this.spinBar = makeBox('spin_cooldown_bar', 0xffb347, SCENE.WIDTH * 0.5 - 45, bottomY + 5.5, 34, 3.2)
    this.heatBar = makeBox('laser_heat_bar', 0x48d6ff, SCENE.WIDTH * 0.5 - 45, bottomY - 1.5, 34, 3.2)

    this.scene.add(root)
  }

  private setHudBar(mesh: THREE.Mesh | null, leftX: number, width: number, ratio: number): void {
    if (!mesh) return
    const r = THREE.MathUtils.clamp(ratio, 0.001, 1)
    mesh.scale.x = width * r
    mesh.position.x = leftX + (width * r) * 0.5
  }

  private updateSceneHud(): void {
    if (!this.sceneHudRoot) return

    for (let i = 0; i < this.lifePips.length; i++) {
      const pip = this.lifePips[i]
      pip.visible = this.debugInvincible || i < this.player.lives
      const mat = pip.material as THREE.MeshBasicMaterial
      mat.color.setHex(this.debugInvincible ? 0xffd166 : 0x4de2ff)
      mat.opacity = this.player.invincibleTimer > 0 && Number.isFinite(this.player.invincibleTimer)
        ? 0.62 + Math.sin(performance.now() / 70) * 0.22
        : 0.92
    }

    const bossVisible = !!this.boss?.active
    if (this.bossHpFrame) this.bossHpFrame.visible = bossVisible
    if (this.bossHpBar) {
      this.bossHpBar.visible = bossVisible
      if (bossVisible && this.boss) {
        const ratio = this.boss.maxHp > 0 ? this.boss.hp / this.boss.maxHp : 0
        this.setHudBar(this.bossHpBar, -64, 128, ratio)
        ;(this.bossHpBar.material as THREE.MeshBasicMaterial).color.setHex(ratio < 0.35 ? 0xffb347 : 0xff315d)
      }
    }

    const spinReady = 1 - THREE.MathUtils.clamp(this.player.spinCooldown / 8, 0, 1)
    this.setHudBar(this.spinBar, SCENE.WIDTH * 0.5 - 62, 34, spinReady)
    if (this.spinBar) {
      const mat = this.spinBar.material as THREE.MeshBasicMaterial
      mat.color.setHex(spinReady >= 0.99 ? 0x7bff74 : 0xffb347)
      mat.opacity = 0.55 + spinReady * 0.4
    }

    const heat = THREE.MathUtils.clamp(this.player.weapon.heat, 0, 1)
    this.setHudBar(this.heatBar, SCENE.WIDTH * 0.5 - 62, 34, Math.max(0.001, heat))
    if (this.heatBar) {
      this.heatBar.visible = this.player.weapon.current === 'laser' || heat > 0.02
      const mat = this.heatBar.material as THREE.MeshBasicMaterial
      mat.color.setHex(this.player.weapon.overheated ? 0xff3f3f : 0x48d6ff)
      mat.opacity = 0.48 + heat * 0.48
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

  private renderLaserBeam(x: number, playerY: number, width: number): void {
    const beamH = SCENE.HEIGHT
    const geo = C1_FUSION_SAFE_VISUALS
      ? new THREE.BoxGeometry(width, beamH, 4)
      : new THREE.PlaneGeometry(width, beamH)
    const beam = new THREE.Mesh(geo, this.laserMat)
    beam.position.set(x, playerY + beamH / 2, DEPTH_LAYERS.BULLET)
    this.scene.add(beam)
    this.laserBeams.push(beam)
  }

  private clearLaserBeams(): void {
    for (const beam of this.laserBeams) {
      this.scene.remove(beam)
      beam.geometry.dispose()
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
      this.bossScreenDarken = this.boss?.active
        ? Math.max(this.bossScreenDarken, this.boss.getScreenDarken() * 0.18)
        : Math.max(0, this.bossScreenDarken - dt * 1.3)
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

  private handleLaser(x: number, _y: number, damage: number, width: number): void {
    const halfW = width / 2
    const targets: { takeDamage(n: number): boolean; position: THREE.Vector3; hitboxRadius: number }[] = [
      ...this.enemies.filter(e => e.active),
    ]
    if (this.boss?.active) targets.push(this.boss)
    for (const t of targets) {
      if (Math.abs(t.position.x - x) < halfW + t.hitboxRadius && t.position.y > this.player.position.y) {
        t.takeDamage(damage)
      }
    }
  }

  private updateBossLogic(dt: number, dist: number): void {
    // 用 nextBossAt 判断，避免 dist 绝对值受 boss 战时长影响
    if (!this.boss && dist >= this.nextBossAt) {
      if (this.warningTimer <= 0) {
        // 进入 WARNING 阶段
        this.warningTimer = WARNING_TIME
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
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
    this.scoring.onBossKilled(this.boss.scoreValue, this.boss.fightDuration)
    this.explosions.spawnBoss(this.boss.position.x, this.boss.position.y)
    audioManager.playSFX('boss_destroy')
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
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
    this.scrollMap?.transitionToBiome(this.bossesDefeated, 2.8)
    this.c1SafeField?.transitionToBiome(this.bossesDefeated, 2.8)
    audioManager.playBGM('gameplay')
  }

  private spawnBoss(index: number): void {
    const ctors = [FortressGuardian, SandScorpion, OceanOverlord, FlameDragon, RuinTitan, OrbitalEye, NebulaPhantom, PlanetBreaker, VoidHerald, FinalArchon]
    this.boss = new (ctors[index % ctors.length])(this.scene)
    this.cameraBossEventTimer = CAMERA_BOSS_EVENT_PULSE_TIME
    this.prevBossPhase = 0
    this.bossScreenDarken = 0
    this.bossDangerMat.opacity = 0
    this.bossDangerMesh.visible = false
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    audioManager.playBGM('boss')
    this.events.onBossState(true)
    for (const e of this.enemies) e.destroy()
  }

  private clearAllEnemyBullets(): void {
    for (const b of this.enemyBullets) if (b.active) { b.destroy(); this.scoring.score += 10 }
  }

  private tryDropPowerUp(x: number, y: number): void {
    if (chance(0.10)) this.powerUps.push(new PowerUp(this.scene, randomPick(DROP_TYPES), x, y))
  }

  private applyPowerUp(p: PowerUp): void {
    switch (p.type) {
      case 'weapon_upgrade': this.player.weapon.upgrade(); break
      case 'weapon_shot':    this.player.weapon.setWeapon('shot'); break
      case 'weapon_spread':  this.player.weapon.setWeapon('spread'); break
      case 'weapon_laser':   this.player.weapon.setWeapon('laser'); break
      case 'extra_life':     this.player.lives++; break
      case 'bomb':           this.clearAllEnemyBullets(); break
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
    if (this.sceneHudRoot) {
      this.scene.remove(this.sceneHudRoot)
      this.sceneHudRoot.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return
        obj.geometry.dispose()
        const material = obj.material
        if (Array.isArray(material)) {
          for (const mat of material) disposeMaterial(mat)
        } else {
          disposeMaterial(material)
        }
      })
      this.sceneHudRoot = null
      this.lifePips = []
      this.bossHpFrame = null
      this.bossHpBar = null
      this.heatBar = null
      this.spinBar = null
    }
    this.explosions.dispose()
    this.bossDangerMesh.geometry.dispose()
    this.bossDangerMat.dispose()
    this.laserMat.dispose()
    audioManager.stopBGM()
    audioManager.stopWarningAlarm()
  }
}
