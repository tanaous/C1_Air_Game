import * as THREE from 'three'
import { Entity } from './Entity'
import { SCENE, DEPTH_LAYERS } from '@/game/GameConfig'
import { clamp } from '@/utils/math'
import type { InputManager } from '@/game/systems/InputManager'
import { WeaponSystem, type BulletSpawn } from '@/game/systems/WeaponSystem'

const MOVE_SPEED       = 120
const FOCUS_SPEED      = 50
const INVINCIBLE_TIME  = 2.0
const HALF_W           = SCENE.WIDTH  / 2 - 8
const HALF_H           = SCENE.HEIGHT / 2 - 8

// 托马斯回旋参数
const SPIN_RISE_TIME   = 0.6    // 上升时间
const SPIN_HANG_TIME   = 0.3    // 滞空
const SPIN_FALL_TIME   = 0.5    // 下落
const SPIN_TOTAL       = SPIN_RISE_TIME + SPIN_HANG_TIME + SPIN_FALL_TIME
const SPIN_MAX_Z       = 8      // C1 景深最大凸出 (cm)
const SPIN_COOLDOWN    = 8      // 冷却时间

export class Player extends Entity {
  lives           = 5
  infiniteLives   = false
  invincibleTimer = 0
  hitboxRadius    = 4
  grazeRadius     = 20

  readonly weapon = new WeaponSystem()
  readonly bulletRequests: BulletSpawn[] = []

  // 托马斯回旋状态
  spinTimer    = 0       // > 0 时正在执行
  spinCooldown = 0       // > 0 时冷却中
  spinBombReady = false  // 回落时触发炸弹
  private baseZ = DEPTH_LAYERS.PLAYER
  private savedY = 0

  constructor(scene: THREE.Scene) {
    super()
    this.position.set(0, -SCENE.HEIGHT / 2 + 40, DEPTH_LAYERS.PLAYER)
    this.mesh = buildPlayerMesh()
    this.mesh.position.copy(this.position)
    scene.add(this.mesh)
  }

  updatePlayer(dt: number, input: InputManager): void {
    this.bulletRequests.length = 0
    this.spinBombReady = false

    // Cooldowns
    if (this.spinCooldown > 0) this.spinCooldown -= dt
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= dt
      if (this.mesh) this.mesh.visible = Math.floor(this.invincibleTimer * 10) % 2 === 0
    } else if (this.mesh) {
      this.mesh.visible = true
    }

    // 托马斯回旋
    if (this.spinTimer > 0) {
      this.updateSpin(dt)
      this.syncMesh()
      return
    }

    // 触发回旋 (X键 / bomb键)
    if (input.isJustPressed('bomb') && this.spinCooldown <= 0) {
      this.startSpin()
      this.syncMesh()
      return
    }

    // Normal movement
    const speed = input.isHeld('focus') ? FOCUS_SPEED : MOVE_SPEED
    let dx = 0, dy = 0
    if (input.isHeld('moveLeft'))  dx -= 1
    if (input.isHeld('moveRight')) dx += 1
    if (input.isHeld('moveUp'))    dy += 1
    if (input.isHeld('moveDown'))  dy -= 1
    if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707 }

    this.position.x = clamp(this.position.x + dx * speed * dt, -HALF_W, HALF_W)
    this.position.y = clamp(this.position.y + dy * speed * dt, -HALF_H, HALF_H)
    if (this.mesh) this.mesh.rotation.z = -dx * 0.4

    if (input.isJustPressed('weaponNext')) this.weapon.switchWeapon()

    const spawns = this.weapon.tryFire(dt, input.isHeld('fire'), this.position.x, this.position.y)
    this.bulletRequests.push(...spawns)

    this.syncMesh()
  }

  private startSpin(): void {
    this.spinTimer = SPIN_TOTAL
    this.spinCooldown = SPIN_COOLDOWN
    this.savedY = this.position.y
    this.invincibleTimer = SPIN_TOTAL + 0.5
  }

  private updateSpin(dt: number): void {
    this.spinTimer -= dt
    const elapsed = SPIN_TOTAL - this.spinTimer

    // Mesh rotation — fast spin
    if (this.mesh) {
      this.mesh.rotation.z += dt * 20
      this.mesh.rotation.x += dt * 8
    }

    if (elapsed < SPIN_RISE_TIME) {
      // Rising phase — fly up + Z toward viewer
      const t = elapsed / SPIN_RISE_TIME
      this.position.y = this.savedY + t * 60
      this.position.z = this.baseZ + t * SPIN_MAX_Z
    } else if (elapsed < SPIN_RISE_TIME + SPIN_HANG_TIME) {
      // Hang at top
      this.position.y = this.savedY + 60
      this.position.z = this.baseZ + SPIN_MAX_Z
    } else {
      // Falling — slam down
      const t = (elapsed - SPIN_RISE_TIME - SPIN_HANG_TIME) / SPIN_FALL_TIME
      this.position.y = this.savedY + 60 * (1 - t)
      this.position.z = this.baseZ + SPIN_MAX_Z * (1 - t * t)

      // Trigger bomb at impact
      if (this.spinTimer <= 0) {
        this.spinTimer = 0
        this.position.y = this.savedY
        this.position.z = this.baseZ
        this.spinBombReady = true
        if (this.mesh) {
          this.mesh.rotation.z = 0
          this.mesh.rotation.x = 0
        }
      }
    }
  }

  hit(): boolean {
    if (this.invincibleTimer > 0 || this.spinTimer > 0) return false
    if (!this.infiniteLives) this.lives--
    this.invincibleTimer = INVINCIBLE_TIME
    return true
  }

  isAlive(): boolean { return this.lives > 0 || this.infiniteLives }
  isSpinning(): boolean { return this.spinTimer > 0 }
}

function buildPlayerMesh(): THREE.Group {
  const group = new THREE.Group()

  const bodyGeo = new THREE.ConeGeometry(6, 22, 6)
  const bodyMat = new THREE.MeshPhongMaterial({ color: 0xc0d8ff, specular: 0x4488ff, shininess: 80 })
  const body = new THREE.Mesh(bodyGeo, bodyMat)
  body.rotation.z = Math.PI
  group.add(body)

  const wingShape = new THREE.Shape()
  wingShape.moveTo(0, 0); wingShape.lineTo(-14, -10); wingShape.lineTo(-4, 4); wingShape.closePath()
  const wingGeo = new THREE.ShapeGeometry(wingShape)
  const wingMat = new THREE.MeshPhongMaterial({ color: 0x6090cc, specular: 0x2244aa, shininess: 60, side: THREE.DoubleSide })
  const wingL = new THREE.Mesh(wingGeo, wingMat); wingL.position.set(0, -4, 0); group.add(wingL)
  const wingR = wingL.clone(); wingR.scale.x = -1; group.add(wingR)

  const engGeo = new THREE.CylinderGeometry(2.5, 3.5, 5, 8)
  const engMat = new THREE.MeshPhongMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2 })
  group.add(new THREE.Mesh(engGeo, engMat).translateY(-13))

  const cockpitGeo = new THREE.SphereGeometry(3, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)
  const cockpitMat = new THREE.MeshPhongMaterial({ color: 0x00ccff, emissive: 0x0066ff, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 })
  group.add(new THREE.Mesh(cockpitGeo, cockpitMat).translateY(4).translateZ(1))

  return group
}
