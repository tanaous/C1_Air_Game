import * as THREE from 'three'

export type EnemySurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

export interface EnemyMaterialSet {
  hull: THREE.MeshStandardMaterial
  accent: THREE.MeshStandardMaterial
  glow: THREE.MeshStandardMaterial
  canopy: THREE.MeshPhysicalMaterial | null
}

export interface EnemyFactionPalette {
  hullColor: number
  accentColor: number
  glowColor: number
  glowEmissive: number
  canopyColor: number
  roughnessBase: number
  metalnessBase: number
}

const PALETTES: Record<string, EnemyFactionPalette> = {
  scout: {
    hullColor: 0x6b1a1a,
    accentColor: 0x9e2c2c,
    glowColor: 0xff6020,
    glowEmissive: 0xff3d00,
    canopyColor: 0x3d1010,
    roughnessBase: 0.60,
    metalnessBase: 0.35,
  },
  fighter: {
    hullColor: 0x1a3d2d,
    accentColor: 0x2d6b4a,
    glowColor: 0x4dff94,
    glowEmissive: 0x1a8a40,
    canopyColor: 0x0d2618,
    roughnessBase: 0.52,
    metalnessBase: 0.42,
  },
  swooper: {
    hullColor: 0x2d1a52,
    accentColor: 0x5438a0,
    glowColor: 0xc47fff,
    glowEmissive: 0x7b30d0,
    canopyColor: 0x180d30,
    roughnessBase: 0.48,
    metalnessBase: 0.48,
  },
  gunship: {
    hullColor: 0x3d4048,
    accentColor: 0x6b7280,
    glowColor: 0xffaa40,
    glowEmissive: 0xd06800,
    canopyColor: 0x1e1f24,
    roughnessBase: 0.64,
    metalnessBase: 0.30,
  },
  bomber: {
    hullColor: 0x4a3d28,
    accentColor: 0x7a6b48,
    glowColor: 0xffc944,
    glowEmissive: 0xb88010,
    canopyColor: 0x2a1f10,
    roughnessBase: 0.66,
    metalnessBase: 0.28,
  },
  carrier: {
    hullColor: 0x2d3844,
    accentColor: 0x4e6279,
    glowColor: 0xff8040,
    glowEmissive: 0xc05018,
    canopyColor: 0x181e26,
    roughnessBase: 0.68,
    metalnessBase: 0.26,
  },
}

function createHullMaterial(p: EnemyFactionPalette): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: p.hullColor,
    roughness: p.roughnessBase,
    metalness: p.metalnessBase,
    envMapIntensity: 0.4,
  })
}

function createAccentMaterial(p: EnemyFactionPalette): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: p.accentColor,
    roughness: Math.max(0.22, p.roughnessBase - 0.2),
    metalness: Math.min(0.7, p.metalnessBase + 0.22),
    envMapIntensity: 0.5,
  })
}

function createGlowMaterial(p: EnemyFactionPalette): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: p.glowColor,
    roughness: 0.18,
    metalness: 0.45,
    emissive: p.glowEmissive,
    emissiveIntensity: 1.05,
    envMapIntensity: 0.55,
  })
}

function createCanopyMaterial(p: EnemyFactionPalette): THREE.MeshPhysicalMaterial | null {
  if (p.canopyColor === 0) return null
  return new THREE.MeshPhysicalMaterial({
    color: p.canopyColor,
    roughness: 0.12,
    metalness: 0.08,
    clearcoat: 0.7,
    clearcoatRoughness: 0.16,
    emissive: p.canopyColor,
    emissiveIntensity: 0.28,
    envMapIntensity: 0.5,
  })
}

export function createEnemyMaterials(type: string): EnemyMaterialSet {
  const p = PALETTES[type] ?? PALETTES.fighter
  return {
    hull: createHullMaterial(p),
    accent: createAccentMaterial(p),
    glow: createGlowMaterial(p),
    canopy: createCanopyMaterial(p),
  }
}
