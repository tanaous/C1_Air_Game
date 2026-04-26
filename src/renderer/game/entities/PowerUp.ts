import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { attachFresnelRim } from '@/rendering/FresnelRim'

export type PowerUpType =
  | 'weapon_upgrade' | 'weapon_shot' | 'weapon_spread' | 'weapon_laser'
  | 'extra_life' | 'bomb' | 'gem_small' | 'gem_large'

const COLORS: Record<PowerUpType, number> = {
  weapon_upgrade: 0xffaa00,
  weapon_shot:    0x4488ff,
  weapon_spread:  0x44ff44,
  weapon_laser:   0xff44ff,
  extra_life:     0xffdd00,
  bomb:           0xff8800,
  gem_small:      0x44ff88,
  gem_large:      0xffcc00,
}

const SCORE_VALUES: Record<PowerUpType, number> = {
  weapon_upgrade: 200, weapon_shot: 200, weapon_spread: 200, weapon_laser: 200,
  extra_life: 500, bomb: 300, gem_small: 100, gem_large: 500,
}

const C1_SAFE_POWERUP_VISUALS = true

// 共享几何体
const innerGeo  = new THREE.IcosahedronGeometry(4.5, 1)
const outerGeo  = new THREE.IcosahedronGeometry(7, 1)
const glowGeo   = new THREE.RingGeometry(7, 9, 16)
const gemGeo    = new THREE.OctahedronGeometry(6, 0)
const gemGeoBig = new THREE.OctahedronGeometry(9, 0)
const weaponGeo = new THREE.IcosahedronGeometry(5.5, 1)

function makeGlowSprite(color: number): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({
    color, side: THREE.DoubleSide,
    transparent: true, opacity: 0.35,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })
  return new THREE.Mesh(glowGeo, mat)
}

export class PowerUp extends Entity {
  type:       PowerUpType
  scoreValue: number
  hitboxRadius = 14

  private light: THREE.PointLight | null = null
  private glowRing: THREE.Mesh | null = null

  constructor(scene: THREE.Scene, type: PowerUpType, x: number, y: number) {
    super()
    this.type       = type
    this.scoreValue = SCORE_VALUES[type]
    this.position.set(x, y, DEPTH_LAYERS.BULLET)
    this.velocity.set(0, -50, 0)

    const grp = buildPowerUpGroup(type)
    grp.position.copy(this.position)
    this.mesh = grp
    this.glowRing = (grp as any).userData?.glowRing ?? null
    scene.add(grp)

    // 稀有道具的点光源挂在 Group 下，随 mesh 一起清理
    if (type === 'extra_life' || type === 'weapon_upgrade') {
      this.light = new THREE.PointLight(COLORS[type], 2.5, 50, 1.5)
      grp.add(this.light)
    }
  }

  attractTo(targetX: number, targetY: number, dt: number): void {
    const dx = targetX - this.position.x
    const dy = targetY - this.position.y
    const d = Math.sqrt(dx * dx + dy * dy)
    const attractRadius = 58
    const alpha = 1 - Math.exp(-dt * 8)

    if (d > 0.001 && d < attractRadius) {
      const strength = 1 - d / attractRadius
      const speed = 70 + strength * 170
      this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, (dx / d) * speed, alpha)
      this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, (dy / d) * speed, alpha)
      return
    }

    this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, 0, alpha * 0.45)
    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, -50, alpha * 0.45)
  }

  update(dt: number): void {
    this.position.addScaledVector(this.velocity, dt)
    if (this.mesh) {
      this.mesh.rotation.y += dt * 2.5
      this.mesh.rotation.z += dt * 1.2
    }
    if (this.glowRing) {
      this.glowRing.rotation.z -= dt * 1.8
      const pulse = 1 + Math.sin(performance.now() / 400) * 0.2
      this.glowRing.scale.setScalar(pulse)
      ;(this.glowRing.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(performance.now() / 300) * 0.12
    }
    if (this.light) {
      this.light.position.copy(this.position)
      this.light.intensity = 2.2 + Math.sin(performance.now() / 350) * 0.7
    }
    if (this.position.y < -SCENE.HEIGHT / 2 - 20) this.destroy()
    this.syncMesh()
  }

  destroy(): void {
    if (this.light) {
      this.light.intensity = 0 // 立即熄灭避免延迟
    }
    super.destroy()
  }
}

function buildPowerUpGroup(type: PowerUpType): THREE.Group {
  if (C1_SAFE_POWERUP_VISUALS) return buildC1SafePowerUpGroup(type)

  const group = new THREE.Group()
  const color = COLORS[type]

  if (type === 'extra_life') {
    // 双层发光核心 + 光环
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xfff8c0, roughness: 0.08, metalness: 0.9,
      emissive: color, emissiveIntensity: 2.4,
    })
    attachFresnelRim(innerMat, { color: 0xfff8c0, power: 3.5, intensity: 0.45 })
    group.add(new THREE.Mesh(innerGeo, innerMat))

    const outerMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.14, metalness: 0.3,
      emissive: color, emissiveIntensity: 1.2,
      transparent: true, opacity: 0.55,
    })
    attachFresnelRim(outerMat, { color: 0xffeebb, power: 2, intensity: 0.3 })
    group.add(new THREE.Mesh(outerGeo, outerMat))

    const glow = makeGlowSprite(color)
    glow.name = 'glowRing'
    group.add(glow)
    ;(group as any).userData = { glowRing: glow }

  } else if (type === 'gem_large') {
    const coreMat = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.08, metalness: 0.65,
      emissive: color, emissiveIntensity: 2.0,
      clearcoat: 0.7, clearcoatRoughness: 0.06,
    })
    attachFresnelRim(coreMat, { color: 0xffffff, power: 4, intensity: 0.35 })
    group.add(new THREE.Mesh(gemGeoBig, coreMat))

    const glow = makeGlowSprite(color)
    glow.name = 'glowRing'
    group.add(glow)
    ;(group as any).userData = { glowRing: glow }

  } else if (type === 'gem_small') {
    const coreMat = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.1, metalness: 0.55,
      emissive: color, emissiveIntensity: 1.6,
      clearcoat: 0.5, clearcoatRoughness: 0.1,
    })
    attachFresnelRim(coreMat, { color: 0xffffff, power: 3.5, intensity: 0.28 })
    group.add(new THREE.Mesh(gemGeo, coreMat))

    const glow = makeGlowSprite(color)
    glow.name = 'glowRing'
    group.add(glow)
    ;(group as any).userData = { glowRing: glow }

  } else {
    // 武器/炸弹类 — 二十面体 + 线框外壳
    const coreMat = new THREE.MeshStandardMaterial({
      color, roughness: 0.18, metalness: 0.7,
      emissive: color, emissiveIntensity: 1.6,
    })
    attachFresnelRim(coreMat, { color: 0xffffff, power: 3, intensity: 0.25 })
    group.add(new THREE.Mesh(weaponGeo, coreMat))

    // 线框外壳
    const wireGeo = new THREE.IcosahedronGeometry(7.5, 1)
    const wireMat = new THREE.MeshBasicMaterial({
      color, wireframe: true, transparent: true, opacity: 0.28,
    })
    group.add(new THREE.Mesh(wireGeo, wireMat))

    const glow = makeGlowSprite(color)
    glow.name = 'glowRing'
    group.add(glow)
    ;(group as any).userData = { glowRing: glow }
  }

  return group
}

function buildC1SafePowerUpGroup(type: PowerUpType): THREE.Group {
  const group = new THREE.Group()
  group.name = `powerup_${type}_c1_safe_proxy`
  const color = COLORS[type]
  const coreMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.22,
    metalness: 0.62,
    emissive: color,
    emissiveIntensity: type === 'extra_life' || type === 'weapon_upgrade' ? 1.5 : 0.9,
  })
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111820,
    roughness: 0.58,
    metalness: 0.25,
  })
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.45,
    emissive: color,
    emissiveIntensity: 0.25,
  })
  const bodyGeo = type === 'gem_large'
    ? new THREE.BoxGeometry(14, 14, 18)
    : new THREE.BoxGeometry(10, 10, 14)
  const body = new THREE.Mesh(bodyGeo, [coreMat, darkMat, capMat, coreMat, capMat, darkMat])
  body.name = 'powerup_core'
  body.frustumCulled = false
  group.add(body)

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(type === 'extra_life' ? 4 : 14, type === 'extra_life' ? 14 : 3, 6),
    capMat,
  )
  bar.name = 'powerup_symbol'
  bar.position.z = 9
  bar.frustumCulled = false
  group.add(bar)

  if (type === 'extra_life') {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(14, 4, 6), capMat)
    cross.name = 'powerup_symbol_cross'
    cross.position.z = 9.5
    cross.frustumCulled = false
    group.add(cross)
  }

  return group
}
