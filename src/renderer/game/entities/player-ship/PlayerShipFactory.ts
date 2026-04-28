import * as THREE from 'three'
import { createPlayerShipMaterials, type ShipSurfaceMaterial } from './PlayerShipMaterials'

type Vec3Like = { x: number; y: number; z: number }
type Side = -1 | 1

const SIDES: Side[] = [-1, 1]

function applySmoothShading(group: THREE.Object3D): void {
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    child.castShadow = false
    child.receiveShadow = false
    child.geometry.computeVertexNormals()
  })
}

function addMesh(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: ShipSurfaceMaterial,
  position: Vec3Like = { x: 0, y: 0, z: 0 },
  rotation: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = name
  mesh.position.set(position.x, position.y, position.z)
  mesh.rotation.copy(rotation)
  mesh.scale.set(scale.x, scale.y, scale.z)
  // C1 多视角相机偏移较大，玩家机体禁用视锥裁剪可避免边缘视角下局部丢失
  mesh.frustumCulled = false
  group.add(mesh)
  return mesh
}

function addSymmetricMesh(
  group: THREE.Group,
  nameBase: string,
  geometry: THREE.BufferGeometry,
  material: ShipSurfaceMaterial,
  pos: Vec3Like,
  rot: THREE.Euler = new THREE.Euler(),
  scale: Vec3Like = { x: 1, y: 1, z: 1 },
): void {
  const absX = Math.abs(pos.x)
  for (const side of SIDES) {
    const suffix = side < 0 ? 'l' : 'r'
    // Mirror Y (yaw) and Z (roll) rotation for symmetric left/right parts.
    // X (pitch) stays the same on both sides.
    const mirroredRot = new THREE.Euler(rot.x, rot.y * side, rot.z * side, rot.order)
    addMesh(
      group,
      `${nameBase}_${suffix}`,
      geometry,
      material,
      { x: absX * side, y: pos.y, z: pos.z },
      mirroredRot,
      {
        x: Math.abs(scale.x) * side,
        y: scale.y,
        z: scale.z,
      },
    )
  }
}

export function buildPlayerShipV2(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'player_ship_v2'

  const mats = createPlayerShipMaterials()
  const hullMat = mats.hull
  const heroMat = mats.hero
  const darkMat = mats.dark
  const railMat = mats.rail
  const engineMat = mats.engineCore
  const canopyMat = mats.canopy

  // Main centerline body
  addMesh(
    group,
    'player_spine',
    new THREE.CapsuleGeometry(4.4, 22, 5, 14),
    heroMat,
    { x: 0, y: -0.2, z: -0.25 },
    new THREE.Euler(Math.PI / 2, 0, 0),
  )
  addMesh(
    group,
    'player_nose',
    new THREE.ConeGeometry(4.8, 16, 14),
    heroMat,
    { x: 0, y: 18, z: 0.1 },
    new THREE.Euler(0, 0, 0),
    { x: 0.94, y: 1.0, z: 1.34 },
  )
  addMesh(
    group,
    'player_armor_mid',
    new THREE.BoxGeometry(9.6, 15.5, 7.1),
    hullMat,
    { x: 0, y: 2.5, z: -0.55 },
    new THREE.Euler(0.1, 0, 0),
  )
  addMesh(
    group,
    'player_armor_tail',
    new THREE.BoxGeometry(8.8, 11.2, 6.8),
    hullMat,
    { x: 0, y: -9.3, z: -0.95 },
    new THREE.Euler(-0.05, 0, 0),
  )

  // Cockpit assembly
  addMesh(
    group,
    'player_cockpit_base',
    new THREE.BoxGeometry(6.2, 9.2, 3.8),
    darkMat,
    { x: 0, y: 7.5, z: 1.35 },
    new THREE.Euler(-0.1, 0, 0),
  )
  addMesh(
    group,
    'player_cockpit',
    new THREE.SphereGeometry(4.5, 18, 12, 0, Math.PI * 2, 0.06, Math.PI * 0.62),
    canopyMat,
    { x: 0, y: 8.7, z: 2.45 },
    new THREE.Euler(0, 0, 0),
    { x: 0.72, y: 1.16, z: 0.88 },
  )

  // Side intakes
  addSymmetricMesh(
    group,
    'player_armor_intake',
    new THREE.BoxGeometry(3.2, 9.2, 3.9),
    darkMat,
    { x: 4.7, y: 2.1, z: 0.9 },
    new THREE.Euler(0.08, 0.18, -0.15),
  )

  // Main wing panels (thicker hard geometry to avoid one-side loss on C1 views)
  addSymmetricMesh(
    group,
    'player_wing',
    new THREE.BoxGeometry(19.5, 5.8, 4.4),
    hullMat,
    { x: 12.8, y: -2.4, z: 0.2 },
    new THREE.Euler(0.08, 0.02, -0.2),
  )
  addSymmetricMesh(
    group,
    'player_wing_lead',
    new THREE.BoxGeometry(12.4, 3.2, 3.0),
    heroMat,
    { x: 17.6, y: -0.2, z: 0.35 },
    new THREE.Euler(0.14, 0.05, -0.27),
  )
  addSymmetricMesh(
    group,
    'player_armor_wingcap',
    new THREE.BoxGeometry(9.4, 3.8, 3.5),
    heroMat,
    { x: 18.5, y: -5.6, z: 0.8 },
    new THREE.Euler(0.12, 0.04, -0.16),
  )
  addSymmetricMesh(
    group,
    'player_wing_flap',
    new THREE.BoxGeometry(10.6, 1.8, 1.5),
    hullMat,
    { x: 16.0, y: -6.4, z: 0.45 },
    new THREE.Euler(0.04, 0.03, -0.1),
  )

  // Front canards for clearer silhouette
  addSymmetricMesh(
    group,
    'player_armor_canard',
    new THREE.BoxGeometry(7.2, 2.2, 1.8),
    hullMat,
    { x: 6.2, y: 10.4, z: 0.55 },
    new THREE.Euler(0.1, 0.12, -0.34),
  )

  // Energy rails and forward rail bridge
  addSymmetricMesh(
    group,
    'player_rail',
    new THREE.BoxGeometry(1.0, 19.5, 0.95),
    railMat,
    { x: 2.85, y: 1.9, z: 2.92 },
    new THREE.Euler(0.08, 0, 0),
  )
  addMesh(
    group,
    'player_rail_nose',
    new THREE.BoxGeometry(3.6, 2.6, 1),
    railMat,
    { x: 0, y: 14.1, z: 2.58 },
    new THREE.Euler(-0.18, 0, 0),
  )

  // Rear engine bay — added manually because the Z π/2 flips the cylinder
  // from vertical to horizontal and must NOT be mirrored across sides.
  for (const side of [-1, 1]) {
    const suffix = side < 0 ? 'l' : 'r'
    addMesh(
      group,
      `player_armor_enginepod_${suffix}`,
      new THREE.CylinderGeometry(2.5, 3.2, 10.6, 12),
      darkMat,
      { x: 5.6 * side, y: -12.6, z: 0.05 },
      new THREE.Euler(0.09, 0.03 * side, Math.PI / 2),
      { x: side, y: 1, z: 1.17 },
    )
  }
  addSymmetricMesh(
    group,
    'player_engine_ring',
    new THREE.TorusGeometry(2.06, 0.45, 8, 20),
    heroMat,
    { x: 5.6, y: -16.9, z: 0.02 },
    new THREE.Euler(Math.PI / 2, 0, 0),
  )
  addSymmetricMesh(
    group,
    'player_engine_core',
    new THREE.CylinderGeometry(1.2, 1.85, 2.55, 20),
    engineMat,
    { x: 5.6, y: -17.0, z: 0.02 },
    new THREE.Euler(Math.PI / 2, 0, 0),
  )

  // Vertical tail fins
  addSymmetricMesh(
    group,
    'player_armor_fin',
    new THREE.BoxGeometry(2.0, 8.8, 1.4),
    heroMat,
    { x: 1.95, y: -11.5, z: 2.85 },
    new THREE.Euler(-0.18, 0.14, -0.08),
  )

  // Wing tip energy blades
  addSymmetricMesh(
    group,
    'player_blade',
    new THREE.BoxGeometry(1.3, 7.6, 0.95),
    railMat,
    { x: 12.6, y: -5.8, z: 1.82 },
    new THREE.Euler(0.14, 0.07, -0.28),
  )

  const muzzleGeo = new THREE.OctahedronGeometry(1, 0).scale(2.2, 5.8, 3.8)
  const muzzleMat = new THREE.MeshStandardMaterial({
    color: 0xffe28a,
    roughness: 0.22,
    metalness: 0.48,
    emissive: 0xff6a1b,
    emissiveIntensity: 0.08,
    flatShading: true,
  })
  addMesh(
    group,
    'player_muzzle_main_c1',
    muzzleGeo,
    muzzleMat,
    { x: 0, y: 22.4, z: 2.1 },
    new THREE.Euler(-0.12, 0, 0),
  )
  addSymmetricMesh(
    group,
    'player_muzzle_c1',
    muzzleGeo,
    muzzleMat,
    { x: 7.6, y: 13.8, z: 1.9 },
    new THREE.Euler(-0.08, 0.06, -0.04),
  )

  applySmoothShading(group)
  group.scale.setScalar(0.68)
  return group
}
