/**
 * UpgradeSystem.ts - Occult Arsenal Upgrades, Passives & Synergies.
 *
 * Requirements:
 * - 5 Weapons with Ranks 1 to 5.
 * - 5 Passives with Ranks 1 to 5 (Might, Velocity, Chalice, Magnet, Armor).
 * - 5 Weapon Evolutions (Weapon Rank 5 + Passive Owned).
 * - Inventory quotas: Max 6 weapons, Max 6 passives.
 * - Weighted random card generator (never offers maxed items).
 */

import { Player } from '../entities/Player';
import { PlayerStats, PlayerStatsManager } from '../player/PlayerStats';
import { InventorySlotData } from '../../ui/GothicHUD';
import { normalizeWeaponId } from '../weapons/WeaponTypes';

export enum UpgradeType {
  WEAPON_UNLOCK = 'WEAPON_UNLOCK',
  WEAPON_RANK = 'WEAPON_RANK',
  PASSIVE_UNLOCK = 'PASSIVE_UNLOCK',
  PASSIVE_RANK = 'PASSIVE_RANK',
  WEAPON_EVOLUTION = 'WEAPON_EVOLUTION',
  FALLBACK = 'FALLBACK',
}

export type UpgradeCategory = 'weapon' | 'passive' | 'evolution' | 'fallback';

export interface UpgradeCard {
  id: string;
  itemId: string;
  name: string;
  subtitle: string;
  category: UpgradeCategory;
  type: UpgradeType;
  icon: string;
  previousRank: number;
  newRank: number;
  maxRank: number;
  description: string;
  statChangeDescription: string;
  isEvolution: boolean;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  rankDescriptions: string[];
  statDeltas: string[];
}

export interface PassiveDefinition {
  id: string;
  name: string;
  icon: string;
  stat: keyof PlayerStats;
  deltaPerRank: number;
  secondaryStat?: keyof PlayerStats;
  secondaryDeltaPerRank?: number;
  rankDescriptions: string[];
  statDeltas: string[];
}

export interface EvolutionDefinition {
  id: string;
  name: string;
  weaponId: string;
  passiveId: string;
  icon: string;
  description: string;
  statChangeDescription: string;
}

export const OCCULT_PASSIVES: Record<string, PassiveDefinition> = {
  passive_might: {
    id: 'passive_might',
    name: 'Tome of Might',
    icon: 'tome',
    stat: 'might',
    deltaPerRank: 0.10, // +10% damage
    rankDescriptions: [
      'Inscribes forbidden runes of ruin, amplifying occult power.',
      '+10% Damage to all weapons.',
      '+10% Damage (Total +20%).',
      '+10% Damage (Total +30%).',
      '+10% Damage (Total +40%).',
      '+10% Damage (Total +50% Maximum Might).',
    ],
    statDeltas: ['+10% Damage', '+10% Damage', '+10% Damage', '+10% Damage', '+10% Damage'],
  },
  passive_velocity: {
    id: 'passive_velocity',
    name: 'Ring of Velocity',
    icon: 'ring',
    stat: 'moveSpeed',
    deltaPerRank: 20.0, // +10% base speed (base 200)
    rankDescriptions: [
      'An obsidian band imbued with phantom wind.',
      '+10% Movement Speed.',
      '+10% Movement Speed (Total +20%).',
      '+10% Movement Speed (Total +30%).',
      '+10% Movement Speed (Total +40%).',
      '+10% Movement Speed (Total +50% Maximum Velocity).',
    ],
    statDeltas: ['+20 Move Speed', '+20 Move Speed', '+20 Move Speed', '+20 Move Speed', '+20 Move Speed'],
  },
  passive_chalice: {
    id: 'passive_chalice',
    name: 'Blood Chalice',
    icon: 'chalice',
    stat: 'maxHealth',
    deltaPerRank: 20,
    secondaryStat: 'healthRegen',
    secondaryDeltaPerRank: 0.5,
    rankDescriptions: [
      'An unholy reliquary of immortal blood.',
      '+20 Max HP & +0.5 HP/s Regeneration.',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +40 HP, +1.0/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +60 HP, +1.5/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +80 HP, +2.0/s).',
      '+20 Max HP & +0.5 HP/s Regeneration (Total +100 HP, +2.5/s).',
    ],
    statDeltas: [
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
      '+20 Max HP, +0.5 HP/s',
    ],
  },
  passive_magnet: {
    id: 'passive_magnet',
    name: 'Eldritch Magnet',
    icon: 'magnet',
    stat: 'magnetRadius',
    deltaPerRank: 22.5, // +25% of base 90
    rankDescriptions: [
      'Attunes the soul to draw nearby spiritual essence.',
      '+25% Soul Magnet Radius.',
      '+25% Soul Magnet Radius (Total +50%).',
      '+25% Soul Magnet Radius (Total +75%).',
      '+25% Soul Magnet Radius (Total +100%).',
      '+25% Soul Magnet Radius (Total +125% Maximum Range).',
    ],
    statDeltas: ['+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius', '+22.5 Magnet Radius'],
  },
  passive_armor: {
    id: 'passive_armor',
    name: 'Obsidian Armor',
    icon: 'armor',
    stat: 'armor',
    deltaPerRank: 1.0,
    rankDescriptions: [
      'Forged in volcanic depths to deflect mortal and undead blows.',
      '+1 Armor (Flat Damage Reduction).',
      '+1 Armor (Total 2 Damage Reduction).',
      '+1 Armor (Total 3 Damage Reduction).',
      '+1 Armor (Total 4 Damage Reduction).',
      '+1 Armor (Total 5 Maximum Damage Reduction).',
    ],
    statDeltas: ['+1 Armor', '+1 Armor', '+1 Armor', '+1 Armor', '+1 Armor'],
  },
};

export const OCCULT_WEAPONS: Record<string, WeaponDefinition> = {
  weapon_scythe: {
    id: 'weapon_scythe',
    name: 'Arcane Scythe',
    icon: 'scythe',
    description: 'Sweeping spectral blade cleaving arcs through forward enemy swarms.',
    rankDescriptions: [
      'Cleaves an arc cutting through forward enemy clusters.',
      '+20% Damage & +15% Cleave Range.',
      '-15% Cooldown & +1 Max Cleave Targets.',
      '+25% Damage & +15% Cleave Range.',
      'Double Cleave Strike (instant reverse back-slash) & +20% Damage.',
    ],
    statDeltas: ['Base Cleave: 25 Dmg', '+20% Dmg, +15% Range', '-15% Cooldown, +1 Target', '+25% Dmg, +15% Range', 'Double Cleave, +20% Dmg'],
  },
  weapon_orbiters: {
    id: 'weapon_orbiters',
    name: 'Soul Orbiters',
    icon: 'orbiters',
    description: 'Orbiting skull flames that incinerate encroaching undead on contact.',
    rankDescriptions: [
      '2 spectral skulls orbit the sorcerer, burning enemies on contact.',
      '+1 Skull (3 total) & +10% Orbit Velocity.',
      '+20% Damage & +10px Orbit Radius.',
      '+1 Skull (4 total) & +15% Orbit Velocity.',
      '+1 Skull (5 total) & Skulls pulse radial necrotic flares every 2s.',
    ],
    statDeltas: ['2 Skulls, 12 Dmg', '+1 Skull, +10% Speed', '+20% Dmg, +10px Radius', '+1 Skull, +15% Speed', '+1 Skull, Radial Flares'],
  },
  weapon_lightning: {
    id: 'weapon_lightning',
    name: 'Abyssal Lightning',
    icon: 'lightning',
    description: 'Strikes random dense enemy clusters with chaining electrical necrosis.',
    rankDescriptions: [
      'Strikes a random foe in range, chaining necrotic bolts to adjacent enemies.',
      '+1 Strike Target & -10% Cooldown.',
      '+1 Chain Jump per strike & +25% Damage.',
      '+1 Strike Target & -15% Cooldown.',
      'Impacts leave lingering electrified ground zones for 1s.',
    ],
    statDeltas: ['1 Target, 40 Dmg', '+1 Target, -10% Cooldown', '+1 Chain, +25% Dmg', '+1 Target, -15% Cooldown', 'Ground Shockpools'],
  },
  weapon_spear: {
    id: 'weapon_spear',
    name: 'Bone Spear',
    icon: 'spear',
    description: 'High-velocity piercing projectiles penetrating multiple undead in a line.',
    rankDescriptions: [
      'Hurls a piercing lance through up to 3 enemies in a straight line.',
      '+1 Spear (fires 2 spears in spread) & +10% Velocity.',
      '+2 Pierce Count (pierces up to 5 enemies) & +20% Damage.',
      '+1 Spear (fires 3 spears) & -15% Cooldown.',
      'Spears shatter into 3 piercing bone shards upon exhausting pierce.',
    ],
    statDeltas: ['35 Dmg, Pierce 3', '+1 Spear, +10% Speed', '+2 Pierce, +20% Dmg', '+1 Spear, -15% Cooldown', 'Shattering Shards'],
  },
  weapon_aura: {
    id: 'weapon_aura',
    name: 'Cursed Aura',
    icon: 'aura',
    description: 'Periodic pulsating damage ring centered on the player with knockback.',
    rankDescriptions: [
      'Emits a periodic shockwave of dark energy repelling nearby foes.',
      '+20% Aura Radius & +20% Damage.',
      '-20% Pulse Cadence & +25% Knockback Force.',
      '+25% Aura Radius & +25% Damage.',
      'Cursed Vulnerability: damaged enemies suffer +20% damage from all weapons for 3s.',
    ],
    statDeltas: ['15 Dmg, 90px Radius', '+20% Radius, +20% Dmg', '-20% Cadence, +25% Knockback', '+25% Radius, +25% Dmg', 'Cursed Vulnerability (+20%)'],
  },
};

export const OCCULT_EVOLUTIONS: Record<string, EvolutionDefinition> = {
  evolution_harvester: {
    id: 'soul_reaping_harvester',
    name: 'Soul Reaping Harvester',
    weaponId: 'weapon_scythe',
    passiveId: 'passive_chalice',
    icon: 'scythe',
    description: 'Colossal 360-degree crimson sweep. Slain foes have a 15% chance to drop Blood Shards that heal 2 HP.',
    statChangeDescription: '360° Harvest • 80 Damage • 15% Life Shard Drop',
  },
  evolution_vortex: {
    id: 'abyssal_vortex',
    name: 'Abyssal Vortex',
    weaponId: 'weapon_orbiters',
    passiveId: 'passive_velocity',
    icon: 'orbiters',
    description: '8 accelerated skulls form a gravitational whirlpool pulling enemies into crushing void flames.',
    statChangeDescription: '8 Orbiting Skulls • +100% Speed • Micro-Vacuum Pull',
  },
  evolution_cataclysm: {
    id: 'ossuary_cataclysm',
    name: 'Ossuary Cataclysm',
    weaponId: 'weapon_spear',
    passiveId: 'passive_might',
    icon: 'spear',
    description: 'Fires 4 ancient dragon lances with infinite screen-wide pierce that erupt in 75 AoE bone cataclysms.',
    statChangeDescription: '4 Colossus Lances • Infinite Pierce • 75 AoE Eruptions',
  },
  evolution_torment: {
    id: 'storm_of_torment',
    name: 'Storm of Torment',
    weaponId: 'weapon_lightning',
    passiveId: 'passive_magnet',
    icon: 'lightning',
    description: 'Continuous necrotic tempest strikes 6 targets every 0.8s, electrocuting swarms and drawing soul gems to impact.',
    statChangeDescription: '6 Simultaneous Strikes • 0.8s Rate • Gem Attraction',
  },
  evolution_decay: {
    id: 'domain_of_decay',
    name: 'Domain of Decay',
    weaponId: 'weapon_aura',
    passiveId: 'passive_armor',
    icon: 'aura',
    description: 'Permanent 160px death blight dealing continuous ticks, slowing foes by 40%, and absorbing 25% incoming damage.',
    statChangeDescription: 'Permanent Blight Field • 40% Enemy Slow • +25% Damage Absorb',
  },
};

/**
 * Normalizes item identifiers (e.g. 'arcane_scythe' -> 'weapon_scythe', 'tome_of_might' -> 'passive_might').
 */
function normalizeItemId(id: string): string {
  const s = id.toLowerCase();
  if (s === 'arcane_scythe' || s === 'scythe' || s === 'weapon_scythe') return 'weapon_scythe';
  if (s === 'soul_orbiters' || s === 'orbiters' || s === 'weapon_orbiters') return 'weapon_orbiters';
  if (s === 'abyssal_lightning' || s === 'lightning' || s === 'weapon_lightning') return 'weapon_lightning';
  if (s === 'bone_spear' || s === 'spear' || s === 'weapon_spear') return 'weapon_spear';
  if (s === 'cursed_aura' || s === 'aura' || s === 'weapon_aura') return 'weapon_aura';

  if (s === 'tome_of_might' || s === 'tome' || s === 'passive_might') return 'passive_might';
  if (s === 'ring_of_velocity' || s === 'ring' || s === 'passive_velocity') return 'passive_velocity';
  if (s === 'blood_chalice' || s === 'chalice' || s === 'passive_chalice') return 'passive_chalice';
  if (s === 'eldritch_magnet' || s === 'magnet' || s === 'passive_magnet') return 'passive_magnet';
  if (s === 'obsidian_armor' || s === 'armor' || s === 'passive_armor') return 'passive_armor';

  return s;
}

export class UpgradeSystem {
  public static readonly MAX_WEAPON_SLOTS = 6;
  public static readonly MAX_PASSIVE_SLOTS = 6;

  public player?: Player;
  public statsManager?: PlayerStatsManager;

  private weapons: Map<string, { rank: number; isEvolution: boolean; rawId: string }> = new Map();
  private passives: Map<string, { rank: number; rawId: string }> = new Map();
  private readonly evolvedWeapons: Set<string> = new Set();

  constructor(player?: Player, statsManager?: PlayerStatsManager) {
    this.player = player;
    this.statsManager = statsManager;
    this.reset('');
  }

  public reset(starterWeaponId: string = '', starterRank: number = 1): void {
    this.weapons.clear();
    this.passives.clear();
    this.evolvedWeapons.clear();
    if (starterWeaponId) {
      this.addWeapon(starterWeaponId, starterRank);
    }
  }

  // --- Weapon Queries & Slots ---
  public getWeaponSlotsCount(): number {
    return this.weapons.size;
  }

  public canAddWeapon(id: string): boolean {
    const norm = normalizeItemId(id);
    if (this.weapons.has(norm)) return true;
    return this.weapons.size < UpgradeSystem.MAX_WEAPON_SLOTS;
  }

  public addWeapon(id: string, rank: number = 1): void {
    const norm = normalizeItemId(id);
    if (!this.weapons.has(norm)) {
      if (this.weapons.size < UpgradeSystem.MAX_WEAPON_SLOTS) {
        this.weapons.set(norm, { rank, isEvolution: false, rawId: id });
      }
    } else {
      const w = this.weapons.get(norm)!;
      w.rank = Math.max(w.rank, rank);
    }
  }

  public hasWeapon(id: string): boolean {
    const norm = normalizeItemId(id);
    if (this.weapons.has(norm)) return true;
    for (const w of this.weapons.values()) {
      if (w.rawId === id) return true;
    }
    return false;
  }

  public getWeaponRank(weaponId: string): number {
    if (this.isWeaponEvolved(weaponId)) return 5;
    const norm = normalizeItemId(weaponId);
    return this.weapons.get(norm)?.rank ?? 0;
  }

  public isWeaponEvolved(weaponId: string): boolean {
    const norm = normalizeItemId(weaponId);
    const normW = normalizeWeaponId(weaponId);
    return (
      this.evolvedWeapons.has(normW) ||
      this.evolvedWeapons.has(norm) ||
      (this.weapons.get(norm)?.isEvolution ?? false)
    );
  }

  // --- Passive Queries & Slots ---
  public getPassiveSlotsCount(): number {
    return this.passives.size;
  }

  public canAddPassive(id: string): boolean {
    const norm = normalizeItemId(id);
    if (this.passives.has(norm)) return true;
    return this.passives.size < UpgradeSystem.MAX_PASSIVE_SLOTS;
  }

  public addPassive(id: string, rank: number = 1): void {
    const norm = normalizeItemId(id);
    if (!this.passives.has(norm)) {
      if (this.passives.size < UpgradeSystem.MAX_PASSIVE_SLOTS) {
        this.passives.set(norm, { rank, rawId: id });
        this.applyPassiveStats(norm, rank);
      }
    } else {
      const p = this.passives.get(norm)!;
      const oldRank = p.rank;
      p.rank = Math.max(p.rank, rank);
      for (let r = oldRank + 1; r <= p.rank; r++) {
        this.applyPassiveStats(norm, 1);
      }
    }
  }

  public hasPassive(id: string): boolean {
    const norm = normalizeItemId(id);
    if (this.passives.has(norm)) return true;
    for (const p of this.passives.values()) {
      if (p.rawId === id) return true;
    }
    return false;
  }

  public getPassiveRank(passiveId: string): number {
    const norm = normalizeItemId(passiveId);
    return this.passives.get(norm)?.rank ?? 0;
  }

  // --- Generic Item Queries ---
  public getItemRank(id: string): number {
    const norm = normalizeItemId(id);
    if (this.weapons.has(norm)) return this.weapons.get(norm)!.rank;
    if (this.passives.has(norm)) return this.passives.get(norm)!.rank;
    return 0;
  }

  public upgradeItem(id: string): void {
    const norm = normalizeItemId(id);
    if (this.isWeaponEvolved(id) || this.isWeaponEvolved(norm)) {
      return;
    }
    if (OCCULT_PASSIVES[norm]) {
      const cur = this.getPassiveRank(norm);
      if (cur === 0) {
        this.addPassive(id, 1);
      } else if (cur < 5) {
        this.passives.get(norm)!.rank = cur + 1;
        this.applyPassiveStats(norm, 1);
      }
    } else if (OCCULT_WEAPONS[norm]) {
      const cur = this.getWeaponRank(norm);
      if (cur === 0) {
        this.addWeapon(id, 1);
      } else if (cur < 5) {
        this.weapons.get(norm)!.rank = cur + 1;
      }
    } else {
      // Dynamic fallback for custom/unregistered item keys
      if (this.weapons.has(norm)) {
        const cur = this.weapons.get(norm)!.rank;
        if (cur < 5) this.weapons.get(norm)!.rank = cur + 1;
      } else if (this.passives.has(norm)) {
        const cur = this.passives.get(norm)!.rank;
        if (cur < 5) {
          this.passives.get(norm)!.rank = cur + 1;
          this.applyPassiveStats(norm, 1);
        }
      }
    }
  }

  private applyPassiveStats(passiveKey: string, rankDeltas: number = 1): void {
    const def = OCCULT_PASSIVES[passiveKey];
    if (!def) return;

    for (let i = 0; i < rankDeltas; i++) {
      if (this.player) {
        this.player.applyStatDelta(def.stat, def.deltaPerRank);
        if (def.secondaryStat && def.secondaryDeltaPerRank) {
          this.player.applyStatDelta(def.secondaryStat, def.secondaryDeltaPerRank);
        }
      }
      if (this.statsManager) {
        this.statsManager.addPassiveModifier({
          id: `${def.id}_${Date.now()}_${Math.random()}`,
          name: def.name,
          stat: def.stat,
          type: 'flat',
          value: def.deltaPerRank,
        });
        if (def.secondaryStat && def.secondaryDeltaPerRank) {
          this.statsManager.addPassiveModifier({
            id: `${def.id}_sec_${Date.now()}_${Math.random()}`,
            name: def.name,
            stat: def.secondaryStat,
            type: 'flat',
            value: def.secondaryDeltaPerRank,
          });
        }
      }
    }
  }

  // --- Evolution Eligibility & Evolution ---
  public isEvolutionEligible(weaponId: string): boolean {
    const normWeapon = normalizeItemId(weaponId);
    const weaponData = this.weapons.get(normWeapon);
    if (!weaponData || weaponData.rank < 5 || weaponData.isEvolution) return false;

    // Find required passive
    for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
      if (normalizeItemId(evo.weaponId) === normWeapon) {
        return this.getPassiveRank(evo.passiveId) >= 1;
      }
    }
    return false;
  }

  public evolveWeapon(weaponId: string, evolutionId: string): void {
    const normBase = normalizeItemId(weaponId);
    const normW = normalizeWeaponId(weaponId);
    this.evolvedWeapons.add(normW);
    this.evolvedWeapons.add(normBase);

    const weapon = this.weapons.get(normBase);
    if (weapon) {
      this.weapons.delete(normBase);
      const normEvo = normalizeItemId(evolutionId);
      this.weapons.set(normEvo, {
        rank: 5,
        isEvolution: true,
        rawId: evolutionId,
      });
    }
  }

  // --- Inventory Lists for GothicHUD ---
  public getWeaponsInventory(): InventorySlotData[] {
    const list: InventorySlotData[] = [];
    for (const [id, data] of this.weapons.entries()) {
      const def = OCCULT_WEAPONS[id];
      list.push({
        id,
        name: def?.name ?? data.rawId,
        icon: def?.icon ?? 'scythe',
        rank: data.rank,
        maxRank: 5,
        isEvolution: data.isEvolution,
      });
    }
    return list;
  }

  public getPassivesInventory(): InventorySlotData[] {
    const list: InventorySlotData[] = [];
    for (const [id, data] of this.passives.entries()) {
      const def = OCCULT_PASSIVES[id];
      list.push({
        id,
        name: def?.name ?? data.rawId,
        icon: def?.icon ?? 'tome',
        rank: data.rank,
        maxRank: 5,
      });
    }
    return list;
  }

  // --- Card Generation Algorithm ---
  public generateUpgradeCards(count: number = 3): UpgradeCard[] {
    const candidates: UpgradeCard[] = [];

    // 1. Check for Eligible Evolutions
    for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
      const normW = normalizeItemId(evo.weaponId);
      const weaponState = this.weapons.get(normW);
      const passiveRank = this.getPassiveRank(evo.passiveId);

      if (weaponState && weaponState.rank >= 5 && !weaponState.isEvolution && passiveRank >= 1) {
        candidates.push({
          id: evo.id,
          itemId: evo.id,
          name: evo.name,
          subtitle: '★ SUPREME EVOLUTION ★',
          category: 'evolution',
          type: UpgradeType.WEAPON_EVOLUTION,
          icon: evo.icon,
          previousRank: 5,
          newRank: 5,
          maxRank: 5,
          description: evo.description,
          statChangeDescription: evo.statChangeDescription,
          isEvolution: true,
        });
      }
    }

    // 2. Check for Weapon Upgrades or New Unlocks
    const canAddWeapon = this.weapons.size < UpgradeSystem.MAX_WEAPON_SLOTS;
    for (const weapon of Object.values(OCCULT_WEAPONS)) {
      const normW = normalizeItemId(weapon.id);
      if (this.isWeaponEvolved(weapon.id) || this.isWeaponEvolved(normW)) {
        continue;
      }
      const rank = this.getWeaponRank(normW);

      if (rank > 0 && rank < 5) {
        candidates.push({
          id: `${weapon.id}_rank_${rank + 1}`,
          itemId: weapon.id,
          name: weapon.name,
          subtitle: `Rank ${rank} → Rank ${rank + 1}`,
          category: 'weapon',
          type: UpgradeType.WEAPON_RANK,
          icon: weapon.icon,
          previousRank: rank,
          newRank: rank + 1,
          maxRank: 5,
          description: weapon.rankDescriptions[rank] ?? '+Damage & -Cooldown',
          statChangeDescription: weapon.statDeltas[rank] ?? '+Stats',
          isEvolution: false,
        });
      } else if (rank === 0 && canAddWeapon) {
        candidates.push({
          id: `${weapon.id}_unlock`,
          itemId: weapon.id,
          name: weapon.name,
          subtitle: 'NEW WEAPON',
          category: 'weapon',
          type: UpgradeType.WEAPON_UNLOCK,
          icon: weapon.icon,
          previousRank: 0,
          newRank: 1,
          maxRank: 5,
          description: weapon.rankDescriptions[0] ?? weapon.description,
          statChangeDescription: weapon.statDeltas[0] ?? 'Unlock Weapon',
          isEvolution: false,
        });
      }
    }

    // Also include custom weapons owned by player not in OCCULT_WEAPONS
    for (const [wKey, wData] of this.weapons.entries()) {
      if (!OCCULT_WEAPONS[wKey] && wData.rank < 5 && !wData.isEvolution) {
        candidates.push({
          id: `${wData.rawId}_rank_${wData.rank + 1}`,
          itemId: wData.rawId,
          name: wData.rawId,
          subtitle: `Rank ${wData.rank} → Rank ${wData.rank + 1}`,
          category: 'weapon',
          type: UpgradeType.WEAPON_RANK,
          icon: 'scythe',
          previousRank: wData.rank,
          newRank: wData.rank + 1,
          maxRank: 5,
          description: `Upgrades ${wData.rawId} to rank ${wData.rank + 1}.`,
          statChangeDescription: '+Damage',
          isEvolution: false,
        });
      }
    }

    // 3. Check for Passive Upgrades or New Unlocks
    const canAddPassive = this.passives.size < UpgradeSystem.MAX_PASSIVE_SLOTS;
    for (const passive of Object.values(OCCULT_PASSIVES)) {
      const normP = normalizeItemId(passive.id);
      const rank = this.getPassiveRank(normP);

      if (rank > 0 && rank < 5) {
        candidates.push({
          id: `${passive.id}_rank_${rank + 1}`,
          itemId: passive.id,
          name: passive.name,
          subtitle: `Rank ${rank} → Rank ${rank + 1}`,
          category: 'passive',
          type: UpgradeType.PASSIVE_RANK,
          icon: passive.icon,
          previousRank: rank,
          newRank: rank + 1,
          maxRank: 5,
          description: passive.rankDescriptions[rank] ?? '+Stats',
          statChangeDescription: passive.statDeltas[rank] ?? '+Stats',
          isEvolution: false,
        });
      } else if (rank === 0 && canAddPassive) {
        candidates.push({
          id: `${passive.id}_unlock`,
          itemId: passive.id,
          name: passive.name,
          subtitle: 'NEW PASSIVE',
          category: 'passive',
          type: UpgradeType.PASSIVE_UNLOCK,
          icon: passive.icon,
          previousRank: 0,
          newRank: 1,
          maxRank: 5,
          description: passive.rankDescriptions[0] ?? passive.name,
          statChangeDescription: passive.statDeltas[0] ?? 'Unlock Passive',
          isEvolution: false,
        });
      }
    }

    // Also include custom passives owned by player not in OCCULT_PASSIVES
    for (const [pKey, pData] of this.passives.entries()) {
      if (!OCCULT_PASSIVES[pKey] && pData.rank < 5) {
        candidates.push({
          id: `${pData.rawId}_rank_${pData.rank + 1}`,
          itemId: pData.rawId,
          name: pData.rawId,
          subtitle: `Rank ${pData.rank} → Rank ${pData.rank + 1}`,
          category: 'passive',
          type: UpgradeType.PASSIVE_RANK,
          icon: 'tome',
          previousRank: pData.rank,
          newRank: pData.rank + 1,
          maxRank: 5,
          description: `Upgrades ${pData.rawId} to rank ${pData.rank + 1}.`,
          statChangeDescription: '+Passive',
          isEvolution: false,
        });
      }
    }

    // 4. Edge Case: No valid upgrades left
    if (candidates.length === 0) {
      return [{
        id: 'fallback_feast',
        itemId: 'fallback_feast',
        name: 'Necrotic Feast',
        subtitle: 'SOUL RESTORATION',
        category: 'fallback',
        type: UpgradeType.FALLBACK,
        icon: 'chalice',
        previousRank: 0,
        newRank: 1,
        maxRank: 1,
        description: 'Absorbs residual soul essence, healing wounds and restoring vitality.',
        statChangeDescription: '+30 HP Healed • +100 Score',
        isEvolution: false,
      }];
    }

    // 5. Weighted Sampling without Replacement
    return this.sampleWeightedCards(candidates, count);
  }

  private sampleWeightedCards(candidates: UpgradeCard[], count: number): UpgradeCard[] {
    const k = Math.min(count, candidates.length);
    const pool = [...candidates];
    const selected: UpgradeCard[] = [];

    // If an evolution is available, guarantee that at least one evolution is chosen
    const evoIdx = pool.findIndex((c) => c.category === 'evolution');
    if (evoIdx !== -1 && selected.length < k) {
      selected.push(pool[evoIdx]);
      pool.splice(evoIdx, 1);
    }

    while (selected.length < k && pool.length > 0) {
      const weights = pool.map((c) => {
        if (c.category === 'evolution') return 3.5;
        if (c.previousRank > 0) return 2.0;
        return 1.0;
      });

      const totalWeight = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * totalWeight;
      let chosenIndex = 0;

      for (let i = 0; i < pool.length; i++) {
        rand -= weights[i];
        if (rand <= 0) {
          chosenIndex = i;
          break;
        }
      }

      selected.push(pool[chosenIndex]);
      pool.splice(chosenIndex, 1);
    }

    return selected;
  }

  public applyUpgrade(card: UpgradeCard, player?: Player, weaponManager?: any): void {
    const targetPlayer = player ?? this.player;

    if (card.category === 'fallback') {
      targetPlayer?.heal(30);
      return;
    }

    if (card.category === 'passive') {
      this.upgradeItem(card.itemId);
      return;
    }

    if (card.category === 'weapon') {
      if (this.isWeaponEvolved(card.itemId)) {
        return;
      }
      this.upgradeItem(card.itemId);
      weaponManager?.setWeaponRank?.(card.itemId, card.newRank);
      return;
    }

    if (card.category === 'evolution') {
      let evoDef: EvolutionDefinition | undefined;
      for (const evo of Object.values(OCCULT_EVOLUTIONS)) {
        if (evo.id === card.itemId || evo.id === normalizeItemId(card.itemId)) {
          evoDef = evo;
          break;
        }
      }

      if (evoDef) {
        this.evolveWeapon(evoDef.weaponId, evoDef.id);
        weaponManager?.evolveWeapon?.(evoDef.weaponId, evoDef.id);
      }
    }
  }
}
