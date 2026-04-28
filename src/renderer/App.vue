<template>
  <div v-if="isDebugWindow" id="debug-window">
    <header class="debug-header">
      <div>
        <h1>C1 Debug</h1>
        <p>OpenstageAI online parameters and renderer diagnostics</p>
      </div>
      <span class="status-pill" :class="debugPipeStatus">{{ debugPipeStatus.toUpperCase() }}</span>
    </header>

    <section class="debug-section">
      <div class="section-title">Runtime</div>
      <div class="debug-grid">
        <span>Mode</span><strong>{{ debugDiagnostics?.c1Mode ? 'C1 interleaved' : 'waiting for params' }}</strong>
        <span>Output</span><strong>{{ debugDiagnostics?.output ?? '-' }}</strong>
        <span>Atlas</span><strong>{{ debugDiagnostics?.atlas ?? '-' }}</strong>
        <span>Projection</span><strong>{{ debugDiagnostics?.projection ?? '-' }}</strong>
        <span>View order</span><strong>{{ debugDiagnostics?.viewOrder ?? '-' }}</strong>
        <span>Camera</span><strong>{{ debugDiagnostics?.camera ?? '-' }}</strong>
        <span>Gameplay visuals</span><strong>{{ debugDiagnostics?.gameplayVisuals ?? '-' }}</strong>
        <span>Canvas backing</span><strong>{{ debugDiagnostics?.backing ?? '-' }}</strong>
        <span>Canvas client</span><strong>{{ debugDiagnostics?.client ?? '-' }}</strong>
        <span>CSS size</span><strong>{{ debugDiagnostics?.css ?? '-' }}</strong>
        <span>Window</span><strong>{{ debugDiagnostics?.window ?? '-' }}</strong>
        <span>DPR</span><strong>{{ debugDiagnostics?.dpr?.toFixed(2) ?? '-' }}</strong>
        <span>DOM Overlay</span><strong>{{ debugDiagnostics?.domOverlayHidden ? 'hidden on C1 output' : 'visible' }}</strong>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Performance</div>
      <div class="debug-grid">
        <span>FPS</span><strong :class="metricClass(debugDiagnostics?.performance?.fps, 30, 20, true)">{{ formatInt(debugDiagnostics?.performance?.fps) }}</strong>
        <span>Frame</span><strong :class="metricClass(debugDiagnostics?.performance?.frameMs, 33.4, 50)">{{ formatMs(debugDiagnostics?.performance?.frameMs) }}</strong>
        <span>Logic FPS</span><strong :class="metricClass(debugDiagnostics?.performance?.logicFps, 58, 50, true)">{{ formatInt(debugDiagnostics?.performance?.logicFps) }}</strong>
        <span>Views</span><strong>{{ formatInt(debugDiagnostics?.render?.views) }}</strong>
        <span>FPS gate</span><strong>30 target / 20 floor</strong>
        <span>GPU caveat</span><strong>ignore FPS if external GPU &gt;30%</strong>
        <span>Draw calls</span><strong :class="metricClass(debugDiagnostics?.render?.calls, 5000, 9000)">{{ formatInt(debugDiagnostics?.render?.calls) }}</strong>
        <span>Render tris</span><strong :class="metricClass(debugDiagnostics?.render?.triangles, 3000000, 6000000)">{{ formatInt(debugDiagnostics?.render?.triangles) }}</strong>
        <span>Lines</span><strong>{{ formatInt(debugDiagnostics?.render?.lines) }}</strong>
        <span>Points</span><strong>{{ formatInt(debugDiagnostics?.render?.points) }}</strong>
        <span>GPU resources</span><strong>{{ renderResourceLabel }}</strong>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Scene Load</div>
      <div class="debug-grid">
        <span>Objects</span><strong>{{ formatInt(debugDiagnostics?.scene?.objects) }}</strong>
        <span>Meshes</span><strong>{{ formatInt(debugDiagnostics?.scene?.meshes) }}</strong>
        <span>Visible meshes</span><strong :class="metricClass(debugDiagnostics?.scene?.visibleMeshes, 180, 280)">{{ formatInt(debugDiagnostics?.scene?.visibleMeshes) }}</strong>
        <span>Materials</span><strong>{{ formatInt(debugDiagnostics?.scene?.materials) }}</strong>
        <span>Scene tris</span><strong :class="metricClass(debugDiagnostics?.scene?.sourceTriangles, 90000, 150000)">{{ formatInt(debugDiagnostics?.scene?.sourceTriangles) }}</strong>
        <span>Visible tris</span><strong :class="metricClass(debugDiagnostics?.scene?.visibleTriangles, 70000, 120000)">{{ formatInt(debugDiagnostics?.scene?.visibleTriangles) }}</strong>
        <span>Gameplay counts</span><strong>{{ gameplayCountsLabel }}</strong>
        <span>Runtime caps</span><strong>{{ runtimeCapsLabel }}</strong>
        <span>Boss</span><strong>{{ debugDiagnostics?.scene?.bossActive ? 'active' : 'none' }}</strong>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Device</div>
      <div class="debug-grid">
        <span>Source</span><strong>{{ debugDeviceParams ? 'ONLINE DEVICE PARAMS' : 'not received' }}</strong>
        <span>Device ID</span><strong>{{ debugDeviceParams?.deviceId ?? '-' }}</strong>
        <span>Label</span><strong>{{ debugDeviceParams?.label ?? '-' }}</strong>
        <span>Slope</span><strong>{{ formatNumber(debugDeviceParams?.obliquity, 5) }}</strong>
        <span>Interval</span><strong>{{ formatNumber(debugDeviceParams?.lineNumber, 5) }}</strong>
        <span>X0</span><strong>{{ formatNumber(debugDeviceParams?.deviation, 5) }}</strong>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Game Debug</div>
      <div class="toggle-row">
        <button type="button" class="toggle-btn" :class="{ active: debugMuted }" @click="toggleMuted">
          {{ debugMuted ? 'Unmute' : 'Mute' }}
        </button>
        <button type="button" class="toggle-btn danger" :class="{ active: debugInvincible }" @click="toggleInvincible">
          {{ debugInvincible ? 'Invincible ON' : 'Invincible OFF' }}
        </button>
        <button type="button" class="toggle-btn" :class="{ active: debugSafeField }" @click="toggleSafeField">
          {{ debugSafeField ? 'Safe Field ON' : 'Safe Field OFF' }}
        </button>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Stage Director</div>
      <div class="debug-grid">
        <span>Stage</span><strong>{{ stageLabel }}</strong>
        <span>Biome</span><strong>{{ debugDiagnostics?.stage?.biome ?? '-' }}</strong>
        <span>Distance</span><strong>{{ stageDistanceLabel }}</strong>
        <span>Next Boss</span><strong>{{ stageBossLabel }}</strong>
      </div>
      <div class="stage-actions">
        <button type="button" @click="startRun">Start Run</button>
        <button type="button" @click="restartRun">Restart Run</button>
        <button type="button" @click="skipToBoss">Skip to Boss</button>
        <button type="button" @click="advanceStage">Advance Stage</button>
      </div>
    </section>

    <section class="debug-section">
      <div class="section-title">Parallax</div>
      <div class="parallax-row">
        <button type="button" @click="nudgeParallax(-0.05)">-</button>
        <input
          v-model.number="debugParallax"
          type="range"
          min="0"
          max="2"
          step="0.01"
          @input="sendParallax(debugParallax)"
        />
        <button type="button" @click="nudgeParallax(0.05)">+</button>
        <button type="button" class="reset-btn" @click="setParallax(1)">Reset 1.00</button>
      </div>
      <div class="parallax-value">{{ debugParallax.toFixed(2) }}</div>
    </section>

    <section class="debug-section">
      <div class="section-title">Gameplay Camera</div>
      <div class="preset-row">
        <button type="button" :class="{ active: debugCameraAuto }" @click="toggleCameraAuto">
          {{ debugCameraAuto ? 'auto on' : 'auto off' }}
        </button>
        <button
          v-for="preset in cameraPresets"
          :key="preset"
          type="button"
          :class="{ active: debugCameraPreset === preset }"
          @click="setCameraPreset(preset)"
        >
          {{ preset }}
        </button>
        <button type="button" @click="resetCameraRig">Reset</button>
      </div>
      <div class="camera-controls">
        <label>
          <span>Pitch</span>
          <input v-model.number="debugCameraRig.pitchDeg" type="range" min="0" max="28" step="0.1" @input="sendCameraRig({ pitchDeg: debugCameraRig.pitchDeg })" />
          <strong>{{ debugCameraRig.pitchDeg.toFixed(1) }}deg</strong>
        </label>
        <label>
          <span>Yaw</span>
          <input v-model.number="debugCameraRig.yawDeg" type="range" min="-24" max="24" step="0.1" @input="sendCameraRig({ yawDeg: debugCameraRig.yawDeg })" />
          <strong>{{ debugCameraRig.yawDeg.toFixed(1) }}deg</strong>
        </label>
        <label>
          <span>Distance</span>
          <input v-model.number="debugCameraRig.distance" type="range" min="1600" max="1735" step="1" @input="sendCameraRig({ distance: debugCameraRig.distance })" />
          <strong>{{ debugCameraRig.distance.toFixed(0) }}</strong>
        </label>
        <label class="locked-control">
          <span>Target Y</span>
          <div class="locked-track">locked</div>
          <strong>{{ debugCameraRig.targetY.toFixed(0) }}</strong>
        </label>
        <label>
          <span>Target Z</span>
          <input v-model.number="debugCameraRig.targetZ" type="range" min="-60" max="80" step="1" @input="sendCameraRig({ targetZ: debugCameraRig.targetZ })" />
          <strong>{{ debugCameraRig.targetZ.toFixed(0) }}</strong>
        </label>
      </div>
    </section>
  </div>

  <div v-else id="game-root">
    <div ref="canvasContainer" id="canvas-container" />

    <div v-if="showGameOverlay && (hudState.gameState === 'playing' || hudState.gameState === 'boss')" id="hud-overlay">
      <div
        v-if="hudState.gameState === 'boss'"
        id="boss-darken"
        :style="{ opacity: Math.min(0.75, hudState.bossDarken) }"
      />

      <div id="hud-score">
        <span class="hud-label">SCORE</span>
        <span class="hud-val">{{ hudState.score.toLocaleString() }}</span>
      </div>

      <div id="hud-combo" v-if="hudState.combo > 1">
        <span class="combo-num">{{ hudState.combo }}</span>
        <span class="combo-label">COMBO</span>
        <span class="combo-mult">x{{ hudState.multiplier.toFixed(1) }}</span>
      </div>

      <div id="hud-weapon">
        <span class="hud-label">WEAPON</span>
        <span class="hud-val weapon-name">{{ weaponLabel }}</span>
        <span class="weapon-lvl">Lv.{{ hudState.weaponLevel }}</span>
      </div>

      <div v-if="hudState.spinCooldown > 0" id="hud-spin">
        <span class="hud-label">SPIN</span>
        <div class="spin-track">
          <div class="spin-fill" :style="{ width: (100 - hudState.spinCooldown / 8 * 100) + '%' }" />
        </div>
      </div>
      <div v-else id="hud-spin-ready">
        <span class="spin-ready-label">[ X ] SPIN READY</span>
      </div>

      <div v-if="hudState.weapon === 'laser'" id="hud-heat">
        <span class="hud-label">HEAT</span>
        <div class="heat-track">
          <div
            class="heat-fill"
            :class="{ overheat: hudState.overheated }"
            :style="{ width: (hudState.laserHeat * 100) + '%' }"
          />
        </div>
      </div>

      <div id="hud-lives">
        <span v-for="i in hudState.lives" :key="i" class="life-icon" />
      </div>

      <div v-if="hudState.gameState === 'boss'" id="boss-bar">
        <div class="boss-name">{{ hudState.bossName }}</div>
        <div class="boss-phase">PHASE {{ hudState.bossPhase + 1 }}</div>
        <div class="boss-state">STATE {{ hudState.bossState.toUpperCase() }}</div>
        <div class="boss-weak">WEAKPOINT {{ Math.round(hudState.bossWeakPoint * 100) }}%</div>
        <div class="boss-hp-track">
          <div class="boss-hp-fill" :class="'phase-' + hudState.bossPhase" :style="{ width: bossHpPct + '%' }" />
        </div>
      </div>

      <div v-if="hudState.warning" id="warning-flash">WARNING</div>
      <div v-if="hudState.gameState === 'boss' && hudState.bossTelegraph > 0.35" id="danger-guide">
        DANGER ZONE // CHARGE {{ Math.round(hudState.bossTelegraph * 100) }}%
      </div>
      <div v-if="hudState.showFps" id="hud-fps">{{ hudState.fps }} FPS</div>
      <div class="scanlines" />
    </div>

    <div v-if="showGameOverlay && hudState.gameState === 'title'" id="title-overlay">
      <div class="eva-border" />
      <div class="title-heading">
        <div class="title-text">VOID STRIKE</div>
        <div class="title-sub">CUBEVI C1 AIR GAME</div>
      </div>
      <div class="title-press">[ Z ] START</div>
      <div class="title-controls">
        <div class="controls-title">// CONTROLS</div>
        <div class="controls-grid">
          <span>MOVE</span><span>ARROWS / WASD</span>
          <span>FIRE</span><span>Z / SPACE</span>
          <span>BOMB</span><span>X</span>
          <span>WEAPON</span><span>C</span>
          <span>FOCUS</span><span>SHIFT</span>
          <span>PAUSE</span><span>ESC</span>
        </div>
      </div>
      <div class="scanlines" />
    </div>

    <div v-if="showGameOverlay && hudState.gameState === 'gameover'" id="gameover-overlay">
      <div class="go-text">GAME OVER</div>
      <div class="go-score">FINAL SCORE<br />{{ hudState.score.toLocaleString() }}</div>
      <div class="scanlines" />
    </div>

    <div v-if="showGameOverlay && hudState.gameState === 'clear'" id="clear-overlay">
      <div class="clear-text">MISSION CLEAR</div>
      <div class="clear-score">FINAL SCORE<br />{{ hudState.score.toLocaleString() }}</div>
      <div class="clear-hint">[ Z ] NEW RUN</div>
      <div class="scanlines" />
    </div>

    <div v-if="showGameOverlay && hudState.gameState === 'paused'" id="pause-overlay">
      <div class="pause-title">SYSTEM HALT</div>
      <div class="pause-hint">[ ESC ] RESUME</div>
      <div class="scanlines" />
    </div>

    <div v-if="showGameOverlay && pipeStatus !== 'connected'" id="pipe-status" :class="pipeStatus">
      <template v-if="pipeStatus === 'connecting'">CONNECTING OPENSTAGEAI</template>
      <template v-else-if="pipeStatus === 'disconnected'">OPENSTAGEAI REQUIRED</template>
      <template v-else>OPENSTAGEAI LINK ERROR</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import type { C1Diagnostics, CameraRigSettings, DeviceParams, PipeStatus } from '@shared/types'
import type { Game, GameHUDState } from '@/game/Game'
import { audioManager } from '@/game/audio/AudioManager'

const isDebugWindow = new URLSearchParams(window.location.search).get('debug') === '1'
const canvasContainer = ref<HTMLDivElement | null>(null)
const pipeStatus = ref<PipeStatus>('disconnected')
const debugPipeStatus = ref<PipeStatus>('disconnected')
const debugDiagnostics = ref<C1Diagnostics | null>(null)
const debugDeviceParams = ref<DeviceParams | null>(null)
const debugParallax = ref(1)
const debugMuted = ref(false)
const debugInvincible = ref(false)
const debugSafeField = ref(true)
const debugCameraAuto = ref(true)
const debugCameraPreset = ref('director')
const cameraPresets = ['baseline', 'canyon', 'orbital', 'boss']
const debugCameraRig = reactive<CameraRigSettings>({
  pitchDeg: 12.4,
  yawDeg: 0,
  distance: 1677,
  targetX: 0,
  targetY: 0,
  targetZ: 0,
})

const hudState: GameHUDState = reactive({
  score: 0,
  lives: 5,
  gameState: 'title',
  weapon: 'shot',
  weaponLevel: 1,
  combo: 0,
  multiplier: 1.0,
  bossName: '',
  bossHp: 1,
  bossMaxHp: 1,
  bossState: 'idle',
  bossTelegraph: 0,
  bossWeakPoint: 0,
  bossDarken: 0,
  warning: false,
  showFps: false,
  fps: 0,
  laserHeat: 0,
  overheated: false,
  bossPhase: 0,
  spinCooldown: 0,
  c1Mode: false,
  depthBoost: 1.0,
  pipeStatus: 'disconnected',
})

const weaponLabel = computed(() => ({ shot: 'SHOT', spread: 'SPREAD', laser: 'LASER' }[hudState.weapon] || 'SHOT'))
const bossHpPct = computed(() => Math.max(0, (hudState.bossHp / hudState.bossMaxHp) * 100))
const showGameOverlay = computed(() => !hudState.c1Mode)
const stageLabel = computed(() => {
  const stage = debugDiagnostics.value?.stage
  return stage ? `${stage.number}/10 ${stage.name}` : '-'
})
const stageDistanceLabel = computed(() => {
  const stage = debugDiagnostics.value?.stage
  return stage ? `${Math.floor(stage.distance)}m` : '-'
})
const stageBossLabel = computed(() => {
  const stage = debugDiagnostics.value?.stage
  if (!stage) return '-'
  if (stage.cleared) return 'cleared'
  if (stage.bossActive) return 'active'
  if (stage.warning) return 'warning'
  return `${Math.ceil(stage.distanceToBoss)}m`
})
const renderResourceLabel = computed(() => {
  const render = debugDiagnostics.value?.render
  if (!render) return '-'
  return `geo ${formatInt(render.geometries)} / tex ${formatInt(render.textures)} / prog ${formatInt(render.programs)}`
})
const gameplayCountsLabel = computed(() => {
  const scene = debugDiagnostics.value?.scene
  if (!scene) return '-'
  return `E ${formatInt(scene.enemies)} / PB ${formatInt(scene.playerBullets)} / EB ${formatInt(scene.enemyBullets)} / PU ${formatInt(scene.powerUps)} / FX ${formatInt(scene.particles)}`
})
const runtimeCapsLabel = computed(() => {
  const caps = debugDiagnostics.value?.scene?.caps
  if (!caps) return '-'
  return `E ${caps.enemies} / PB ${caps.playerBullets} / EB ${caps.enemyBullets} / PU ${caps.powerUps} / FX ${caps.particles}`
})

let game: Game | null = null
let diagnosticsTimer: number | null = null

function parseToggle(value: string | null): boolean | null {
  if (!value) return null
  const v = value.toLowerCase()
  if (v === '1' || v === 'true' || v === 'on' || v === 'yes') return true
  if (v === '0' || v === 'false' || v === 'off' || v === 'no') return false
  return null
}

function resolveAudioPolicy(search: string): { sfx: boolean; bgm: boolean } {
  const params = new URLSearchParams(search)
  const mode = (params.get('test') ?? '').toLowerCase()

  let sfx = true
  let bgm = true
  if (mode && mode !== 'audio') {
    sfx = false
    bgm = false
  }

  const master = parseToggle(params.get('audio'))
  if (master !== null) {
    sfx = master
    bgm = master
  }

  const sfxParam = parseToggle(params.get('sfx'))
  if (sfxParam !== null) sfx = sfxParam

  const bgmParam = parseToggle(params.get('bgm'))
  if (bgmParam !== null) bgm = bgmParam

  return { sfx, bgm }
}

function formatNumber(value: number | undefined, digits: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '-'
}

function formatInt(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? Math.round(value).toLocaleString() : '-'
}

function formatMs(value: number | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)}ms` : '-'
}

function metricClass(value: number | undefined, warn: number, critical: number, lowerIsWorse = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return ''
  if (lowerIsWorse) {
    if (value <= critical) return 'metric-critical'
    if (value <= warn) return 'metric-warn'
    return 'metric-good'
  }
  if (value >= critical) return 'metric-critical'
  if (value >= warn) return 'metric-warn'
  return 'metric-good'
}

function publishDiagnostics(): void {
  const diagnostics = game?.getC1Diagnostics()
  if (!diagnostics) return
  window.electronAPI?.publishC1Diagnostics(diagnostics)
}

function setParallax(value: number): void {
  debugParallax.value = Math.max(0, Math.min(2, value))
  sendParallax(debugParallax.value)
}

function nudgeParallax(delta: number): void {
  setParallax(debugParallax.value + delta)
}

function sendParallax(value: number): void {
  window.electronAPI?.sendC1Control({ type: 'set-parallax', value })
}

function toggleMuted(): void {
  debugMuted.value = !debugMuted.value
  window.electronAPI?.sendC1Control({ type: 'set-muted', value: debugMuted.value })
}

function toggleInvincible(): void {
  debugInvincible.value = !debugInvincible.value
  window.electronAPI?.sendC1Control({ type: 'set-invincible', value: debugInvincible.value })
}

function toggleSafeField(): void {
  debugSafeField.value = !debugSafeField.value
  window.electronAPI?.sendC1Control({ type: 'set-safe-field', value: debugSafeField.value })
}

function startRun(): void {
  window.electronAPI?.sendC1Control({ type: 'start-run' })
}

function restartRun(): void {
  window.electronAPI?.sendC1Control({ type: 'restart-run' })
}

function skipToBoss(): void {
  window.electronAPI?.sendC1Control({ type: 'skip-to-boss' })
}

function advanceStage(): void {
  window.electronAPI?.sendC1Control({ type: 'advance-stage' })
}

function sendCameraRig(value: Partial<CameraRigSettings>): void {
  debugCameraAuto.value = false
  window.electronAPI?.sendC1Control({ type: 'set-camera-rig', value })
}

function setCameraPreset(value: string): void {
  debugCameraAuto.value = false
  debugCameraPreset.value = value
  window.electronAPI?.sendC1Control({ type: 'set-camera-preset', value })
}

function toggleCameraAuto(): void {
  debugCameraAuto.value = !debugCameraAuto.value
  window.electronAPI?.sendC1Control({ type: 'set-camera-auto', value: debugCameraAuto.value })
}

function resetCameraRig(): void {
  debugCameraAuto.value = true
  debugCameraPreset.value = 'director'
  window.electronAPI?.sendC1Control({ type: 'reset-camera-rig' })
}

function initDebugWindow(): void {
  if (!window.electronAPI) return

  window.electronAPI.onDeviceParamsUpdated((params) => {
    debugDeviceParams.value = params
  })
  window.electronAPI.onPipeStatusChanged((status) => {
    debugPipeStatus.value = status
  })
  window.electronAPI.onC1Diagnostics((diagnostics) => {
    debugDiagnostics.value = diagnostics
    debugParallax.value = diagnostics.parallax
    debugMuted.value = diagnostics.audioMuted ?? false
    debugInvincible.value = diagnostics.debugInvincible ?? false
    debugSafeField.value = diagnostics.safeFieldEnabled ?? true
    debugCameraAuto.value = diagnostics.cameraAuto ?? debugCameraAuto.value
    debugCameraPreset.value = diagnostics.cameraPreset ?? debugCameraPreset.value
    if (diagnostics.cameraRig) Object.assign(debugCameraRig, diagnostics.cameraRig)
    if (diagnostics.grating) debugDeviceParams.value = diagnostics.grating
  })
  window.electronAPI.requestDeviceParams()
  window.electronAPI.sendC1Control({ type: 'request-diagnostics' })
}

async function initGameWindow(): Promise<void> {
  const audioPolicy = resolveAudioPolicy(window.location.search)
  audioManager.setEnabled(audioPolicy.sfx)
  audioManager.setBGMEnabled(audioPolicy.bgm)

  const { Game: G } = await import('@/game/Game')
  if (!canvasContainer.value) return

  game = new G(canvasContainer.value)
  game.onHUDUpdate((state) => {
    Object.assign(hudState, state)
    pipeStatus.value = state.pipeStatus
  })
  game.setC1Mode(false)
  game.start()

  if (window.electronAPI) {
    pipeStatus.value = 'connecting'
    game.setPipeStatus('connecting')

    window.electronAPI.onDeviceParamsUpdated((params) => {
      game?.updateGratingParams(params)
      game?.setPipeStatus('connected')
      publishDiagnostics()
    })
    window.electronAPI.onPipeStatusChanged((status) => {
      pipeStatus.value = status
      game?.setPipeStatus(status)
      if (status !== 'connected') game?.setC1Mode(false)
      publishDiagnostics()
    })
    window.electronAPI.onC1Control((command) => {
      game?.applyC1Control(command)
      publishDiagnostics()
    })
    window.electronAPI.requestDeviceParams()

    diagnosticsTimer = window.setInterval(publishDiagnostics, 250)
  } else {
    pipeStatus.value = 'disconnected'
    game.setPipeStatus('disconnected')
  }
}

onMounted(() => {
  if (isDebugWindow) {
    initDebugWindow()
  } else {
    void initGameWindow()
  }
})

onUnmounted(() => {
  if (diagnosticsTimer !== null) {
    window.clearInterval(diagnosticsTimer)
    diagnosticsTimer = null
  }
  game?.dispose()
  window.electronAPI?.removeAllListeners()
})
</script>

<style>
:root {
  --eva-orange: #ff7a1a;
  --eva-green: #00ff66;
  --eva-purple: #9b59b6;
  --eva-red: #ff285f;
  --eva-cyan: #00d9ff;
  --panel: rgba(0, 0, 0, 0.68);
  --font-main: 'Orbitron', 'Share Tech Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; overflow: hidden; user-select: none; }
button, input { font: inherit; }

#game-root { width: 100vw; height: 100vh; position: relative; background: #000; }
#canvas-container { width: 100%; height: 100%; }

.scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.08) 3px,
    rgba(0, 0, 0, 0.08) 4px
  );
}

#hud-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  font-family: var(--font-main);
  color: var(--eva-green);
}

#boss-darken {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  transition: opacity 0.08s linear;
}

.hud-label {
  font-size: clamp(42px, 4.5vw, 56px);
  color: var(--eva-orange);
  letter-spacing: 6px;
  opacity: 0.85;
}

.hud-val {
  font-size: clamp(64px, 7vw, 96px);
  font-weight: 700;
  text-shadow: 0 0 12px var(--eva-green), 0 0 24px rgba(0, 255, 102, 0.3);
}

#hud-score {
  position: absolute;
  top: 3vh;
  right: 4vw;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

#hud-combo {
  position: absolute;
  top: 12vh;
  right: 4vw;
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.combo-num {
  font-size: clamp(72px, 7.5vw, 104px);
  font-weight: 900;
  color: var(--eva-orange);
  text-shadow: 0 0 15px var(--eva-orange);
}
.combo-label { font-size: clamp(40px, 4.5vw, 56px); color: var(--eva-orange); opacity: 0.7; }
.combo-mult { font-size: clamp(48px, 5.5vw, 72px); color: var(--eva-red); font-weight: 700; }

#hud-weapon {
  position: absolute;
  top: 3vh;
  left: 4vw;
  display: flex;
  flex-direction: column;
}
.weapon-name { color: var(--eva-cyan); }
.weapon-lvl {
  font-size: clamp(44px, 5vw, 64px);
  color: var(--eva-purple);
  text-shadow: 0 0 8px var(--eva-purple);
}

#hud-spin, #hud-heat {
  position: absolute;
  left: 4vw;
  display: flex;
  flex-direction: column;
  width: 20vw;
}
#hud-spin { top: 21vh; }
#hud-heat { top: 14vh; }

.spin-track, .heat-track {
  height: clamp(10px, 1.2vh, 16px);
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid var(--eva-purple);
  overflow: hidden;
  margin-top: 4px;
}
.heat-track { border-color: var(--eva-orange); }
.spin-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--eva-purple), #dd88ff);
  transition: width 0.2s;
}
.heat-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--eva-orange), var(--eva-red));
  transition: width 0.1s;
}
.heat-fill.overheat { animation: overheat-blink 0.2s step-end infinite; }
@keyframes overheat-blink { 50% { opacity: 0.3; } }

#hud-spin-ready {
  position: absolute;
  top: 21vh;
  left: 4vw;
}
.spin-ready-label {
  font-size: clamp(34px, 3.8vw, 48px);
  color: var(--eva-purple);
  text-shadow: 0 0 8px var(--eva-purple);
}

#hud-lives {
  position: absolute;
  bottom: 3vh;
  left: 4vw;
  display: flex;
  gap: 18px;
}
.life-icon {
  width: clamp(42px, 4.6vw, 64px);
  height: clamp(42px, 4.6vw, 64px);
  border: 5px solid var(--eva-green);
  box-shadow: 0 0 12px rgba(0, 255, 102, 0.6);
  transform: rotate(45deg);
}

#boss-bar { position: absolute; top: 2vh; left: 12vw; right: 12vw; }
.boss-name {
  text-align: center;
  font-size: clamp(52px, 6vw, 76px);
  font-weight: 700;
  color: var(--eva-red);
  letter-spacing: 8px;
  text-shadow: 0 0 12px var(--eva-red);
}
.boss-phase, .boss-state, .boss-weak {
  text-align: center;
  letter-spacing: 4px;
}
.boss-phase { font-size: clamp(34px, 3.8vw, 46px); color: var(--eva-orange); }
.boss-state, .boss-weak { font-size: clamp(28px, 3vw, 38px); color: var(--eva-cyan); }
.boss-weak { color: var(--eva-green); margin-bottom: 6px; }
.boss-hp-track {
  width: 100%;
  height: clamp(14px, 1.8vh, 22px);
  background: rgba(255, 40, 95, 0.15);
  border: 2px solid var(--eva-red);
  overflow: hidden;
  margin-top: 4px;
}
.boss-hp-fill { height: 100%; transition: width 0.15s; }
.boss-hp-fill.phase-0 { background: linear-gradient(90deg, #00ff66, #44ff99); }
.boss-hp-fill.phase-1 { background: linear-gradient(90deg, #ffaa00, #ffcc44); }
.boss-hp-fill.phase-2 { background: linear-gradient(90deg, #ff4400, #ff6644); }
.boss-hp-fill.phase-3 { background: linear-gradient(90deg, #ff285f, #ff6690); }
.boss-hp-fill.phase-4 { background: linear-gradient(90deg, #aa00ff, #cc44ff); }

#warning-flash {
  position: absolute;
  top: 38%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: clamp(88px, 11vw, 150px);
  font-weight: 900;
  color: var(--eva-red);
  letter-spacing: 14px;
  text-shadow: 0 0 40px var(--eva-red), 0 0 80px rgba(255, 40, 95, 0.5);
  animation: warn-blink 0.35s step-end infinite;
}
@keyframes warn-blink { 50% { opacity: 0.15; } }

#danger-guide {
  position: absolute;
  bottom: 20vh;
  left: 50%;
  transform: translateX(-50%);
  font-size: clamp(40px, 4.5vw, 60px);
  font-weight: 700;
  color: var(--eva-red);
  letter-spacing: 6px;
  text-shadow: 0 0 16px var(--eva-red);
}

#hud-fps {
  position: absolute;
  bottom: 3vh;
  right: 4vw;
  font-size: clamp(40px, 4.5vw, 56px);
  color: rgba(255, 255, 255, 0.4);
  font-family: monospace;
}

#title-overlay, #gameover-overlay, #clear-overlay, #pause-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  font-family: var(--font-main);
}

#title-overlay { background: radial-gradient(ellipse at center, rgba(155, 89, 182, 0.1) 0%, transparent 70%); }
.eva-border {
  position: absolute;
  inset: 5vh 5vw;
  border: 2px solid var(--eva-orange);
  opacity: 0.3;
}
.title-heading {
  position: absolute;
  top: 7vh;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.title-text {
  font-size: clamp(96px, 11vw, 170px);
  font-weight: 900;
  letter-spacing: 14px;
  color: var(--eva-orange);
  text-shadow: 0 0 30px var(--eva-orange), 0 0 60px rgba(255, 122, 26, 0.4);
  white-space: nowrap;
}
.title-sub {
  font-size: clamp(46px, 5vw, 68px);
  letter-spacing: 10px;
  color: #7de7ff;
  text-shadow: 0 0 22px rgba(0, 217, 255, 0.45);
  white-space: nowrap;
}
.title-press {
  position: absolute;
  bottom: 33vh;
  font-size: clamp(52px, 6.2vw, 78px);
  letter-spacing: 10px;
  color: var(--eva-green);
  text-shadow: 0 0 15px var(--eva-green);
  animation: press-blink 1.5s step-end infinite;
}
@keyframes press-blink { 50% { opacity: 0; } }

.title-controls {
  position: absolute;
  bottom: 5vh;
  left: 50%;
  transform: translateX(-50%);
  border: 2px solid rgba(0, 217, 255, 0.24);
  padding: 18px 36px;
  background: rgba(0, 0, 0, 0.42);
  min-width: min(86vw, 820px);
}
.controls-title {
  font-size: clamp(34px, 3.8vw, 48px);
  color: var(--eva-cyan);
  letter-spacing: 5px;
  margin-bottom: 12px;
  opacity: 0.8;
}
.controls-grid {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 38px;
  row-gap: 8px;
  font-size: clamp(30px, 3.2vw, 42px);
  color: rgba(255, 255, 255, 0.78);
  letter-spacing: 2px;
}
.controls-grid span:nth-child(odd) {
  color: var(--eva-orange);
  text-align: right;
  opacity: 0.95;
}

#gameover-overlay { background: rgba(0, 0, 0, 0.6); }
.go-text {
  font-size: clamp(100px, 13vw, 180px);
  font-weight: 900;
  letter-spacing: 14px;
  color: var(--eva-red);
  text-shadow: 0 0 30px var(--eva-red);
}
.go-score {
  font-size: clamp(64px, 8vw, 104px);
  color: var(--eva-orange);
  margin-top: 40px;
  text-align: center;
  line-height: 1.4;
}
#clear-overlay { background: rgba(0, 18, 24, 0.55); }
.clear-text {
  font-size: clamp(88px, 11vw, 156px);
  font-weight: 900;
  letter-spacing: 12px;
  color: var(--eva-green);
  text-shadow: 0 0 30px var(--eva-green);
  white-space: nowrap;
}
.clear-score {
  font-size: clamp(58px, 7vw, 96px);
  color: var(--eva-cyan);
  margin-top: 34px;
  text-align: center;
  line-height: 1.35;
}
.clear-hint {
  font-size: clamp(38px, 4.6vw, 58px);
  color: var(--eva-orange);
  margin-top: 30px;
  letter-spacing: 6px;
  animation: press-blink 1.5s step-end infinite;
}
#pause-overlay { background: rgba(0, 0, 20, 0.6); }
.pause-title {
  font-size: clamp(96px, 12vw, 160px);
  font-weight: 900;
  letter-spacing: 14px;
  color: var(--eva-cyan);
  text-shadow: 0 0 25px var(--eva-cyan);
}
.pause-hint {
  font-size: clamp(44px, 5.5vw, 64px);
  color: var(--eva-green);
  margin-top: 32px;
  opacity: 0.8;
}

#pipe-status {
  position: absolute;
  top: 2vh;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 36px;
  font-family: var(--font-main);
  font-size: clamp(32px, 4vw, 48px);
  background: var(--panel);
  border: 2px solid;
  pointer-events: none;
  letter-spacing: 4px;
  white-space: nowrap;
}
#pipe-status.connecting { border-color: var(--eva-orange); color: var(--eva-orange); }
#pipe-status.disconnected { border-color: rgba(255, 255, 255, 0.35); color: rgba(255, 255, 255, 0.65); }
#pipe-status.error { border-color: var(--eva-red); color: var(--eva-red); }

#debug-window {
  width: 100vw;
  height: 100vh;
  overflow: auto;
  padding: 12px;
  color: #d7dde7;
  background: #101317;
  font-family: Inter, 'Segoe UI', Arial, sans-serif;
  font-size: 12px;
}
.debug-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}
.debug-header h1 {
  font-size: 20px;
  line-height: 1.1;
  color: #ffffff;
  letter-spacing: 0;
}
.debug-header p {
  margin-top: 3px;
  font-size: 11px;
  color: #8d99a8;
}
.status-pill {
  flex: 0 0 auto;
  padding: 5px 8px;
  border: 1px solid #3b4656;
  background: #171d24;
  color: #aeb9c8;
  font-size: 11px;
  font-weight: 700;
}
.status-pill.connected { border-color: #278f5c; color: #42d991; }
.status-pill.connecting { border-color: #a87222; color: #f2b24b; }
.status-pill.error { border-color: #a43d55; color: #ff6b8a; }
.debug-section {
  border: 1px solid #27313d;
  background: #151a20;
  padding: 9px;
  margin-bottom: 8px;
}
.section-title {
  margin-bottom: 6px;
  color: #78c8ff;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0;
}
.debug-grid {
  display: grid;
  grid-template-columns: minmax(78px, 0.34fr) minmax(0, 1fr) minmax(78px, 0.34fr) minmax(0, 1fr);
  gap: 5px 10px;
  font-size: 12px;
  line-height: 1.22;
}
.debug-grid span { color: #8793a3; }
.debug-grid strong {
  color: #f2f6fb;
  font-weight: 650;
  word-break: break-word;
}
.debug-grid strong.metric-good { color: #42d991; }
.debug-grid strong.metric-warn { color: #f2b24b; }
.debug-grid strong.metric-critical { color: #ff6b8a; }
.toggle-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(105px, 1fr));
  gap: 6px;
}
.toggle-btn {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid #3d4a59;
  background: #202833;
  color: #f4f7fb;
  cursor: pointer;
  font-size: 12px;
}
.toggle-btn:hover { background: #283342; }
.toggle-btn.active {
  border-color: #278f5c;
  background: #163728;
  color: #42d991;
}
.toggle-btn.danger.active {
  border-color: #a87222;
  background: #3a2915;
  color: #f2b24b;
}
.stage-actions {
  display: grid;
  grid-template-columns: repeat(4, minmax(90px, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.stage-actions button {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid #3d4a59;
  background: #202833;
  color: #f4f7fb;
  cursor: pointer;
  font-size: 12px;
}
.stage-actions button:hover { background: #283342; }
.parallax-row {
  display: grid;
  grid-template-columns: 30px minmax(130px, 1fr) 30px auto;
  gap: 6px;
  align-items: center;
}
.parallax-row button {
  min-height: 30px;
  padding: 0 8px;
  border: 1px solid #3d4a59;
  background: #202833;
  color: #f4f7fb;
  cursor: pointer;
  font-size: 12px;
}
.parallax-row button:hover { background: #283342; }
.parallax-row .reset-btn { min-width: 78px; }
.parallax-row input { width: 100%; accent-color: #42d991; }
.parallax-value {
  margin-top: 4px;
  font-size: 18px;
  font-weight: 800;
  color: #42d991;
}
.preset-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(68px, 1fr));
  gap: 5px;
  margin-bottom: 8px;
}
.preset-row button {
  min-height: 28px;
  padding: 0 6px;
  border: 1px solid #3d4a59;
  background: #202833;
  color: #f4f7fb;
  cursor: pointer;
  font-size: 11px;
  text-transform: capitalize;
}
.preset-row button:hover { background: #283342; }
.preset-row button.active {
  border-color: #42d991;
  background: #17382b;
  color: #42d991;
}
.camera-controls {
  display: grid;
  gap: 6px;
}
.camera-controls label {
  display: grid;
  grid-template-columns: 62px minmax(120px, 1fr) 58px;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.camera-controls span { color: #8793a3; }
.camera-controls input { width: 100%; accent-color: #78c8ff; }
.locked-track {
  min-height: 22px;
  display: flex;
  align-items: center;
  padding: 0 7px;
  border: 1px solid #2d3744;
  background: #11161d;
  color: #5f6e7f;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0;
}
.locked-control span { color: #647284; }
.camera-controls strong {
  color: #f2f6fb;
  font-weight: 750;
  text-align: right;
}
@media (max-width: 760px) {
  .debug-grid {
    grid-template-columns: minmax(72px, 0.42fr) minmax(0, 1fr);
  }
  .stage-actions,
  .preset-row {
    grid-template-columns: repeat(2, minmax(96px, 1fr));
  }
}
</style>
