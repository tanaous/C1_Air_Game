import * as THREE from 'three'
import type { InputManager } from '@/game/systems/InputManager'
import { audioManager } from '@/game/audio/AudioManager'

/** Title screen — rotating background + press Z to start */
export class TitleScene {
  readonly scene: THREE.Scene

  private cubes:    THREE.Mesh[] = []
  private titleMesh: THREE.Group

  constructor() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000820)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)
    const dir = new THREE.DirectionalLight(0x88aaff, 2)
    dir.position.set(50, 100, 300)
    this.scene.add(dir)
    const hemi = new THREE.HemisphereLight(0x6666ff, 0x222244, 0.5)
    this.scene.add(hemi)

    // Floating background cubes
    for (let i = 0; i < 30; i++) {
      const size = 4 + Math.random() * 12
      const geo  = new THREE.BoxGeometry(size, size, size)
      const mat  = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.4),
        specular: 0x4488ff, shininess: 60,
      })
      const cube = new THREE.Mesh(geo, mat)
      cube.position.set(
        (Math.random() - 0.5) * 180,
        (Math.random() - 0.5) * 320,
        -20 - Math.random() * 30,
      )
      cube.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      this.scene.add(cube)
      this.cubes.push(cube)
    }

    this.titleMesh = buildTitleText()
    this.scene.add(this.titleMesh)

    audioManager.playBGM('title')
  }

  update(dt: number, input: InputManager): boolean {
    // Rotate background cubes
    for (const cube of this.cubes) {
      cube.rotation.x += dt * 0.3
      cube.rotation.y += dt * 0.5
    }

    // Pulse title
    const t = performance.now() / 1000
    this.titleMesh.scale.setScalar(1 + Math.sin(t * 2) * 0.03)

    // Return true = start game
    const start = input.isJustPressed('confirm')
    if (start) audioManager.playSFX('menu_confirm')
    return start
  }
}

function buildTitleText(): THREE.Group {
  const group = new THREE.Group()

  // "C1战机" title mesh
  const letterMat = new THREE.MeshPhongMaterial({
    color: 0x00ccff, emissive: 0x0066ff, emissiveIntensity: 1.5,
    specular: 0xffffff, shininess: 100,
  })

  // Main title bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(140, 14, 4), letterMat)
  bar.position.set(0, 30, 0)
  group.add(bar)

  // Sub bar
  const subMat = new THREE.MeshPhongMaterial({
    color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 1,
  })
  const sub = new THREE.Mesh(new THREE.BoxGeometry(100, 6, 3), subMat)
  sub.position.set(0, 10, 0)
  group.add(sub)

  // "PRESS Z" indicator
  const pressMat = new THREE.MeshPhongMaterial({
    color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5,
  })
  const press = new THREE.Mesh(new THREE.BoxGeometry(60, 5, 2), pressMat)
  press.position.set(0, -20, 0)
  group.add(press)

  group.position.set(0, 40, 2)
  return group
}
