/** 计分系统 — 杀敌 + 道具 + 擦弹 + Combo */
export class ScoreSystem {
  score      = 0
  multiplier = 1.0
  grazeCount = 0
  killCombo  = 0
  comboTimer = 0

  update(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt
      if (this.comboTimer <= 0) {
        this.killCombo  = 0
        this.multiplier = 1.0
      }
    }
  }

  onEnemyKilled(scoreValue: number): void {
    this.score += Math.floor(scoreValue * this.multiplier)
    this.killCombo++
    this.comboTimer = 2.0
    if (this.killCombo % 10 === 0) this.multiplier += 0.1
  }

  onGraze(): void {
    this.grazeCount++
    this.score += Math.floor(50 * this.multiplier)
  }

  onPowerUp(value: number): void {
    this.score += Math.floor(value * this.multiplier)
  }

  onBossKilled(scoreValue: number, fightDuration: number): void {
    const timeBonus = Math.max(0, 30 - fightDuration) * 1000
    this.score += scoreValue + Math.floor(timeBonus)
  }
}
