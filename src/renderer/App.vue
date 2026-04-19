<template>
  <div id="game-root">
    <div ref="canvasContainer" id="canvas-container" />

    <!-- HUD overlay — EVA style -->
    <div v-if="hudState.gameState === 'playing' || hudState.gameState === 'boss'" id="hud-overlay">
      <!-- Score -->
      <div id="hud-score">
        <span class="hud-label">SCORE</span>
        <span class="hud-val">{{ hudState.score.toLocaleString() }}</span>
      </div>
      <!-- Combo -->
      <div id="hud-combo" v-if="hudState.combo > 1">
        <span class="combo-num">{{ hudState.combo }}</span>
        <span class="combo-label">COMBO</span>
        <span class="combo-mult">×{{ hudState.multiplier.toFixed(1) }}</span>
      </div>
      <!-- Weapon -->
      <div id="hud-weapon">
        <span class="hud-label">WEAPON</span>
        <span class="hud-val weapon-name">{{ weaponLabel }}</span>
        <span class="weapon-lvl">Lv.{{ hudState.weaponLevel }}</span>
      </div>
      <!-- Spin cooldown -->
      <div v-if="hudState.spinCooldown > 0" id="hud-spin">
        <span class="hud-label">SPIN</span>
        <div class="spin-track">
          <div class="spin-fill" :style="{ width: (100 - hudState.spinCooldown / 8 * 100) + '%' }" />
        </div>
      </div>
      <div v-else-if="hudState.gameState === 'playing' || hudState.gameState === 'boss'" id="hud-spin-ready">
        <span class="spin-ready-label">[ X ] SPIN READY</span>
      </div>
      <!-- Heat bar (laser) -->
      <div v-if="hudState.weapon === 'laser'" id="hud-heat">
        <span class="hud-label">HEAT</span>
        <div class="heat-track">
          <div class="heat-fill" :class="{ overheat: hudState.overheated }" :style="{ width: (hudState.laserHeat * 100) + '%' }" />
        </div>
      </div>
      <!-- Lives -->
      <div id="hud-lives">
        <span v-for="i in hudState.lives" :key="i" class="life-icon">▲</span>
      </div>
      <!-- Boss HP — multi-phase colored bar -->
      <div v-if="hudState.gameState === 'boss'" id="boss-bar">
        <div class="boss-name">{{ hudState.bossName }}</div>
        <div class="boss-phase">PHASE {{ hudState.bossPhase + 1 }}</div>
        <div class="boss-hp-track">
          <div class="boss-hp-fill" :class="'phase-' + hudState.bossPhase" :style="{ width: bossHpPct + '%' }" />
        </div>
      </div>
      <!-- WARNING -->
      <div v-if="hudState.warning" id="warning-flash">⚠ WARNING ⚠</div>
      <!-- FPS -->
      <div v-if="hudState.showFps" id="hud-fps">{{ hudState.fps }} FPS</div>
      <!-- Scanline overlay -->
      <div class="scanlines" />
    </div>

    <!-- Title -->
    <div v-if="hudState.gameState === 'title'" id="title-overlay">
      <div class="eva-border" />
      <div class="title-text">C1战机</div>
      <div class="title-sub">CubeVi C1 // 战机系统</div>
      <div class="title-press">[ Z ] START</div>
      <div class="scanlines" />
    </div>

    <!-- Game Over -->
    <div v-if="hudState.gameState === 'gameover'" id="gameover-overlay">
      <div class="go-text">GAME OVER</div>
      <div class="go-score">FINAL SCORE<br/>{{ hudState.score.toLocaleString() }}</div>
      <div class="scanlines" />
    </div>

    <!-- Pause -->
    <div v-if="hudState.gameState === 'paused'" id="pause-overlay">
      <div class="pause-title">SYSTEM HALT</div>
      <div class="pause-hint">[ ESC ] RESUME</div>
      <div class="scanlines" />
    </div>

    <!-- Pipe status -->
    <div v-if="pipeStatus !== 'connected'" id="pipe-status" :class="pipeStatus">
      <template v-if="pipeStatus === 'connecting'">CONNECTING...</template>
      <template v-else-if="pipeStatus === 'disconnected'">C1 OFFLINE — NORMAL MODE</template>
      <template v-else>LINK ERROR</template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import type { PipeStatus } from '@shared/types'
import type { Game, GameHUDState } from '@/game/Game'

const canvasContainer = ref<HTMLDivElement | null>(null)
const pipeStatus = ref<PipeStatus>('disconnected')
const hudState: GameHUDState & { laserHeat: number; overheated: boolean; bossPhase: number; spinCooldown: number } = reactive({
  score: 0, lives: 5, gameState: 'title',
  weapon: 'shot', weaponLevel: 1,
  combo: 0, multiplier: 1.0,
  bossName: '', bossHp: 1, bossMaxHp: 1,
  warning: false, showFps: false, fps: 0,
  laserHeat: 0, overheated: false, bossPhase: 0, spinCooldown: 0,
})

const weaponLabel = computed(() => ({ shot: 'SHOT', spread: 'SPREAD', laser: 'LASER' }[hudState.weapon] || 'SHOT'))
const bossHpPct = computed(() => Math.max(0, (hudState.bossHp / hudState.bossMaxHp) * 100))

let game: Game | null = null

onMounted(async () => {
  const { Game: G } = await import('@/game/Game')
  game = new G(canvasContainer.value!)
  game.onHUDUpdate((s) => Object.assign(hudState, s))
  game.start()
  window.electronAPI?.onDeviceParamsUpdated((p) => game?.updateGratingParams(p))
  window.electronAPI?.onPipeStatusChanged((s) => { pipeStatus.value = s })
  window.electronAPI?.requestDeviceParams()
})

onUnmounted(() => { game?.dispose(); window.electronAPI?.removeAllListeners() })
</script>

<style>
/* ═══════════════════════════════════════════════════════════
   EVA-INSPIRED UI — 橙/紫/绿 高对比度，扫描线，动画
   C1 适配：最小字体 40px+，关键信息 56px+
   ═══════════════════════════════════════════════════════════ */

:root {
  --eva-orange: #ff6a00;
  --eva-green:  #00ff41;
  --eva-purple: #9b59b6;
  --eva-red:    #ff0040;
  --eva-cyan:   #00e5ff;
  --eva-bg:     rgba(0, 0, 0, 0.65);
  --font-main:  'Orbitron', 'Share Tech Mono', monospace;
}

* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #000; overflow: hidden; user-select: none; }
#game-root { width: 100vw; height: 100vh; position: relative; }
#canvas-container { width: 100%; height: 100%; }

/* Scanline overlay */
.scanlines {
  position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(
    0deg, transparent, transparent 3px, rgba(0,0,0,0.08) 3px, rgba(0,0,0,0.08) 4px
  );
  animation: scanmove 8s linear infinite;
}
@keyframes scanmove { to { background-position: 0 100px; } }

/* ── HUD ── */
#hud-overlay {
  position: absolute; inset: 0; pointer-events: none;
  font-family: var(--font-main); color: var(--eva-green);
}

.hud-label {
  font-size: clamp(28px, 3vw, 40px); font-weight: 400;
  color: var(--eva-orange); letter-spacing: 4px;
  opacity: 0.85;
}
.hud-val {
  font-size: clamp(48px, 5.5vw, 72px); font-weight: 700;
  text-shadow: 0 0 12px var(--eva-green), 0 0 24px rgba(0,255,65,0.3);
}

#hud-score {
  position: absolute; top: 3vh; right: 4vw;
  display: flex; flex-direction: column; align-items: flex-end;
}

#hud-combo {
  position: absolute; top: 12vh; right: 4vw;
  display: flex; align-items: baseline; gap: 8px;
}
.combo-num {
  font-size: clamp(56px, 6vw, 80px); font-weight: 900;
  color: var(--eva-orange);
  text-shadow: 0 0 15px var(--eva-orange);
  animation: combo-pulse 0.3s ease-out;
}
.combo-label { font-size: clamp(28px, 3vw, 40px); color: var(--eva-orange); opacity: 0.7; }
.combo-mult { font-size: clamp(36px, 4vw, 56px); color: var(--eva-red); font-weight: 700; }
@keyframes combo-pulse { from { transform: scale(1.3); } to { transform: scale(1); } }

#hud-weapon {
  position: absolute; top: 3vh; left: 4vw;
  display: flex; flex-direction: column;
}
.weapon-name { color: var(--eva-cyan); }
.weapon-lvl {
  font-size: clamp(32px, 3.5vw, 48px); color: var(--eva-purple);
  text-shadow: 0 0 8px var(--eva-purple);
}

#hud-spin {
  position: absolute; top: 21vh; left: 4vw;
  display: flex; flex-direction: column; width: 20vw;
}
.spin-track {
  height: clamp(8px, 1vh, 14px); background: rgba(255,255,255,0.1);
  border: 2px solid var(--eva-purple); border-radius: 2px; overflow: hidden;
  margin-top: 4px;
}
.spin-fill {
  height: 100%; background: linear-gradient(90deg, var(--eva-purple), #dd88ff);
  transition: width 0.2s;
}
#hud-spin-ready {
  position: absolute; top: 21vh; left: 4vw;
}
.spin-ready-label {
  font-size: clamp(22px, 2.5vw, 32px); color: var(--eva-purple);
  text-shadow: 0 0 8px var(--eva-purple);
  animation: spin-glow 1.5s ease-in-out infinite alternate;
}
@keyframes spin-glow { from { opacity: 0.6; } to { opacity: 1; text-shadow: 0 0 20px var(--eva-purple); } }

#hud-heat {
  position: absolute; top: 14vh; left: 4vw;
  display: flex; flex-direction: column; width: 20vw;
}
.heat-track {
  height: clamp(10px, 1.2vh, 16px); background: rgba(255,255,255,0.1);
  border: 2px solid var(--eva-orange); border-radius: 2px; overflow: hidden;
  margin-top: 4px;
}
.heat-fill {
  height: 100%; background: linear-gradient(90deg, var(--eva-orange), var(--eva-red));
  transition: width 0.1s;
}
.heat-fill.overheat { animation: overheat-blink 0.2s step-end infinite; }
@keyframes overheat-blink { 50% { opacity: 0.3; } }

#hud-lives {
  position: absolute; bottom: 3vh; left: 4vw;
  font-size: clamp(40px, 4.5vw, 60px); letter-spacing: 10px;
}
.life-icon { color: var(--eva-green); text-shadow: 0 0 10px var(--eva-green); }

/* Boss bar */
#boss-bar { position: absolute; top: 2vh; left: 12vw; right: 12vw; }
.boss-name {
  text-align: center;
  font-size: clamp(36px, 4vw, 52px); font-weight: 700;
  color: var(--eva-red); letter-spacing: 6px;
  text-shadow: 0 0 12px var(--eva-red);
  animation: boss-name-in 0.5s ease-out;
}
@keyframes boss-name-in { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
.boss-phase {
  text-align: center;
  font-size: clamp(22px, 2.5vw, 32px); color: var(--eva-orange);
  letter-spacing: 4px; margin-bottom: 4px;
}
.boss-hp-track {
  width: 100%; height: clamp(14px, 1.8vh, 22px);
  background: rgba(255,0,64,0.15); border: 2px solid var(--eva-red);
  border-radius: 2px; overflow: hidden; margin-top: 4px;
}
.boss-hp-fill {
  height: 100%; transition: width 0.15s;
}
.boss-hp-fill.phase-0 { background: linear-gradient(90deg, #00ff41, #44ff88); }
.boss-hp-fill.phase-1 { background: linear-gradient(90deg, #ffaa00, #ffcc44); }
.boss-hp-fill.phase-2 { background: linear-gradient(90deg, #ff4400, #ff6644); }
.boss-hp-fill.phase-3 { background: linear-gradient(90deg, #ff0040, #ff2266); }
.boss-hp-fill.phase-4 { background: linear-gradient(90deg, #aa00ff, #cc44ff); }

#warning-flash {
  position: absolute; top: 38%; left: 50%; transform: translate(-50%, -50%);
  font-size: clamp(64px, 8vw, 110px); font-weight: 900;
  color: var(--eva-red); letter-spacing: 10px;
  text-shadow: 0 0 40px var(--eva-red), 0 0 80px rgba(255,0,64,0.5);
  animation: warn-blink 0.35s step-end infinite;
}
@keyframes warn-blink { 50% { opacity: 0.15; } }

#hud-fps {
  position: absolute; bottom: 3vh; right: 4vw;
  font-size: clamp(28px, 3vw, 40px); color: rgba(255,255,255,0.4);
  font-family: monospace;
}

/* ── Title ── */
#title-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; font-family: var(--font-main);
  background: radial-gradient(ellipse at center, rgba(155,89,182,0.1) 0%, transparent 70%);
}
.eva-border {
  position: absolute; inset: 5vh 5vw;
  border: 2px solid var(--eva-orange); opacity: 0.3;
  animation: border-in 1s ease-out;
}
@keyframes border-in { from { opacity: 0; transform: scale(1.1); } }
.title-text {
  font-size: clamp(80px, 10vw, 140px); font-weight: 900; letter-spacing: 12px;
  color: var(--eva-orange);
  text-shadow: 0 0 30px var(--eva-orange), 0 0 60px rgba(255,106,0,0.4);
  animation: title-in 0.8s ease-out;
}
@keyframes title-in { from { transform: translateY(-20px); opacity: 0; } }
.title-sub {
  font-size: clamp(28px, 3.5vw, 44px); letter-spacing: 8px;
  color: var(--eva-purple); margin-top: 12px; opacity: 0.8;
}
.title-press {
  font-size: clamp(36px, 4.5vw, 56px); letter-spacing: 6px;
  color: var(--eva-green); margin-top: 60px;
  text-shadow: 0 0 15px var(--eva-green);
  animation: press-blink 1.5s step-end infinite;
}
@keyframes press-blink { 50% { opacity: 0; } }

/* ── Game Over ── */
#gameover-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; font-family: var(--font-main);
  background: rgba(0,0,0,0.6);
}
.go-text {
  font-size: clamp(80px, 10vw, 140px); font-weight: 900; letter-spacing: 10px;
  color: var(--eva-red);
  text-shadow: 0 0 30px var(--eva-red);
  animation: go-in 0.6s ease-out;
}
@keyframes go-in { from { transform: scale(2); opacity: 0; } }
.go-score {
  font-size: clamp(48px, 6vw, 80px); color: var(--eva-orange);
  margin-top: 30px; text-align: center; line-height: 1.4;
}

/* ── Pause ── */
#pause-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none; font-family: var(--font-main);
  background: rgba(0,0,20,0.6);
}
.pause-title {
  font-size: clamp(72px, 9vw, 120px); font-weight: 900; letter-spacing: 10px;
  color: var(--eva-cyan);
  text-shadow: 0 0 25px var(--eva-cyan);
}
.pause-hint {
  font-size: clamp(32px, 4vw, 48px); color: var(--eva-green); margin-top: 24px; opacity: 0.8;
}

/* ── Pipe status ── */
#pipe-status {
  position: absolute; top: 2vh; left: 50%; transform: translateX(-50%);
  padding: 10px 28px; border-radius: 2px;
  font-family: var(--font-main); font-size: clamp(24px, 3vw, 36px);
  background: var(--eva-bg); border: 2px solid; pointer-events: none;
  letter-spacing: 3px;
}
#pipe-status.connecting   { border-color: var(--eva-orange); color: var(--eva-orange); }
#pipe-status.disconnected { border-color: rgba(255,255,255,0.3); color: rgba(255,255,255,0.5); }
#pipe-status.error        { border-color: var(--eva-red); color: var(--eva-red); }
</style>
