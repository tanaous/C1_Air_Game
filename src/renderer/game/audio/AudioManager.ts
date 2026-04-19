/**
 * 16-bit 品质音频引擎
 * 全程序化合成，模拟16-bit时代SNES SPC700风格：
 *   - 弦乐：双去谐锯齿波 + 4极低通滤波 + 颤音LFO
 *   - 钢琴：三角波 + 快速衰减包络 + 谐波叠加
 *   - 贝斯：正弦波 + 拨奏包络
 *   - 打击：独立 Kick / Snare / HiHat 合成
 *
 * BGM风格：借鉴《EVA新剧场版》Shiro Sagisu弦乐编曲，
 * Dm小调，旋律与对位线条基于原作情绪变奏。
 */

export type SFXType =
  | 'shot_fire'
  | 'spread_fire'
  | 'laser_start'
  | 'enemy_hit'
  | 'enemy_destroy'
  | 'boss_destroy'
  | 'player_hit'
  | 'player_death'
  | 'powerup_collect'
  | 'extra_life'
  | 'graze'
  | 'bomb_use'
  | 'spin_start'
  | 'spin_land'
  | 'warning_alarm'
  | 'boss_phase_change'
  | 'menu_select'
  | 'menu_confirm'
  | 'game_over'

export type BGMTrack = 'none' | 'title' | 'gameplay' | 'boss' | 'gameover'

// ─── 音符频率表（Dm相关音阶）────────────────────────────────────────────────
const N: Record<string, number> = {
  _:    0,
  C2:  65.41,  D2:  73.42,  E2:  82.41,  F2:  87.31,
  G2:  98.00,  A2: 110.00,  Bb2:116.54,  B2: 123.47,
  C3: 130.81,  Db3:138.59, D3: 146.83,  Eb3:155.56,
  E3: 164.81,  F3: 174.61,  Gb3:185.00, G3: 196.00,
  Ab3:207.65,  A3: 220.00,  Bb3:233.08, B3: 246.94,
  C4: 261.63,  Db4:277.18, D4: 293.66,  Eb4:311.13,
  E4: 329.63,  F4: 349.23,  Gb4:369.99, G4: 392.00,
  Ab4:415.30,  A4: 440.00,  Bb4:466.16, B4: 493.88,
  C5: 523.25,  Db5:554.37, D5: 587.33,  Eb5:622.25,
  E5: 659.25,  F5: 698.46,  Gb5:739.99, G5: 783.99,
  Ab5:830.61,  A5: 880.00,  Bb5:932.33, B5: 987.77,
  C6:1046.50,  D6:1174.66, E6:1318.51,
}

interface Note { freq: number; dur: number; vol?: number }

interface BGMPattern {
  bpm:      number
  melody:   Note[]   // 主旋律（小提琴）
  counter:  Note[]   // 对位（中提琴）
  bass:     Note[]   // 低音（大提琴）
  chord:    Note[]   // 和声铺底
  drumGrid: number[] // 16分音符网格：0=无 1=kick 2=snare 3=hihat 4=snare+hihat
}

// ═══════════════════════════════════════════════════════════════════════════
//  BGM 乐谱 — Dm小调，借鉴EVA弦乐情绪变奏
//  和声进行: Dm - Bb - C - A7 (i - VI - VII - V)
// ═══════════════════════════════════════════════════════════════════════════

const BGM_TITLE: BGMPattern = {
  bpm: 72,
  // ── 主旋律：Dm下行然后上扬 ────────────────────────────────────────────
  melody: [
    // Bar 1 (Dm)
    { freq: N.D5,  dur: 2   }, { freq: N.C5,  dur: 1   }, { freq: N.Bb4, dur: 1   },
    // Bar 2 (Dm→Gm)
    { freq: N.A4,  dur: 1.5 }, { freq: N.G4,  dur: 0.5 }, { freq: N.F4,  dur: 2   },
    // Bar 3 (Bb)
    { freq: N.G4,  dur: 1   }, { freq: N.A4,  dur: 1   }, { freq: N.Bb4, dur: 2   },
    // Bar 4 (A7 - 和声小调)
    { freq: N.A4,  dur: 1   }, { freq: N.C5,  dur: 1   }, { freq: N.Db5, dur: 2   },
    // Bar 5 (Dm - 高八度)
    { freq: N.F5,  dur: 1   }, { freq: N.E5,  dur: 0.5 }, { freq: N.D5,  dur: 0.5 }, { freq: N.C5, dur: 2 },
    // Bar 6 (Bb)
    { freq: N.Bb4, dur: 1.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 2   },
    // Bar 7 (C→A7 过渡)
    { freq: N.G4,  dur: 1   }, { freq: N.F4,  dur: 1   }, { freq: N.Ab4, dur: 1   }, { freq: N.A4, dur: 1 },
    // Bar 8 (Dm 解决)
    { freq: N.D4,  dur: 4   },
  ],
  // ── 对位旋律：中提琴，支撑和声 ─────────────────────────────────────────
  counter: [
    // Bar 1-2 (Dm)
    { freq: N.F4,  dur: 2 }, { freq: N.E4,  dur: 2 },
    { freq: N.D4,  dur: 2 }, { freq: N.C4,  dur: 2 },
    // Bar 3-4 (Bb, A7)
    { freq: N.D4,  dur: 2 }, { freq: N.F4,  dur: 2 },
    { freq: N.E4,  dur: 2 }, { freq: N.Db4, dur: 2 },
    // Bar 5-6 (Dm, Bb)
    { freq: N.A4,  dur: 2 }, { freq: N.G4,  dur: 2 },
    { freq: N.F4,  dur: 2 }, { freq: N.E4,  dur: 2 },
    // Bar 7-8 (C, Dm)
    { freq: N.C4,  dur: 2 }, { freq: N.Db4, dur: 2 },
    { freq: N.A3,  dur: 4 },
  ],
  // ── 大提琴拨奏低音 ───────────────────────────────────────────────────────
  bass: [
    { freq: N.D3,  dur: 1 }, { freq: N.A3,  dur: 1 }, { freq: N.D3, dur: 1 }, { freq: N.A3, dur: 1 },
    { freq: N.D3,  dur: 1 }, { freq: N.A3,  dur: 1 }, { freq: N.D3, dur: 1 }, { freq: N.A3, dur: 1 },
    { freq: N.Bb2, dur: 1 }, { freq: N.F3,  dur: 1 }, { freq: N.Bb2,dur: 1 }, { freq: N.F3, dur: 1 },
    { freq: N.A2,  dur: 1 }, { freq: N.E3,  dur: 1 }, { freq: N.A2, dur: 1 }, { freq: N.E3, dur: 1 },
    { freq: N.D3,  dur: 1 }, { freq: N.A3,  dur: 1 }, { freq: N.D3, dur: 1 }, { freq: N.A3, dur: 1 },
    { freq: N.Bb2, dur: 1 }, { freq: N.F3,  dur: 1 }, { freq: N.Bb2,dur: 1 }, { freq: N.F3, dur: 1 },
    { freq: N.C3,  dur: 1 }, { freq: N.G3,  dur: 1 }, { freq: N.A2, dur: 1 }, { freq: N.E3, dur: 1 },
    { freq: N.D2,  dur: 2 }, { freq: N.A2,  dur: 2 },
  ],
  // ── 和弦铺底（慢速衬托） ─────────────────────────────────────────────────
  chord: [
    { freq: N.F3,  dur: 4 }, { freq: N.F3,  dur: 4 },
    { freq: N.Bb3, dur: 4 }, { freq: N.E3,  dur: 4 },
    { freq: N.D3,  dur: 4 }, { freq: N.Bb3, dur: 4 },
    { freq: N.C4,  dur: 4 }, { freq: N.D3,  dur: 4 },
  ],
  // ── 轻柔打击 ─────────────────────────────────────────────────────────────
  drumGrid: [
    1,0,0,3, 0,0,2,3, 0,0,0,3, 0,3,0,0,
    1,0,0,3, 0,0,2,3, 0,0,0,3, 0,0,2,0,
  ],
}

const BGM_GAMEPLAY: BGMPattern = {
  bpm: 148,
  // ── 主旋律：快节奏Dm，弦乐断奏风格 ────────────────────────────────────
  melody: [
    // Bar 1 (Dm) - 八分音符为主
    { freq: N.D5,  dur: 0.5 }, { freq: N.F5,  dur: 0.5 }, { freq: N.E5,  dur: 0.5 }, { freq: N.D5,  dur: 0.5 },
    { freq: N.C5,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 },
    // Bar 2 (C)
    { freq: N.A4,  dur: 0.5 }, { freq: N.C5,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 },
    { freq: N.G4,  dur: 0.5 }, { freq: N.F4,  dur: 0.5 }, { freq: N.E4,  dur: 0.5 }, { freq: N.F4,  dur: 0.5 },
    // Bar 3 (Bb)
    { freq: N.G4,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 },
    { freq: N.F4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 }, { freq: N.Bb4, dur: 1    }, { freq: N._,   dur: 0.5 },
    // Bar 4 (A7)
    { freq: N.A4,  dur: 0.5 }, { freq: N.Db5, dur: 0.5 }, { freq: N.E5,  dur: 0.5 }, { freq: N.Db5, dur: 0.5 },
    { freq: N.A4,  dur: 0.5 }, { freq: N.E4,  dur: 0.5 }, { freq: N.A4,  dur: 1    },
    // Bar 5 (Dm - 高位)
    { freq: N.F5,  dur: 0.5 }, { freq: N.G5,  dur: 0.5 }, { freq: N.F5,  dur: 0.5 }, { freq: N.E5,  dur: 0.5 },
    { freq: N.D5,  dur: 1    }, { freq: N.A4,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 },
    // Bar 6 (Bb)
    { freq: N.C5,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 },
    { freq: N.F4,  dur: 1    }, { freq: N.G4,  dur: 0.5 }, { freq: N.A4,  dur: 0.5 },
    // Bar 7 (C→A7)
    { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 }, { freq: N.Ab4, dur: 0.5 },
    { freq: N.A4,  dur: 1    }, { freq: N.Db5, dur: 1    },
    // Bar 8 (Dm)
    { freq: N.D5,  dur: 1    }, { freq: N.A4,  dur: 1    }, { freq: N.F4,  dur: 1    }, { freq: N.D4,  dur: 1    },
  ],
  // ── 对位：十六分音符快速跑动 ───────────────────────────────────────────
  counter: [
    { freq: N.A4, dur: 0.5 }, { freq: N.F4, dur: 0.5 }, { freq: N.A4, dur: 0.5 }, { freq: N.F4, dur: 0.5 },
    { freq: N.G4, dur: 0.5 }, { freq: N.E4, dur: 0.5 }, { freq: N.G4, dur: 0.5 }, { freq: N.E4, dur: 0.5 },
    { freq: N.G4, dur: 0.5 }, { freq: N.E4, dur: 0.5 }, { freq: N.G4, dur: 0.5 }, { freq: N.E4, dur: 0.5 },
    { freq: N.F4, dur: 0.5 }, { freq: N.C4, dur: 0.5 }, { freq: N.F4, dur: 0.5 }, { freq: N.C4, dur: 0.5 },
    { freq: N.F4, dur: 0.5 }, { freq: N.D4, dur: 0.5 }, { freq: N.F4, dur: 0.5 }, { freq: N.D4, dur: 0.5 },
    { freq: N.E4, dur: 0.5 }, { freq: N.C4, dur: 0.5 }, { freq: N.E4, dur: 0.5 }, { freq: N.C4, dur: 0.5 },
    { freq: N.E4, dur: 0.5 }, { freq: N.C4, dur: 0.5 }, { freq: N.Db4,dur: 0.5 }, { freq: N.A3, dur: 0.5 },
    { freq: N.D4, dur: 2   }, { freq: N.A3, dur: 2   },
  ],
  bass: [
    { freq: N.D3,  dur: 0.5 }, { freq: N.A3, dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A3, dur: 0.5 },
    { freq: N.D3,  dur: 0.5 }, { freq: N.A3, dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A3, dur: 0.5 },
    { freq: N.C3,  dur: 0.5 }, { freq: N.G3, dur: 0.5 }, { freq: N.C3, dur: 0.5 }, { freq: N.G3, dur: 0.5 },
    { freq: N.C3,  dur: 0.5 }, { freq: N.G3, dur: 0.5 }, { freq: N.C3, dur: 0.5 }, { freq: N.G3, dur: 0.5 },
    { freq: N.Bb2, dur: 0.5 }, { freq: N.F3, dur: 0.5 }, { freq: N.Bb2,dur: 0.5 }, { freq: N.F3, dur: 0.5 },
    { freq: N.Bb2, dur: 0.5 }, { freq: N.F3, dur: 0.5 }, { freq: N.Bb2,dur: 0.5 }, { freq: N.F3, dur: 0.5 },
    { freq: N.A2,  dur: 0.5 }, { freq: N.E3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.E3, dur: 0.5 },
    { freq: N.A2,  dur: 0.5 }, { freq: N.E3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.D3, dur: 0.5 },
  ],
  chord: [
    { freq: N.F3, dur: 2 }, { freq: N.A3, dur: 2 },
    { freq: N.E3, dur: 2 }, { freq: N.G3, dur: 2 },
    { freq: N.D3, dur: 2 }, { freq: N.F3, dur: 2 },
    { freq: N.E3, dur: 2 }, { freq: N.A3, dur: 2 },
  ],
  drumGrid: [
    1,0,3,0, 2,0,3,0, 1,0,3,3, 2,0,3,0,
    1,0,3,0, 2,3,3,0, 1,0,3,3, 2,0,3,0,
  ],
}

const BGM_BOSS: BGMPattern = {
  bpm: 170,
  // ── 主旋律：紧张半音进行，和声小调色彩 ───────────────────────────────
  melody: [
    // Bar 1 (Dm - 紧张断奏)
    { freq: N.A4,  dur: 0.5 }, { freq: N._,   dur: 0.25 }, { freq: N.A4,  dur: 0.25 },
    { freq: N.Bb4, dur: 0.5 }, { freq: N._,   dur: 0.25 }, { freq: N.A4,  dur: 0.25 },
    { freq: N.Ab4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 },
    // Bar 2 (加剧)
    { freq: N.D5,  dur: 0.5 }, { freq: N._,   dur: 0.25 }, { freq: N.D5,  dur: 0.25 },
    { freq: N.Eb5, dur: 0.5 }, { freq: N._,   dur: 0.25 }, { freq: N.D5,  dur: 0.25 },
    { freq: N.Db5, dur: 0.5 }, { freq: N.D5,  dur: 0.5 },
    // Bar 3 (Bb - 渐强)
    { freq: N.F5,  dur: 1   }, { freq: N.E5,  dur: 0.5 }, { freq: N.Eb5, dur: 0.5 },
    { freq: N.D5,  dur: 0.5 }, { freq: N.C5,  dur: 0.5 }, { freq: N.Bb4, dur: 1   },
    // Bar 4 (A7 高潮)
    { freq: N.E5,  dur: 0.5 }, { freq: N.Db5, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.E4,  dur: 0.5 },
    { freq: N.Db5, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.E4,  dur: 0.5 }, { freq: N.A4,  dur: 0.5 },
    // Bar 5-8 (循环变奏)
    { freq: N.D5,  dur: 0.5 }, { freq: N.F5,  dur: 0.5 }, { freq: N.A5,  dur: 1   }, { freq: N.G5,  dur: 0.5 }, { freq: N.F5, dur: 0.5 },
    { freq: N.E5,  dur: 0.5 }, { freq: N.D5,  dur: 0.5 }, { freq: N.C5,  dur: 0.5 }, { freq: N.Bb4, dur: 0.5 }, { freq: N.A4, dur: 1 },
    { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.Ab4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 },
    { freq: N.Bb4, dur: 0.5 }, { freq: N.A4,  dur: 0.5 }, { freq: N.G4,  dur: 0.5 }, { freq: N.Ab4, dur: 0.5 },
    { freq: N.A4,  dur: 4   },
  ],
  counter: [
    { freq: N.D4, dur: 1 }, { freq: N.E4,  dur: 1 }, { freq: N.F4, dur: 1 }, { freq: N.E4,  dur: 1 },
    { freq: N.F4, dur: 1 }, { freq: N.G4,  dur: 1 }, { freq: N.Ab4,dur: 1 }, { freq: N.G4,  dur: 1 },
    { freq: N.D4, dur: 1 }, { freq: N.Eb4, dur: 1 }, { freq: N.D4, dur: 1 }, { freq: N.Db4, dur: 1 },
    { freq: N.C4, dur: 1 }, { freq: N.Db4, dur: 1 }, { freq: N.D4, dur: 1 }, { freq: N.A3,  dur: 1 },
  ],
  bass: [
    { freq: N.D3,  dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.A2, dur: 0.5 },
    { freq: N.D3,  dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.A2, dur: 0.5 },
    { freq: N.Bb2, dur: 0.5 }, { freq: N.Bb2,dur: 0.5 }, { freq: N.F2, dur: 0.5 }, { freq: N.F2, dur: 0.5 },
    { freq: N.A2,  dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.E2, dur: 0.5 }, { freq: N.E2, dur: 0.5 },
    { freq: N.D3,  dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.A2, dur: 0.5 },
    { freq: N.D3,  dur: 0.5 }, { freq: N.D3, dur: 0.5 }, { freq: N.A2, dur: 0.5 }, { freq: N.A2, dur: 0.5 },
    { freq: N.C3,  dur: 0.5 }, { freq: N.C3, dur: 0.5 }, { freq: N.G2, dur: 0.5 }, { freq: N.A2, dur: 0.5 },
    { freq: N.A2,  dur: 1   }, { freq: N.E2, dur: 1   }, { freq: N.A2, dur: 1   }, { freq: N.E2, dur: 1   },
  ],
  chord: [
    { freq: N.F3, dur: 2 }, { freq: N.A3, dur: 2 },
    { freq: N.F3, dur: 2 }, { freq: N.A3, dur: 2 },
    { freq: N.D3, dur: 2 }, { freq: N.F3, dur: 2 },
    { freq: N.E3, dur: 2 }, { freq: N.Db3,dur: 2 },
  ],
  drumGrid: [
    1,0,3,3, 2,3,3,3, 1,0,3,3, 2,3,3,3,
    1,3,3,3, 2,3,3,3, 1,3,3,3, 4,3,4,3,
  ],
}

// ═══════════════════════════════════════════════════════════════════════════
//  AudioManager
// ═══════════════════════════════════════════════════════════════════════════

export class AudioManager {
  private ctx:        AudioContext | null = null
  private masterGain: GainNode    | null = null
  private sfxGain:    GainNode    | null = null
  private bgmGain:    GainNode    | null = null
  private enabled  = true
  private bgmEnabled = true

  masterVolume = 0.88
  sfxVolume    = 0.75
  bgmVolume    = 0.40

  private currentBGM: BGMTrack = 'none'
  private bgmScheduleId: ReturnType<typeof setTimeout> | null = null
  private bgmLoopTime  = 0

  private warningInterval: ReturnType<typeof setInterval> | null = null

  // ─── 初始化 ───────────────────────────────────────────────────────────────

  private getCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx        = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.sfxGain    = this.ctx.createGain()
      this.bgmGain    = this.ctx.createGain()
      this.sfxGain.connect(this.masterGain)
      this.bgmGain.connect(this.masterGain)
      this.masterGain.connect(this.ctx.destination)
      this.applyVolumes()
    }
    return this.ctx
  }

  private applyVolumes(): void {
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume
    if (this.sfxGain)    this.sfxGain.gain.value    = this.sfxVolume
    if (this.bgmGain)    this.bgmGain.gain.value    = this.bgmVolume
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  16-bit 合成器工具
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 弦乐合成：双去谐锯齿波 + 4极低通 + 颤音LFO + 慢速包络
   */
  private string(
    ctx: AudioContext, freq: number, startT: number, dur: number,
    vol: number, dest: AudioNode, vibratoDepth = 8,
  ): void {
    if (freq <= 0) return
    const osc1  = ctx.createOscillator()
    const osc2  = ctx.createOscillator()
    const flt   = ctx.createBiquadFilter()
    const gain  = ctx.createGain()
    const lfo   = ctx.createOscillator()
    const lfoG  = ctx.createGain()

    osc1.type = 'sawtooth'; osc1.frequency.value = freq
    osc2.type = 'sawtooth'; osc2.frequency.value = freq * 1.004  // +7 cents

    // 颤音
    lfo.type = 'sine'; lfo.frequency.value = 5.5
    lfoG.gain.value = vibratoDepth
    lfo.connect(lfoG)
    lfoG.connect(osc1.detune)
    lfoG.connect(osc2.detune)

    // 滤波 — 去除刺耳高频
    flt.type = 'lowpass'; flt.frequency.value = 2200; flt.Q.value = 0.7

    // 弦乐ADSR
    const atk = Math.min(dur * 0.12, 0.15)
    const rel = Math.min(dur * 0.2, 0.2)
    gain.gain.setValueAtTime(0.001, startT)
    gain.gain.linearRampToValueAtTime(vol, startT + atk)
    gain.gain.setValueAtTime(vol, startT + dur - rel)
    gain.gain.linearRampToValueAtTime(0.001, startT + dur)

    osc1.connect(flt); osc2.connect(flt)
    flt.connect(gain); gain.connect(dest)
    lfo.start(startT); osc1.start(startT); osc2.start(startT)
    lfo.stop(startT + dur + 0.1)
    osc1.stop(startT + dur + 0.1)
    osc2.stop(startT + dur + 0.1)
  }

  /**
   * 拨奏低音：正弦波 + 快速衰减 (大提琴拨弦感)
   */
  private pluck(
    ctx: AudioContext, freq: number, startT: number, dur: number,
    vol: number, dest: AudioNode,
  ): void {
    if (freq <= 0) return
    const osc  = ctx.createOscillator()
    const osc2 = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine';     osc.frequency.value  = freq
    osc2.type = 'triangle'; osc2.frequency.value = freq * 2  // 8va harmonic
    const g2 = ctx.createGain(); g2.gain.value = 0.15
    osc2.connect(g2); g2.connect(gain)

    gain.gain.setValueAtTime(vol, startT)
    gain.gain.exponentialRampToValueAtTime(vol * 0.3, startT + 0.08)
    gain.gain.exponentialRampToValueAtTime(0.001, startT + Math.min(dur, 0.6))

    osc.connect(gain); gain.connect(dest)
    osc.start(startT); osc2.start(startT)
    osc.stop(startT + Math.min(dur, 0.65))
    osc2.stop(startT + Math.min(dur, 0.65))
  }

  /**
   * 和弦铺底：三角波 + 慢攻击，模拟管风琴/合成弦乐
   */
  private pad(
    ctx: AudioContext, freq: number, startT: number, dur: number,
    vol: number, dest: AudioNode,
  ): void {
    if (freq <= 0) return
    const osc = ctx.createOscillator()
    const flt = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'triangle'; osc.frequency.value = freq
    flt.type = 'lowpass';  flt.frequency.value = 800; flt.Q.value = 0.5

    const atk = Math.min(dur * 0.3, 0.4)
    const rel = Math.min(dur * 0.4, 0.5)
    gain.gain.setValueAtTime(0.001, startT)
    gain.gain.linearRampToValueAtTime(vol, startT + atk)
    gain.gain.setValueAtTime(vol, startT + dur - rel)
    gain.gain.linearRampToValueAtTime(0.001, startT + dur)

    osc.connect(flt); flt.connect(gain); gain.connect(dest)
    osc.start(startT); osc.stop(startT + dur + 0.1)
  }

  // ─── 打击乐 (16-bit 三通道) ───────────────────────────────────────────────

  private kick(ctx: AudioContext, t: number, vol: number, dest: AudioNode): void {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(160, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.1)
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
    osc.connect(gain); gain.connect(dest)
    osc.start(t); osc.stop(t + 0.28)
    // 噪声冲击
    this.noiseBurst(ctx, t, 0.04, vol * 0.3, 200, dest)
  }

  private snare(ctx: AudioContext, t: number, vol: number, dest: AudioNode): void {
    // 音调部分
    const osc  = ctx.createOscillator()
    const og   = ctx.createGain()
    osc.type = 'triangle'; osc.frequency.setValueAtTime(250, t)
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.1)
    og.gain.setValueAtTime(vol * 0.5, t)
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.connect(og); og.connect(dest)
    osc.start(t); osc.stop(t + 0.18)
    // 噪声部分
    this.noiseBurst(ctx, t, 0.18, vol * 0.7, 3000, dest)
  }

  private hihat(ctx: AudioContext, t: number, vol: number, dest: AudioNode): void {
    const sr  = ctx.sampleRate
    const len = Math.floor(sr * 0.05)
    const buf = ctx.createBuffer(1, len, sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src  = ctx.createBufferSource()
    const flt  = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = buf
    flt.type = 'highpass'; flt.frequency.value = 8000
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    src.connect(flt); flt.connect(gain); gain.connect(dest)
    src.start(t)
  }

  private noiseBurst(
    ctx: AudioContext, t: number, dur: number, vol: number, tone: number, dest: AudioNode,
  ): void {
    const sr  = ctx.sampleRate
    const len = Math.max(1, Math.floor(sr * dur))
    const buf = ctx.createBuffer(1, len, sr)
    const d   = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len)
    const src  = ctx.createBufferSource()
    const flt  = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    src.buffer = buf
    flt.type = 'bandpass'; flt.frequency.value = tone; flt.Q.value = 1.2
    gain.gain.setValueAtTime(vol, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
    src.connect(flt); flt.connect(gain); gain.connect(dest)
    src.start(t)
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  BGM 调度器
  // ═══════════════════════════════════════════════════════════════════════

  playBGM(track: BGMTrack): void {
    if (this.currentBGM === track) return
    this.stopBGM()
    this.currentBGM = track
    if (track === 'none' || track === 'gameover') return
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const pattern = track === 'title' ? BGM_TITLE : track === 'boss' ? BGM_BOSS : BGM_GAMEPLAY
    this.bgmLoopTime = ctx.currentTime + 0.15
    this.scheduleBGM(ctx, pattern)
  }

  private scheduleBGM(ctx: AudioContext, pat: BGMPattern): void {
    if (!this.bgmEnabled || this.currentBGM === 'none') return
    const beat  = 60 / pat.bpm
    const dest  = this.bgmGain!

    // 计算各轨时长
    const scheduleTrack = (
      notes: Note[],
      synth: (ctx: AudioContext, f: number, t: number, d: number, v: number, dest: AudioNode) => void,
      vol: number,
    ) => {
      let t = this.bgmLoopTime
      for (const n of notes) {
        const dur = n.dur * beat
        synth.call(this, ctx, n.freq, t, dur * 0.9, (n.vol ?? 1) * vol, dest)
        t += dur
      }
      return t - this.bgmLoopTime
    }

    const d1 = scheduleTrack(pat.melody,  this.string, 0.22)
    const d2 = scheduleTrack(pat.counter, this.string, 0.14)
    const d3 = scheduleTrack(pat.bass,    this.pluck,  0.30)
    const d4 = scheduleTrack(pat.chord,   this.pad,    0.10)
    const loopDur = Math.max(d1, d2, d3, d4)

    // 打击乐：16分音符网格
    const sixteenth = beat * 0.25
    pat.drumGrid.forEach((hit, i) => {
      const t = this.bgmLoopTime + i * sixteenth
      if (hit === 1 || hit === 4) this.kick(ctx,  t, 0.5, dest)
      if (hit === 2 || hit === 4) this.snare(ctx, t, 0.4, dest)
      if (hit === 3 || hit === 4) this.hihat(ctx, t, 0.15, dest)
    })

    this.bgmLoopTime += loopDur

    const delay = Math.max(0, (this.bgmLoopTime - ctx.currentTime - 0.2) * 1000)
    this.bgmScheduleId = setTimeout(() => {
      if (this.currentBGM !== 'none') this.scheduleBGM(ctx, pat)
    }, delay)
  }

  stopBGM(): void {
    if (this.bgmScheduleId) { clearTimeout(this.bgmScheduleId); this.bgmScheduleId = null }
    this.currentBGM = 'none'
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  SFX 合成
  // ═══════════════════════════════════════════════════════════════════════

  playSFX(type: SFXType): void {
    if (!this.enabled) return
    const ctx = this.getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const d = this.sfxGain!
    const t = ctx.currentTime

    switch (type) {
      case 'shot_fire':       this.sfxShot(ctx, t, d);         break
      case 'spread_fire':     this.sfxSpread(ctx, t, d);       break
      case 'laser_start':     this.sfxLaser(ctx, t, d);        break
      case 'enemy_hit':       this.sfxEnemyHit(ctx, t, d);     break
      case 'enemy_destroy':   this.sfxExplosion(ctx, t, 0.8, d); break
      case 'boss_destroy':    this.sfxBossKill(ctx, t, d);     break
      case 'player_hit':      this.sfxPlayerHit(ctx, t, d);    break
      case 'player_death':    this.sfxPlayerDeath(ctx, t, d);  break
      case 'powerup_collect': this.sfxPickup(ctx, t, d);       break
      case 'extra_life':      this.sfxExtraLife(ctx, t, d);    break
      case 'graze':           this.sfxGraze(ctx, t, d);        break
      case 'bomb_use':        this.sfxBomb(ctx, t, d);         break
      case 'spin_start':      this.sfxSpinStart(ctx, t, d);    break
      case 'spin_land':       this.sfxSpinLand(ctx, t, d);     break
      case 'warning_alarm':   this.sfxWarning(ctx, t, d);      break
      case 'boss_phase_change': this.sfxPhase(ctx, t, d);      break
      case 'menu_select':     this.sfxMenuSel(ctx, t, d);      break
      case 'menu_confirm':    this.sfxMenuOk(ctx, t, d);       break
      case 'game_over':       this.sfxGameOver(ctx, t, d);     break
    }
  }

  // ─── SFX 实现 ─────────────────────────────────────────────────────────────

  private sfxShot(ctx: AudioContext, t: number, d: AudioNode): void {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(900, t)
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.07)
    gain.gain.setValueAtTime(0.10, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.08)
  }

  private sfxSpread(ctx: AudioContext, t: number, d: AudioNode): void {
    for (let i = 0; i < 3; i++) {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.setValueAtTime(700 + i * 100, t + i * 0.012)
      osc.frequency.exponentialRampToValueAtTime(200, t + 0.1 + i * 0.012)
      gain.gain.setValueAtTime(0.07, t + i * 0.012)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
      osc.connect(gain); gain.connect(d)
      osc.start(t + i * 0.012); osc.stop(t + 0.12)
    }
  }

  private sfxLaser(ctx: AudioContext, t: number, d: AudioNode): void {
    const osc  = ctx.createOscillator()
    const flt  = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(1600, t)
    osc.frequency.linearRampToValueAtTime(1800, t + 0.03)
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.12)
    flt.type = 'lowpass'; flt.frequency.value = 3000
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
    osc.connect(flt); flt.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.13)
  }

  private sfxEnemyHit(ctx: AudioContext, t: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 0.06, 0.25, 800, d)
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'; osc.frequency.value = 600
    gain.gain.setValueAtTime(0.12, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.06)
  }

  private sfxExplosion(ctx: AudioContext, t: number, scale: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 0.4 * scale, 0.55, 120, d)
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(80, t)
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.3 * scale)
    gain.gain.setValueAtTime(0.45 * scale, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * scale)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.4 * scale)
  }

  private sfxBossKill(ctx: AudioContext, t: number, d: AudioNode): void {
    for (let i = 0; i < 5; i++) {
      this.noiseBurst(ctx, t + i * 0.12, 0.5, 0.7, 80 + i * 40, d)
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'; osc.frequency.value = 50 + i * 15
      gain.gain.setValueAtTime(0.5, t + i * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.12 + 0.4)
      osc.connect(gain); gain.connect(d)
      osc.start(t + i * 0.12); osc.stop(t + i * 0.12 + 0.45)
    }
    // 尾音上升
    const freqs = [N.A4, N.D5, N.A5, N.D6]
    freqs.forEach((f, i) => this.string(ctx, f, t + 0.6 + i * 0.2, 0.35, 0.3, d, 0))
  }

  private sfxPlayerHit(ctx: AudioContext, t: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 0.3, 0.5, 100, d)
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(300, t)
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.3)
    gain.gain.setValueAtTime(0.35, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.32)
  }

  private sfxPlayerDeath(ctx: AudioContext, t: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 0.6, 0.6, 90, d)
    const mel = [N.A4, N.G4, N.F4, N.Eb4, N.D4, N.C4, N.Bb3, N.A3]
    mel.forEach((f, i) => this.string(ctx, f, t + i * 0.1, 0.15, 0.2, d, 0))
  }

  private sfxPickup(ctx: AudioContext, t: number, d: AudioNode): void {
    const mel = [N.D5, N.F5, N.A5, N.D6]
    mel.forEach((f, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = f
      gain.gain.setValueAtTime(0.25, t + i * 0.05)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.1)
      osc.connect(gain); gain.connect(d)
      osc.start(t + i * 0.05); osc.stop(t + i * 0.05 + 0.12)
    })
  }

  private sfxExtraLife(ctx: AudioContext, t: number, d: AudioNode): void {
    const mel = [N.D5, N.F5, N.A5, N.F5, N.D6, N.A5, N.D6]
    mel.forEach((f, i) => this.string(ctx, f, t + i * 0.07, 0.12, 0.25, d, 4))
    this.pluck(ctx, N.D3, t, 0.3, 0.3, d)
  }

  private sfxGraze(ctx: AudioContext, t: number, d: AudioNode): void {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(3000, t)
    osc.frequency.exponentialRampToValueAtTime(4500, t + 0.04)
    gain.gain.setValueAtTime(0.06, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.05)
  }

  private sfxBomb(ctx: AudioContext, t: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 1.0, 0.75, 60, d)
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(80, t)
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.7)
    gain.gain.setValueAtTime(0.6, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.85)
    // 频率扫过
    const sw  = ctx.createOscillator()
    const swg = ctx.createGain()
    sw.type = 'sawtooth'
    sw.frequency.setValueAtTime(60, t); sw.frequency.exponentialRampToValueAtTime(5000, t + 0.7)
    swg.gain.setValueAtTime(0.2, t); swg.gain.exponentialRampToValueAtTime(0.001, t + 0.7)
    sw.connect(swg); swg.connect(d)
    sw.start(t); sw.stop(t + 0.75)
  }

  private sfxSpinStart(ctx: AudioContext, t: number, d: AudioNode): void {
    const osc  = ctx.createOscillator()
    const flt  = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.6)
    flt.type = 'lowpass'; flt.frequency.value = 3000
    gain.gain.setValueAtTime(0.3, t); gain.gain.linearRampToValueAtTime(0.08, t + 0.6)
    osc.connect(flt); flt.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.65)
  }

  private sfxSpinLand(ctx: AudioContext, t: number, d: AudioNode): void {
    this.noiseBurst(ctx, t, 0.35, 0.5, 200, d)
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(400, t)
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.3)
    gain.gain.setValueAtTime(0.5, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.35)
  }

  private sfxWarning(ctx: AudioContext, t: number, d: AudioNode): void {
    this.string(ctx, N.A5, t,        0.15, 0.45, d, 0)
    this.string(ctx, N.A5, t + 0.22, 0.15, 0.45, d, 0)
    this.string(ctx, N.E6, t + 0.44, 0.30, 0.55, d, 2)
  }

  private sfxPhase(ctx: AudioContext, t: number, d: AudioNode): void {
    const mel = [N.D5, N.C5, N.Bb4, N.A4, N.Ab4]
    mel.forEach((f, i) => this.string(ctx, f, t + i * 0.07, 0.1, 0.3, d, 0))
    this.noiseBurst(ctx, t, 0.4, 0.4, 150, d)
  }

  private sfxMenuSel(ctx: AudioContext, t: number, d: AudioNode): void {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'; osc.frequency.value = N.D5
    gain.gain.setValueAtTime(0.2, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    osc.connect(gain); gain.connect(d)
    osc.start(t); osc.stop(t + 0.07)
  }

  private sfxMenuOk(ctx: AudioContext, t: number, d: AudioNode): void {
    const mel = [N.D5, N.F5, N.A5]
    mel.forEach((f, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'; osc.frequency.value = f
      gain.gain.setValueAtTime(0.25, t + i * 0.07)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.12)
      osc.connect(gain); gain.connect(d)
      osc.start(t + i * 0.07); osc.stop(t + i * 0.07 + 0.13)
    })
  }

  private sfxGameOver(ctx: AudioContext, t: number, d: AudioNode): void {
    const mel = [N.A4, N.Ab4, N.G4, N.Gb4, N.F4, N._,   N.D4, N._,   N.A3]
    mel.forEach((f, i) => {
      if (f > 0) this.string(ctx, f, t + i * 0.2, 0.22, 0.32, d, 2)
    })
    this.pluck(ctx, N.D2, t + 0.4, 0.5, 0.4, d)
    this.pluck(ctx, N.A2, t + 1.0, 0.5, 0.3, d)
  }

  // ─── WARNING 循环 ─────────────────────────────────────────────────────────

  startWarningAlarm(): void {
    if (this.warningInterval) return
    this.playSFX('warning_alarm')
    this.warningInterval = setInterval(() => this.playSFX('warning_alarm'), 900)
  }

  stopWarningAlarm(): void {
    if (this.warningInterval) { clearInterval(this.warningInterval); this.warningInterval = null }
  }

  // ─── 控制 API ─────────────────────────────────────────────────────────────

  setEnabled(enabled: boolean): void    { this.enabled = enabled }
  setBGMEnabled(enabled: boolean): void { this.bgmEnabled = enabled; if (!enabled) this.stopBGM() }

  setVolumes(master: number, sfx: number, bgm: number): void {
    this.masterVolume = master; this.sfxVolume = sfx; this.bgmVolume = bgm
    this.applyVolumes()
  }

  dispose(): void {
    this.stopBGM()
    this.stopWarningAlarm()
    this.ctx?.close()
    this.ctx = null
  }
}

export const audioManager = new AudioManager()
