/**
 * SoulOrbiters.ts - Continuous Contact Orbital Barrier Occult Weapon.
 *
 * Capabilities:
 * - 2 to 6 spectral skulls orbiting the player at high angular velocity.
 * - Flat intrusive hit cooldown array (Float32Array) ensuring no per-tick damage spam on enemies.
 * - Supreme Evolution: Abyssal Vortex (8 accelerated skulls with micro-vacuum gravity).
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

export interface SkullOrbiter {
  angle: number;
  x: number;
  y: number;
}

export class SoulOrbiters extends Weapon {
  public readonly id: string = 'orbiters';
  public readonly name: string = 'Soul Orbiters';
  public readonly icon: string = 'orbiters';

  public skulls: SkullOrbiter[] = [];
  public orbitRadius: number = 75;
  public baseAngle: number = 0;
  public simulationTime: number = 0;

  // Per-enemy hit cooldown tracker (0 to 2047 IDs)
  private readonly lastHitTimes: Float32Array = new Float32Array(2048);
  private scratchIds: Int32Array = new Int32Array(128);

  public static readonly STATS: Record<number, WeaponRankStats> = {
    1: {
      rank: 1,
      damage: 14,
      cooldown: 0.30, // per-enemy hit cooldown
      area: 75,
      speed: 2.4, // rad/s
      count: 2,
      knockback: 60,
      description: '2 spectral skull flames orbit the player, burning enemies on contact.',
    },
    2: {
      rank: 2,
      damage: 18,
      cooldown: 0.38,
      area: 80,
      speed: 2.6,
      count: 3,
      knockback: 70,
      description: '+1 Skull (3 total) & +10% Orbit Velocity.',
    },
    3: {
      rank: 3,
      damage: 24,
      cooldown: 0.35,
      area: 85,
      speed: 2.8,
      count: 4,
      knockback: 80,
      description: '+1 Skull (4 total) & +6 Damage.',
    },
    4: {
      rank: 4,
      damage: 30,
      cooldown: 0.32,
      area: 90,
      speed: 3.1,
      count: 5,
      knockback: 90,
      description: '+1 Skull (5 total) & +10% Speed.',
    },
    5: {
      rank: 5,
      damage: 42,
      cooldown: 0.28,
      area: 95,
      speed: 3.5,
      count: 6,
      knockback: 110,
      description: '+1 Skull (6 total) & faster contact cadence.',
    },
  };

  public static readonly EVOLUTION_STATS: WeaponRankStats = {
    rank: 5,
    damage: 55,
    cooldown: 0.20,
    area: 110,
    speed: 4.8,
    count: 8,
    knockback: 140,
    description: 'Abyssal Vortex: 8 accelerated skulls create a crushing gravitational whirlpool.',
  };

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    super(player, hordeManager, statsManager);
    this.baseDamage = SoulOrbiters.STATS[1].damage;
    this.baseCooldown = SoulOrbiters.STATS[1].cooldown;
    this.baseArea = SoulOrbiters.STATS[1].area;
    this.baseSpeed = SoulOrbiters.STATS[1].speed;
    this.baseKnockback = SoulOrbiters.STATS[1].knockback;
    this.lastHitTimes.fill(-999);
    this.syncSkulls();
  }

  public override get rank(): number {
    return super.rank;
  }

  public override set rank(val: number) {
    super.rank = val;
    this.syncSkulls();
  }

  public getStats(rank: number = this.rank): WeaponRankStats {
    if (this.isEvolution) {
      return SoulOrbiters.EVOLUTION_STATS;
    }
    return SoulOrbiters.STATS[Math.min(5, Math.max(1, rank))] ?? SoulOrbiters.STATS[1];
  }

  public syncSkulls(): void {
    const stats = this.getStats();
    const count = stats.count;
    const px = this.player?.position?.x ?? 0;
    const py = this.player?.position?.y ?? 0;
    this.orbitRadius = stats.area;

    while (this.skulls.length < count) {
      this.skulls.push({ angle: 0, x: 0, y: 0 });
    }
    while (this.skulls.length > count) {
      this.skulls.pop();
    }

    for (let i = 0; i < count; i++) {
      const angle = this.baseAngle + (i * Math.PI * 2) / count;
      this.skulls[i].angle = angle;
      this.skulls[i].x = px + Math.cos(angle) * this.orbitRadius;
      this.skulls[i].y = py + Math.sin(angle) * this.orbitRadius;
    }
  }

  public update(
    dt: number,
    _pool?: ProjectilePool,
    vfx?: DarkFantasyVFX,
    _scratchIds?: Int32Array,
    lootManager?: LootManager,
    engine?: any
  ): void {
    this.simulationTime += dt;
    this.syncSkulls();

    const stats = this.getStats();
    const speedMult = this.statsManager
      ? this.statsManager.getEffectiveStats().projSpeed
      : (this.player?.stats?.projSpeed ?? 1.0);
    const areaMult = this.statsManager
      ? this.statsManager.getEffectiveStats().area
      : (this.player?.stats?.area ?? 1.0);

    const angularSpeed = stats.speed * speedMult;
    this.orbitRadius = stats.area * areaMult;
    this.baseAngle += angularSpeed * dt;

    const px = this.player.position.x;
    const py = this.player.position.y;
    const count = this.skulls.length;
    const effectiveDamage = this.getEffectiveDamage();
    const hitCD = stats.cooldown;

    for (let i = 0; i < count; i++) {
      const angle = this.baseAngle + (i * Math.PI * 2) / count;
      const sx = px + Math.cos(angle) * this.orbitRadius;
      const sy = py + Math.sin(angle) * this.orbitRadius;

      this.skulls[i].angle = angle;
      this.skulls[i].x = sx;
      this.skulls[i].y = sy;
    }

    // Contact query around the orbital ring barrier
    const nearby = this.hordeManager.getEnemiesInRadius(
      px,
      py,
      this.orbitRadius + 28,
      this.scratchIds
    );

    for (let j = 0; j < nearby; j++) {
      const enemyId = this.scratchIds[j];
      const enemy = this.hordeManager.pool[enemyId];
      if (!enemy || !enemy.active || !enemy.isAlive) continue;

      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const dist = Math.hypot(dx, dy) || 1;

      if (Math.abs(dist - this.orbitRadius) <= 26) {
        if (this.simulationTime - this.lastHitTimes[enemyId] >= hitCD) {
          this.lastHitTimes[enemyId] = this.simulationTime;

          let kbX = (dx / dist) * stats.knockback;
          let kbY = (dy / dist) * stats.knockback;
          if (this.isEvolution) {
            kbX = -kbX * 0.4;
            kbY = -kbY * 0.4;
          }

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
            vfx?.emitBloodBurst(result.x, result.y, 2, dx / dist, dy / dist);
          }
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.skulls.length === 0) return;

    ctx.save();
    for (const skull of this.skulls) {
      const screenX = skull.x - camera.renderX;
      const screenY = skull.y - camera.renderY;

      // Outer flaming glow
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.isEvolution ? 14 : 10, 0, Math.PI * 2);
      ctx.fillStyle = this.isEvolution
        ? 'rgba(229, 62, 62, 0.4)'
        : 'rgba(104, 211, 145, 0.35)';
      ctx.fill();

      // Skull core
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.isEvolution ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = this.isEvolution ? '#e53e3e' : '#28a745';
      ctx.shadowColor = this.isEvolution ? '#e53e3e' : '#68d391';
      ctx.shadowBlur = 10;
      ctx.fill();

      // Eye sockets
      ctx.fillStyle = '#08060c';
      ctx.fillRect(screenX - 3, screenY - 2, 2, 2);
      ctx.fillRect(screenX + 1, screenY - 2, 2, 2);
    }
    ctx.restore();
  }
}
