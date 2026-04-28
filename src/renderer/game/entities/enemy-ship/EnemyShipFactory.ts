import * as THREE from 'three'
import { type EnemyMaterialSet, createEnemyMaterials } from './EnemyShipMaterials'

type Vec3Like = { x: number; y: number; z: number }
type Side = -1 | 1

function addMesh(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: Vec3Like = { x: 0, y: 0, z: 0 },
  rotation: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(position.x, position.y, position.z)
  mesh.rotation.copy(rotation)
  mesh.scale.set(scale.x, scale.y, scale.z)
  mesh.castShadow = false
  mesh.receiveShadow = false
  mesh.frustumCulled = false
  group.add(mesh)
  return mesh
}

function addSymmetric(
  group: THREE.Group,
  nameBase: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  pos: Vec3Like,
  rot: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): void {
  const absX = Math.abs(pos.x)
  for (const side of [-1, 1] as Side[]) {
    const suffix = side < 0 ? 'l' : 'r'
    const mirroredRot = new THREE.Euler(rot.x, rot.y * side, rot.z * side, rot.order)
    addMesh(
      group,
      `${nameBase}_${suffix}`,
      geometry,
      material,
      { x: absX * side, y: pos.y, z: pos.z },
      mirroredRot,
      { x: Math.abs(scale.x) * side, y: scale.y, z: scale.z },
    )
  }
}

function finish(group: THREE.Group): THREE.Group {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.geometry.computeVertexNormals()
  })
  return group
}

// ---------------------------------------------------------------------------
// Scout — small dart / arrowhead
// ---------------------------------------------------------------------------
function buildScout(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_scout'

  // Central spike
  addMesh(g, 'enemy_spine', new THREE.ConeGeometry(3.5, 22, 8), m.hull,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(0, 0, 0), { x: 0.85, y: 1, z: 0.85 })

  // Mid armor collar
  addMesh(g, 'enemy_armor', new THREE.CylinderGeometry(4.2, 5.5, 7, 8), m.accent,
    { x: 0, y: -4, z: 0 })

  // Delta wings
  addSymmetric(g, 'enemy_wing', new THREE.BoxGeometry(11, 4.5, 1.8), m.accent,
    { x: 6.2, y: -3.5, z: 0.15 }, new THREE.Euler(0.06, 0.05, -0.3))

  // Wing-tip fins
  addSymmetric(g, 'enemy_fin', new THREE.BoxGeometry(1.4, 5.5, 1.2), m.hull,
    { x: 6.8, y: -6.8, z: 0.45 }, new THREE.Euler(0.1, 0.08, -0.2))

  // Single thruster
  addMesh(g, 'enemy_thruster_core', new THREE.CylinderGeometry(1.4, 2.2, 4.5, 10), m.glow,
    { x: 0, y: -11.5, z: 0.1 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Thruster ring
  addMesh(g, 'enemy_thruster_ring', new THREE.TorusGeometry(2.6, 0.4, 6, 14), m.glow,
    { x: 0, y: -11.5, z: 0.1 }, new THREE.Euler(Math.PI / 2, 0, 0))

  return finish(g)
}

// ---------------------------------------------------------------------------
// Fighter — aggressive interceptor with forward prongs
// ---------------------------------------------------------------------------
function buildFighter(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_fighter'

  // Central body
  addMesh(g, 'enemy_hull', new THREE.CapsuleGeometry(4, 16, 4, 10), m.hull,
    { x: 0, y: 0, z: -0.2 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Armor plate
  addMesh(g, 'enemy_armor', new THREE.BoxGeometry(9, 12, 4.5), m.accent,
    { x: 0, y: -1, z: -0.6 })

  // Forward prongs
  addSymmetric(g, 'enemy_prong', new THREE.BoxGeometry(3, 15, 2.8), m.hull,
    { x: 5.2, y: 3.5, z: 0.2 }, new THREE.Euler(0.12, 0.15, -0.22))

  // Canopy / sensor eye
  if (m.canopy) {
    addMesh(g, 'enemy_sensor', new THREE.SphereGeometry(2.8, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), m.canopy,
      { x: 0, y: 4, z: 2.2 })
  }

  // Twin engine nacelles — Z=π/2 flips cylinder to horizontal; must not mirror across sides.
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 'l' : 'r'
    addMesh(g, `enemy_engine_pod_${s}`, new THREE.CylinderGeometry(1.8, 2.4, 7, 10), m.hull,
      { x: 4 * side, y: -10, z: 0.3 }, new THREE.Euler(0.06, 0.04 * side, Math.PI / 2))
  }

  // Thruster cores
  addSymmetric(g, 'enemy_thruster_core', new THREE.CylinderGeometry(1.1, 1.7, 3, 12), m.glow,
    { x: 4, y: -13, z: 0.3 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Thruster rings
  addSymmetric(g, 'enemy_thruster_ring', new THREE.TorusGeometry(1.9, 0.32, 6, 14), m.glow,
    { x: 4, y: -13, z: 0.3 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Wing extensions
  addSymmetric(g, 'enemy_wing', new THREE.BoxGeometry(8.5, 3.8, 1.6), m.accent,
    { x: 9.5, y: -2, z: 0.1 }, new THREE.Euler(0.05, 0.04, -0.24))

  return finish(g)
}

// ---------------------------------------------------------------------------
// Swooper — curved crescent / sickle shape
// ---------------------------------------------------------------------------
function buildSwooper(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_swooper'

  // Crescent body — torus arc
  addMesh(g, 'enemy_hull', new THREE.TorusGeometry(9, 3.2, 8, 18, Math.PI * 1.2), m.hull,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(0, 0, Math.PI / 2))

  // Inner arc spine
  addMesh(g, 'enemy_spine', new THREE.TorusGeometry(7, 1.5, 8, 16, Math.PI * 1.05), m.accent,
    { x: 0, y: 1.2, z: 1.2 }, new THREE.Euler(0.1, 0.2, Math.PI / 2))

  // Blade tips at arc ends
  addSymmetric(g, 'enemy_blade', new THREE.BoxGeometry(1.2, 6, 1.8), m.accent,
    { x: 7.5, y: 0, z: 0.6 }, new THREE.Euler(0.14, 0, -0.4))

  // Single large engine
  addMesh(g, 'enemy_engine_housing', new THREE.CylinderGeometry(3.5, 4.2, 5.5, 12), m.hull,
    { x: 0, y: -7.5, z: 1.2 }, new THREE.Euler(0, 0, Math.PI / 2))

  addMesh(g, 'enemy_thruster_core', new THREE.CylinderGeometry(2.2, 3.2, 3.5, 14), m.glow,
    { x: 0, y: -9.5, z: 1.2 }, new THREE.Euler(Math.PI / 2, 0, 0))

  addMesh(g, 'enemy_thruster_ring', new THREE.TorusGeometry(3.4, 0.45, 8, 18), m.glow,
    { x: 0, y: -9.5, z: 1.2 }, new THREE.Euler(Math.PI / 2, 0, 0))

  return finish(g)
}

// ---------------------------------------------------------------------------
// Gunship — heavy turret platform
// ---------------------------------------------------------------------------
function buildGunship(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_gunship'

  // Wide hull disk
  addMesh(g, 'enemy_hull', new THREE.CylinderGeometry(15, 16, 6, 16), m.hull,
    { x: 0, y: 0, z: 0 }, new THREE.Euler(0, 0, 0))

  // Lower armor skirt
  addMesh(g, 'enemy_armor_skirt', new THREE.CylinderGeometry(13, 15, 4.5, 16), m.accent,
    { x: 0, y: -3, z: 0 })

  // Turret base
  addMesh(g, 'enemy_turret_base', new THREE.CylinderGeometry(5.5, 7, 4, 12), m.accent,
    { x: 0, y: 4, z: 0 })

  // Turret sphere
  addMesh(g, 'enemy_turret', new THREE.SphereGeometry(5.5, 14, 10), m.hull,
    { x: 0, y: 8, z: 2 })

  // Cannon barrel
  addMesh(g, 'enemy_cannon', new THREE.CylinderGeometry(1.6, 2.2, 14, 10), m.glow,
    { x: 0, y: 8, z: 9 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Cannon muzzle
  addMesh(g, 'enemy_muzzle', new THREE.TorusGeometry(2.5, 0.4, 6, 14), m.glow,
    { x: 0, y: 8, z: 16 }, new THREE.Euler(0, 0, 0))

  // Support thrusters (4 around the rim)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4
    const tx = Math.cos(angle) * 11
    const ty = Math.sin(angle) * 11
    addMesh(g, `enemy_thruster_${i}`, new THREE.CylinderGeometry(1.6, 2.1, 4, 10), m.glow,
      { x: tx, y: ty, z: -3.5 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }

  return finish(g)
}

// ---------------------------------------------------------------------------
// Bomber — large flying wing
// ---------------------------------------------------------------------------
function buildBomber(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_bomber'

  // Central fuselage
  addMesh(g, 'enemy_hull', new THREE.CapsuleGeometry(5.5, 18, 5, 12), m.hull,
    { x: 0, y: 0, z: -0.5 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Main wing — massive span
  addMesh(g, 'enemy_wing_center', new THREE.BoxGeometry(42, 7, 3.5), m.accent,
    { x: 0, y: -1, z: 0.2 }, new THREE.Euler(0.04, 0, 0))

  // Wing outer panels (angled down slightly for menacing silhouette)
  addSymmetric(g, 'enemy_wing_outer', new THREE.BoxGeometry(16, 5, 2.8), m.hull,
    { x: 22, y: -3.5, z: 0.3 }, new THREE.Euler(0.06, 0.04, -0.2))

  // Wing-tip pylons
  addSymmetric(g, 'enemy_pylon', new THREE.BoxGeometry(2, 8, 2.2), m.accent,
    { x: 26, y: -7, z: 0.5 }, new THREE.Euler(0.08, 0.06, -0.1))

  // Bomb bay
  addMesh(g, 'enemy_bay', new THREE.BoxGeometry(16, 3.5, 6), m.glow,
    { x: 0, y: -8, z: 0.4 })

  // Bay doors
  addSymmetric(g, 'enemy_bay_door', new THREE.BoxGeometry(7, 0.8, 3), m.hull,
    { x: 4, y: -10, z: 0.6 }, new THREE.Euler(0.1, 0, 0))

  // Canopy
  if (m.canopy) {
    addMesh(g, 'enemy_sensor', new THREE.SphereGeometry(3.2, 10, 8, 0, Math.PI * 2, 0.05, Math.PI * 0.5), m.canopy,
      { x: 0, y: 6.5, z: 2.5 })
  }

  // Twin large engines — Z=π/2 flips cylinder to horizontal; must not mirror.
  for (const side of [-1, 1] as const) {
    const s = side < 0 ? 'l' : 'r'
    addMesh(g, `enemy_engine_nacelle_${s}`, new THREE.CylinderGeometry(3, 3.8, 8, 12), m.hull,
      { x: 8 * side, y: -13, z: 0 }, new THREE.Euler(0.05, 0.03 * side, Math.PI / 2))
  }

  addSymmetric(g, 'enemy_thruster_core', new THREE.CylinderGeometry(2, 3, 4, 14), m.glow,
    { x: 8, y: -16.5, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0))

  addSymmetric(g, 'enemy_thruster_ring', new THREE.TorusGeometry(3.2, 0.5, 8, 18), m.glow,
    { x: 8, y: -16.5, z: 0 }, new THREE.Euler(Math.PI / 2, 0, 0))

  return finish(g)
}

// ---------------------------------------------------------------------------
// Carrier — massive deck / command ship
// ---------------------------------------------------------------------------
function buildCarrier(m: EnemyMaterialSet): THREE.Group {
  const g = new THREE.Group()
  g.name = 'enemy_carrier'

  // Main hull deck
  addMesh(g, 'enemy_hull', new THREE.BoxGeometry(44, 18, 8), m.hull,
    { x: 0, y: 0, z: 0 })

  // Upper deck
  addMesh(g, 'enemy_deck', new THREE.BoxGeometry(38, 14, 3.5), m.accent,
    { x: 0, y: 2, z: 5.5 })

  // Command tower (offset to one side for carrier silhouette)
  addMesh(g, 'enemy_tower_base', new THREE.BoxGeometry(8, 7, 10), m.hull,
    { x: 14, y: 4, z: 8.5 })

  addMesh(g, 'enemy_tower_top', new THREE.BoxGeometry(6, 5, 7), m.accent,
    { x: 14, y: 8, z: 10 })

  // Sensor array on tower
  if (m.canopy) {
    addMesh(g, 'enemy_sensor', new THREE.SphereGeometry(2.4, 8, 8, 0, Math.PI * 2, 0.06, Math.PI * 0.55), m.canopy,
      { x: 14, y: 10.5, z: 13 })
  }

  // Forward launch tubes
  addSymmetric(g, 'enemy_launcher', new THREE.CylinderGeometry(2.5, 3, 12, 10), m.glow,
    { x: 10, y: -7, z: 6 }, new THREE.Euler(Math.PI / 2, 0, 0))

  // Rear thruster array (4 engines)
  for (let i = 0; i < 4; i++) {
    const tx = -16 + i * 10.6
    addMesh(g, `enemy_engine_pod_${i}`, new THREE.CylinderGeometry(2.2, 2.8, 5, 10), m.hull,
      { x: tx, y: -12, z: -1 }, new THREE.Euler(0, 0, Math.PI / 2))

    addMesh(g, `enemy_thruster_core_${i}`, new THREE.CylinderGeometry(1.4, 2.2, 3, 12), m.glow,
      { x: tx, y: -14, z: -1 }, new THREE.Euler(Math.PI / 2, 0, 0))

    addMesh(g, `enemy_thruster_ring_${i}`, new THREE.TorusGeometry(2.4, 0.35, 6, 14), m.glow,
      { x: tx, y: -14, z: -1 }, new THREE.Euler(Math.PI / 2, 0, 0))
  }

  // Side armor plates
  addSymmetric(g, 'enemy_armor_plate', new THREE.BoxGeometry(4, 10, 2), m.accent,
    { x: 22, y: 0, z: 2 }, new THREE.Euler(0, 0.08, 0))

  return finish(g)
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export function buildEnemyShip(type: string): THREE.Group {
  const mats = createEnemyMaterials(type)
  switch (type) {
    case 'scout':   return buildScout(mats)
    case 'fighter': return buildFighter(mats)
    case 'swooper': return buildSwooper(mats)
    case 'gunship': return buildGunship(mats)
    case 'bomber':  return buildBomber(mats)
    case 'carrier': return buildCarrier(mats)
    default:        return buildScout(mats)
  }
}
