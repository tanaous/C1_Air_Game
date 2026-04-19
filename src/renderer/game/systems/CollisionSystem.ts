import { distance2D } from '@/utils/math'
import type { Player } from '@/game/entities/Player'
import type { Enemy }  from '@/game/entities/Enemy'
import type { Bullet } from '@/game/entities/Bullet'
import type { Boss }   from '@/game/entities/Boss'
import type { PowerUp } from '@/game/entities/PowerUp'

export interface CollisionResult {
  playerHit:        boolean
  killedEnemies:    Enemy[]
  grazeCount:       number
  bossHit:          boolean
  bossKilled:       boolean
  collectedPowerUps:PowerUp[]
}

export class CollisionSystem {
  check(
    player: Player,
    enemies: Enemy[],
    playerBullets: Bullet[],
    enemyBullets: Bullet[],
    powerUps: PowerUp[],
    boss: Boss | null,
  ): CollisionResult {
    const result: CollisionResult = {
      playerHit: false, killedEnemies: [], grazeCount: 0,
      bossHit: false, bossKilled: false, collectedPowerUps: [],
    }

    const px = player.position.x, py = player.position.y

    // Player bullets vs enemies
    for (const bullet of playerBullets) {
      if (!bullet.active) continue
      for (const enemy of enemies) {
        if (!enemy.active) continue
        if (distance2D(bullet.position.x, bullet.position.y, enemy.position.x, enemy.position.y) < bullet.hitboxRadius + enemy.hitboxRadius) {
          bullet.destroy()
          if (enemy.takeDamage(bullet.damage)) result.killedEnemies.push(enemy)
          break
        }
      }
    }

    // Player bullets vs boss
    if (boss && boss.active) {
      for (const bullet of playerBullets) {
        if (!bullet.active) continue
        if (distance2D(bullet.position.x, bullet.position.y, boss.position.x, boss.position.y) < bullet.hitboxRadius + boss.hitboxRadius) {
          bullet.destroy()
          result.bossHit = true
          if (boss.takeDamage(bullet.damage)) result.bossKilled = true
        }
      }
    }

    // Enemy bullets vs player
    for (const bullet of enemyBullets) {
      if (!bullet.active) continue
      const d = distance2D(bullet.position.x, bullet.position.y, px, py)
      if (d < bullet.hitboxRadius + player.hitboxRadius) {
        bullet.destroy()
        if (player.hit()) result.playerHit = true
      } else if (d < player.grazeRadius) {
        result.grazeCount++
      }
    }

    // Enemy body vs player
    for (const enemy of enemies) {
      if (!enemy.active) continue
      if (distance2D(enemy.position.x, enemy.position.y, px, py) < enemy.hitboxRadius + player.hitboxRadius) {
        if (player.hit()) result.playerHit = true
      }
    }

    // Player vs power-ups
    for (const p of powerUps) {
      if (!p.active) continue
      if (distance2D(p.position.x, p.position.y, px, py) < p.hitboxRadius + player.hitboxRadius + 10) {
        p.destroy()
        result.collectedPowerUps.push(p)
      }
    }

    return result
  }
}
