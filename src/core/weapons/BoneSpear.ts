/**
 * BoneSpear.ts - High-Velocity Piercing Projectile Occult Weapon.
 *
 * Capabilities:
 * - Fires 1 to 3 piercing bone spears with angular spread.
 * - Flat zero-garbage intrusive hit tracking on pooled projectiles.
 * - Supreme Evolution: Ossuary Cataclysm (4 ancient dragon lances with infinite screen-wide pierce).
 */

import { Weapon } from './Weapon';
import { WeaponRankStats } from './WeaponTypes';
import { Player } from '../entities/Player';
import { HordeManager } from '../HordeManager';
import { PlayerStatsManager } from '../player/PlayerStats';
import { Projectile, ProjectilePool } from './Projectile';
import { DarkFantasyVFX } from '../../render/vfx/DarkFantasyVFX';
import { Camera } from '../../render/Camera';
import { LootManager, LootDropType } from '../systems/LootManager';
import { Enemy } from '../entities/Enemy';

export class BoneSpear extends Weapon {
  public readonly id: string = 'spear';
  public readonly name: string = 'Bone Spear';
  public readonly icon: string = 'spear';

  public readonly projectilePool: ProjectilePool = new ProjectilePool(256);
  private scratchIds: Int32Array = new Int32Array(64);

  public static readonly STATS: Record<number, WeaponRankStats> = {
    1: {
      rank: 1,
      damage: 30,
      cooldown: 1.4,
      area: 450, // max targeting range
      speed: 500, // px/s
      count: 1, // number of spears
      pierce: 2, // penetrates 2 enemies
      knockback: 100,
      description: 'Hurls a piercing lance through up to 2 enemies in a straight line.',
    },
    2: {
      rank: 2,
      damage: 42,
      cooldown: 1.3,
      area: 480,
      speed: 540,
      count: 2,
      pierce: 3,
      knockback: 110,
      description: '+1 Spear (fires 2 in spread) & +1 Pierce.',
    },
    3: {
      rank: 3,
      damage: 55,
      cooldown: 1.2,
      area: 500,
      speed: 580,
      count: 2,
      pierce: 5,
      knockback: 120,
      description: '+2 Pierce Count & +13 Damage.',
    },
    4: {
      rank: 4,
      damage: 72,
      cooldown: 1.1,
      area: 520,
      speed: 620,
      count: 3,
      pierce: 6,
      knockback: 135,
      description: '+1 Spear (fires 3 in fan) & -0.1s Cooldown.',
    },
    5: {
      rank: 5,
      damage: 95,
      cooldown: 0.95,
      area: 550,
      speed: 680,
      count: 3,
      pierce: 8,
      knockback: 150,
      description: 'Devastating bone volley with 8 pierce and high speed.',
    },
  };

  public static readonly EVOLUTION_STATS: WeaponRankStats = {
    rank: 5,
    damage: 130,
    cooldown: 0.85,
    area: 600,
    speed: 750,
    count: 4,
    pierce: 999, // Infinite pierce
    knockback: 180,
    description: 'Ossuary Cataclysm: 4 ancient colossus dragon lances with infinite screen-wide pierce.',
  };

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    super(player, hordeManager, statsManager);
    this.baseDamage = BoneSpear.STATS[1].damage;
    this.baseCooldown = BoneSpear.STATS[1].cooldown;
    this.baseArea = BoneSpear.STATS[1].area;
    this.baseSpeed = BoneSpear.STATS[1].speed;
    this.baseKnockback = BoneSpear.STATS[1].knockback;
  }

  public getStats(rank: number = this.rank): WeaponRankStats {
    if (this.isEvolution) {
      return BoneSpear.EVOLUTION_STATS;
    }
    return BoneSpear.STATS[Math.min(5, Math.max(1, rank))] ?? BoneSpear.STATS[1];
  }

  public fireProjectile(dirX: number, dirY: number): Projectile | null {
    const stats = this.getStats();
    const speedMult = this.statsManager
      ? this.statsManager.getEffectiveStats().projSpeed
      : (this.player?.stats?.projSpeed ?? 1.0);
    const speed = stats.speed * speedMult;
    const damage = this.getEffectiveDamage();
    const pierce = stats.pierce ?? 2;

    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    const p = this.projectilePool.spawn();
    if (!p) return null;

    const px = this.player.position.x;
    const py = this.player.position.y;

    p.reset(
      this.id,
      px,
      py,
      nx * speed,
      ny * speed,
      speed,
      12, // radius
      damage,
      stats.knockback,
      pierce,
      2.0 // maxLife
    );

    return p;
  }

  public recycleProjectile(p: Projectile): void {
    this.projectilePool.recycleProjectile(p);
  }

  public handleHit(
    proj: Projectile,
    enemy: Enemy,
    vfx?: DarkFantasyVFX,
    lootManager?: LootManager,
    engine?: any
  ): boolean {
    if (!proj.active || proj.hasHit(enemy.id)) return false;

    proj.recordHit(enemy.id);
    proj.pierceRemaining--;

    const dx = enemy.x - proj.x;
    const dy = enemy.y - proj.y;
    const dist = Math.hypot(dx, dy) || 1;
    const kbX = (proj.vx / proj.speed) * proj.knockback;
    const kbY = (proj.vy / proj.speed) * proj.knockback;

    const result = this.hordeManager.applyDamage(enemy.id, proj.damage, kbX, kbY);

    vfx?.emitBoneShatter(enemy.x, enemy.y, 4);

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

    if (proj.pierceRemaining <= 0) {
      this.projectilePool.free(proj.id);
      return true;
    }

    return false;
  }

  public fireAllSpears(): void {
    const stats = this.getStats();
    const px = this.player.position.x;
    const py = this.player.position.y;

    let baseAngle = this.player.facingAngle;
    const nearest = this.hordeManager.getNearestEnemy(px, py, stats.area);
    if (nearest && nearest.isAlive) {
      baseAngle = Math.atan2(nearest.y - py, nearest.x - px);
    }

    const count = stats.count;
    const spreadAngle = 0.16; // ~9 degrees

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spreadAngle;
      const angle = baseAngle + offset;
      this.fireProjectile(Math.cos(angle), Math.sin(angle));
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
    // 1. Advance active projectiles
    const activeCount = this.projectilePool.getActiveCount();
    for (let i = activeCount - 1; i >= 0; i--) {
      const p = this.projectilePool.getActiveProjectile(i);
      if (!p || !p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        this.projectilePool.free(p.id);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Check collision with enemies near projectile
      const hitCount = this.hordeManager.getEnemiesInRadius(
        p.x,
        p.y,
        p.radius + 14,
        this.scratchIds
      );

      for (let j = 0; j < hitCount; j++) {
        const enemyId = this.scratchIds[j];
        const enemy = this.hordeManager.pool[enemyId];
        if (enemy && enemy.active && enemy.isAlive) {
          const despawned = this.handleHit(p, enemy, vfx, lootManager, engine);
          if (despawned) break;
        }
      }
    }

    // 2. Advance fire timer
    this.timer += dt;
    const cd = this.getEffectiveCooldown();
    if (this.timer >= cd) {
      this.timer -= cd;
      this.fireAllSpears();
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const activeCount = this.projectilePool.getActiveCount();
    if (activeCount === 0) return;

    ctx.save();
    for (let i = 0; i < activeCount; i++) {
      const p = this.projectilePool.getActiveProjectile(i);
      if (!p || !p.active) continue;

      const screenX = p.x - camera.renderX;
      const screenY = p.y - camera.renderY;

      ctx.save();
      ctx.translate(screenX, screenY);
      ctx.rotate(p.rotation);

      // Bone spear shaft
      ctx.fillStyle = this.isEvolution ? '#e53e3e' : '#ede5de';
      ctx.fillRect(-14, -2, 28, 4);

      // Spear tip
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(10, -5);
      ctx.lineTo(10, 5);
      ctx.closePath();
      ctx.fillStyle = this.isEvolution ? '#d4af37' : '#b8aea5';
      ctx.fill();

      // Glowing trail
      ctx.strokeStyle = this.isEvolution
        ? 'rgba(229, 62, 62, 0.4)'
        : 'rgba(184, 174, 165, 0.3)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-24, 0);
      ctx.stroke();

      ctx.restore();
    }
    ctx.restore();
  }
}
