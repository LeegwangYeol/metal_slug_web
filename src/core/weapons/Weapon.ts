/**
 * Weapon.ts - Base Occult Weapon Abstract Class and Interface.
 *
 * Capabilities:
 * - Dynamic scaling with PlayerStats (Might, Area, Cooldown Reduction with 50% hard clamp, Projectile Speed).
 * - Rank 1 to 5 progression and evolution support.
 * - Decoupled rendering and simulation tick.
 */

import { WeaponRankStats } from './WeaponTypes';
import { Player } from '../entities/Player';
import { HordeManager } from '../HordeManager';
import { PlayerStatsManager } from '../player/PlayerStats';
import { ProjectilePool } from './Projectile';
import { DarkFantasyVFX } from '../../render/vfx/DarkFantasyVFX';
import { Camera } from '../../render/Camera';
import { LootManager } from '../systems/LootManager';

export abstract class Weapon {
  public abstract readonly id: string;
  public abstract readonly name: string;
  public abstract readonly icon: string;

  protected _rank: number = 1;
  public get rank(): number {
    return this._rank;
  }
  public set rank(value: number) {
    this._rank = value;
  }
  public maxRank: number = 5;
  public isEvolution: boolean = false;

  public player: Player;
  public hordeManager: HordeManager;
  public statsManager?: PlayerStatsManager;

  public timer: number = 0;

  public baseDamage: number = 20;
  public baseCooldown: number = 1.5;
  public baseArea: number = 80;
  public baseSpeed: number = 300;
  public baseKnockback: number = 100;

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    this.player = player;
    this.hordeManager = hordeManager;
    this.statsManager = statsManager;
  }

  public abstract getStats(rank?: number): WeaponRankStats;

  public getDamage(rank: number = this.rank): number {
    return this.getStats(rank).damage;
  }

  public getArea(rank: number = this.rank): number {
    return this.getStats(rank).area;
  }

  public getCooldown(rank: number = this.rank): number {
    return this.getStats(rank).cooldown;
  }

  /**
   * Effective damage scaled by Player might.
   */
  public getEffectiveDamage(): number {
    const might = this.statsManager
      ? this.statsManager.getEffectiveStats().might
      : (this.player?.stats?.might ?? 1.0);
    return Math.round(this.getDamage() * might);
  }

  /**
   * Effective cooldown scaled by Player CDR (hard clamped to 50% max reduction).
   */
  public getEffectiveCooldown(): number {
    const cdr = this.statsManager
      ? this.statsManager.getEffectiveStats().cooldownReduction
      : (this.player?.stats?.cooldownReduction ?? 0.0);
    const clampedCDR = Math.min(0.50, Math.max(0.0, cdr));
    return this.getCooldown() * (1.0 - clampedCDR);
  }

  /**
   * Effective radius/reach scaled by Player area.
   */
  public getEffectiveArea(): number {
    const area = this.statsManager
      ? this.statsManager.getEffectiveStats().area
      : (this.player?.stats?.area ?? 1.0);
    return this.getArea() * area;
  }

  /**
   * Effective projectile/orbital velocity scaled by Player projSpeed.
   */
  public getEffectiveSpeed(): number {
    const projSpeed = this.statsManager
      ? this.statsManager.getEffectiveStats().projSpeed
      : (this.player?.stats?.projSpeed ?? 1.0);
    return this.baseSpeed * projSpeed;
  }

  public canUpgrade(): boolean {
    return this.rank < this.maxRank && !this.isEvolution;
  }

  public upgrade(): boolean {
    if (this.canUpgrade()) {
      this.rank++;
      return true;
    }
    return false;
  }

  public abstract update(
    dt: number,
    pool?: ProjectilePool,
    vfx?: DarkFantasyVFX,
    scratchIds?: Int32Array,
    lootManager?: LootManager,
    engine?: any
  ): void;

  public render?(ctx: CanvasRenderingContext2D, camera: Camera): void;
}
