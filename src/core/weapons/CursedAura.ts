/**
 * CursedAura.ts - Periodic Expanding Radial Shockwave Occult Weapon.
 *
 * Capabilities:
 * - Pulses an expanding necrotic ring centered on the player with heavy radial knockback.
 * - Scales damage, pulse cadence, and radius across Ranks 1 to 5.
 * - Supreme Evolution: Domain of Decay (Permanent 160px death blight, slowing foes by 40%).
 */

import { Weapon } from './Weapon';
import { WeaponRankStats } from './WeaponTypes';
import { Player } from '../entities/Player';
import { HordeManager } from '../HordeManager';
import { PlayerStatsManager } from '../player/PlayerStats';
import { ProjectilePool } from './Projectile';
import { DarkFantasyVFX } from '../../render/vfx/DarkFantasyVFX';
import { Camera } from '../../render/Camera';
import { LootManager, LootDropType } from '../systems/LootManager';

interface PulseRingVisual {
  x: number;
  y: number;
  maxRadius: number;
  life: number;
  maxLife: number;
  isEvolution: boolean;
}

export class CursedAura extends Weapon {
  public readonly id: string = 'aura';
  public readonly name: string = 'Cursed Aura';
  public readonly icon: string = 'aura';

  public activeRings: PulseRingVisual[] = [];
  private scratchIds: Int32Array = new Int32Array(512);

  public static readonly STATS: Record<number, WeaponRankStats> = {
    1: {
      rank: 1,
      damage: 20,
      cooldown: 1.2,
      area: 85, // pulse radius
      speed: 1.0,
      count: 1,
      knockback: 100,
      description: 'Emits a periodic shockwave of dark energy repelling nearby foes.',
    },
    2: {
      rank: 2,
      damage: 28,
      cooldown: 1.1,
      area: 95,
      speed: 1.0,
      count: 1,
      knockback: 120,
      description: '+10px Aura Radius & +8 Damage.',
    },
    3: {
      rank: 3,
      damage: 38,
      cooldown: 1.0,
      area: 110,
      speed: 1.0,
      count: 1,
      knockback: 145,
      description: '-0.1s Cadence & +25 Knockback Force.',
    },
    4: {
      rank: 4,
      damage: 52,
      cooldown: 0.9,
      area: 130,
      speed: 1.0,
      count: 1,
      knockback: 175,
      description: '+20px Aura Radius & +14 Damage.',
    },
    5: {
      rank: 5,
      damage: 72,
      cooldown: 0.75,
      area: 155,
      speed: 1.0,
      count: 1,
      knockback: 215,
      description: 'Massive death sigil dealing heavy damage and knocking back entire swarms.',
    },
  };

  public static readonly EVOLUTION_STATS: WeaponRankStats = {
    rank: 5,
    damage: 95,
    cooldown: 0.5,
    area: 160,
    speed: 1.0,
    count: 1,
    knockback: 250,
    description: 'Domain of Decay: Permanent 160px death blight, slowing foes by 40% and absorbing incoming damage.',
  };

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    super(player, hordeManager, statsManager);
    this.baseDamage = CursedAura.STATS[1].damage;
    this.baseCooldown = CursedAura.STATS[1].cooldown;
    this.baseArea = CursedAura.STATS[1].area;
    this.baseKnockback = CursedAura.STATS[1].knockback;
  }

  public getStats(rank: number = this.rank): WeaponRankStats {
    if (this.isEvolution) {
      return CursedAura.EVOLUTION_STATS;
    }
    return CursedAura.STATS[Math.min(5, Math.max(1, rank))] ?? CursedAura.STATS[1];
  }

  public pulse(
    vfx?: DarkFantasyVFX,
    lootManager?: LootManager,
    engine?: any
  ): number {
    const stats = this.getStats();
    const effectiveDamage = this.getEffectiveDamage();
    const effectiveRadius = this.getEffectiveArea();
    const px = this.player.position.x;
    const py = this.player.position.y;

    const nearbyCount = this.hordeManager.getEnemiesInRadius(
      px,
      py,
      effectiveRadius,
      this.scratchIds
    );

    let hits = 0;
    for (let i = 0; i < nearbyCount; i++) {
      const enemyId = this.scratchIds[i];
      const enemy = this.hordeManager.pool[enemyId];
      if (!enemy || !enemy.active || !enemy.isAlive) continue;

      hits++;
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = Math.hypot(dx, dy) || 1;
      const kbX = (dx / dist) * stats.knockback;
      const kbY = (dy / dist) * stats.knockback;

      const result = this.hordeManager.applyDamage(enemyId, effectiveDamage, kbX, kbY);

      if (result.killed) {
        if (lootManager) {
          let drop = LootDropType.EMERALD_SHARD;
          if (result.gemType === 'ruby') drop = LootDropType.RUBY_GEM;
          else if (result.gemType === 'violet') drop = LootDropType.VIOLET_ABYSSAL;

          lootManager.spawnDrop(drop, result.x, result.y, true);
        }
        vfx?.emitSoulBurst(result.x, result.y, result.gemType, 6);
        vfx?.emitBloodBurst(result.x, result.y, 6);
        engine?.eventBus?.emit('enemy_killed', result);
      } else {
        vfx?.emitBloodBurst(result.x, result.y, 3, dx / dist, dy / dist);
      }
    }

    this.activeRings.push({
      x: px,
      y: py,
      maxRadius: effectiveRadius,
      life: 0,
      maxLife: 0.35,
      isEvolution: this.isEvolution,
    });

    return hits;
  }

  public update(
    dt: number,
    _pool?: ProjectilePool,
    vfx?: DarkFantasyVFX,
    _scratchIds?: Int32Array,
    lootManager?: LootManager,
    engine?: any
  ): void {
    // Update active rings
    for (let i = this.activeRings.length - 1; i >= 0; i--) {
      const ring = this.activeRings[i];
      ring.life += dt;
      if (ring.life >= ring.maxLife) {
        this.activeRings.splice(i, 1);
      }
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown();
    if (this.timer >= cd) {
      this.timer -= cd;
      this.pulse(vfx, lootManager, engine);
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.activeRings.length === 0 && !this.isEvolution) return;

    ctx.save();
    for (const ring of this.activeRings) {
      const progress = ring.life / ring.maxLife;
      const currentRadius = ring.maxRadius * progress;
      const alpha = 1.0 - progress;

      const screenX = ring.x - camera.renderX;
      const screenY = ring.y - camera.renderY;

      ctx.beginPath();
      ctx.arc(screenX, screenY, currentRadius, 0, Math.PI * 2);
      ctx.lineWidth = ring.isEvolution ? 4.5 : 3.0;
      ctx.strokeStyle = ring.isEvolution
        ? `rgba(229, 62, 62, ${alpha * 0.85})`
        : `rgba(183, 148, 246, ${alpha * 0.8})`;
      ctx.shadowColor = ring.isEvolution ? '#e53e3e' : '#7038b8';
      ctx.shadowBlur = 12;
      ctx.stroke();
    }

    // If evolved (Domain of Decay), draw permanent subtle blight circle around player
    if (this.isEvolution) {
      const screenPx = this.player.position.x - camera.renderX;
      const screenPy = this.player.position.y - camera.renderY;
      ctx.beginPath();
      ctx.arc(screenPx, screenPy, this.getEffectiveArea(), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(56, 10, 10, 0.15)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(229, 62, 62, 0.4)';
      ctx.stroke();
    }

    ctx.restore();
  }
}
