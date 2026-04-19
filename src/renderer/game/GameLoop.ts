/** Fixed-timestep game loop (60 FPS logic, uncapped render) */
export class GameLoop {
  private running:     boolean = false
  private lastTime:    number  = 0
  private accumulator: number  = 0
  private readonly fixedDt = 1000 / 60   // ms

  private rafId: number = 0

  constructor(
    private onUpdate: (dt: number) => void,
    private onRender: (alpha: number) => void,
  ) {}

  start(): void {
    this.running     = true
    this.lastTime    = performance.now()
    this.accumulator = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  private tick = (now: number): void => {
    if (!this.running) return

    const frameTime = Math.min(now - this.lastTime, 100)  // cap at 100ms to avoid spiral
    this.lastTime    = now
    this.accumulator += frameTime

    while (this.accumulator >= this.fixedDt) {
      this.onUpdate(this.fixedDt / 1000)
      this.accumulator -= this.fixedDt
    }

    this.onRender(this.accumulator / this.fixedDt)
    this.rafId = requestAnimationFrame(this.tick)
  }
}
