/**
 * WeaponTypes.ts - Type definitions for Occult Weapons, stats, and ranks.
 *
 * Capabilities:
 * - Weapon identifiers for base weapons and supreme evolutions.
 * - Per-rank statistic profiles (damage, cooldown, radius/area, velocity, projectile/strike count, pierce, knockback).
 * - Identifier normalization helpers.
 */

export type WeaponId =
  | 'scythe'
  | 'orbiters'
  | 'lightning'
  | 'spear'
  | 'aura'
  | 'arcane_scythe'
  | 'soul_orbiters'
  | 'abyssal_lightning'
  | 'bone_spear'
  | 'cursed_aura'
  | 'evolution_harvester'
  | 'evolution_vortex'
  | 'evolution_cataclysm'
  | 'evolution_torment'
  | 'evolution_decay'
  | 'soul_reaping_harvester'
  | 'abyssal_vortex'
  | 'ossuary_cataclysm'
  | 'storm_of_torment'
  | 'domain_of_decay';

export interface WeaponRankStats {
  rank: number;
  damage: number;
  cooldown: number; // in seconds
  area: number;     // radius in px or reach
  speed: number;    // projectile speed or angular velocity
  count: number;    // number of projectiles / skulls / strikes
  pierce?: number;  // pierce count for projectiles
  knockback: number;
  description: string;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  icon: string;
  maxRank: number;
  ranks: Record<number, WeaponRankStats>;
}

/**
 * Normalizes varied weapon IDs (e.g. 'arcane_scythe' or 'weapon_scythe') to standard short form.
 */
export function normalizeWeaponId(id: string): string {
  const clean = id.toLowerCase().replace(/^weapon_/, '');
  if (clean === 'arcane_scythe' || clean === 'scythe') return 'scythe';
  if (clean === 'soul_orbiters' || clean === 'orbiters') return 'orbiters';
  if (clean === 'abyssal_lightning' || clean === 'lightning') return 'lightning';
  if (clean === 'bone_spear' || clean === 'spear') return 'spear';
  if (clean === 'cursed_aura' || clean === 'aura') return 'aura';
  return clean;
}
