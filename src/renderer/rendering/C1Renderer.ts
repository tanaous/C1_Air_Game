import * as THREE from 'three'
import { C1_DISPLAY } from '@/game/GameConfig'
import { InterleavingShaderDef, updateInterleavingUniforms } from './InterleavingShader'
import { MultiViewCamera } from './MultiViewCamera'
import type { C1Diagnostics, DeviceParams } from '@shared/types'

const {
  OUTPUT_WIDTH,
  OUTPUT_HEIGHT,
  VIEW_COLS,
  VIEW_ROWS,
  VIEW_COUNT,
  SUB_WIDTH,
  SUB_HEIGHT,
} = C1_DISPLAY

export class C1Renderer {
  readonly renderer: THREE.WebGLRenderer

  private readonly canvas: HTMLCanvasElement
  private readonly multiViewTarget: THREE.WebGLRenderTarget
  private readonly blitScene: THREE.Scene
  private readonly blitCamera: THREE.OrthographicCamera
  private readonly blitQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private readonly interleavingMaterial: THREE.ShaderMaterial
  private readonly mvCamera: MultiViewCamera
  private deviceParams: DeviceParams | null = null

  c1Mode = false

  get parallaxBoost(): number {
    return this.mvCamera.parallaxBoost
  }

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false
    this.renderer.setSize(OUTPUT_WIDTH, OUTPUT_HEIGHT, false)
    this.fitCanvasToContainer()

    this.multiViewTarget = new THREE.WebGLRenderTarget(
      SUB_WIDTH * VIEW_COLS,
      SUB_HEIGHT * VIEW_ROWS,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: true,
        stencilBuffer: false,
      },
    )

    this.interleavingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.multiViewTarget.texture },
        slope: { value: InterleavingShaderDef.uniforms.slope.value },
        interval: { value: InterleavingShaderDef.uniforms.interval.value },
        x0: { value: InterleavingShaderDef.uniforms.x0.value },
      },
      vertexShader: InterleavingShaderDef.vertexShader,
      fragmentShader: InterleavingShaderDef.fragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.blitScene = new THREE.Scene()
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.interleavingMaterial)
    this.blitScene.add(this.blitQuad)
    this.mvCamera = new MultiViewCamera()
  }

  getDiagnostics(): C1Diagnostics {
    return {
      backing: `${this.canvas.width}x${this.canvas.height}`,
      client: `${this.canvas.clientWidth}x${this.canvas.clientHeight}`,
      css: `${this.canvas.style.width || 'auto'}x${this.canvas.style.height || 'auto'}`,
      window: `${window.innerWidth}x${window.innerHeight}`,
      dpr: window.devicePixelRatio,
      c1Mode: this.c1Mode,
      parallax: Math.round(this.mvCamera.parallaxBoost * 1000) / 1000,
      atlas: `${SUB_WIDTH * VIEW_COLS}x${SUB_HEIGHT * VIEW_ROWS}`,
      output: `${OUTPUT_WIDTH}x${OUTPUT_HEIGHT}`,
      grating: this.deviceParams,
    }
  }

  setParallaxBoost(value: number): void {
    this.mvCamera.setParallaxBoost(value)
  }

  updateGratingParams(params: DeviceParams): void {
    this.deviceParams = params
    updateInterleavingUniforms(
      this.interleavingMaterial.uniforms as typeof InterleavingShaderDef.uniforms,
      params,
    )
  }

  renderFrame(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    if (!this.c1Mode) {
      this.renderSingleView(scene, camera)
      return
    }

    const origPosition = camera.position.clone()
    const origQuaternion = camera.quaternion.clone()
    const origUp = camera.up.clone()
    const origFilmOffset = camera instanceof THREE.PerspectiveCamera ? camera.filmOffset : 0

    this.renderer.setRenderTarget(this.multiViewTarget)
    this.renderer.clear(true, true, false)

    for (let i = 0; i < VIEW_COUNT; i++) {
      const col = i % VIEW_COLS
      const row = Math.floor(i / VIEW_COLS)
      const viewOffset = this.mvCamera.getOffset(i)

      camera.position.copy(origPosition)
      camera.position.x += viewOffset
      camera.quaternion.copy(origQuaternion)
      if (camera instanceof THREE.PerspectiveCamera) {
        this.mvCamera.applyOffAxisProjection(camera, viewOffset, origFilmOffset)
      }
      camera.updateMatrixWorld()

      const vx = col * SUB_WIDTH
      const vy = (VIEW_ROWS - 1 - row) * SUB_HEIGHT
      this.renderer.setViewport(vx, vy, SUB_WIDTH, SUB_HEIGHT)
      this.renderer.setScissor(vx, vy, SUB_WIDTH, SUB_HEIGHT)
      this.renderer.setScissorTest(true)
      this.renderer.clear(true, true, false)
      this.renderer.render(scene, camera)
    }

    camera.position.copy(origPosition)
    camera.quaternion.copy(origQuaternion)
    camera.up.copy(origUp)
    this.mvCamera.resetProjection(camera, origFilmOffset)
    camera.updateMatrixWorld()

    this.renderer.setRenderTarget(null)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
    this.renderer.clear()
    this.renderer.render(this.blitScene, this.blitCamera)
  }

  resize(_width: number, _height: number): void {
    this.fitCanvasToContainer()
  }

  fitCanvasToContainer(): void {
    const container = this.canvas.parentElement
    if (!container) return

    const cw = container.clientWidth
    const ch = container.clientHeight
    if (cw <= 0 || ch <= 0) return

    this.canvas.style.width = `${cw}px`
    this.canvas.style.height = `${ch}px`
    this.canvas.style.position = 'absolute'
    this.canvas.style.left = '0'
    this.canvas.style.top = '0'
  }

  dispose(): void {
    this.multiViewTarget.dispose()
    this.interleavingMaterial.dispose()
    this.blitQuad.geometry.dispose()
    this.renderer.dispose()
  }

  private renderSingleView(scene: THREE.Scene, camera: THREE.PerspectiveCamera | THREE.OrthographicCamera): void {
    this.mvCamera.resetProjection(camera)
    this.renderer.setRenderTarget(null)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
    this.renderer.clear()
    this.renderer.render(scene, camera)
  }
}
