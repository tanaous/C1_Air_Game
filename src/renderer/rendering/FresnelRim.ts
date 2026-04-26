import * as THREE from 'three'

export type FresnelCompatibleMaterial = THREE.MeshStandardMaterial | THREE.MeshPhysicalMaterial

export interface FresnelRimOptions {
  color?: THREE.ColorRepresentation
  power?: number
  intensity?: number
}

export interface FresnelRimHandle {
  setIntensity: (value: number) => void
  setPower: (value: number) => void
  setColor: (value: THREE.ColorRepresentation) => void
  getIntensity: () => number
}

const HANDLE_KEY = '__fresnelRimHandle'
type CompiledShader = Parameters<THREE.Material['onBeforeCompile']>[0]

interface FresnelRuntimeState {
  color: THREE.Color
  power: number
  intensity: number
  shader: CompiledShader | null
}

function isFresnelCompatibleMaterial(mat: unknown): mat is FresnelCompatibleMaterial {
  return mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export function attachFresnelRim(
  material: FresnelCompatibleMaterial,
  options: FresnelRimOptions = {},
): FresnelRimHandle {
  const existing = getFresnelRimHandle(material)
  if (existing) return existing

  const state: FresnelRuntimeState = {
    color: new THREE.Color(options.color ?? 0xa5e4ff),
    power: Math.max(0.5, options.power ?? 2.7),
    intensity: clamp01(options.intensity ?? 0.25),
    shader: null,
  }

  const baseOnBeforeCompile = material.onBeforeCompile.bind(material)
  material.onBeforeCompile = (shader, renderer) => {
    baseOnBeforeCompile(shader, renderer)
    state.shader = shader
    shader.uniforms.fresnelRimColor = { value: state.color }
    shader.uniforms.fresnelRimPower = { value: state.power }
    shader.uniforms.fresnelRimIntensity = { value: state.intensity }

    if (!shader.fragmentShader.includes('uniform vec3 fresnelRimColor;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
uniform vec3 fresnelRimColor;
uniform float fresnelRimPower;
uniform float fresnelRimIntensity;`,
      )
    }

    const rimBlendBlock = `
float fresnelView = 1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
float fresnelRim = pow(fresnelView, fresnelRimPower);
outgoingLight += fresnelRimColor * (fresnelRim * fresnelRimIntensity);`

    if (shader.fragmentShader.includes('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
${rimBlendBlock}`,
      )
    } else if (shader.fragmentShader.includes('#include <output_fragment>')) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <output_fragment>',
        `${rimBlendBlock}
#include <output_fragment>`,
      )
    }
  }

  const baseCacheKey = material.customProgramCacheKey?.bind(material)
  material.customProgramCacheKey = () => {
    const base = baseCacheKey ? baseCacheKey() : ''
    return `${base}|fresnel_rim_v1`
  }
  material.needsUpdate = true

  const handle: FresnelRimHandle = {
    setIntensity: (value: number) => {
      state.intensity = clamp01(value)
      if (state.shader) state.shader.uniforms.fresnelRimIntensity.value = state.intensity
    },
    setPower: (value: number) => {
      state.power = Math.max(0.5, value)
      if (state.shader) state.shader.uniforms.fresnelRimPower.value = state.power
    },
    setColor: (value: THREE.ColorRepresentation) => {
      state.color.set(value)
      if (state.shader) state.shader.uniforms.fresnelRimColor.value = state.color
    },
    getIntensity: () => state.intensity,
  }

  ;(material.userData as Record<string, unknown>)[HANDLE_KEY] = handle
  return handle
}

export function getFresnelRimHandle(mat: unknown): FresnelRimHandle | null {
  if (!isFresnelCompatibleMaterial(mat)) return null
  const value = (mat.userData as Record<string, unknown>)[HANDLE_KEY]
  if (!value) return null
  return value as FresnelRimHandle
}
