import * as THREE from 'three'
import { DEPTH_LAYERS } from '@/game/GameConfig'

/** Assigns Z position to objects based on named depth layers */
export class DepthLayerManager {
  setLayer(object: THREE.Object3D, layer: keyof typeof DEPTH_LAYERS): void {
    object.position.z = DEPTH_LAYERS[layer]
  }

  setDepth(object: THREE.Object3D, depthCm: number): void {
    object.position.z = depthCm
  }
}
