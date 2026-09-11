/**
 * AbyssalLightning.ts - Chaining Necrotic Electrical Strikes Occult Weapon.
 *
 * Capabilities:
 * - Selects 1 to 4 primary enemy targets in a wide radius and chains to adjacent foes.
 * - Multi-segment jittered bolt rendering with dual-core cyan/violet energy.
 * - Supreme Evolution: Storm of Torment (6 simultaneous strikes, rapid 0.8s cadence, pulls soul gems).
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

interface BoltSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface ActiveBolt {
  segments: BoltSegment[];
  life: number;
  maxLife: number;
  isEvolution: boolean;
}

export class AbyssalLightning extends Weapon {
  public readonly id: string = 'lightning';
  public readonly name: string = 'Abyssal Lightning';
  public readonly icon: string = 'lightning';

  public activeBolts: ActiveBolt[] = [];
  private scratchPrimary: Int32Array = new Int32Array(512);
  private scratchChain: Int32Array = new Int32Array(128);

  public static readonly STATS: Record<number, WeaponRankStats> = {
    1: {
      rank: 1,
      damage: 45,
      cooldown: 2.0,
      area: 320, // range
      speed: 1.0,
      count: 1, // strikes
      pierce: 1, // chain bounces
      knockback: 80,
      description: 'Strikes a random foe in range, chaining necrotic bolts to 1 adjacent enemy.',
    },
    2: {
      rank: 2,
      damage: 60,
      cooldown: 1.85,
      area: 350,
      speed: 1.0,
      count: 2,
      pierce: 2,
      knockback: 90,
      description: '+1 Strike Target & -0.15s Cooldown.',
    },
    3: {
      rank: 3,
      damage: 80,
      cooldown: 1.70,
      area: 380,
      speed: 1.0,
      count: 2,
      pierce: 3,
      knockback: 100,
      description: '+1 Chain Bounce & +20 Damage.',
    },
    4: {
      rank: 4,
      damage: 105,
      cooldown: 1.55,
      area: 410,
      speed: 1.0,
      count: 3,
      pierce: 3,
      knockback: 110,
      description: '+1 Strike Target & -0.15s Cooldown.',
    },
    5: {
      rank: 5,
      damage: 140,
      cooldown: 1.35,
      area: 450,
      speed: 1.0,
      count: 4,
      pierce: 4,
      knockback: 130,
      description: 'Catastrophic tempest striking 4 targets with 4 chain bounces.',
    },
  };

  public static readonly EVOLUTION_STATS: WeaponRankStats = {
    rank: 5,
    damage: 180,
    cooldown: 0.8,
    area: 500,
    speed: 1.2,
    count: 6,
    pierce: 5,
    knockback: 160,
    description: 'Storm of Torment: 6 simultaneous strikes, 0.8s rate, draws soul gems to impact.',
  };

  constructor(
    player: Player,
    hordeManager: HordeManager,
    statsManager?: PlayerStatsManager
  ) {
    super(player, hordeManager, statsManager);
    this.baseDamage = AbyssalLightning.STATS[1].damage;
    this.baseCooldown = AbyssalLightning.STATS[1].cooldown;
    this.baseArea = AbyssalLightning.STATS[1].area;
    this.baseKnockback = AbyssalLightning.STATS[1].knockback;
  }

  public getStats(rank: number = this.rank): WeaponRankStats {
    if (this.isEvolution) {
      return AbyssalLightning.EVOLUTION_STATS;
    }
    return AbyssalLightning.STATS[Math.min(5, Math.max(1, rank))] ?? AbyssalLightning.STATS[1];
  }

  public triggerStrike(
    vfx?: DarkFantasyVFX,
    lootManager?: LootManager,
    engine?: any
  ): number {
    const stats = this.getStats();
    const effectiveDamage = this.getEffectiveDamage();
    const effectiveRange = this.getEffectiveArea();
    const px = this.player.position.x;
    const py = this.player.position.y;

    const rawCount = this.hordeManager.getEnemiesInRadius(
      px,
      py,
      effectiveRange + 32,
      this.scratchPrimary
    );

    let nearbyCount = 0;
    for (let i = 0; i < rawCount; i++) {
      const enemyId = this.scratchPrimary[i];
      const enemy = this.hordeManager.pool[enemyId];
      if (!enemy || !enemy.active || !enemy.isAlive) continue;
      const dx = enemy.x - px;
      const dy = enemy.y - py;
      const maxReach = effectiveRange + enemy.radius;
      if (dx * dx + dy * dy <= maxReach * maxReach) {
        this.scratchPrimary[nearbyCount++] = enemyId;
      }
    }

    if (nearbyCount === 0) return 0;

    const strikesCount = Math.min(stats.count, nearbyCount);
    const maxBounces = stats.pierce ?? 1;
    const hitEnemies = new Set<number>();
    let totalHits = 0;

    // Pick unique primary targets
    for (let s = 0; s < strikesCount; s++) {
      let candidateId = -1;
      // Try to find an unhit enemy
      for (let attempt = 0; attempt < 10; attempt++) {
        const randIdx = Math.floor(Math.random() * nearbyCount);
        const id = this.scratchPrimary[randIdx];
        if (!hitEnemies.has(id)) {
          candidateId = id;
          break;
        }
      }
      if (candidateId === -1) candidateId = this.scratchPrimary[s % nearbyCount];
      hitEnemies.add(candidateId);

      const target = this.hordeManager.pool[candidateId];
      if (!target || !target.active || !target.isAlive) continue;

      // Strike primary target
      totalHits++;
      this.createBoltVisual(px, py, target.x, target.y);
      this.applyDamageToEnemy(target.id, effectiveDamage, vfx, lootManager, engine);

      // Chain to nearby enemies
      let prevX = target.x;
      let prevY = target.y;
      let currentDamage = effectiveDamage;

      for (let b = 0; b < maxBounces; b++) {
        currentDamage = Math.round(currentDamage * 0.75);
        const chainCount = this.hordeManager.getEnemiesInRadius(
          prevX,
          prevY,
          130 + 32,
          this.scratchChain
        );

        let nextTargetId = -1;
        for (let c = 0; c < chainCount; c++) {
          const cid = this.scratchChain[c];
          const cand = this.hordeManager.pool[cid];
          if (!cand || !cand.active || !cand.isAlive) continue;
          const cdx = cand.x - prevX;
          const cdy = cand.y - prevY;
          if (cdx * cdx + cdy * cdy > (130 + cand.radius) * (130 + cand.radius)) continue;
          if (!hitEnemies.has(cid)) {
            nextTargetId = cid;
            break;
          }
        }

        if (nextTargetId === -1) break; // No further chain target
        hitEnemies.add(nextTargetId);

        const nextTarget = this.hordeManager.pool[nextTargetId];
        if (!nextTarget || !nextTarget.active || !nextTarget.isAlive) break;

        totalHits++;
        this.createBoltVisual(prevX, prevY, nextTarget.x, nextTarget.y);
        this.applyDamageToEnemy(nextTarget.id, currentDamage, vfx, lootManager, engine);

        prevX = nextTarget.x;
        prevY = nextTarget.y;
      }
    }

    return totalHits;
  }

  private applyDamageToEnemy(
    enemyId: number,
    damage: number,
    vfx?: DarkFantasyVFX,
    lootManager?: LootManager,
    engine?: any
  ): void {
    const stats = this.getStats();
    const enemy = this.hordeManager.pool[enemyId];
    if (!enemy || !enemy.active || !enemy.isAlive) return;

    const dx = enemy.x - this.player.position.x;
    const dy = enemy.y - this.player.position.y;
    const dist = Math.hypot(dx, dy) || 1;
    const kbX = (dx / dist) * stats.knockback;
    const kbY = (dy / dist) * stats.knockback;

    const result = this.hordeManager.applyDamage(enemyId, damage, kbX, kbY);

    if (result.killed) {
      if (lootManager) {
        let drop = LootDropType.EMERALD_SHARD;
        if (result.gemType === 'ruby') drop = LootDropType.RUBY_GEM;
        else if (result.gemType === 'violet') drop = LootDropType.VIOLET_ABYSSAL;

        lootManager.spawnDrop(drop, result.x, result.y, true);
      }
      vfx?.emitSoulBurst(result.x, result.y, result.gemType, 8);
      vfx?.emitBloodBurst(result.x, result.y, 6);
      engine?.eventBus?.emit('enemy_killed', result);
    } else {
      vfx?.emitBloodBurst(result.x, result.y, 3);
    }
  }

  private createBoltVisual(x1: number, y1: number, x2: number, y2: number): void {
    const segments: BoltSegment[] = [];
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(3, Math.floor(dist / 35));

    let curX = x1;
    let curY = y1;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      let nextX = x1 + (x2 - x1) * t;
      let nextY = y1 + (y2 - y1) * t;

      if (i < steps) {
        const jitter = (Math.random() - 0.5) * 24;
        const perpX = -(y2 - y1) / dist;
        const perpY = (x2 - x1) / dist;
        nextX += perpX * jitter;
        nextY += perpY * jitter;
      }

      segments.push({ x1: curX, y1: curY, x2: nextX, y2: nextY });
      curX = nextX;
      curY = nextY;
    }

    this.activeBolts.push({
      segments,
      life: 0,
      maxLife: 0.16,
      isEvolution: this.isEvolution,
    });
  }

  public update(
    dt: number,
    _pool?: ProjectilePool,
    vfx?: DarkFantasyVFX,
    _scratchIds?: Int32Array,
    lootManager?: LootManager,
    engine?: any
  ): void {
    // Update active bolts visual
    for (let i = this.activeBolts.length - 1; i >= 0; i--) {
      const b = this.activeBolts[i];
      b.life += dt;
      if (b.life >= b.maxLife) {
        this.activeBolts.splice(i, 1);
      }
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown();
    if (this.timer >= cd) {
      this.timer -= cd;
      this.triggerStrike(vfx, lootManager, engine);
    }
  }

  public render(ctx: CanvasRenderingContext2D, camera: Camera): void {
    if (this.activeBolts.length === 0) return;

    ctx.save();
    for (const bolt of this.activeBolts) {
      const alpha = 1.0 - bolt.life / bolt.maxLife;

      ctx.lineWidth = bolt.isEvolution ? 4 : 2.5;
      ctx.strokeStyle = bolt.isEvolution
        ? `rgba(229, 62, 62, ${alpha * 0.95})`
        : `rgba(183, 148, 246, ${alpha * 0.95})`;
      ctx.shadowColor = bolt.isEvolution ? '#e53e3e' : '#b794f6';
      ctx.shadowBlur = 12;

      ctx.beginPath();
      for (const seg of bolt.segments) {
        const sx1 = seg.x1 - camera.renderX;
        const sy1 = seg.y1 - camera.renderY;
        const sx2 = seg.x2 - camera.renderX;
        const sy2 = seg.y2 - camera.renderY;
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
      }
      ctx.stroke();

      // White inner electric core
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.stroke();
    }
    ctx.restore();
  }
}
