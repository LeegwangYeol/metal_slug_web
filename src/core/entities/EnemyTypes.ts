/**
 * EnemyTypes.ts - Undead Enemy Archetypes, Base Stats, and Data Contracts.
 *
 * Provides specifications for Skeletons, Ghouls, Banshees, and Death Knights.
 */

export type GemType = 'emerald' | 'ruby' | 'violet';

export type EnemyType =
  | 'skeleton'
  | 'ghoul'
  | 'banshee'
  | 'death_knight'
  | 'SKELETON'
  | 'GHOUL'
  | 'BANSHEE'
  | 'DEATH_KNIGHT';

export interface EnemyStatsConfig {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  mass: number;
  gemType: GemType;
  xpValue: number;
}

export const ENEMY_BASE_STATS: Record<string, EnemyStatsConfig> = {
  skeleton: {
    hp: 25,
    speed: 65,
    radius: 12,
    damage: 10,
    mass: 1.0,
    gemType: 'emerald',
    xpValue: 1,
  },
  ghoul: {
    hp: 45,
    speed: 110,
    radius: 14,
    damage: 15,
    mass: 1.2,
    gemType: 'emerald',
    xpValue: 2,
  },
  banshee: {
    hp: 80,
    speed: 75,
    radius: 16,
    damage: 20,
    mass: 0.8,
    gemType: 'ruby',
    xpValue: 5,
  },
  death_knight: {
    hp: 350,
    speed: 40,
    radius: 22,
    damage: 40,
    mass: 5.0,
    gemType: 'violet',
    xpValue: 20,
  },
};

export function normalizeEnemyType(type: EnemyType | string): string {
  const lower = type.toLowerCase();
  if (lower in ENEMY_BASE_STATS) {
    return lower;
  }
  return 'skeleton';
}
