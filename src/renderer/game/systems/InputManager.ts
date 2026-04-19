/** Keyboard input manager — tracks held keys and just-pressed events */
export class InputManager {
  private held    = new Set<string>()
  private pressed = new Set<string>()  // cleared each frame

  private readonly keyMap = {
    moveUp:     ['ArrowUp',    'KeyW'],
    moveDown:   ['ArrowDown',  'KeyS'],
    moveLeft:   ['ArrowLeft',  'KeyA'],
    moveRight:  ['ArrowRight', 'KeyD'],
    fire:       ['KeyZ'],
    bomb:       ['KeyX'],
    focus:      ['ShiftLeft', 'ShiftRight'],
    weaponNext: ['KeyC'],
    pause:      ['Escape'],
    confirm:    ['KeyZ', 'Enter'],
  } as const

  constructor() {
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup',   this.onKeyUp)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.held.has(e.code)) {
      this.pressed.add(e.code)
    }
    this.held.add(e.code)
    e.preventDefault()
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.held.delete(e.code)
  }

  isHeld(action: keyof typeof this.keyMap): boolean {
    return this.keyMap[action].some(k => this.held.has(k))
  }

  isJustPressed(action: keyof typeof this.keyMap): boolean {
    return this.keyMap[action].some(k => this.pressed.has(k))
  }

  /** Call at end of each logic frame to clear just-pressed state */
  flush(): void {
    this.pressed.clear()
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup',   this.onKeyUp)
  }
}
