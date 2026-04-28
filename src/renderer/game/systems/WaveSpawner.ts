import * as THREE from 'three'
import { Enemy, type EnemyType } from '@/game/entities/Enemy'
import { SCENE } from '@/game/GameConfig'
import { randomRange, randomPick, chance } from '@/utils/math'

const SMALL: EnemyType[] = ['scout', 'fighter', 'swooper']
const MEDIUM: EnemyType[] = ['gunship', 'bomber', 'carrier']

type Formation = 'random' | 'v_shape' | 'line' | 'circle' | 'pincer'

interface StageWaveProfile {
  small: EnemyType[]
  medium: EnemyType[]
  formations: Array<[Formation, number]>
  baseInterval: number
  minInterval: number
  baseCount: number
  maxCount: number
  mediumChance: number
  edgePressure: number
  staggerY: number
}

const STAGE_WAVE_PROFILES: StageWaveProfile[] = [
  {
    small: ['scout', 'fighter'],
    medium: ['gunship'],
    formations: [['random', 4], ['line', 3], ['v_shape', 2]],
    baseInterval: 1.45,
    minInterval: 0.58,
    baseCount: 2,
    maxCount: 5,
    mediumChance: 0.08,
    edgePressure: 0.12,
    staggerY: 12,
  },
  {
    small: ['scout', 'swooper', 'fighter'],
    medium: ['bomber', 'gunship'],
    formations: [['pincer', 4], ['v_shape', 3], ['random', 2], ['line', 1]],
    baseInterval: 1.34,
    minInterval: 0.52,
    baseCount: 3,
    maxCount: 6,
    mediumChance: 0.14,
    edgePressure: 0.35,
    staggerY: 15,
  },
  {
    small: ['fighter', 'scout'],
    medium: ['carrier', 'gunship'],
    formations: [['circle', 3], ['line', 3], ['random', 2], ['v_shape', 2]],
    baseInterval: 1.28,
    minInterval: 0.48,
    baseCount: 3,
    maxCount: 7,
    mediumChance: 0.18,
    edgePressure: 0.18,
    staggerY: 13,
  },
  {
    small: ['swooper', 'fighter', 'scout'],
    medium: ['bomber', 'gunship'],
    formations: [['pincer', 3], ['circle', 3], ['v_shape', 2], ['random', 1]],
    baseInterval: 1.2,
    minInterval: 0.44,
    baseCount: 4,
    maxCount: 8,
    mediumChance: 0.24,
    edgePressure: 0.3,
    staggerY: 16,
  },
  {
    small: ['fighter', 'swooper'],
    medium: ['gunship', 'carrier', 'bomber'],
    formations: [['line', 3], ['pincer', 3], ['v_shape', 2], ['circle', 2]],
    baseInterval: 1.14,
    minInterval: 0.42,
    baseCount: 4,
    maxCount: 8,
    mediumChance: 0.28,
    edgePressure: 0.24,
    staggerY: 14,
  },
  {
    small: ['scout', 'swooper', 'fighter'],
    medium: ['carrier', 'gunship'],
    formations: [['circle', 4], ['random', 2], ['line', 2], ['pincer', 2]],
    baseInterval: 1.08,
    minInterval: 0.4,
    baseCount: 4,
    maxCount: 9,
    mediumChance: 0.32,
    edgePressure: 0.2,
    staggerY: 12,
  },
  {
    small: ['swooper', 'fighter'],
    medium: ['carrier', 'bomber'],
    formations: [['circle', 4], ['pincer', 3], ['v_shape', 2], ['random', 1]],
    baseInterval: 1.0,
    minInterval: 0.38,
    baseCount: 5,
    maxCount: 9,
    mediumChance: 0.36,
    edgePressure: 0.28,
    staggerY: 15,
  },
  {
    small: ['fighter', 'swooper', 'scout'],
    medium: ['bomber', 'carrier', 'gunship'],
    formations: [['pincer', 4], ['line', 3], ['circle', 2], ['random', 1]],
    baseInterval: 0.95,
    minInterval: 0.36,
    baseCount: 5,
    maxCount: 10,
    mediumChance: 0.4,
    edgePressure: 0.38,
    staggerY: 16,
  },
  {
    small: ['swooper', 'fighter'],
    medium: ['carrier', 'bomber', 'gunship'],
    formations: [['circle', 4], ['pincer', 3], ['line', 2], ['v_shape', 1]],
    baseInterval: 0.9,
    minInterval: 0.34,
    baseCount: 6,
    maxCount: 10,
    mediumChance: 0.46,
    edgePressure: 0.32,
    staggerY: 15,
  },
  {
    small: ['fighter', 'swooper', 'scout'],
    medium: ['carrier', 'bomber', 'gunship'],
    formations: [['pincer', 3], ['circle', 3], ['line', 2], ['v_shape', 2]],
    baseInterval: 0.84,
    minInterval: 0.32,
    baseCount: 6,
    maxCount: 11,
    mediumChance: 0.52,
    edgePressure: 0.34,
    staggerY: 16,
  },
]

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function stageProfile(stageIndex: number): StageWaveProfile {
  const index = Math.max(0, Math.min(STAGE_WAVE_PROFILES.length - 1, Math.floor(stageIndex)))
  return STAGE_WAVE_PROFILES[index]
}

function weightedFormation(entries: Array<[Formation, number]>): Formation {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (total <= 0) return 'random'

  let roll = Math.random() * total
  for (const [formation, weight] of entries) {
    roll -= Math.max(0, weight)
    if (roll <= 0) return formation
  }
  return entries[entries.length - 1]?.[0] ?? 'random'
}

export class WaveSpawner {
  private timer = 2.0
  private waveNum = 0

  resetForStage(delay = 1.4): void {
    this.timer = Math.max(0.2, delay)
  }

  update(dt: number, distance: number, stageIndex: number, scene: THREE.Scene, enemies: Enemy[], maxEnemies = Number.POSITIVE_INFINITY): void {
    this.timer -= dt
    if (this.timer > 0) return
    if (enemies.length >= maxEnemies) return

    const profile = stageProfile(stageIndex)
    const globalT = clamp01(distance / 24000)
    const stageT = clamp01(stageIndex / Math.max(1, STAGE_WAVE_PROFILES.length - 1))
    const diff = clamp01(stageT * 0.68 + globalT * 0.32)

    this.timer = Math.max(profile.minInterval, profile.baseInterval - diff * 0.72)
    this.waveNum++

    const countRange = Math.max(0, profile.maxCount - profile.baseCount)
    const countJitter = chance(0.5) ? 1 : 0
    const count = Math.min(
      profile.maxCount,
      Math.max(0, Math.floor(maxEnemies - enemies.length)),
      Math.max(1, Math.floor(profile.baseCount + countRange * diff + countJitter)),
    )
    if (count <= 0) return
    const mediumChance = clamp01(profile.mediumChance + diff * 0.24)

    const formation = weightedFormation(profile.formations)
    const smallPool = profile.small.length ? profile.small : SMALL
    const mediumPool = profile.medium.length ? profile.medium : MEDIUM

    const types: EnemyType[] = []
    for (let i = 0; i < count; i++) {
      types.push(chance(mediumChance) ? randomPick(mediumPool) : randomPick(smallPool))
    }

    const positions = this.getFormationPositions(formation, count, profile.edgePressure, profile.staggerY)
    for (let i = 0; i < count; i++) {
      const [x, yOff] = positions[i]
      enemies.push(new Enemy(scene, types[i], x, SCENE.HEIGHT / 2 + 25 + yOff))
    }
  }

  private getFormationPositions(
    formation: Formation,
    count: number,
    edgePressure: number,
    staggerY: number,
  ): [number, number][] {
    const halfW = SCENE.WIDTH / 2 - 20
    const out: [number, number][] = []
    const push = (x: number, y: number) => {
      out.push([THREE.MathUtils.clamp(x, -halfW, halfW), y])
    }

    switch (formation) {
      case 'v_shape':
        for (let i = 0; i < count; i++) {
          const side = i % 2 === 0 ? 1 : -1
          const row = Math.floor(i / 2)
          push(side * (row + 1) * 18, row * (staggerY + 7))
        }
        break
      case 'line':
        for (let i = 0; i < count; i++) {
          push((i - (count - 1) / 2) * 22, 0)
        }
        break
      case 'circle': {
        const r = 35
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2
          push(Math.cos(a) * r, Math.sin(a) * r + r)
        }
        break
      }
      case 'pincer':
        for (let i = 0; i < count; i++) {
          const side = i < count / 2 ? -1 : 1
          push(
            side * halfW * (0.56 + edgePressure * 0.24) + randomRange(-10, 10),
            (i % Math.ceil(count / 2)) * staggerY,
          )
        }
        break
      default:
        for (let i = 0; i < count; i++) {
          const side = chance(0.5) ? -1 : 1
          const x = chance(edgePressure)
            ? side * randomRange(halfW * 0.55, halfW)
            : randomRange(-halfW, halfW)
          push(x, i * staggerY)
        }
    }

    return out
  }
}
