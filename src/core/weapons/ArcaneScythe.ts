/**
 * ArcaneScythe.ts - Sweeping Spectral Blade Occult Weapon.
 *
 * Capabilities:
 * - Sweeps wide cleaving arc in the direction of the nearest enemy or player facing angle.
 * - Scales damage, arc reach, and cooldown across Ranks 1 to 5.
 * - Rank 5 cleaves 180° semi-circle with dual blades.
 * - Supreme Evolution: Soul Reaping Harvester (360° full screen harvest, 15% life shard chance).
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

interface SlashVisual {
  x: number;
  y: number;
  angle: number;
  radius: number;
  arcAngle: number;
  life: number;
  maxLife: number;
  isDual: boolean;
  isEvolution: boolean;
}

export class ArcaneScythe extends Weapon {
  public readonly id: string = 'scythe';
  public readonly name: string = 'Arcane Scythe';
  public readonly icon: string = 'scythe';

  public activeSlashes: SlashVisual[] = [];
  private scratchIds: Int32Array = new Int32Array(512);

  public static readonly STATS: Record<number, WeaponRankStats> = {
    1: {
      rank: 1,
      damage: 25,
      cooldown: 1.4,
      area: 75,
      speed: 1.0,
      count: 1,
      knockback: 120,
      description: 'Sweeping spectral blade cleaves a 110° arc cutting through enemies.',
    },
    2: {
      rank: 2,
      damage: 35,
      cooldown: 1.3,
      area: 85,
      speed: 1.0,
      count: 1,
      knockback: 140,
      description: '+10 Damage & +10px Cleave Radius.',
    },
    3: {
      rank: 3,
      damage: 50,
      cooldown: 1.2,
      area: 95,
      speed: 1.0,
      count: 1,
      knockback: 160,
      description: '+15 Damage & -0.1s Cooldown.',
    },
    4: {
      rank: 4,
      damage: 70,
      cooldown: 1.05,
      area: 110,
      speed: 1.0,
      count: 1,
      knockback: 180,
      description: '+20 Damage & +15px Cleave Radius.',
    },
    5: {
      rank: 5,
      damage: 95,
      cooldown: 0.9,
      area: 130,
      speed: 1.0,
      count: 2,
      knockback: 220,
      description: 'Dual spectral blades cleave 180° semi-circle & +25 Damage.',
    },
  };

  public static readonly EVOLUTION_STATS: WeaponRankStats = {
    rank: 5,
    damage: 140,
    cooldown: 0.8,
    area: 160,
    speed: 1.2,
    count: 2,
    knockback: 260,
    description: 'Soul Reaping Harvester: 360° colossal reap. Slain foes have a 15% chance to drop life gems.',
  };

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    super(player, hordeManager, statsManager);
    this.baseDamage = ArcaneScythe.STATS[1].damage;
    this.baseCooldown = ArcaneScythe.STATS[1].cooldown;
    this.baseArea = ArcaneScythe.STATS[1].area;
    this.baseKnockback = ArcaneScythe.STATS[1].knockback;
  }

  public getStats(rank: number = this.rank): WeaponRankStats {
    if (this.isEvolution) {
      return ArcaneScythe.EVOLUTION_STATS;
    }
    return ArcaneScythe.STATS[Math.min(5, Math.max(1, rank))] ?? ArcaneScythe.STATS[1];
  }

  public fire(
    aimX?: number,
    aimY?: number,
    vfx?: DarkFantasyVFX,
    lootManager?: LootManager,
    engine?: any
  ): number {
    const stats = this.getStats();
    const effectiveRadius = this.getEffectiveArea();
    const effectiveDamage = this.getEffectiveDamage();
    const px = this.player.position.x;
    const py = this.player.position.y;

    // Determine aim direction
    let aimAngle = this.player.facingAngle;
    if (aimX !== undefined && aimY !== undefined) {
      if (aimX !== 0 || aimY !== 0) {
        aimAngle = Math.atan2(aimY, aimX);
      }
    } else {
      const nearest = this.hordeManager.getNearestEnemy(px, py, effectiveRadius * 2);
      if (nearest) {
        aimAngle = Math.atan2(nearest.y - py, nearest.x - px);
      }
    }

    const arcDegrees = this.isEvolution
      ? 360
      : this.rank === 5
      ? 180
      : this.rank === 4
      ? 150
      : this.rank === 3
      ? 135
      : this.rank === 2
      ? 120
      : 110;
    const halfArcRad = (arcDegrees * Math.PI) / 360;

    // Query enemies in range
    const enemyCount = this.hordeManager.getEnemiesInRadius(
      px,
      py,
      effectiveRadius,
      this.scratchIds
    );

    let hits = 0;
    for (let i = 0; i < enemyCount; i++) {
      const enemyId = this.scratchIds[i];
      const enemy = this.hordeManager.pool[enemyId];
      if (!enemy || !enemy.active || !enemy.isAlive) continue;

      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const enemyAngle = Math.atan2(dy, dx);
      let diff = enemyAngle - aimAngle;

      // Normalize diff to [-PI, PI]
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      if (Math.abs(diff) <= halfArcRad || this.isEvolution) {
        hits++;
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

            // Soul Reaping Harvester: 15% chance to heal player
            if (this.isEvolution && Math.random() < 0.15) {
              this.player.heal(2);
            }
          }
          vfx?.emitSoulBurst(result.x, result.y, result.gemType, 6);
          vfx?.emitBloodBurst(result.x, result.y, 6);
          engine?.eventBus?.emit('enemy_killed', result);
        } else {
          vfx?.emitBloodBurst(result.x, result.y, 3, dx / dist, dy / dist);
        }
      }
    }

    // Add slash visual
    this.activeSlashes.push({
      x: px,
      y: py,
      angle: aimAngle,
      radius: effectiveRadius,
      arcAngle: (arcDegrees * Math.PI) / 180,
      life: 0,
      maxLife: 0.18,
      isDual: this.rank >= 5,
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
    // Update slashes visual
    for (let i = this.activeSlashes.length - 1; i >= 0; i--) {
      const s = this.activeSlashes[i];
      s.life += dt;
      if (s.life >= s.maxLife) {
        this.activeSlashes.splice(i, 1);
      }
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown();
    if (this.timer >= cd) {
      this.timer -= cd;
      this.fire(undefined, undefined, vfx, lootManager, engine);
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.activeSlashes.length === 0) return;

    ctx.save();
    for (const s of this.activeSlashes) {
      const alpha = 1.0 - s.life / s.maxLife;
      const screenX = s.x - camera.renderX;
      const screenY = s.y - camera.renderY;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(s.angle);

      ctx.beginPath();
      const startAngle = -s.arcAngle / 2;
      const endAngle = s.arcAngle / 2;
      ctx.arc(0, 0, s.radius, startAngle, endAngle);

      ctx.lineWidth = s.isEvolution ? 6 : s.isDual ? 4.5 : 3.5;
      ctx.strokeStyle = s.isEvolution
        ? `rgba(229, 62, 62, ${alpha * 0.9})`
        : `rgba(183, 148, 246, ${alpha * 0.85})`;
      ctx.shadowColor = s.isEvolution ? '#e53e3e' : '#7038b8';
      ctx.shadowBlur = 10;
      ctx.stroke();

      if (s.isDual || s.isEvolution) {
        ctx.beginPath();
        ctx.arc(0, 0, s.radius * 0.75, startAngle, endAngle);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = `rgba(237, 229, 222, ${alpha * 0.8})`;
        ctx.stroke();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}
