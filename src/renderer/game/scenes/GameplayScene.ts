import * as THREE from 'three'
import { Player } from '@/game/entities/Player'
import { Enemy } from '@/game/entities/Enemy'
import { Bullet } from '@/game/entities/Bullet'
import { Boss } from '@/game/entities/Boss'
import { FortressGuardian, SandScorpion, OceanOverlord, FlameDragon, RuinTitan, OrbitalEye, NebulaPhantom, PlanetBreaker, VoidHerald, FinalArchon } from '@/game/entities/BossTypes'
import { PowerUp, type PowerUpType } from '@/game/entities/PowerUp'
import { CollisionSystem } from '@/game/systems/CollisionSystem'
import { ScrollMap } from '@/game/systems/ScrollMap'
import { WaveSpawner } from '@/game/systems/WaveSpawner'
import { ScoreSystem } from '@/game/systems/ScoreSystem'
import { ExplosionSystem } from '@/game/systems/ExplosionSystem'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { randomRange, randomPick, chance } from '@/utils/math'
import type { InputManager } from '@/game/systems/InputManager'
import type { WeaponType } from '@shared/types'
import { audioManager } from '@/game/audio/AudioManager'

const BOSS_INTERVAL = 5000
const WARNING_TIME  = 3.0
const DROP_TYPES: PowerUpType[] = ['weapon_upgrade','gem_small','gem_large','extra_life','bomb']

export interface GameplayEvents {
  onHUDChange: () => void
  onGameOver:  () => void
  onBossState: (active: boolean) => void
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
  private scrollMap:     ScrollMap
  private spawner:       WaveSpawner
  private scoring:       ScoreSystem
  private explosions:    ExplosionSystem
  private events:        GameplayEvents

  private bossesDefeated = 0
  private warningTimer   = 0
  private nextBossAt     = BOSS_INTERVAL  // 下一个Boss触发距离（相对，不受dist累计影响）

  // 音效节流状态
  private lastShotSfxTime  = 0
  private lastLaserSfxTime = 0
  private lastGrazeSfxTime = 0
  private lastBossHitTime  = 0
  private prevSpinning     = false
  private prevBossPhase    = -1
  private warningAlarmOn   = false

  // Laser beam visual
  private laserBeams: THREE.Mesh[] = []
  private laserMat = new THREE.MeshPhongMaterial({
    color: 0x00ffff, emissive: 0x00ccff, emissiveIntensity: 3,
    transparent: true, opacity: 0.85,
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

    this.player     = new Player(this.scene)
    this.collision  = new CollisionSystem()
    this.scrollMap  = new ScrollMap(this.scene)
    this.spawner    = new WaveSpawner()
    this.scoring    = new ScoreSystem()
    this.explosions = new ExplosionSystem(this.scene)

    audioManager.playBGM('gameplay')
  }

  update(dt: number, input: InputManager): void {
    this.scoring.update(dt)
    this.explosions.update(dt)

    const now = performance.now() / 1000

    // Player
    const wasSpinning = this.prevSpinning
    this.player.updatePlayer(dt, input)
    const isSpinning = this.player.isSpinning()

    // 回旋开始/落地音效
    if (!wasSpinning && isSpinning) audioManager.playSFX('spin_start')
    this.prevSpinning = isSpinning

    // Clear old laser beams
    for (const b of this.laserBeams) this.scene.remove(b)
    this.laserBeams = []

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
      if (input.isJustPressed('bomb')) this.clearAllEnemyBullets()
    }

    this.scrollMap.update(dt)
    const dist = this.scrollMap.totalDistance

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
    }

    for (const b of this.playerBullets) if (b.active) b.update(dt)
    for (const b of this.enemyBullets)  if (b.active) b.update(dt)
    for (const p of this.powerUps)      if (p.active) p.update(dt)

    const result = this.collision.check(
      this.player, this.enemies.filter(e => e.active),
      this.playerBullets.filter(b => b.active),
      this.enemyBullets.filter(b => b.active),
      this.powerUps.filter(p => p.active),
      this.boss?.active ? this.boss : null,
    )

    for (const e of result.killedEnemies) {
      this.scoring.onEnemyKilled(e.scoreValue)
      this.explosions.spawnSmall(e.position.x, e.position.y)
      this.tryDropPowerUp(e.position.x, e.position.y)
      audioManager.playSFX('enemy_destroy')
    }
    if (result.bossHit && now - this.lastBossHitTime > 0.05) {
      this.explosions.spawnSpark(this.boss!.position.x + randomRange(-20, 20), this.boss!.position.y + randomRange(-20, 20))
      audioManager.playSFX('enemy_hit')
      this.lastBossHitTime = now
      // Boss 阶段变化检测
      const bp = this.boss?.currentPhase ?? 0
      if (bp !== this.prevBossPhase && this.prevBossPhase >= 0) {
        audioManager.playSFX('boss_phase_change')
      }
      this.prevBossPhase = bp
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
      audioManager.playSFX('graze')
      this.lastGrazeSfxTime = now
    }
    if (result.playerHit) {
      this.explosions.spawnMedium(this.player.position.x, this.player.position.y)
      if (!this.player.isAlive()) {
        audioManager.playSFX('player_death')
        audioManager.stopBGM()
        this.events.onGameOver()
        return
      }
      audioManager.playSFX('player_hit')
    }

    this.events.onHUDChange()
    this.cleanup()
  }

  private renderLaserBeam(x: number, playerY: number, width: number): void {
    const beamH = SCENE.HEIGHT
    const geo = new THREE.PlaneGeometry(width, beamH)
    const beam = new THREE.Mesh(geo, this.laserMat)
    beam.position.set(x, playerY + beamH / 2, DEPTH_LAYERS.BULLET)
    this.scene.add(beam)
    this.laserBeams.push(beam)
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
    this.scoring.onBossKilled(this.boss.scoreValue, this.boss.fightDuration)
    this.explosions.spawnBoss(this.boss.position.x, this.boss.position.y)
    audioManager.playSFX('boss_destroy')
    audioManager.stopWarningAlarm()
    this.warningAlarmOn = false
    this.bossesDefeated++
    if (this.boss.mesh) { this.scene.remove(this.boss.mesh); this.boss.mesh = null }
    this.boss = null           // ← 必须置 null，spawner 才能恢复
    this.prevBossPhase = -1
    this.events.onBossState(false)
    this.scrollMap.setBiome(this.bossesDefeated)
    audioManager.playBGM('gameplay')
  }

  private spawnBoss(index: number): void {
    const ctors = [FortressGuardian, SandScorpion, OceanOverlord, FlameDragon, RuinTitan, OrbitalEye, NebulaPhantom, PlanetBreaker, VoidHerald, FinalArchon]
    this.boss = new (ctors[index % ctors.length])(this.scene)
    this.prevBossPhase = 0
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
    if (chance(0.18)) this.powerUps.push(new PowerUp(this.scene, randomPick(DROP_TYPES), x, y))
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
    const rm = (e: { active: boolean; mesh: THREE.Object3D | null }) => {
      if (!e.active && e.mesh) { this.scene.remove(e.mesh); e.mesh = null }
    }
    this.enemies.forEach(rm); this.playerBullets.forEach(rm)
    this.enemyBullets.forEach(rm); this.powerUps.forEach(rm)
    // boss 已由 onBossDefeated() 统一清理，此处仅做安全兜底（不重复调用）
    this.enemies       = this.enemies.filter(e => e.active)
    this.playerBullets = this.playerBullets.filter(b => b.active)
    this.enemyBullets  = this.enemyBullets.filter(b => b.active)
    this.powerUps      = this.powerUps.filter(p => p.active)
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
  isWarning():      boolean  { return this.warningTimer > 0 }
  getLaserHeat():   number   { return this.player.weapon.heat }
  isOverheated():   boolean  { return this.player.weapon.overheated }
  getBossPhase():   number   { return this.boss?.currentPhase ?? 0 }
  getSpinCooldown(): number  { return this.player.spinCooldown }

  dispose(): void {
    this.scrollMap.dispose()
    this.explosions.dispose()
    audioManager.stopBGM()
    audioManager.stopWarningAlarm()
  }
}
