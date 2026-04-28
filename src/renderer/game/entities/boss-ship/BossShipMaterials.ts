import * as THREE from 'three'

export type BossSurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

export interface BossMaterialSet {
  armor: THREE.MeshStandardMaterial
  armorAccent: THREE.MeshStandardMaterial
  core: THREE.MeshPhysicalMaterial
  weapon: THREE.MeshStandardMaterial
  weakPoint: THREE.MeshPhysicalMaterial
}

export interface BossPalette {
  armorColor: number
  accentColor: number
  coreColor: number
  coreEmissive: number
  weaponColor: number
  weaponEmissive: number
  weakColor: number
  weakEmissive: number
}

const PALETTES: Record<string, BossPalette> = {
  fortress: {
    armorColor: 0x6f7f95, accentColor: 0x8e9db3,
    coreColor: 0xff7a45, coreEmissive: 0xff4411,
    weaponColor: 0x5f6e84, weaponEmissive: 0x20334a,
    weakColor: 0xffd28e, weakEmissive: 0xff7733,
  },
  scorpion: {
    armorColor: 0x8f6b3f, accentColor: 0xa88252,
    coreColor: 0xffd48a, coreEmissive: 0xff8f39,
    weaponColor: 0x7a532f, weaponEmissive: 0x361d0f,
    weakColor: 0xff8f4b, weakEmissive: 0xff5a1f,
  },
  carrier: {
    armorColor: 0x4b6074, accentColor: 0x60788e,
    coreColor: 0x92d8ff, coreEmissive: 0x3f9fff,
    weaponColor: 0x8e9fb6, weaponEmissive: 0x3f5c7e,
    weakColor: 0xffdc6e, weakEmissive: 0xffa21f,
  },
  dragon: {
    armorColor: 0x8e2f15, accentColor: 0xa84022,
    coreColor: 0xffb474, coreEmissive: 0xff6a2e,
    weaponColor: 0x6a1d0e, weaponEmissive: 0x3c1408,
    weakColor: 0xffcc8a, weakEmissive: 0xff7a33,
  },
  titan: {
    armorColor: 0x606058, accentColor: 0x7a7a72,
    coreColor: 0x89ff94, coreEmissive: 0x4bff59,
    weaponColor: 0x4f4f47, weaponEmissive: 0x1e1e18,
    weakColor: 0xd8ffc0, weakEmissive: 0x7fff5a,
  },
  eye: {
    armorColor: 0x5670a0, accentColor: 0x728cc7,
    coreColor: 0xff7c4a, coreEmissive: 0xff4a1f,
    weaponColor: 0x8f9fff, weaponEmissive: 0x4e5cff,
    weakColor: 0xffc19d, weakEmissive: 0xff8f63,
  },
  phantom: {
    armorColor: 0x6540a3, accentColor: 0x8260c8,
    coreColor: 0xd8e0ff, coreEmissive: 0x9cb4ff,
    weaponColor: 0x7e5dbe, weaponEmissive: 0x50318a,
    weakColor: 0xd9c6ff, weakEmissive: 0xb57dff,
  },
  breaker: {
    armorColor: 0x87795f, accentColor: 0xa8997c,
    coreColor: 0xffd278, coreEmissive: 0xffa023,
    weaponColor: 0x7b705a, weaponEmissive: 0x3a2e20,
    weakColor: 0xffe4a0, weakEmissive: 0xffb647,
  },
  herald: {
    armorColor: 0x452864, accentColor: 0x63428c,
    coreColor: 0xff6be0, coreEmissive: 0xb236ff,
    weaponColor: 0x7f43c6, weaponEmissive: 0x6222ba,
    weakColor: 0xf4b7ff, weakEmissive: 0xcf65ff,
  },
  archon: {
    armorColor: 0x2a2a34, accentColor: 0x42425a,
    coreColor: 0xff9d5f, coreEmissive: 0xff5a2a,
    weaponColor: 0x41e7ff, weaponEmissive: 0x1fb0ff,
    weakColor: 0xffddb8, weakEmissive: 0xffa56c,
  },
}

export function createBossMaterials(type: string): BossMaterialSet {
  const p = PALETTES[type] ?? PALETTES.fortress

  return {
    armor: new THREE.MeshStandardMaterial({
      color: p.armorColor, roughness: 0.45, metalness: 0.56, envMapIntensity: 0.72,
    }),
    armorAccent: new THREE.MeshStandardMaterial({
      color: p.accentColor, roughness: 0.38, metalness: 0.62, envMapIntensity: 0.78,
    }),
    core: new THREE.MeshPhysicalMaterial({
      color: p.coreColor, roughness: 0.22, metalness: 0.86,
      clearcoat: 0.84, clearcoatRoughness: 0.14,
      emissive: p.coreEmissive, emissiveIntensity: 1.6,
      envMapIntensity: 0.92,
    }),
    weapon: new THREE.MeshStandardMaterial({
      color: p.weaponColor, roughness: 0.37, metalness: 0.68,
      emissive: p.weaponEmissive, emissiveIntensity: 0.7,
      envMapIntensity: 0.62,
    }),
    weakPoint: new THREE.MeshPhysicalMaterial({
      color: p.weakColor, roughness: 0.2, metalness: 0.62,
      clearcoat: 1, clearcoatRoughness: 0.08,
      emissive: p.weakEmissive, emissiveIntensity: 2.0,
      transparent: false, opacity: 1,
      envMapIntensity: 0.95,
    }),
  }
}
