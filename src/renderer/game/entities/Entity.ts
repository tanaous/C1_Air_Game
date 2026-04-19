import * as THREE from 'three'

/** Base class for all game entities */
export class Entity {
  position: THREE.Vector3 = new THREE.Vector3()
  velocity: THREE.Vector3 = new THREE.Vector3()
  active:   boolean       = true
  mesh:     THREE.Object3D | null = null

  hitboxRadius: number = 10

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  update(..._args: any[]): void {}

  syncMesh(): void {
    if (this.mesh) {
      this.mesh.position.copy(this.position)
    }
  }

  destroy(): void {
    this.active = false
  }
}
