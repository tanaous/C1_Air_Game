import './styles.css'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

type DeviceParams = {
  obliquity: number
  lineNumber: number
  deviation: number
  deviceId?: string
  remark?: string
}

type StartupInfo = {
  pipeName: string
  pipeStatus: string
  display: DisplayInfo | null
  deviceParams: DeviceParams | null
}

type DisplayInfo = {
  id: number
  label: string
  scaleFactor: number
  bounds: { x: number, y: number, width: number, height: number }
  size: { width: number, height: number }
  physical?: { width: number, height: number }
  labelsFromOpenstageAI: string[]
}

type ControlCommand =
  | { type: 'cycle-mode' }
  | { type: 'cycle-projection' }
  | { type: 'toggle-view-order' }
  | { type: 'toggle-columns' }
  | { type: 'toggle-rows' }
  | { type: 'toggle-hud' }
  | { type: 'toggle-frame' }
  | { type: 'parallax-delta', delta: number }

type RendererDiagnostics = {
  mode: OutputMode
  projection: ProjectionMode
  parallax: number
  viewOrder: string
  atlasColumns: string
  atlasRows: string
  frameVisible: boolean
  hudVisible: boolean
  hasDeviceParams: boolean
  deviceId: string
  grating: { slope: number, interval: number, x0: number }
  display: string
  pipeStatus: string
  paramSource: string
  atlasSize: string
  outputSize: string
  c1Settings: string
}

type C1Api = {
  getStartupInfo: () => Promise<StartupInfo>
  requestDeviceParams: () => void
  sendControl: (command: ControlCommand) => void
  publishDiagnostics: (diagnostics: RendererDiagnostics) => void
  onControl: (callback: (command: ControlCommand) => void) => () => void
  onDiagnostics: (callback: (diagnostics: RendererDiagnostics) => void) => () => void
  onDeviceParams: (callback: (params: DeviceParams) => void) => () => void
  onPipeStatus: (callback: (status: string) => void) => () => void
  onDisplayInfo: (callback: (info: DisplayInfo) => void) => () => void
}

declare global {
  interface Window {
    c1Api?: C1Api
  }
}

const C1 = {
  outputWidth: 1440,
  outputHeight: 2560,
  viewCols: 8,
  viewRows: 5,
  viewCount: 40,
  subWidth: 540,
  subHeight: 960,
  boxSize: 0.78,
  focalPlane: 10,
  totalViewAngleDeg: 40,
  focalLength: 3806,
  tanHalfHorizontalFov: 0.071,
  // Only used to keep the shader numerically valid before OpenstageAI replies.
  // This is not treated as a valid device calibration.
  bootPlaceholderParams: {
    slope: 0.1057,
    interval: 19.625,
    x0: 8.89,
  },
} as const

const ATLAS_WIDTH = C1.subWidth * C1.viewCols
const ATLAS_HEIGHT = C1.subHeight * C1.viewRows

const vertexShader = /* glsl */`
  varying vec2 vUV;

  void main() {
    vUV = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

// Kept intentionally close to reference/3DMonitor/src/view/viewer/shader.ts.
const interleavingFragmentShader = /* glsl */`
  #ifdef GL_ES
  precision highp float;
  #endif

  varying vec2 vUV;
  uniform sampler2D tDiffuse;
  uniform float slope;
  uniform float interval;
  uniform float x0;

  float row_img_num = 8.0;
  float col_img_num = 5.0;
  float num_of_view = 40.0;
  float gridSizeX = 1440.0;
  float gridSizeY = 2560.0;

  vec2 get_choice(vec2 pos, float bias) {
    float x = pos.x * gridSizeX + 0.5;
    float y = (1.0 - pos.y) * gridSizeY + 0.5;

    float x1 = (x + y * slope) * 3.0 + bias;
    float x_local = mod(x1 + x0, interval);
    int choice = int(floor((x_local / interval) * num_of_view));

    vec2 choice_vec = vec2(
      row_img_num - mod(float(choice), row_img_num) - 1.0,
      floor(float(choice) / row_img_num)
    );

    vec2 reciprocals = vec2(1.0 / row_img_num, 1.0 / col_img_num);
    return (choice_vec.xy + pos) * reciprocals;
  }

  vec4 get_color(float bias) {
    vec2 sel_pos = get_choice(vUV, bias);
    return texture2D(tDiffuse, sel_pos);
  }

  void main(void) {
    vec4 color = get_color(0.0);
    color.g = get_color(1.0).g;
    color.b = get_color(2.0).b;
    gl_FragColor = vec4(color.rgb, 1.0);
  }
`

const atlasFragmentShader = /* glsl */`
  precision highp float;

  varying vec2 vUV;
  uniform sampler2D tDiffuse;

  void main() {
    vec4 color = texture2D(tDiffuse, vUV);
    vec2 tileUv = fract(vUV * vec2(8.0, 5.0));
    float border = step(tileUv.x, 0.012) + step(0.988, tileUv.x) + step(tileUv.y, 0.012) + step(0.988, tileUv.y);
    float center = step(abs(tileUv.x - 0.5), 0.004) + step(abs(tileUv.y - 0.5), 0.004);
    vec3 outColor = color.rgb;
    outColor = mix(outColor, vec3(1.0, 0.08, 0.03), clamp(border, 0.0, 1.0));
    outColor = mix(outColor, vec3(0.0, 0.9, 1.0), clamp(center, 0.0, 1.0) * 0.45);
    gl_FragColor = vec4(outColor, 1.0);
  }
`

type OutputMode = 'interleaved' | 'atlas' | 'single'
type ProjectionMode = 'three-converged' | 'unity-negative' | 'unity-positive' | 'none'

class C1PbrBoxPrototype {
  private readonly canvas: HTMLCanvasElement
  private readonly hud: HTMLPreElement
  private readonly screenFrame: HTMLDivElement
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly box: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial[]>
  private readonly faceTextures: THREE.CanvasTexture[]
  private readonly atlasTarget: THREE.WebGLRenderTarget
  private readonly blitScene: THREE.Scene
  private readonly blitCamera: THREE.OrthographicCamera
  private readonly blitQuad: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>
  private readonly interleavingMaterial: THREE.ShaderMaterial
  private readonly atlasMaterial: THREE.ShaderMaterial
  private readonly clock = new THREE.Clock()
  private mode: OutputMode = 'interleaved'
  private paramSource = 'waiting for OpenstageAI device config'
  private hasDeviceParams = false
  private deviceId = ''
  private pipeStatus = window.c1Api ? 'waiting' : 'browser mode'
  private displayInfo: DisplayInfo | null = null
  private parallaxScale = 1
  private viewOrder = 1
  private reverseAtlasColumns = false
  private reverseAtlasRows = true
  private hudVisible = false
  private frameVisible = false
  private projectionMode: ProjectionMode = 'three-converged'
  private lastDiagnosticAt = 0

  constructor(canvas: HTMLCanvasElement, hud: HTMLPreElement, screenFrame: HTMLDivElement) {
    this.canvas = canvas
    this.hud = hud
    this.screenFrame = screenFrame
    this.hud.classList.toggle('hidden', !this.hudVisible)
    this.screenFrame.classList.toggle('enabled', this.frameVisible)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(C1.outputWidth, C1.outputHeight, false)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.renderer.autoClear = false
    this.renderer.setClearColor(0x05060a, 1)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x05060a)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(
      this.officialVerticalFovDeg(),
      C1.subWidth / C1.subHeight,
      0.1,
      100,
    )
    this.camera.filmGauge = C1.subHeight
    this.camera.setFocalLength(C1.focalLength)
    this.camera.position.set(0, 0, C1.focalPlane)
    this.camera.lookAt(0, 0, 0)

    const geometry = new THREE.BoxGeometry(C1.boxSize, C1.boxSize, C1.boxSize)
    const faceMaterials = this.createBoxFaceMaterials()
    this.faceTextures = faceMaterials.map((material) => material.map).filter((texture): texture is THREE.CanvasTexture => Boolean(texture))
    this.box = new THREE.Mesh(geometry, faceMaterials)
    this.box.rotation.set(0.35, -0.45, 0.12)
    this.scene.add(this.box)

    const hemiLight = new THREE.HemisphereLight(0x9ecbff, 0x10131c, 1.05)
    this.scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4)
    keyLight.position.set(38, 45, 75)
    this.scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0x8ff3ff, 1.2)
    rimLight.position.set(-42, -16, 50)
    this.scene.add(rimLight)

    this.atlasTarget = new THREE.WebGLRenderTarget(ATLAS_WIDTH, ATLAS_HEIGHT, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: true,
      stencilBuffer: false,
    })
    this.atlasTarget.texture.name = 'C1 8x5 multi-view atlas'

    this.interleavingMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.atlasTarget.texture },
        slope: { value: C1.bootPlaceholderParams.slope },
        interval: { value: C1.bootPlaceholderParams.interval },
        x0: { value: C1.bootPlaceholderParams.x0 },
      },
      vertexShader,
      fragmentShader: interleavingFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    this.atlasMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: this.atlasTarget.texture },
      },
      vertexShader,
      fragmentShader: atlasFragmentShader,
      depthTest: false,
      depthWrite: false,
    })

    this.blitScene = new THREE.Scene()
    this.blitCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.blitQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.interleavingMaterial)
    this.blitScene.add(this.blitQuad)

    this.bindEvents()
    void this.bindElectron()
  }

  start(): void {
    this.renderer.setAnimationLoop(() => this.render())
  }

  private bindEvents(): void {
    window.addEventListener('resize', () => {
      this.renderer.setSize(C1.outputWidth, C1.outputHeight, false)
    })

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.key.toLowerCase() === 'd') {
        this.applyCommand({ type: 'cycle-mode' })
      }
      if (event.key.toLowerCase() === 'h') {
        this.applyCommand({ type: 'toggle-hud' })
      }
      if (event.key.toLowerCase() === 'r') {
        this.applyCommand({ type: 'toggle-view-order' })
      }
      if (event.key.toLowerCase() === 'o') {
        this.applyCommand({ type: 'toggle-columns' })
      }
      if (event.key.toLowerCase() === 'y') {
        this.applyCommand({ type: 'toggle-rows' })
      }
      if (event.key.toLowerCase() === 'v') {
        this.applyCommand({ type: 'cycle-projection' })
      }
      if (event.key.toLowerCase() === 'f') {
        this.applyCommand({ type: 'toggle-frame' })
      }
      if (event.key === '[') {
        this.applyCommand({ type: 'parallax-delta', delta: -0.05 })
      }
      if (event.key === ']') {
        this.applyCommand({ type: 'parallax-delta', delta: 0.05 })
      }
    })
  }

  private applyCommand(command: ControlCommand): void {
    if (command.type === 'cycle-mode') {
      this.mode = this.mode === 'interleaved' ? 'atlas' : this.mode === 'atlas' ? 'single' : 'interleaved'
    } else if (command.type === 'cycle-projection') {
      this.cycleProjectionMode()
    } else if (command.type === 'toggle-view-order') {
      this.viewOrder *= -1
    } else if (command.type === 'toggle-columns') {
      this.reverseAtlasColumns = !this.reverseAtlasColumns
    } else if (command.type === 'toggle-rows') {
      this.reverseAtlasRows = !this.reverseAtlasRows
    } else if (command.type === 'toggle-hud') {
      this.hudVisible = !this.hudVisible
      this.hud.classList.toggle('hidden', !this.hudVisible)
    } else if (command.type === 'toggle-frame') {
      this.frameVisible = !this.frameVisible
      this.screenFrame.classList.toggle('enabled', this.frameVisible)
    } else if (command.type === 'parallax-delta') {
      this.parallaxScale = Math.min(1.5, Math.max(0, this.parallaxScale + command.delta))
    }

    this.publishDiagnostics(true)
  }

  private createBoxFaceMaterials(): THREE.MeshStandardMaterial[] {
    const faces = [
      { label: '+X', base: '#ff4d4d', accent: '#ffe45c', pattern: 'diagonal' },
      { label: '-X', base: '#2f80ff', accent: '#8ff3ff', pattern: 'grid' },
      { label: '+Y', base: '#35d07f', accent: '#f8ff7a', pattern: 'rings' },
      { label: '-Y', base: '#8b5cff', accent: '#ff9df2', pattern: 'dots' },
      { label: '+Z', base: '#ff9a3d', accent: '#ffffff', pattern: 'cross' },
      { label: '-Z', base: '#1fd0c4', accent: '#101820', pattern: 'stripes' },
    ] as const

    return faces.map((face) => {
      const texture = this.createFaceTexture(face.label, face.base, face.accent, face.pattern)
      return new THREE.MeshStandardMaterial({
        map: texture,
        metalness: 0.28,
        roughness: 0.32,
        envMapIntensity: 1.25,
      })
    })
  }

  private createFaceTexture(label: string, base: string, accent: string, pattern: string): THREE.CanvasTexture {
    const size = 512
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Unable to create face texture canvas')

    ctx.fillStyle = base
    ctx.fillRect(0, 0, size, size)
    ctx.globalAlpha = 0.86
    ctx.strokeStyle = accent
    ctx.fillStyle = accent
    ctx.lineWidth = 18

    if (pattern === 'diagonal') {
      for (let x = -size; x < size * 2; x += 82) {
        ctx.beginPath()
        ctx.moveTo(x, size)
        ctx.lineTo(x + size, 0)
        ctx.stroke()
      }
    } else if (pattern === 'grid') {
      for (let x = 48; x < size; x += 82) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, size)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, x)
        ctx.lineTo(size, x)
        ctx.stroke()
      }
    } else if (pattern === 'rings') {
      for (let r = 58; r < 360; r += 68) {
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    } else if (pattern === 'dots') {
      for (let y = 72; y < size; y += 92) {
        for (let x = 72; x < size; x += 92) {
          ctx.beginPath()
          ctx.arc(x, y, 21, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    } else if (pattern === 'cross') {
      ctx.fillRect(size / 2 - 34, 48, 68, size - 96)
      ctx.fillRect(48, size / 2 - 34, size - 96, 68)
    } else {
      for (let y = 34; y < size; y += 68) {
        ctx.fillRect(0, y, size, 26)
      }
    }

    ctx.globalAlpha = 1
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)'
    ctx.fillRect(0, size - 168, size, 168)
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 154px Consolas, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, size / 2, size - 84)

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 4
    texture.needsUpdate = true
    return texture
  }

  private async bindElectron(): Promise<void> {
    if (!window.c1Api) return

    const startup = await window.c1Api.getStartupInfo()
    this.pipeStatus = startup.pipeStatus
    this.displayInfo = startup.display
    if (startup.deviceParams) this.applyDeviceParams(startup.deviceParams, 'OpenstageAI startup')

    window.c1Api.onPipeStatus((status) => {
      this.pipeStatus = status
    })
    window.c1Api.onDisplayInfo((info) => {
      this.displayInfo = info
    })
    window.c1Api.onDeviceParams((params) => {
      this.applyDeviceParams(params, 'OpenstageAI pipe')
    })
    window.c1Api.onControl((command) => {
      this.applyCommand(command)
    })
    window.c1Api.requestDeviceParams()
  }

  private applyDeviceParams(params: DeviceParams, source: string): void {
    if (
      !Number.isFinite(params.obliquity) ||
      !Number.isFinite(params.lineNumber) ||
      params.lineNumber <= 0 ||
      !Number.isFinite(params.deviation)
    ) {
      return
    }

    this.interleavingMaterial.uniforms.slope.value = params.obliquity
    this.interleavingMaterial.uniforms.interval.value = params.lineNumber
    this.interleavingMaterial.uniforms.x0.value = params.deviation
    this.paramSource = params.deviceId ? `${source} (${params.deviceId})` : source
    this.hasDeviceParams = true
    this.deviceId = params.deviceId ?? ''
  }

  private render(): void {
    if (!this.hasDeviceParams) {
      this.renderer.setRenderTarget(null)
      this.renderer.setScissorTest(false)
      this.renderer.setViewport(0, 0, C1.outputWidth, C1.outputHeight)
      this.renderer.clear(true, true, true)
      this.updateHud()
      this.publishDiagnostics()
      return
    }

    const elapsed = this.clock.getElapsedTime()
    this.box.rotation.x = 0.35 + elapsed * 0.42
    this.box.rotation.y = -0.45 + elapsed * 0.68
    this.box.rotation.z = 0.12 + Math.sin(elapsed * 0.55) * 0.18

    if (this.mode === 'single') {
      this.renderSingle()
    } else {
      this.renderAtlas()
      this.renderBlit()
    }

    this.updateHud()
    this.publishDiagnostics()
  }

  private renderSingle(): void {
    this.resetCamera()
    this.renderer.setRenderTarget(null)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, C1.outputWidth, C1.outputHeight)
    this.renderer.clear(true, true, true)
    this.renderer.render(this.scene, this.camera)
  }

  private renderAtlas(): void {
    const basePosition = this.camera.position.clone()
    const baseQuaternion = this.camera.quaternion.clone()
    const baseFilmOffset = this.camera.filmOffset

    this.renderer.setRenderTarget(this.atlasTarget)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, ATLAS_WIDTH, ATLAS_HEIGHT)
    this.renderer.clear(true, true, true)

    for (let i = 0; i < C1.viewCount; i++) {
      const col = i % C1.viewCols
      const row = Math.floor(i / C1.viewCols)
      const atlasCol = this.reverseAtlasColumns ? C1.viewCols - 1 - col : col
      const atlasRow = this.reverseAtlasRows ? C1.viewRows - 1 - row : row
      const vx = atlasCol * C1.subWidth
      const vy = atlasRow * C1.subHeight
      const offset = this.viewOffset(i) * this.viewOrder

      this.camera.position.copy(basePosition)
      this.camera.quaternion.copy(baseQuaternion)
      this.camera.position.x += offset
      this.camera.filmOffset = baseFilmOffset + this.getFilmOffset(offset)
      this.camera.updateProjectionMatrix()
      this.camera.updateMatrixWorld()

      this.renderer.setViewport(vx, vy, C1.subWidth, C1.subHeight)
      this.renderer.setScissor(vx, vy, C1.subWidth, C1.subHeight)
      this.renderer.setScissorTest(true)
      this.renderer.clear(true, true, true)
      this.renderer.render(this.scene, this.camera)
    }

    this.camera.position.copy(basePosition)
    this.camera.quaternion.copy(baseQuaternion)
    this.camera.filmOffset = baseFilmOffset
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  private renderBlit(): void {
    this.renderer.setRenderTarget(null)
    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, C1.outputWidth, C1.outputHeight)
    this.renderer.clear(true, true, true)
    this.blitQuad.material = this.mode === 'atlas' ? this.atlasMaterial : this.interleavingMaterial
    this.renderer.render(this.blitScene, this.blitCamera)
  }

  private resetCamera(): void {
    this.camera.position.set(0, 0, C1.focalPlane)
    this.camera.lookAt(0, 0, 0)
    this.camera.filmOffset = 0
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  private viewOffset(index: number): number {
    const t = 1 - (index * 2) / (C1.viewCount - 1)
    const span = C1.focalPlane * Math.tan(THREE.MathUtils.degToRad(C1.totalViewAngleDeg) / 2)
    return t * span * this.parallaxScale
  }

  private getFilmOffset(viewOffset: number): number {
    if (this.projectionMode === 'none') return 0
    if (this.projectionMode === 'unity-negative') {
      const lensShiftX = viewOffset / (2 * C1.tanHalfHorizontalFov * C1.focalPlane)
      return -lensShiftX * this.camera.getFilmWidth()
    }
    if (this.projectionMode === 'unity-positive') {
      const lensShiftX = viewOffset / (2 * C1.tanHalfHorizontalFov * C1.focalPlane)
      return lensShiftX * this.camera.getFilmWidth()
    }
    return -(viewOffset / C1.focalPlane) * this.camera.getFilmWidth()
  }

  private cycleProjectionMode(): void {
    const modes: ProjectionMode[] = ['three-converged', 'unity-negative', 'unity-positive', 'none']
    const index = modes.indexOf(this.projectionMode)
    this.projectionMode = modes[(index + 1) % modes.length]
  }

  private officialVerticalFovDeg(): number {
    return THREE.MathUtils.radToDeg(2 * Math.atan(C1.subHeight / (2 * C1.focalLength)))
  }

  private updateHud(): void {
    if (!this.hudVisible) return

    const diagnostics = this.getDiagnostics()

    this.hud.textContent = [
      'C1 PBR Box Prototype',
      `mode=${diagnostics.mode}  atlas=${diagnostics.atlasSize}  output=${diagnostics.outputSize}`,
      diagnostics.c1Settings,
      `projection=${diagnostics.projection}  parallax=${diagnostics.parallax.toFixed(2)}  viewOrder=${diagnostics.viewOrder}`,
      `atlasColumns=${diagnostics.atlasColumns}  atlasRows=${diagnostics.atlasRows}`,
      `grating slope=${diagnostics.grating.slope.toFixed(5)}  interval=${diagnostics.grating.interval.toFixed(5)}  x0=${diagnostics.grating.x0.toFixed(5)}`,
      `calibration=${diagnostics.hasDeviceParams ? 'ONLINE DEVICE PARAMS' : 'WAITING / NOT CALIBRATED'}  deviceId=${diagnostics.deviceId || '-'}`,
      `params=${diagnostics.paramSource}  pipe=${diagnostics.pipeStatus}`,
      `display=${diagnostics.display}`,
      `debug window: use buttons or V/R/O/Y/[ ]/Space/F/H`,
    ].join('\n')
  }

  private getDiagnostics(): RendererDiagnostics {
    const slope = Number(this.interleavingMaterial.uniforms.slope.value)
    const interval = Number(this.interleavingMaterial.uniforms.interval.value)
    const x0 = Number(this.interleavingMaterial.uniforms.x0.value)
    const display = this.displayInfo
      ? `${this.displayInfo.label || 'unknown'} bounds=${this.displayInfo.bounds.width}x${this.displayInfo.bounds.height} physical=${this.displayInfo.physical?.width ?? '?'}x${this.displayInfo.physical?.height ?? '?'} @${this.displayInfo.scaleFactor}`
      : 'browser/current display'

    return {
      mode: this.mode,
      projection: this.projectionMode,
      parallax: this.parallaxScale,
      viewOrder: this.viewOrder > 0 ? 'official' : 'reversed',
      atlasColumns: this.reverseAtlasColumns ? 'reversed' : 'official straight',
      atlasRows: this.reverseAtlasRows ? 'official top-first' : 'straight',
      frameVisible: this.frameVisible,
      hudVisible: this.hudVisible,
      hasDeviceParams: this.hasDeviceParams,
      deviceId: this.deviceId,
      grating: { slope, interval, x0 },
      display,
      pipeStatus: this.pipeStatus,
      paramSource: this.paramSource,
      atlasSize: `${ATLAS_WIDTH}x${ATLAS_HEIGHT}`,
      outputSize: `${C1.outputWidth}x${C1.outputHeight}`,
      c1Settings: `views=${C1.viewCols}x${C1.viewRows}  sub=${C1.subWidth}x${C1.subHeight}  focalLength=${C1.focalLength}  fov=${this.officialVerticalFovDeg().toFixed(2)}deg  theta=${C1.totalViewAngleDeg}deg`,
    }
  }

  private publishDiagnostics(force = false): void {
    if (!window.c1Api) return
    const now = performance.now()
    if (!force && now - this.lastDiagnosticAt < 250) return
    this.lastDiagnosticAt = now
    window.c1Api.publishDiagnostics(this.getDiagnostics())
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null)
    this.box.geometry.dispose()
    this.box.material.forEach((material) => material.dispose())
    this.faceTextures.forEach((texture) => texture.dispose())
    this.atlasTarget.dispose()
    this.interleavingMaterial.dispose()
    this.atlasMaterial.dispose()
    this.blitQuad.geometry.dispose()
    this.renderer.dispose()
  }
}

class DebugPanel {
  private diagnostics: RendererDiagnostics | null = null
  private readonly root: HTMLDivElement
  private readonly status: HTMLPreElement

  constructor(canvas: HTMLCanvasElement, hud: HTMLPreElement, screenFrame: HTMLDivElement) {
    if (!window.c1Api) throw new Error('Debug panel requires Electron C1 API')
    document.body.classList.add('debug-window')
    canvas.style.display = 'none'
    screenFrame.style.display = 'none'
    hud.style.display = 'none'

    this.root = document.createElement('div')
    this.root.className = 'debug-panel'
    this.root.innerHTML = `
      <div class="debug-title">C1 PBR Box Debug 控制台</div>
      <div class="debug-buttons">
        <button data-command="cycle-projection">V 投影</button>
        <button data-command="toggle-view-order">R 视角方向</button>
        <button data-command="toggle-columns">O 图集列</button>
        <button data-command="toggle-rows">Y 图集行</button>
        <button data-command="parallax-down">[ 视差-</button>
        <button data-command="parallax-up">] 视差+</button>
        <button data-command="cycle-mode">Space 模式</button>
        <button data-command="toggle-frame">F 边框</button>
        <button data-command="toggle-hud">H C1字</button>
      </div>
    `
    this.status = document.createElement('pre')
    this.status.className = 'debug-status'
    this.root.appendChild(this.status)
    document.querySelector('#app')?.appendChild(this.root)

    this.root.addEventListener('click', (event) => {
      const target = event.target
      if (!(target instanceof HTMLButtonElement)) return
      this.sendButtonCommand(target.dataset.command ?? '')
    })

    window.addEventListener('keydown', (event) => {
      this.sendKeyCommand(event)
    })

    window.c1Api?.onDiagnostics((diagnostics) => {
      this.diagnostics = diagnostics
      this.render()
    })

    void this.loadStartupInfo()

    this.render()
  }

  private async loadStartupInfo(): Promise<void> {
    const startup = await window.c1Api!.getStartupInfo()
    this.status.textContent = [
      '等待 C1 渲染窗口回传状态...',
      '',
      `pipe: ${startup.pipeStatus}`,
      `deviceId: ${startup.deviceParams?.deviceId ?? '-'}`,
      startup.display
        ? `display: ${startup.display.label || 'unknown'} bounds=${startup.display.bounds.width}x${startup.display.bounds.height} physical=${startup.display.physical?.width ?? '?'}x${startup.display.physical?.height ?? '?'}`
        : 'display: -',
      '',
      '如果 C1 上已经有立方体，但这里没有刷新，请按任意控制按钮一次。',
    ].join('\n')
  }

  private sendButtonCommand(command: string): void {
    if (command === 'parallax-down') {
      window.c1Api?.sendControl({ type: 'parallax-delta', delta: -0.05 })
    } else if (command === 'parallax-up') {
      window.c1Api?.sendControl({ type: 'parallax-delta', delta: 0.05 })
    } else if (
      command === 'cycle-mode' ||
      command === 'cycle-projection' ||
      command === 'toggle-view-order' ||
      command === 'toggle-columns' ||
      command === 'toggle-rows' ||
      command === 'toggle-hud' ||
      command === 'toggle-frame'
    ) {
      window.c1Api?.sendControl({ type: command })
    }
  }

  private sendKeyCommand(event: KeyboardEvent): void {
    if (event.code === 'Space' || event.key.toLowerCase() === 'd') {
      window.c1Api?.sendControl({ type: 'cycle-mode' })
    } else if (event.key.toLowerCase() === 'v') {
      window.c1Api?.sendControl({ type: 'cycle-projection' })
    } else if (event.key.toLowerCase() === 'r') {
      window.c1Api?.sendControl({ type: 'toggle-view-order' })
    } else if (event.key.toLowerCase() === 'o') {
      window.c1Api?.sendControl({ type: 'toggle-columns' })
    } else if (event.key.toLowerCase() === 'y') {
      window.c1Api?.sendControl({ type: 'toggle-rows' })
    } else if (event.key.toLowerCase() === 'f') {
      window.c1Api?.sendControl({ type: 'toggle-frame' })
    } else if (event.key.toLowerCase() === 'h') {
      window.c1Api?.sendControl({ type: 'toggle-hud' })
    } else if (event.key === '[') {
      window.c1Api?.sendControl({ type: 'parallax-delta', delta: -0.05 })
    } else if (event.key === ']') {
      window.c1Api?.sendControl({ type: 'parallax-delta', delta: 0.05 })
    }
  }

  private render(): void {
    if (!this.diagnostics) {
      this.status.textContent = [
        '等待 C1 渲染窗口回传状态...',
        '',
        '如果这里一直不变：确认 C1 窗口已经打开，OpenstageAI 在线参数已经获取。',
      ].join('\n')
      return
    }

    const d = this.diagnostics
    this.status.textContent = [
      `当前组合`,
      `projection:   ${d.projection}`,
      `viewOrder:    ${d.viewOrder}`,
      `atlasColumns: ${d.atlasColumns}`,
      `atlasRows:    ${d.atlasRows}`,
      `parallax:     ${d.parallax.toFixed(2)}`,
      `mode:         ${d.mode}`,
      ``,
      `设备`,
      `calibration:  ${d.hasDeviceParams ? 'ONLINE DEVICE PARAMS' : 'WAITING / NOT CALIBRATED'}`,
      `deviceId:     ${d.deviceId || '-'}`,
      `grating:      slope=${d.grating.slope.toFixed(5)}  interval=${d.grating.interval.toFixed(5)}  x0=${d.grating.x0.toFixed(5)}`,
      `pipe:         ${d.pipeStatus}`,
      `display:      ${d.display}`,
      ``,
      `渲染`,
      `atlas:        ${d.atlasSize}`,
      `output:       ${d.outputSize}`,
      d.c1Settings,
      ``,
      `请反馈：当前组合是否融合？深度方向对不对？六个面是否稳定清楚？`,
    ].join('\n')
  }
}

const canvas = document.querySelector<HTMLCanvasElement>('#c1-canvas')
const hud = document.querySelector<HTMLPreElement>('#hud')
const screenFrame = document.querySelector<HTMLDivElement>('#screen-frame')

if (!canvas || !hud || !screenFrame) {
  throw new Error('Missing #c1-canvas, #hud, or #screen-frame')
}

if (!window.c1Api) {
  hud.textContent = [
    'C1 PBR Box Prototype refused to run.',
    'This prototype requires Electron plus online device parameters from China-region OpenstageAI.',
    'Do not validate C1 naked-eye 3D from a plain browser tab.',
  ].join('\n')
  throw new Error('Missing Electron C1 API / OpenstageAI device parameter bridge')
}

const isDebugWindow = new URLSearchParams(window.location.search).get('debug') === '1'

if (isDebugWindow) {
  new DebugPanel(canvas, hud, screenFrame)
} else {
  const app = new C1PbrBoxPrototype(canvas, hud, screenFrame)
  app.start()
}
