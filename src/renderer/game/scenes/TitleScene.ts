import * as THREE from 'three'
import type { InputManager } from '@/game/systems/InputManager'
import { audioManager } from '@/game/audio/AudioManager'
import { attachFresnelRim } from '@/rendering/FresnelRim'

/**
 * EVA / Persona 5 风格 3D 动态标题画面
 *   - 中心旋转线框二十面体 + 实心核心
 *   - 轨道八面体群
 *   - 多层能量环
 *   - 粒子场 + 六角地网
 *   - 戏剧化彩色点光源
 */
export class TitleScene {
  readonly scene: THREE.Scene

  // ── 动画引用 ──
  private coreGroup   = new THREE.Group()
  private ring1       = new THREE.Mesh()
  private ring2       = new THREE.Mesh()
  private ring3       = new THREE.Mesh()
  private orbitGroup  = new THREE.Group()
  private orbiters: THREE.Mesh[] = []
  private gridPlane   = new THREE.Mesh()
  private particles!: THREE.Points
  private particleData: Float32Array

  // 背景漂浮物
  private bgGeoms: { mesh: THREE.Mesh; rotSpeed: THREE.Vector3; floatAmp: number }[] = []

  constructor() {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x000510)
    this.scene.fog = new THREE.FogExp2(0x000510, 0.00018)

    this.buildLights()
    this.buildCore()
    this.buildRings()
    this.buildOrbiters()
    this.buildGrid()
    this.buildParticles()
    this.buildBackground()

    // 粒子原始位置（用于动画）
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    this.particleData = new Float32Array(posAttr.array)

    audioManager.playBGM('title')
  }

  /* ════════════════════════════════════════════════════
     Lighting
     ════════════════════════════════════════════════════ */
  private buildLights(): void {
    this.scene.add(new THREE.AmbientLight(0x1a1a3a, 0.6))

    // 橙色主光（EVA 标志色）
    const key = new THREE.PointLight(0xff6a00, 60, 200, 1.5)
    key.position.set(0, 30, 100)
    this.scene.add(key)

    // 紫色补光
    const fill = new THREE.PointLight(0x9b59b6, 35, 180, 1.5)
    fill.position.set(-60, -10, 70)
    this.scene.add(fill)

    // 青色底光
    const rim = new THREE.PointLight(0x00e5ff, 28, 160, 1.5)
    rim.position.set(50, -40, -30)
    this.scene.add(rim)

    // 远处微弱红色背光
    const back = new THREE.PointLight(0xff0040, 20, 250, 2)
    back.position.set(0, 0, -100)
    this.scene.add(back)
  }

  /* ════════════════════════════════════════════════════
     Core 結構 — 线框二十面体 + 实心内核
     ════════════════════════════════════════════════════ */
  private buildCore(): void {
    // 实心内核
    const coreGeo = new THREE.IcosahedronGeometry(14, 0)
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xff6a00, roughness: 0.12, metalness: 0.8,
      emissive: 0xff4400, emissiveIntensity: 2.2,
    })
    attachFresnelRim(coreMat, { color: 0xffaa44, power: 2.8, intensity: 0.35 })
    const core = new THREE.Mesh(coreGeo, coreMat)
    this.coreGroup.add(core)

    // 线框层
    const wireGeo = new THREE.IcosahedronGeometry(19, 1)
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.35,
    })
    const wire = new THREE.Mesh(wireGeo, wireMat)
    this.coreGroup.add(wire)

    // 外层虚线框（更大）
    const outerGeo = new THREE.IcosahedronGeometry(26, 2)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x9b59b6, wireframe: true, transparent: true, opacity: 0.18,
    })
    const outerWire = new THREE.Mesh(outerGeo, outerMat)
    this.coreGroup.add(outerWire)

    this.coreGroup.position.set(0, -8, 0)
    this.scene.add(this.coreGroup)
  }

  /* ════════════════════════════════════════════════════
     Energy Rings — 多层发光环
     ════════════════════════════════════════════════════ */
  private buildRings(): void {
    const ringGeo1 = new THREE.TorusGeometry(24, 0.5, 16, 120)
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0xff6a00, roughness: 0.15, metalness: 0.6,
      emissive: 0xff4400, emissiveIntensity: 1.8,
    })
    attachFresnelRim(ringMat1, { color: 0xff9944, power: 3, intensity: 0.3 })
    this.ring1 = new THREE.Mesh(ringGeo1, ringMat1)
    this.ring1.position.copy(this.coreGroup.position)
    this.ring1.rotation.x = Math.PI * 0.45
    this.scene.add(this.ring1)

    const ringGeo2 = new THREE.TorusGeometry(30, 0.4, 16, 100)
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x9b59b6, roughness: 0.12, metalness: 0.7,
      emissive: 0x7722aa, emissiveIntensity: 1.4,
    })
    attachFresnelRim(ringMat2, { color: 0xcc77ff, power: 2.5, intensity: 0.25 })
    this.ring2 = new THREE.Mesh(ringGeo2, ringMat2)
    this.ring2.position.copy(this.coreGroup.position)
    this.ring2.rotation.x = Math.PI * 0.65
    this.ring2.rotation.y = Math.PI * 0.3
    this.scene.add(this.ring2)

    const ringGeo3 = new THREE.TorusGeometry(36, 0.3, 12, 80)
    const ringMat3 = new THREE.MeshStandardMaterial({
      color: 0x00e5ff, roughness: 0.1, metalness: 0.5,
      emissive: 0x0088aa, emissiveIntensity: 1.0,
      transparent: true, opacity: 0.75,
    })
    this.ring3 = new THREE.Mesh(ringGeo3, ringMat3)
    this.ring3.position.copy(this.coreGroup.position)
    this.ring3.rotation.x = Math.PI * 0.2
    this.ring3.rotation.y = -Math.PI * 0.25
    this.scene.add(this.ring3)
  }

  /* ════════════════════════════════════════════════════
     Orbiting octahedrons
     ════════════════════════════════════════════════════ */
  private buildOrbiters(): void {
    const orbGeo = new THREE.OctahedronGeometry(4, 0)
    const colors = [0xff6a00, 0x9b59b6, 0x00e5ff, 0xff0040, 0xffaa00]

    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: colors[i % colors.length],
        roughness: 0.1, metalness: 0.85,
        emissive: colors[i % colors.length],
        emissiveIntensity: 1.8,
      })
      attachFresnelRim(mat, { color: 0xffffff, power: 3.5, intensity: 0.2 })
      const mesh = new THREE.Mesh(orbGeo, mat)

      const angle = (i / 6) * Math.PI * 2
      const radius = 44
      mesh.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
      mesh.userData = {
        orbitAngle: angle,
        orbitRadius: radius,
        orbitSpeed: 0.25 + Math.random() * 0.35,
        yBase: (Math.random() - 0.5) * 20 + 40, // same Y as core
      }
      this.orbitGroup.add(mesh)
      this.orbiters.push(mesh)
    }

    this.orbitGroup.position.copy(this.coreGroup.position)
    this.scene.add(this.orbitGroup)
  }

  /* ════════════════════════════════════════════════════
     Hexagonal floor grid — EVA 控制面板风格
     ════════════════════════════════════════════════════ */
  private buildGrid(): void {
    const size = 200
    const divisions = 16
    const geo = new THREE.PlaneGeometry(size, size, divisions, divisions)

    // 用 ShaderMaterial 画六角网格太复杂，这里用线框 + 淡色平面
    const mat = new THREE.MeshStandardMaterial({
      color: 0x0a0a20, roughness: 0.9, metalness: 0.2,
      emissive: 0x000810, emissiveIntensity: 0.3,
      transparent: true, opacity: 0.65,
    })
    this.gridPlane = new THREE.Mesh(geo, mat)
    this.gridPlane.position.set(0, -100, -60)
    this.gridPlane.rotation.x = -Math.PI * 0.38
    this.scene.add(this.gridPlane)

    // 网格线
    const lineGeo = new THREE.PlaneGeometry(size, size, divisions, divisions)
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x1a3366, wireframe: true, transparent: true, opacity: 0.12,
    })
    const linePlane = new THREE.Mesh(lineGeo, lineMat)
    linePlane.position.copy(this.gridPlane.position)
    linePlane.rotation.copy(this.gridPlane.rotation)
    this.scene.add(linePlane)

    // EVA 风格八边形装饰环
    for (let i = 0; i < 3; i++) {
      const octGeo = new THREE.RingGeometry(18 + i * 20, 20 + i * 20, 8)
      const octMat = new THREE.MeshBasicMaterial({
        color: 0xff6a00, side: THREE.DoubleSide,
        transparent: true, opacity: 0.06 + i * 0.02,
      })
      const oct = new THREE.Mesh(octGeo, octMat)
      oct.position.set(0, -98, -58)
      oct.rotation.x = -Math.PI * 0.38
      this.scene.add(oct)
    }
  }

  /* ════════════════════════════════════════════════════
     Particle field
     ════════════════════════════════════════════════════ */
  private buildParticles(): void {
    const count = 500
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)

    const palette = [
      new THREE.Color(0xff6a00),
      new THREE.Color(0x9b59b6),
      new THREE.Color(0x00e5ff),
      new THREE.Color(0xff0040),
      new THREE.Color(0xffffff),
    ]

    for (let i = 0; i < count; i++) {
      positions[i * 3]     = (Math.random() - 0.5) * 180
      positions[i * 3 + 1] = (Math.random() - 0.5) * 280
      positions[i * 3 + 2] = (Math.random() - 0.5) * 120

      const c = palette[Math.floor(Math.random() * palette.length)]
      colors[i * 3]     = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    })

    this.particles = new THREE.Points(geo, mat)
    this.scene.add(this.particles)
  }

  /* ════════════════════════════════════════════════════
     背景漂浮几何体
     ════════════════════════════════════════════════════ */
  private buildBackground(): void {
    const shapes: THREE.BufferGeometry[] = [
      new THREE.TetrahedronGeometry(5),
      new THREE.OctahedronGeometry(6),
      new THREE.BoxGeometry(8, 8, 8),
      new THREE.TorusKnotGeometry(4, 0.8, 64, 8),
    ]

    for (let i = 0; i < 18; i++) {
      const geo = shapes[Math.floor(Math.random() * shapes.length)]
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.58 + Math.random() * 0.18, 0.7, 0.25 + Math.random() * 0.15),
        roughness: 0.3, metalness: 0.7,
        emissive: new THREE.Color().setHSL(0.6, 0.8, 0.08),
        emissiveIntensity: 0.6,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 300,
        -30 - Math.random() * 70,
      )
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      this.scene.add(mesh)
      this.bgGeoms.push({
        mesh,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 0.4,
        ),
        floatAmp: 3 + Math.random() * 8,
      })
    }
  }

  /* ════════════════════════════════════════════════════
     Update — 每帧动画
     ════════════════════════════════════════════════════ */
  update(dt: number, input: InputManager): boolean {
    const t = performance.now() / 1000

    // ── 核心旋转 + 呼吸 ──
    this.coreGroup.rotation.y += dt * 0.3
    this.coreGroup.rotation.x += dt * 0.15
    this.coreGroup.rotation.z += dt * 0.1
    const breathe = 1 + Math.sin(t * 1.3) * 0.06
    this.coreGroup.scale.setScalar(breathe)

    // ── 光环旋转 ──
    this.ring1.rotation.z += dt * 0.4
    this.ring1.rotation.y += dt * 0.2
    ;(this.ring1.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.8 + Math.sin(t * 2.1) * 0.4

    this.ring2.rotation.z -= dt * 0.35
    this.ring2.rotation.x += dt * 0.25
    ;(this.ring2.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.4 + Math.cos(t * 1.7) * 0.35

    this.ring3.rotation.z += dt * 0.5
    this.ring3.rotation.y -= dt * 0.3
    ;(this.ring3.material as THREE.MeshStandardMaterial).opacity =
      0.6 + Math.sin(t * 2.5) * 0.2

    // ── 轨道体 ──
    for (const orb of this.orbiters) {
      const d = orb.userData as any
      d.orbitAngle += d.orbitSpeed * dt
      orb.position.x = Math.cos(d.orbitAngle) * d.orbitRadius
      orb.position.z = Math.sin(d.orbitAngle) * d.orbitRadius
      orb.position.y = d.yBase - 40 + Math.sin(t * 1.1 + d.orbitAngle) * 8
      orb.rotation.x += dt * 1.2
      orb.rotation.y += dt * 0.9
    }

    // ── 粒子动画 ──
    const posAttr = this.particles.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    for (let i = 0; i < Math.min(500, arr.length / 3); i++) {
      arr[i * 3 + 1] += dt * (1.5 + (this.particleData[i * 3 + 1] % 7))
      if (arr[i * 3 + 1] > 160) arr[i * 3 + 1] = -160
    }
    posAttr.needsUpdate = true

    // ── 背景几何体 ──
    for (const bg of this.bgGeoms) {
      bg.mesh.rotation.x += bg.rotSpeed.x * dt
      bg.mesh.rotation.y += bg.rotSpeed.y * dt
      bg.mesh.rotation.z += bg.rotSpeed.z * dt
      bg.mesh.position.y += Math.sin(t * 0.7 + bg.mesh.position.x * 0.1) * dt * 1.5
    }

    // ── 网格脉动 ──
    const gridAlpha = 0.5 + Math.sin(t * 0.6) * 0.15
    ;(this.gridPlane.material as THREE.MeshStandardMaterial).opacity = gridAlpha

    const start = input.isJustPressed('confirm')
    if (start) audioManager.playSFX('menu_confirm')
    return start
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh || obj instanceof THREE.Points)) return
      obj.geometry?.dispose()
      const material = obj.material
      if (Array.isArray(material)) {
        for (const mat of material) mat.dispose()
      } else {
        material?.dispose()
      }
    })
    audioManager.stopBGM()
  }
}
