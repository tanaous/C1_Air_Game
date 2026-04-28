import * as THREE from 'three'
import { attachFresnelRim, type FresnelRimHandle } from '@/rendering/FresnelRim'

export type ShipSurfaceMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

export interface PlayerShipMaterialSet {
  hull: THREE.MeshStandardMaterial
  hero: THREE.MeshPhysicalMaterial
  dark: THREE.MeshStandardMaterial
  rail: THREE.MeshStandardMaterial
  engineCore: THREE.MeshStandardMaterial
  canopy: THREE.MeshPhysicalMaterial
  hullRim: FresnelRimHandle
  heroRim: FresnelRimHandle
  canopyRim: FresnelRimHandle
}

function createHullMaterial(color: number, roughness: number, metalness: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    envMapIntensity: 0.75,
  })
}

function createHeroCoatMaterial(color: number): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.28,
    metalness: 0.9,
    clearcoat: 0.9,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.95,
  })
}

function createEnergyMaterial(color: number, emissive: number, emissiveIntensity: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.22,
    metalness: 0.35,
    emissive,
    emissiveIntensity,
  })
}

function createCanopyMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: 0x7fd6ff,
    roughness: 0.1,
    metalness: 0.02,
    transmission: 0,
    thickness: 0,
    ior: 1.18,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: 0x0d6ea4,
    emissiveIntensity: 0.45,
    transparent: false,
    opacity: 1,
    envMapIntensity: 0.9,
  })
}

export function createPlayerShipMaterials(): PlayerShipMaterialSet {
  const hull = createHullMaterial(0xd9e7ff, 0.44, 0.62)
  const hero = createHeroCoatMaterial(0xa6bdd8)
  const dark = createHullMaterial(0x2b3446, 0.62, 0.5)
  const rail = createEnergyMaterial(0x63bfff, 0x1e90ff, 0.9)
  const engineCore = createEnergyMaterial(0xff8f47, 0xff5a1f, 2.4)
  const canopy = createCanopyMaterial()

  const hullRim = attachFresnelRim(hull, { color: 0xa0d9ff, power: 3.0, intensity: 0.08 })
  const heroRim = attachFresnelRim(hero, { color: 0xc6f1ff, power: 2.6, intensity: 0.14 })
  const canopyRim = attachFresnelRim(canopy, { color: 0x9de9ff, power: 2.2, intensity: 0.34 })

  return {
    hull,
    hero,
    dark,
    rail,
    engineCore,
    canopy,
    hullRim,
    heroRim,
    canopyRim,
  }
}
