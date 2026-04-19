/**
 * Game — 主类，连接所有子系统
 */

import * as THREE from 'three'
import { C1Renderer } from '@/rendering/C1Renderer'
import { GameLoop } from './GameLoop'
import { GameState, type GameStateType } from './GameState'
import { InputManager } from './systems/InputManager'
import { TitleScene } from './scenes/TitleScene'
import { GameplayScene } from './scenes/GameplayScene'
import { SCENE, C1_DISPLAY } from './GameConfig'
import { audioManager } from './audio/AudioManager'
import type { DeviceParams, WeaponType } from '@shared/types'

export interface GameHUDState {
  score:       number
  lives:       number
  gameState:   string
  weapon:      WeaponType
  weaponLevel: number
  combo:       number
  multiplier:  number
  bossName:    string
  bossHp:      number
  bossMaxHp:   number
  warning:     boolean
  showFps:     boolean
  fps:         number
  laserHeat:   number
  overheated:  boolean
  bossPhase:   number
  spinCooldown:number
}

export class Game {
  private c1Renderer:    C1Renderer
  private camera:        THREE.PerspectiveCamera
  private loop:          GameLoop
  private state:         GameState
  private input:         InputManager

  private titleScene:    TitleScene | null    = null
  private gameplayScene: GameplayScene | null = null

  private hudCallback: ((s: GameHUDState) => void) | null = null
  private frameCount = 0
  private fpsTimer   = 0
  private currentFps = 0

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'width:100%;height:100%;display:block'
    container.appendChild(canvas)

    this.c1Renderer = new C1Renderer(canvas)

    const aspect = C1_DISPLAY.SUB_WIDTH / C1_DISPLAY.SUB_HEIGHT
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 2000)
    this.camera.position.set(0, 0, SCENE.CAMERA_Z)
    this.camera.lookAt(0, 0, 0)

    this.state = new GameState()
    this.input = new InputManager()

    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (_alpha) => this.render(),
    )

    this.enterTitle()
  }

  onHUDUpdate(cb: (s: GameHUDState) => void): void { this.hudCallback = cb }
  start(): void { this.loop.start() }
  stop(): void  { this.loop.stop() }

  updateGratingParams(params: DeviceParams): void {
    this.c1Renderer.updateGratingParams(params)
  }

  private enterTitle(): void {
    this.gameplayScene?.dispose()
    this.gameplayScene = null
    this.titleScene    = new TitleScene()
    this.state.transition('title')
    this.emitHUD()
  }

  private enterGameplay(): void {
    this.titleScene = null
    this.gameplayScene = new GameplayScene({
      onHUDChange: () => this.emitHUD(),
      onGameOver:  () => this.handleGameOver(),
      onBossState: (active) => this.state.transition(active ? 'boss' : 'playing'),
    })
    this.state.transition('playing')
    this.emitHUD()
  }

  private handleGameOver(): void {
    this.state.transition('gameover')
    this.emitHUD()
    audioManager.playSFX('game_over')
    setTimeout(() => this.enterTitle(), 4500)
  }

  private update(dt: number): void {
    // FPS counter
    this.fpsTimer += dt
    this.frameCount++
    if (this.fpsTimer >= 1) {
      this.currentFps = this.frameCount
      this.frameCount = 0
      this.fpsTimer -= 1
    }

    const st = this.state.get()
    if (st === 'title' && this.titleScene) {
      if (this.titleScene.update(dt, this.input)) this.enterGameplay()
    } else if ((st === 'playing' || st === 'boss') && this.gameplayScene) {
      if (this.input.isJustPressed('pause')) {
        this.state.transition('paused')
        this.emitHUD()
      } else {
        this.gameplayScene.update(dt, this.input)
      }
    } else if (st === 'paused') {
      if (this.input.isJustPressed('pause')) {
        this.state.transition('playing')
        this.emitHUD()
      }
    }

    this.input.flush()
  }

  private render(): void {
    const st = this.state.get()
    const scene = (st === 'playing' || st === 'gameover' || st === 'boss' || st === 'paused')
      ? this.gameplayScene?.scene
      : this.titleScene?.scene

    if (scene) this.c1Renderer.renderFrame(scene, this.camera)
  }

  private emitHUD(partial: Partial<GameHUDState> = {}): void {
    if (!this.hudCallback) return
    const gp = this.gameplayScene
    this.hudCallback({
      score:       gp?.getScore()       ?? 0,
      lives:       gp?.getPlayerLives() ?? 5,
      gameState:   this.state.get(),
      weapon:      gp?.getWeapon()      ?? 'shot',
      weaponLevel: gp?.getWeaponLevel() ?? 1,
      combo:       gp?.getCombo()       ?? 0,
      multiplier:  gp?.getMultiplier()  ?? 1,
      bossName:    gp?.getBossName()    ?? '',
      bossHp:      gp?.getBossHp()      ?? 0,
      bossMaxHp:   gp?.getBossMaxHp()   ?? 1,
      warning:     gp?.isWarning()      ?? false,
      showFps:     true,
      fps:         this.currentFps,
      laserHeat:   gp?.getLaserHeat()  ?? 0,
      overheated:  gp?.isOverheated()  ?? false,
      bossPhase:   gp?.getBossPhase()  ?? 0,
      spinCooldown: gp?.getSpinCooldown() ?? 0,
      ...partial,
    })
  }

  dispose(): void {
    this.loop.stop()
    this.input.dispose()
    this.gameplayScene?.dispose()
    this.c1Renderer.dispose()
    audioManager.dispose()
  }
}
