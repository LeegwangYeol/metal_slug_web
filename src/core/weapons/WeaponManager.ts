/**
 * WeaponManager.ts - Master Coordinator for Active Occult Weapons & Projectiles.
 *
 * Capabilities:
 * - Coordinates up to 6 active weapons with independent auto-fire timers.
 * - Central projectile pooling (256 capacity) with zero-garbage active tracking.
 * - Dynamic weapon factory supporting both class instances and string keys.
 * - Decoupled rendering and simulation tick.
 */

import { Weapon } from './Weapon';
import { normalizeWeaponId } from './WeaponTypes';
import { ProjectilePool } from './Projectile';
import { Player } from '../entities/Player';
import { HordeManager } from '../HordeManager';
import { LootManager } from '../systems/LootManager';
import { DarkFantasyVFX } from '../../render/vfx/DarkFantasyVFX';
import { Camera } from '../../render/Camera';
import { InventorySlotData } from '../../ui/GothicHUD';

import { ArcaneScythe } from './ArcaneScythe';
import { SoulOrbiters } from './SoulOrbiters';
import { AbyssalLightning } from './AbyssalLightning';
import { BoneSpear } from './BoneSpear';
import { CursedAura } from './CursedAura';

export class WeaponManager {
  private readonly weapons: Map<string, Weapon> = new Map();
  public readonly projectilePool: ProjectilePool = new ProjectilePool(256);

  public player: Player;
  public hordeManager: HordeManager;
  public lootManager?: LootManager;
  public vfx?: DarkFantasyVFX;

  // Scratch query buffer (zero heap allocation)
  private readonly scratchEnemyIds: Int32Array = new Int32Array(1024);
  private readonly hitCooldownBuffer: Float32Array = new Float32Array(2048);

  public simulationTime: number = 0;

  constructor(
    hordeManager?: HordeManager,
    player?: Player,
    lootManager?: LootManager,
    vfx?: DarkFantasyVFX
  ) {
    this.hordeManager = hordeManager as HordeManager;
    this.player = player as Player;
    this.lootManager = lootManager;
    this.vfx = vfx;
    this.hitCooldownBuffer.fill(-999);
  }

  public setDependencies(
    player: Player,
    hordeManager: HordeManager,
    lootManager?: LootManager,
    vfx?: DarkFantasyVFX
  ): void {
    this.player = player;
    this.hordeManager = hordeManager;
    this.lootManager = lootManager;
    this.vfx = vfx;

    // Update dependencies on existing weapons
    for (const weapon of this.weapons.values()) {
      weapon.player = player;
      weapon.hordeManager = hordeManager;
    }
  }

  public addWeapon(weaponOrId: Weapon | string, rank: number = 1): Weapon | null {
    if (typeof weaponOrId === 'string') {
      const normId = normalizeWeaponId(weaponOrId);
      if (this.weapons.has(normId)) {
        const existing = this.weapons.get(normId)!;
        existing.rank = Math.max(existing.rank, rank);
        return existing;
      }

      let weapon: Weapon | null = null;
      switch (normId) {
        case 'scythe':
          weapon = new ArcaneScythe(this.player, this.hordeManager);
          break;
        case 'orbiters':
          weapon = new SoulOrbiters(this.player, this.hordeManager);
          break;
        case 'lightning':
          weapon = new AbyssalLightning(this.player, this.hordeManager);
          break;
        case 'spear':
          weapon = new BoneSpear(this.player, this.hordeManager);
          break;
        case 'aura':
          weapon = new CursedAura(this.player, this.hordeManager);
          break;
      }

      if (weapon) {
        weapon.rank = rank;
        this.weapons.set(normId, weapon);
        return weapon;
      }
      return null;
    } else {
      const normId = normalizeWeaponId(weaponOrId.id);
      this.weapons.set(normId, weaponOrId);
      return weaponOrId;
    }
  }

  public getWeapon(id: string): Weapon | undefined {
    return this.weapons.get(normalizeWeaponId(id));
  }

  public hasWeapon(id: string): boolean {
    return this.weapons.has(normalizeWeaponId(id));
  }

  public getEquippedCount(): number {
    return this.weapons.size;
  }

  public upgradeWeapon(id: string): boolean {
    const weapon = this.getWeapon(id);
    if (weapon) {
      return weapon.upgrade();
    }
    return false;
  }

  public setWeaponRank(id: string, rank: number): void {
    const normId = normalizeWeaponId(id);
    let weapon = this.getWeapon(normId);
    if (!weapon) {
      this.addWeapon(normId, rank);
    } else {
      if (weapon.isEvolution) {
        return;
      }
      weapon.rank = rank;
    }
  }

  public evolveWeapon(baseId: string, _evolutionId: string): void {
    const normId = normalizeWeaponId(baseId);
    const weapon = this.getWeapon(normId);
    if (weapon) {
      weapon.rank = 5;
      weapon.isEvolution = true;
    }
  }

  public getActiveWeapons(): Weapon[] {
    return Array.from(this.weapons.values());
  }

  public getInventorySlotData(): InventorySlotData[] {
    const list: InventorySlotData[] = [];
    for (const w of this.weapons.values()) {
      list.push({
        id: w.id,
        name: w.name,
        icon: w.icon,
        rank: w.rank,
        maxRank: w.maxRank,
        isEvolution: w.isEvolution,
      });
    }
    return list;
  }

  public update(
    dt: number,
    player: Player = this.player,
    hordeManager: HordeManager = this.hordeManager,
    lootManager: LootManager | undefined = this.lootManager,
    vfx: DarkFantasyVFX | undefined = this.vfx,
    engine?: any
  ): void {
    this.simulationTime += dt;
    this.player = player;
    this.hordeManager = hordeManager;
    this.lootManager = lootManager;
    this.vfx = vfx;

    for (const weapon of this.weapons.values()) {
      weapon.player = player;
      weapon.hordeManager = hordeManager;
      weapon.update(
        dt,
        this.projectilePool,
        vfx,
        this.scratchEnemyIds,
        lootManager,
        engine
      );
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    for (const weapon of this.weapons.values()) {
      if (weapon.render) {
        weapon.render(ctx, camera);
      }
    }
  }

  public clear(): void {
    this.weapons.clear();
    this.projectilePool.clear();
  }

  /**
   * Resets WeaponManager, clearing weapon pools, active projectiles/slashes,
   * resetting simulation clocks and cooldown buffers, and re-equipping starter weapon.
   */
  public reset(starterWeaponId: string = 'scythe', starterRank: number = 1): void {
    for (const weapon of this.weapons.values()) {
      if ((weapon as any).projectilePool?.clear) {
        (weapon as any).projectilePool.clear();
      }
      if (Array.isArray((weapon as any).activeSlashes)) {
        (weapon as any).activeSlashes.length = 0;
      }
      if (Array.isArray((weapon as any).skulls)) {
        (weapon as any).skulls.length = 0;
      }
      if (Array.isArray((weapon as any).activeBolts)) {
        (weapon as any).activeBolts.length = 0;
      }
      if (Array.isArray((weapon as any).activeRings)) {
        (weapon as any).activeRings.length = 0;
      }
      weapon.timer = 0;
    }

    this.weapons.clear();
    this.projectilePool.clear();

    this.simulationTime = 0;
    this.hitCooldownBuffer.fill(-999);
    this.scratchEnemyIds.fill(0);

    if (starterWeaponId) {
      this.addWeapon(starterWeaponId, starterRank);
    }
  }
}
