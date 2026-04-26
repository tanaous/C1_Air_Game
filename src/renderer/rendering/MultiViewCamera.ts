import * as THREE from 'three'
import { SCENE } from '@/game/GameConfig'
import { viewCameraOffset } from '@/utils/math'

export class MultiViewCamera {
  private offsets: number[]
  private _parallaxBoost: number

  constructor(
    private focalDist: number = SCENE.FOCAL_PLANE,
    private totalAngleDeg: number = SCENE.TOTAL_ANGLE,
    private viewCount: number = 40,
    parallaxBoost: number = SCENE.PARALLAX_BOOST,
  ) {
    this._parallaxBoost = parallaxBoost
    this.offsets = this.computeOffsets()
  }

  get parallaxBoost(): number { return this._parallaxBoost }

  setParallaxBoost(value: number): void {
    this._parallaxBoost = THREE.MathUtils.clamp(value, 0, 2)
    this.offsets = this.computeOffsets()
  }

  private computeOffsets(): number[] {
    return Array.from({ length: this.viewCount }, (_, i) =>
      viewCameraOffset(i, this.focalDist, this.totalAngleDeg, this.viewCount, this._parallaxBoost),
    )
  }

  getOffset(viewIndex: number): number {
    return this.offsets[viewIndex] ?? 0
  }

  applyOffAxisProjection(
    camera: THREE.PerspectiveCamera,
    viewOffset: number,
    baseFilmOffset: number,
  ): void {
    camera.filmOffset = baseFilmOffset - (viewOffset * camera.getFilmWidth()) / this.focalDist
    camera.updateProjectionMatrix()
  }

  resetProjection(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, filmOffset: number = 0): void {
    if (camera instanceof THREE.PerspectiveCamera) camera.filmOffset = filmOffset
    camera.updateProjectionMatrix()
  }
}
