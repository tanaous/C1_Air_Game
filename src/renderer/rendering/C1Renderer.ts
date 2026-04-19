/**
 * C1 多视角渲染器
 * 将游戏场景渲染为 C1 裸眼3D显示器可显示的交织图像
 *
 * 关键：交织着色器输出必须固定为 1440×2560 像素，
 *       与 C1 物理分辨率一一对应，否则像素-透镜映射错位。
 *       用 CSS 缩放 canvas 适配窗口大小。
 */

import * as THREE from 'three'
import { C1_DISPLAY, DEFAULT_GRATING_PARAMS } from '@/game/GameConfig'
import { InterleavingShaderDef, updateInterleavingUniforms } from './InterleavingShader'
import { MultiViewCamera } from './MultiViewCamera'
import type { DeviceParams } from '@shared/types'

const {
  OUTPUT_WIDTH, OUTPUT_HEIGHT,
  VIEW_COLS, VIEW_ROWS, VIEW_COUNT,
  SUB_WIDTH, SUB_HEIGHT,
} = C1_DISPLAY

export class C1Renderer {
  readonly renderer: THREE.WebGLRenderer

  private multiViewTarget: THREE.WebGLRenderTarget
  private blitScene: THREE.Scene
  private blitCamera: THREE.OrthographicCamera
  private interleavingMaterial: THREE.ShaderMaterial
  private mvCamera: MultiViewCamera

  /** false = 单视角普通渲染（未连接 C1 时） */
  c1Mode: boolean = true

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.autoClear = false

    // 固定 canvas 像素尺寸为 C1 物理分辨率
    // CSS 负责缩放到窗口大小
    this.renderer.setSize(OUTPUT_WIDTH, OUTPUT_HEIGHT, false)
    canvas.style.width  = '100%'
    canvas.style.height = '100%'

    // 多视角纹理图集: 8列 × 5行
    this.multiViewTarget = new THREE.WebGLRenderTarget(
      SUB_WIDTH * VIEW_COLS,
      SUB_HEIGHT * VIEW_ROWS,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
      },
    )

    // 全屏 blit 四边形 + 交织着色器
    this.interleavingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.multiViewTarget.texture },
        slope:    { value: DEFAULT_GRATING_PARAMS.slope },
        interval: { value: DEFAULT_GRATING_PARAMS.interval },
        x0:       { value: DEFAULT_GRATING_PARAMS.x0 },
      },
      vertexShader:   InterleavingShaderDef.vertexShader,
      fragmentShader: InterleavingShaderDef.fragmentShader,
      depthTest:  false,
      depthWrite: false,
    })

    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.blitScene  = new THREE.Scene()
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.interleavingMaterial)
    this.blitScene.add(quad)

    this.mvCamera = new MultiViewCamera()
  }

  renderFrame(scene: THREE.Scene, camera: THREE.PerspectiveCamera): void {
    if (!this.c1Mode) {
      this.renderer.setRenderTarget(null)
      this.renderer.setViewport(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
      this.renderer.setScissorTest(false)
      this.renderer.clear()
      this.renderer.render(scene, camera)
      return
    }

    const origX = camera.position.x

    // ── Phase 1: 渲染 40 个视角到纹理图集 ──
    this.renderer.setRenderTarget(this.multiViewTarget)

    for (let i = 0; i < VIEW_COUNT; i++) {
      // 着色器中列索引是反转的: choice_vec.x = 8 - (choice%8) - 1
      // choice=0 → 采样 col=7, choice=7 → 采样 col=0
      // 所以渲染时也要反转列，让视角 i 落在着色器期望的位置
      const col = (VIEW_COLS - 1) - (i % VIEW_COLS)
      const row = Math.floor(i / VIEW_COLS)

      camera.position.x = origX + this.mvCamera.getOffset(i)
      camera.updateMatrixWorld()

      const vx = col * SUB_WIDTH
      const vy = row * SUB_HEIGHT
      this.renderer.setViewport(vx, vy, SUB_WIDTH, SUB_HEIGHT)
      this.renderer.setScissor(vx, vy, SUB_WIDTH, SUB_HEIGHT)
      this.renderer.setScissorTest(true)
      this.renderer.clear(true, true, false)
      this.renderer.render(scene, camera)
    }

    camera.position.x = origX
    camera.updateMatrixWorld()

    // ── Phase 2: 交织后处理 → 屏幕 (固定 1440×2560) ──
    this.renderer.setRenderTarget(null)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT)
    this.renderer.clear()
    this.renderer.render(this.blitScene, this.blitCamera)
  }

  updateGratingParams(params: DeviceParams): void {
    updateInterleavingUniforms(
      this.interleavingMaterial.uniforms as typeof InterleavingShaderDef.uniforms,
      params,
    )
  }

  /** C1 模式下不需要 resize — canvas 固定 1440×2560，CSS 缩放 */
  resize(_width: number, _height: number): void {
    // 不改变 renderer 像素尺寸，只让 CSS 处理缩放
  }

  dispose(): void {
    this.multiViewTarget.dispose()
    this.interleavingMaterial.dispose()
    this.renderer.dispose()
  }
}
