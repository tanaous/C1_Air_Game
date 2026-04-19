import * as THREE from 'three'
import { SCENE } from '@/game/GameConfig'
import { viewCameraOffset } from '@/utils/math'

export class MultiViewCamera {
  private offsets: number[]

  constructor(
    private focalDist: number = SCENE.FOCAL_PLANE,
    private totalAngleDeg: number = SCENE.TOTAL_ANGLE,
    private viewCount: number = 40,
  ) {
    this.offsets = Array.from({ length: viewCount }, (_, i) =>
      viewCameraOffset(i, focalDist, totalAngleDeg),
    )
  }

  getOffset(viewIndex: number): number {
    return this.offsets[viewIndex] ?? 0
  }

  /** Apply offset to camera for view i, returns original X for restoration */
  applyToCamera(camera: THREE.PerspectiveCamera, viewIndex: number): number {
    const origX = camera.position.x
    camera.position.x = origX + this.offsets[viewIndex]
    camera.updateMatrixWorld()
    return origX
  }
}
