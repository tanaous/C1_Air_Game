import * as THREE from 'three'
import { type BossMaterialSet, createBossMaterials } from './BossShipMaterials'

type Vec3Like = { x: number; y: number; z: number }

function addMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos: Vec3Like = { x: 0, y: 0, z: 0 },
  rot: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(pos.x, pos.y, pos.z)
  mesh.rotation.copy(rot)
  mesh.scale.set(scale.x, scale.y, scale.z)
  mesh.castShadow = false; mesh.receiveShadow = false
  mesh.frustumCulled = false
  parent.add(mesh)
  return mesh
}

function addSymmetric(
  parent: THREE.Object3D,
  nameBase: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos: Vec3Like,
  rot: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): void {
  const absX = Math.abs(pos.x)
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 'l' : 'r'
    const mr = new THREE.Euler(rot.x, rot.y * side, rot.z * side, rot.order)
    addMesh(parent, `${nameBase}_${s}`, geometry, material,
      { x: absX * side, y: pos.y, z: pos.z }, mr,
      { x: Math.abs(scale.x) * side, y: scale.y, z: scale.z })
  }
}

function createLayerSet(name: string) {
  const root = new THREE.Group(); root.name = 'root'; root.userData.bossType = name
  const armorLayer = new THREE.Group(); armorLayer.name = 'armorLayer'
  const coreLayer = new THREE.Group(); coreLayer.name = 'coreLayer'
  const weaponLayer = new THREE.Group(); weaponLayer.name = 'weaponLayer'
  const weakPointLayer = new THREE.Group(); weakPointLayer.name = 'weakPointLayer'
  root.add(armorLayer, coreLayer, weaponLayer, weakPointLayer)

  const smooth = () => {
    root.traverse((c) => {
      if (!(c instanceof THREE.Mesh)) return
      c.geometry.computeVertexNormals()
    })
  }

  return { root, armorLayer, coreLayer, weaponLayer, weakPointLayer, smooth }
}

// ─── Boss 1: 要塞守卫 — 重型要塞平台 ────────────────────────────────────

function buildFortress(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('fortress')

  // Main armor hull
  addMesh(l.armorLayer, 'fortress_base', new THREE.BoxGeometry(82, 68, 14), m.armor, { x: 0, y: 0, z: 0 })
  // Upper deck
  addMesh(l.armorLayer, 'fortress_deck', new THREE.BoxGeometry(68, 56, 8), m.armorAccent, { x: 0, y: 4, z: 7 })
  // Command bridge
  addMesh(l.armorLayer, 'fortress_bridge', new THREE.CylinderGeometry(10, 12, 16, 8), m.armorAccent, { x: 0, y: 8, z: 12 })

  // 4 turret platforms
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as Array<[number, number]>) {
    addMesh(l.armorLayer, `fortress_platform_${sx}_${sy}`,
      new THREE.CylinderGeometry(9, 12, 5, 7), m.armorAccent,
      { x: sx * 30, y: sy * 26, z: 9 })
    addMesh(l.weaponLayer, `fortress_turret_${sx}_${sy}`,
      new THREE.CylinderGeometry(7, 8, 18, 7), m.weapon,
      { x: sx * 30, y: sy * 26, z: 12 })
    addMesh(l.weaponLayer, `fortress_barrel_${sx}_${sy}`,
      new THREE.CylinderGeometry(3, 4, 10, 7), m.weapon,
      { x: sx * 30, y: sy * 26, z: 22 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }

  // Side armor skirts
  addSymmetric(l.armorLayer, 'fortress_skirt',
    new THREE.BoxGeometry(6, 42, 10), m.armor, { x: 42, y: 0, z: -2 })

  // Core reactor
  addMesh(l.coreLayer, 'fortress_core', new THREE.SphereGeometry(12, 16, 12), m.core, { x: 0, y: 0, z: 9 })
  addMesh(l.coreLayer, 'fortress_core_ring', new THREE.TorusGeometry(14, 1.5, 8, 18), m.core,
    { x: 0, y: 0, z: 9 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Weak point
  addMesh(l.weakPointLayer, 'fortress_weak', new THREE.OctahedronGeometry(7), m.weakPoint, { x: 0, y: 0, z: 18 })

  l.smooth()
  return l.root
}

// ─── Boss 2: 沙暴蝎 — 沙漠蝎形机甲 ────────────────────────────────────

function buildScorpion(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('scorpion')

  // Main body segments
  addMesh(l.armorLayer, 'scorpion_body', new THREE.SphereGeometry(22, 14, 10), m.armor)
  addMesh(l.armorLayer, 'scorpion_abdomen', new THREE.SphereGeometry(16, 12, 9), m.armorAccent,
    { x: 0, y: -20, z: -2 })

  // Head plate
  addMesh(l.armorLayer, 'scorpion_head', new THREE.ConeGeometry(14, 16, 8), m.armorAccent,
    { x: 0, y: 20, z: 2 }, new THREE.Euler(Math.PI, 0, 0))

  // Arms + claws
  for (const side of [-1, 1] as const) {
    addMesh(l.weaponLayer, `scorpion_arm_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(12, 30, 7), m.weapon,
      { x: side * 28, y: 15, z: 2 }, new THREE.Euler(0, 0, side * 0.33))
    addMesh(l.weaponLayer, `scorpion_claw_${side < 0 ? 'l' : 'r'}`,
      new THREE.ConeGeometry(8, 16, 5), m.weapon,
      { x: side * 37, y: 35, z: 2 }, new THREE.Euler(0, 0, side * 0.2))
    // Mandibles
    addMesh(l.weaponLayer, `scorpion_mandible_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(3, 18, 4), m.weapon,
      { x: side * 12, y: 26, z: 5 }, new THREE.Euler(0.1, 0, side * 0.5))
  }

  // Tail segments
  for (let i = 0; i < 5; i++) {
    addMesh(l.armorLayer, `scorpion_tail_${i}`,
      new THREE.CylinderGeometry(5, 6.5, 10, 7), m.armor,
      { x: 0, y: -30 - i * 10, z: 3 }, new THREE.Euler(0.2 * i, 0, 0))
  }

  // Stinger
  addMesh(l.weakPointLayer, 'scorpion_stinger',
    new THREE.ConeGeometry(7, 14, 5), m.weakPoint,
    { x: 0, y: -54, z: 18 }, new THREE.Euler(-0.5, 0, 0))

  // Core
  addMesh(l.coreLayer, 'scorpion_core', new THREE.SphereGeometry(9, 10, 8), m.core,
    { x: 0, y: 6, z: 8 })

  l.smooth()
  return l.root
}

// ─── Boss 3: 深海霸王 — 重型航母平台 ──────────────────────────────────

function buildCarrier(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('carrier')

  addMesh(l.armorLayer, 'carrier_hull', new THREE.BoxGeometry(104, 42, 14), m.armor)
  addMesh(l.armorLayer, 'carrier_deck', new THREE.BoxGeometry(94, 36, 4), m.armorAccent, { x: 0, y: 0, z: 9 })
  // Command tower
  addMesh(l.armorLayer, 'carrier_tower_base', new THREE.BoxGeometry(16, 12, 12), m.armor, { x: 34, y: 0, z: 12 })
  addMesh(l.armorLayer, 'carrier_tower', new THREE.BoxGeometry(12, 10, 24), m.armorAccent, { x: 34, y: 0, z: 22 })
  // Antenna array
  for (let i = 0; i < 3; i++) {
    addMesh(l.armorLayer, `carrier_antenna_${i}`,
      new THREE.CylinderGeometry(0.8, 1.2, 14 + i * 4, 6), m.armorAccent,
      { x: 34, y: -6 + i * 6, z: 36 })
  }
  // Forward cannons
  for (const side of [-1, 1] as const) {
    addMesh(l.weaponLayer, `carrier_cannon_${side < 0 ? 'l' : 'r'}`,
      new THREE.CylinderGeometry(4.5, 5, 15, 7), m.weapon,
      { x: side * 40, y: -15, z: 12 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }
  // Side missile pods
  addSymmetric(l.weaponLayer, 'carrier_pod',
    new THREE.BoxGeometry(10, 8, 6), m.weapon, { x: 48, y: -8, z: 5 })

  addMesh(l.coreLayer, 'carrier_reactor', new THREE.SphereGeometry(12, 12, 10), m.core,
    { x: -28, y: 0, z: 12 })
  addMesh(l.weakPointLayer, 'carrier_weak', new THREE.OctahedronGeometry(8), m.weakPoint,
    { x: 0, y: 16, z: 16 })

  l.smooth()
  return l.root
}

// ─── Boss 4: 炎龙机甲 — 机械巨龙 ──────────────────────────────────────

function buildDragon(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('dragon')

  // Head
  addMesh(l.armorLayer, 'dragon_head', new THREE.ConeGeometry(15, 26, 8), m.armorAccent,
    { x: 0, y: 28, z: 3 }, new THREE.Euler(0, 0, 0))

  // Neck
  for (let i = 0; i < 3; i++) {
    addMesh(l.armorLayer, `dragon_neck_${i}`,
      new THREE.CylinderGeometry(9, 10.5, 8, 8), m.armor,
      { x: 0, y: 18 + i * 9, z: -1 }, new THREE.Euler(0.12, 0, 0))
  }

  // Body
  addMesh(l.armorLayer, 'dragon_body', new THREE.SphereGeometry(18, 12, 9), m.armor)

  // Chest armor
  addMesh(l.armorLayer, 'dragon_chest', new THREE.BoxGeometry(20, 14, 8), m.armorAccent,
    { x: 0, y: 6, z: 8 })

  // Wings
  for (const s of [-1, 1] as const) {
    addMesh(l.weaponLayer, `dragon_wing_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(46, 24, 4), m.weapon,
      { x: s * 36, y: 8, z: 0 }, new THREE.Euler(0.08, 0.22 * -s, s * 0.32))
    // Wing struts
    addMesh(l.weaponLayer, `dragon_strut_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(6, 28, 2), m.armorAccent,
      { x: s * 38, y: 2, z: -2 }, new THREE.Euler(0.05, 0, s * 0.4))
  }

  // Tail segments
  for (let i = 0; i < 4; i++) {
    addMesh(l.armorLayer, `dragon_tail_${i}`,
      new THREE.SphereGeometry(9 - i, 8, 6), m.armor,
      { x: 0, y: -20 - i * 12, z: 0 })
  }
  // Tail tip
  addMesh(l.weaponLayer, 'dragon_tail_tip',
    new THREE.ConeGeometry(6, 14, 6), m.weapon,
    { x: 0, y: -48, z: 2 }, new THREE.Euler(0.3, 0, 0))

  addMesh(l.coreLayer, 'dragon_core', new THREE.SphereGeometry(10, 12, 10), m.core,
    { x: 0, y: 8, z: 6 })
  addMesh(l.weakPointLayer, 'dragon_weak', new THREE.ConeGeometry(8, 16, 5), m.weakPoint,
    { x: 0, y: 28, z: 12 })

  l.smooth()
  return l.root
}

// ─── Boss 5: 废铁泰坦 — 巨型人形机甲 ──────────────────────────────────

function buildTitan(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('titan')

  // Legs
  for (const s of [-1, 1] as const) {
    addMesh(l.armorLayer, `titan_leg_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(14, 48, 14), m.armor,
      { x: s * 18, y: -28, z: 0 })
    addMesh(l.armorLayer, `titan_foot_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(20, 10, 22), m.armorAccent,
      { x: s * 20, y: -52, z: 2 })
  }

  // Torso
  addMesh(l.armorLayer, 'titan_torso', new THREE.BoxGeometry(42, 56, 20), m.armor)
  // Chest plate
  addMesh(l.armorLayer, 'titan_chest', new THREE.BoxGeometry(30, 28, 10), m.armorAccent,
    { x: 0, y: 14, z: 10 })

  // Head
  addMesh(l.armorLayer, 'titan_head', new THREE.SphereGeometry(16, 12, 10), m.armorAccent,
    { x: 0, y: 36, z: 3 })
  addMesh(l.armorLayer, 'titan_visor', new THREE.BoxGeometry(20, 6, 4), m.weakPoint,
    { x: 0, y: 34, z: 14 })

  // Arms
  for (const s of [-1, 1] as const) {
    addMesh(l.armorLayer, `titan_shoulder_${s < 0 ? 'l' : 'r'}`,
      new THREE.SphereGeometry(10, 10, 8), m.armorAccent,
      { x: s * 26, y: 22, z: 0 })
    addMesh(l.weaponLayer, `titan_arm_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(12, 40, 11), m.weapon,
      { x: s * 32, y: -4, z: 0 })
    addMesh(l.weaponLayer, `titan_cannon_${s < 0 ? 'l' : 'r'}`,
      new THREE.CylinderGeometry(6, 4, 18, 7), m.weapon,
      { x: s * 36, y: -28, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }

  // Backpack / reactor
  addMesh(l.coreLayer, 'titan_core', new THREE.OctahedronGeometry(10), m.core,
    { x: 0, y: 8, z: -14 })
  addMesh(l.weakPointLayer, 'titan_weak', new THREE.SphereGeometry(7, 10, 8), m.weakPoint,
    { x: 0, y: 14, z: 14 })

  l.smooth()
  return l.root
}

// ─── Boss 6: 轨道之眼 ──────────────────────────────────────────────────

function buildEye(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('eye')

  addMesh(l.armorLayer, 'eye_ring_outer', new THREE.TorusGeometry(30, 6, 10, 30), m.armor,
    { x: 0, y: 0, z: 0 })
  addMesh(l.armorLayer, 'eye_ring_inner', new THREE.TorusGeometry(22, 4.5, 8, 24), m.armorAccent,
    { x: 0, y: 0, z: 1 }, new THREE.Euler(Math.PI / 4, 0, 0))
  addMesh(l.coreLayer, 'eye_core', new THREE.SphereGeometry(18, 14, 11), m.core)

  // Orbital weapon nodes
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    addMesh(l.weaponLayer, `eye_node_${i}`,
      new THREE.OctahedronGeometry(5.5), m.weapon,
      { x: Math.cos(a) * 32, y: Math.sin(a) * 32, z: 0 })
    addMesh(l.weaponLayer, `eye_arm_${i}`,
      new THREE.CylinderGeometry(2, 2.5, 14, 5), m.weapon,
      { x: Math.cos(a) * 18, y: Math.sin(a) * 18, z: 0 },
      new THREE.Euler(Math.PI / 2, 0, a + Math.PI / 2))
  }

  addMesh(l.weakPointLayer, 'eye_weak', new THREE.SphereGeometry(7, 10, 8), m.weakPoint,
    { x: 0, y: 0, z: 20 })

  l.smooth()
  return l.root
}

// ─── Boss 7: 星云幻影 ──────────────────────────────────────────────────

function buildPhantom(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('phantom')

  const shell = m.armor.clone()
  shell.transparent = true; shell.opacity = 0.75
  addMesh(l.armorLayer, 'phantom_shell', new THREE.IcosahedronGeometry(26, 2), shell)
  addMesh(l.armorLayer, 'phantom_shell_inner', new THREE.OctahedronGeometry(20), m.armorAccent,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(0.3, 0.4, 0.5))

  addMesh(l.coreLayer, 'phantom_core', new THREE.SphereGeometry(11, 12, 10), m.core)
  // Energy blades
  for (const side of [-1, 1] as const) {
    addMesh(l.weaponLayer, `phantom_blade_${side < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(2.5, 32, 4), m.weapon,
      { x: side * 22, y: 0, z: 6 }, new THREE.Euler(0.2, side * 0.3, side * 0.45))
  }
  // Ring of shards
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2
    addMesh(l.weaponLayer, `phantom_shard_${i}`,
      new THREE.ConeGeometry(4, 12, 4), m.weapon,
      { x: Math.cos(a) * 22, y: Math.sin(a) * 22, z: 3 },
      new THREE.Euler(0.2, 0, a))
  }

  addMesh(l.weakPointLayer, 'phantom_weak', new THREE.OctahedronGeometry(7), m.weakPoint,
    { x: 0, y: -18, z: 14 })

  l.smooth()
  return l.root
}

// ─── Boss 8: 碎星者 ────────────────────────────────────────────────────

function buildBreaker(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('breaker')

  // Drill head
  addMesh(l.armorLayer, 'breaker_head', new THREE.ConeGeometry(22, 48, 9), m.armorAccent,
    { x: 0, y: 24, z: 0 })
  addMesh(l.weaponLayer, 'breaker_drill', new THREE.CylinderGeometry(8, 12, 18, 9), m.weapon,
    { x: 0, y: 48, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Body
  addMesh(l.armorLayer, 'breaker_body', new THREE.BoxGeometry(52, 76, 18), m.armor)
  // Outer armor plates
  addSymmetric(l.armorLayer, 'breaker_plate',
    new THREE.BoxGeometry(16, 60, 6), m.armorAccent,
    { x: 28, y: 4, z: 8 })

  // Arms
  for (const s of [-1, 1] as const) {
    addMesh(l.weaponLayer, `breaker_arm_${s < 0 ? 'l' : 'r'}`,
      new THREE.BoxGeometry(18, 38, 10), m.weapon,
      { x: s * 38, y: -14, z: 0 })
    addMesh(l.weaponLayer, `breaker_fist_${s < 0 ? 'l' : 'r'}`,
      new THREE.SphereGeometry(11, 10, 8), m.weapon,
      { x: s * 38, y: -36, z: 3 })
  }

  // Core
  addMesh(l.coreLayer, 'breaker_core', new THREE.SphereGeometry(12, 12, 10), m.core,
    { x: 0, y: -6, z: 12 })
  // Energy conduits
  for (let i = 0; i < 4; i++) {
    const ty = -22 + i * 12
    addMesh(l.coreLayer, `breaker_conduit_${i}`,
      new THREE.CylinderGeometry(2.5, 3, 6, 7), m.core,
      { x: 0, y: ty, z: 14 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }

  addMesh(l.weakPointLayer, 'breaker_weak', new THREE.CylinderGeometry(6, 7, 14, 8), m.weakPoint,
    { x: 0, y: -34, z: 18 }, new THREE.Euler(Math.PI / 2, 0, 0))

  l.smooth()
  return l.root
}

// ─── Boss 9: 虚空使者 ──────────────────────────────────────────────────

function buildHerald(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('herald')

  const shell = m.armor.clone()
  shell.transparent = true; shell.opacity = 0.80
  addMesh(l.armorLayer, 'herald_shell', new THREE.TorusKnotGeometry(21, 6, 96, 12), shell)
  addMesh(l.armorLayer, 'herald_cage', new THREE.IcosahedronGeometry(28, 1), m.armorAccent,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(0.2, 0.3, 0.1))

  addMesh(l.coreLayer, 'herald_core', new THREE.SphereGeometry(14, 14, 11), m.core)
  // Arc weapons
  for (const side of [-1, 1] as const) {
    addMesh(l.weaponLayer, `herald_arc_${side < 0 ? 'l' : 'r'}`,
      new THREE.TorusGeometry(26, 2.5, 8, 18, Math.PI * 1.2), m.weapon,
      { x: 0, y: 0, z: 2 }, new THREE.Euler(side * 0.2, 0, side * 0.3))
  }
  // Orbital shards
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    addMesh(l.weaponLayer, `herald_orb_${i}`,
      new THREE.ConeGeometry(3.5, 10, 5), m.weapon,
      { x: Math.cos(a) * 30, y: Math.sin(a) * 30, z: 2 },
      new THREE.Euler(0, 0, a))
  }

  addMesh(l.weakPointLayer, 'herald_weak', new THREE.OctahedronGeometry(8), m.weakPoint,
    { x: 0, y: 0, z: 20 })

  l.smooth()
  return l.root
}

// ─── Boss 10: 终极执政官 ───────────────────────────────────────────────

function buildArchon(m: BossMaterialSet): THREE.Group {
  const l = createLayerSet('archon')

  // Multi-layered shells
  addMesh(l.armorLayer, 'archon_shell_outer', new THREE.IcosahedronGeometry(32, 2), m.armor)
  addMesh(l.armorLayer, 'archon_shell_mid', new THREE.DodecahedronGeometry(24, 1), m.armorAccent,
    { x: 0, y: 0, z: 2 }, new THREE.Euler(0.4, 0.3, 0.2))
  addMesh(l.armorLayer, 'archon_shell_inner', new THREE.OctahedronGeometry(20), m.armorAccent,
    { x: 0, y: 0, z: 4 }, new THREE.Euler(0.2, 0.5, 0.3))

  // Core
  addMesh(l.coreLayer, 'archon_core', new THREE.SphereGeometry(16, 14, 11), m.core)
  addMesh(l.coreLayer, 'archon_core_ring', new THREE.TorusGeometry(20, 2, 12, 32), m.core,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Weapon rings
  addMesh(l.weaponLayer, 'archon_ring_a', new THREE.TorusGeometry(38, 3, 10, 28), m.weapon)
  addMesh(l.weaponLayer, 'archon_ring_b', new THREE.TorusGeometry(42, 2.5, 10, 28), m.weapon,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(Math.PI / 3, Math.PI / 4, 0))

  // Outer orbs
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    addMesh(l.weaponLayer, `archon_orb_${i}`,
      new THREE.SphereGeometry(6, 8, 6), m.weapon,
      { x: Math.cos(a) * 43, y: Math.sin(a) * 43, z: 0 })
  }

  // Weak point
  addMesh(l.weakPointLayer, 'archon_weak', new THREE.SphereGeometry(9, 10, 8), m.weakPoint,
    { x: 0, y: 0, z: 26 })

  l.smooth()
  return l.root
}

// ─── Public entry ────────────────────────────────────────────────────────

export function buildBossShip(type: string): THREE.Group {
  const mats = createBossMaterials(type)
  switch (type) {
    case 'fortress': return buildFortress(mats)
    case 'scorpion': return buildScorpion(mats)
    case 'carrier':  return buildCarrier(mats)
    case 'dragon':   return buildDragon(mats)
    case 'titan':    return buildTitan(mats)
    case 'eye':      return buildEye(mats)
    case 'phantom':  return buildPhantom(mats)
    case 'breaker':  return buildBreaker(mats)
    case 'herald':   return buildHerald(mats)
    case 'archon':   return buildArchon(mats)
    default:         return buildFortress(mats)
  }
}
