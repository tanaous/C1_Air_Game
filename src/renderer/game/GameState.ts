export type GameStateType = 'title' | 'playing' | 'paused' | 'boss' | 'gameover'

type Listener = (from: GameStateType, to: GameStateType) => void

export class GameState {
  private current: GameStateType = 'title'
  private listeners: Listener[] = []

  get(): GameStateType { return this.current }
  is(state: GameStateType): boolean { return this.current === state }

  transition(to: GameStateType): void {
    const from = this.current
    if (from === to) return
    this.current = to
    for (const fn of this.listeners) fn(from, to)
  }

  onChange(fn: Listener): void { this.listeners.push(fn) }
}
