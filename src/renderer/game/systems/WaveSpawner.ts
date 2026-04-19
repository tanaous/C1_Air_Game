/**
 * WaveSpawner — 基于卷轴距离触发敌机波次
 * 支持编队模式和难度递增
 */

import * as THREE from 'three'
import { Enemy, type EnemyType } from '@/game/entities/Enemy'
import { SCENE } from '@/game/GameConfig'
import { randomRange, randomPick, chance } from '@/utils/math'

const SMALL: EnemyType[]  = ['scout', 'fighter', 'swooper']
const MEDIUM: EnemyType[] = ['gunship', 'bomber', 'carrier']

type Formation = 'random' | 'v_shape' | 'line' | 'circle' | 'pincer'

export class WaveSpawner {
  private timer = 2.0
  private waveNum = 0

  update(dt: number, distance: number, scene: THREE.Scene, enemies: Enemy[]): void {
    this.timer -= dt
    if (this.timer > 0) return

    // 难度曲线 — 指数增长，不是线性
    const t = Math.min(distance / 20000, 1)
    const diff = t * t  // quadratic ramp

    this.timer = Math.max(0.35, 1.4 - diff * 1.1)
    this.waveNum++

    const count = Math.floor(2 + diff * 6)
    const mediumChance = Math.min(diff * 0.6, 0.5)
    const formationChance = Math.min(diff * 0.8, 0.6)

    const formation: Formation = chance(formationChance)
      ? randomPick(['v_shape', 'line', 'circle', 'pincer'] as Formation[])
      : 'random'

    const types: EnemyType[] = []
    for (let i = 0; i < count; i++) {
      types.push(chance(mediumChance) ? randomPick(MEDIUM) : randomPick(SMALL))
    }

    const positions = this.getFormationPositions(formation, count)
    for (let i = 0; i < count; i++) {
      const [x, yOff] = positions[i]
      enemies.push(new Enemy(scene, types[i], x, SCENE.HEIGHT / 2 + 25 + yOff))
    }
  }

  private getFormationPositions(formation: Formation, count: number): [number, number][] {
    const halfW = SCENE.WIDTH / 2 - 20
    const out: [number, number][] = []

    switch (formation) {
      case 'v_shape':
        for (let i = 0; i < count; i++) {
          const side = i % 2 === 0 ? 1 : -1
          const row = Math.floor(i / 2)
          out.push([side * (row + 1) * 18, row * 20])
        }
        break
      case 'line':
        for (let i = 0; i < count; i++) {
          out.push([(i - (count - 1) / 2) * 22, 0])
        }
        break
      case 'circle': {
        const r = 35
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2
          out.push([Math.cos(a) * r, Math.sin(a) * r + r])
        }
        break
      }
      case 'pincer':
        for (let i = 0; i < count; i++) {
          const side = i < count / 2 ? -1 : 1
          out.push([side * halfW * 0.7 + randomRange(-10, 10), (i % Math.ceil(count / 2)) * 15])
        }
        break
      default:
        for (let i = 0; i < count; i++) {
          out.push([randomRange(-halfW, halfW), i * 12])
        }
    }
    return out
  }
}
