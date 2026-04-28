import type { BiomeType, StageStatus } from '@shared/types'

export interface StageDefinition {
  index: number
  number: number
  name: string
  biome: BiomeType
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  { index: 0, number: 1, name: 'Surface Approach', biome: 'earth_plains' },
  { index: 1, number: 2, name: 'Dune Breakline', biome: 'earth_desert' },
  { index: 2, number: 3, name: 'Abyssal Shelf', biome: 'earth_ocean' },
  { index: 3, number: 4, name: 'Volcanic Run', biome: 'earth_volcanic' },
  { index: 4, number: 5, name: 'Ruin Gate', biome: 'earth_ruins' },
  { index: 5, number: 6, name: 'Orbital Climb', biome: 'space_orbit' },
  { index: 6, number: 7, name: 'Deep Space', biome: 'space_deep' },
  { index: 7, number: 8, name: 'Asteroid Scar', biome: 'space_asteroid' },
  { index: 8, number: 9, name: 'Event Horizon', biome: 'space_blackhole' },
  { index: 9, number: 10, name: 'Final Vector', biome: 'space_final' },
]

export function getStageDefinition(index: number): StageDefinition {
  const safeIndex = Math.max(0, Math.min(STAGE_DEFINITIONS.length - 1, Math.floor(index)))
  return STAGE_DEFINITIONS[safeIndex]
}

export function getStageCount(): number {
  return STAGE_DEFINITIONS.length
}

export function createStageStatus(
  bossesDefeated: number,
  distance: number,
  nextBossAt: number,
  warning: boolean,
  bossActive: boolean,
  cleared = false,
): StageStatus {
  const stage = getStageDefinition(bossesDefeated)
  return {
    ...stage,
    bossesDefeated,
    distance,
    nextBossAt,
    distanceToBoss: cleared || bossActive || warning ? 0 : Math.max(0, nextBossAt - distance),
    warning,
    bossActive,
    cleared,
  }
}
