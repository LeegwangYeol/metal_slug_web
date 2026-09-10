/**
 * PlayerStats.ts - Core 11 Player Statistics & Passive Modifier System.
 *
 * Implements additive flat bonuses, percentage scaling, and hard CDR clamping (50% max).
 */

export interface PlayerStats {
  maxHealth: number;
  currentHealth: number;
  healthRegen: number;
  armor: number;
  moveSpeed: number;
  might: number;
  area: number;
  projSpeed: number;
  cooldownReduction: number;
  magnetRadius: number;
  luck: number;
}

export interface PassiveModifier {
  id: string;
  name: string;
  stat: keyof PlayerStats;
  type: 'flat' | 'percent';
  value: number;
}

export const DEFAULT_PLAYER_STATS: PlayerStats = {
  maxHealth: 100,
  currentHealth: 100,
  healthRegen: 0.2,
  armor: 0,
  moveSpeed: 200,
  might: 1.0,
  area: 1.0,
  projSpeed: 1.0,
  cooldownReduction: 0.0,
  magnetRadius: 90,
  luck: 1.0,
};

export class PlayerStatsManager {
  private baseStats: PlayerStats;
  private modifiers: PassiveModifier[] = [];

  constructor(baseStats: PlayerStats = DEFAULT_PLAYER_STATS) {
    this.baseStats = { ...baseStats };
  }

  public getBaseStats(): PlayerStats {
    return { ...this.baseStats };
  }

  public setBaseStat(stat: keyof PlayerStats, value: number): void {
    this.baseStats[stat] = value;
  }

  public addPassiveModifier(mod: PassiveModifier): void {
    this.modifiers.push(mod);
  }

  public removePassiveModifier(id: string): void {
    const idx = this.modifiers.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.modifiers.splice(idx, 1);
    }
  }

  public getModifiers(): readonly PassiveModifier[] {
    return this.modifiers;
  }

  public clearModifiers(): void {
    this.modifiers = [];
  }

  /**
   * Computes current effective stats after applying all active flat and percent modifiers.
   * Formula: effective = (base + flatBonuses) * (1 + percentBonuses).
   * Enforces 50% max CDR ceiling.
   */
  public getEffectiveStats(): PlayerStats {
    const result = { ...this.baseStats };

    const flatBonuses: Partial<Record<keyof PlayerStats, number>> = {};
    const percentBonuses: Partial<Record<keyof PlayerStats, number>> = {};

    for (const mod of this.modifiers) {
      if (mod.type === 'flat') {
        flatBonuses[mod.stat] = (flatBonuses[mod.stat] ?? 0) + mod.value;
      } else if (mod.type === 'percent') {
        percentBonuses[mod.stat] = (percentBonuses[mod.stat] ?? 0) + mod.value;
      }
    }

    const statKeys = Object.keys(this.baseStats) as (keyof PlayerStats)[];
    for (const key of statKeys) {
      const base = this.baseStats[key];
      const flat = flatBonuses[key] ?? 0;
      const pct = percentBonuses[key] ?? 0;

      let effective = (base + flat) * (1 + pct);

      if (key === 'cooldownReduction') {
        effective = Math.min(0.50, Math.max(0.0, effective));
      }

      result[key] = effective;
    }

    if (result.currentHealth > result.maxHealth) {
      result.currentHealth = result.maxHealth;
    }

    return result;
  }
}
