import * as THREE from 'three'
import { C1Renderer } from '@/rendering/C1Renderer'
import { GameLoop } from './GameLoop'
import { GameState, type GameStateType } from './GameState'
import { InputManager } from './systems/InputManager'
import { TitleScene } from './scenes/TitleScene'
import { GameplayScene } from './scenes/GameplayScene'
import { CameraDirector, type CameraDirectorContext } from './CameraDirector'
import { C1_DISPLAY, SCENE } from './GameConfig'
import { audioManager } from './audio/AudioManager'
import type { C1ControlCommand, C1Diagnostics, DeviceParams, PipeStatus, WeaponType } from '@shared/types'

export interface GameHUDState {
  score: number
  lives: number
  gameState: string
  weapon: WeaponType
  weaponLevel: number
  combo: number
  multiplier: number
  bossName: string
  bossHp: number
  bossMaxHp: number
  bossState: string
  bossTelegraph: number
  bossWeakPoint: number
  bossDarken: number
  warning: boolean
  showFps: boolean
  fps: number
  laserHeat: number
  overheated: boolean
  bossPhase: number
  spinCooldown: number
  c1Mode: boolean
  depthBoost: number
  pipeStatus: PipeStatus
}

export class Game {
  private readonly c1Renderer: C1Renderer
  private readonly camera: THREE.PerspectiveCamera
  private readonly cameraDirector: CameraDirector
  private readonly loop: GameLoop
  private readonly state: GameState
  private readonly input: InputManager

  private titleScene: TitleScene | null = null
  private gameplayScene: GameplayScene | null = null
  private hudCallback: ((s: GameHUDState) => void) | null = null
  private frameCount = 0
  private fpsTimer = 0
  private currentFps = 0
  private pausedFromState: GameStateType = 'playing'
  private pipeStatusValue: PipeStatus = 'disconnected'
  private audioMuted = false
  private debugInvincible = false
  private resizeListener: (() => void) | null = null

  constructor(container: HTMLElement) {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'display:block'
    container.appendChild(canvas)

    this.c1Renderer = new C1Renderer(canvas)
    this.cameraDirector = new CameraDirector()

    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(C1_DISPLAY.SUB_HEIGHT / (2 * C1_DISPLAY.FOCAL_LENGTH)))
    this.camera = new THREE.PerspectiveCamera(
      fov,
      C1_DISPLAY.SUB_WIDTH / C1_DISPLAY.SUB_HEIGHT,
      1,
      5000,
    )
    this.camera.filmGauge = C1_DISPLAY.SUB_HEIGHT
    this.camera.setFocalLength(C1_DISPLAY.FOCAL_LENGTH)
    this.configureCameraForScene('title')

    this.state = new GameState()
    this.input = new InputManager()
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      () => this.render(),
    )

    this.resizeListener = () => this.c1Renderer.fitCanvasToContainer()
    window.addEventListener('resize', this.resizeListener)

    this.enterTitle()
  }

  onHUDUpdate(cb: (s: GameHUDState) => void): void {
    this.hudCallback = cb
  }

  start(): void {
    this.loop.start()
  }

  stop(): void {
    this.loop.stop()
  }

  updateGratingParams(params: DeviceParams): void {
    this.c1Renderer.updateGratingParams(params)
    this.c1Renderer.c1Mode = true
    this.emitHUD()
  }

  setC1Mode(enabled: boolean): void {
    this.c1Renderer.c1Mode = enabled
    this.emitHUD()
  }

  setPipeStatus(status: PipeStatus): void {
    this.pipeStatusValue = status
    this.emitHUD()
  }

  applyC1Control(command: C1ControlCommand): void {
    if (command.type === 'set-parallax') {
      this.c1Renderer.setParallaxBoost(command.value)
      this.emitHUD()
    } else if (command.type === 'set-muted') {
      this.audioMuted = command.value
      audioManager.setMuted(command.value)
    } else if (command.type === 'set-invincible') {
      this.debugInvincible = command.value
      this.gameplayScene?.setDebugInvincible(command.value)
    } else if (command.type === 'set-safe-field') {
      this.gameplayScene?.setSafeFieldEnabled(command.value)
    } else if (command.type === 'set-camera-rig') {
      this.cameraDirector.setPartial(command.value)
      this.emitHUD()
    } else if (command.type === 'set-camera-preset') {
      this.cameraDirector.setPreset(command.value)
      this.emitHUD()
    } else if (command.type === 'reset-camera-rig') {
      this.cameraDirector.reset()
      this.emitHUD()
    } else if (command.type === 'set-camera-auto') {
      this.cameraDirector.setAutoEnabled(command.value)
      this.emitHUD()
    }
  }

  getC1Diagnostics(): C1Diagnostics {
    const rig = this.cameraDirector.settings
    return {
      ...this.c1Renderer.getDiagnostics(),
      projection: 'three-converged',
      viewOrder: 'reversed',
      camera: `focalLength=${C1_DISPLAY.FOCAL_LENGTH} fov=${this.camera.fov.toFixed(2)}deg pos=(${this.camera.position.x.toFixed(0)},${this.camera.position.y.toFixed(0)},${this.camera.position.z.toFixed(0)}) pitch=${rig.pitchDeg.toFixed(1)} yaw=${rig.yawDeg.toFixed(1)}`,
      gameplayVisuals: 'C1 fusion-safe proxies + safe field',
      audioMuted: this.audioMuted,
      debugInvincible: this.debugInvincible,
      safeFieldEnabled: this.gameplayScene?.isSafeFieldEnabled() ?? true,
      domOverlayHidden: this.c1Renderer.c1Mode,
      cameraRig: rig,
      cameraPreset: this.cameraDirector.activePreset,
      cameraAuto: this.cameraDirector.isAutoEnabled,
    }
  }

  private enterTitle(): void {
    this.gameplayScene?.dispose()
    this.gameplayScene = null
    this.titleScene = new TitleScene()
    this.state.transition('title')
    this.emitHUD()
  }

  private enterGameplay(): void {
    this.titleScene?.dispose()
    this.titleScene = null
    this.gameplayScene = new GameplayScene({
      onHUDChange: () => this.emitHUD(),
      onGameOver: () => this.handleGameOver(),
      onBossState: (active) => this.state.transition(active ? 'boss' : 'playing'),
    })
    this.gameplayScene.setDebugInvincible(this.debugInvincible)
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
        this.pausedFromState = st
        this.state.transition('paused')
        this.emitHUD()
      } else {
        this.gameplayScene.update(dt, this.input)
      }
    } else if (st === 'paused') {
      if (this.input.isJustPressed('pause')) {
        this.state.transition(this.pausedFromState === 'boss' ? 'boss' : 'playing')
        this.emitHUD()
      }
    }

    this.cameraDirector.update(dt, this.getCameraDirectorContext())
    this.input.flush()
  }

  private getCameraDirectorContext(): CameraDirectorContext {
    const gp = this.gameplayScene
    const st = this.state.get()
    return {
      gameState: st,
      playerXNorm: gp?.getPlayerXNorm() ?? 0,
      playerYNorm: gp?.getPlayerYNorm() ?? 0,
      playerFiring: gp?.isPlayerFiring() ?? false,
      playerFocusing: gp?.isPlayerFocusing() ?? false,
      playerSpinning: gp?.isPlayerSpinning() ?? false,
      hitPulse: gp?.getCameraHitPulse() ?? 0,
      bombPulse: gp?.getCameraBombPulse() ?? 0,
      bossEventPulse: gp?.getCameraBossEventPulse() ?? 0,
      warning: gp?.isWarning() ?? false,
      bossActive: st === 'boss',
      bossTelegraph: gp?.getBossTelegraph() ?? 0,
      bossPhase: gp?.getBossPhase() ?? 0,
    }
  }

  private render(): void {
    const st = this.state.get()
    const scene = (st === 'playing' || st === 'gameover' || st === 'boss' || st === 'paused')
      ? this.gameplayScene?.scene
      : this.titleScene?.scene

    if (scene) {
      this.configureCameraForScene(st)
      this.c1Renderer.renderFrame(scene, this.camera)
    }
  }

  private configureCameraForScene(state: string): void {
    this.camera.up.set(0, 1, 0)
    this.camera.filmOffset = 0
    if (state === 'playing' || state === 'gameover' || state === 'boss' || state === 'paused') {
      this.cameraDirector.applyGameplayCamera(this.camera)
    } else {
      this.camera.position.set(0, 0, SCENE.CAMERA_Z)
      this.camera.lookAt(0, 0, 0)
      this.camera.updateProjectionMatrix()
      this.camera.updateMatrixWorld()
    }
  }

  private emitHUD(partial: Partial<GameHUDState> = {}): void {
    if (!this.hudCallback) return
    const gp = this.gameplayScene
    this.hudCallback({
      score: gp?.getScore() ?? 0,
      lives: gp?.getPlayerLives() ?? 5,
      gameState: this.state.get(),
      weapon: gp?.getWeapon() ?? 'shot',
      weaponLevel: gp?.getWeaponLevel() ?? 1,
      combo: gp?.getCombo() ?? 0,
      multiplier: gp?.getMultiplier() ?? 1,
      bossName: gp?.getBossName() ?? '',
      bossHp: gp?.getBossHp() ?? 0,
      bossMaxHp: gp?.getBossMaxHp() ?? 1,
      bossState: gp?.getBossState() ?? 'idle',
      bossTelegraph: gp?.getBossTelegraph() ?? 0,
      bossWeakPoint: gp?.getBossWeakPointExposure() ?? 0,
      bossDarken: gp?.getBossDarken() ?? 0,
      warning: gp?.isWarning() ?? false,
      showFps: true,
      fps: this.currentFps,
      laserHeat: gp?.getLaserHeat() ?? 0,
      overheated: gp?.isOverheated() ?? false,
      bossPhase: gp?.getBossPhase() ?? 0,
      spinCooldown: gp?.getSpinCooldown() ?? 0,
      c1Mode: this.c1Renderer.c1Mode,
      depthBoost: Math.round(this.c1Renderer.parallaxBoost * 100) / 100,
      pipeStatus: this.pipeStatusValue,
      ...partial,
    })
  }

  dispose(): void {
    this.loop.stop()
    this.input.dispose()
    this.gameplayScene?.dispose()
    this.c1Renderer.dispose()
    audioManager.dispose()
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener)
      this.resizeListener = null
    }
  }
}
