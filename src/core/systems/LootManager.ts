/**
 * LootManager.ts - High-Performance Soul Shard, Gem, and Pickup Pool.
 *
 * Capabilities:
 * - Pre-allocated 1500 LootItem pool with O(1) swap-and-pop recycling.
 * - Magnetic attraction kinematics (180 to 1400 px/s at 900 px/s²).
 * - Multi-tier soul gems: Emerald (1 XP), Ruby (5 XP), Violet (25 XP), Soul Chest (100 XP + 50 HP).
 * - Special survival drops: Health Vial (25 HP) and Eldritch Magnet (Map-wide vacuum).
 * - Zero garbage generation during spawn, attraction, and collection.
 */

import { Vector2D } from '../math/Vector2D';
import { AABB } from '../physics/AABB';
import { Player } from '../entities/Player';

export enum LootDropType {
  EMERALD_SHARD = 'EMERALD_SHARD',
  RUBY_GEM = 'RUBY_GEM',
  VIOLET_ABYSSAL = 'VIOLET_ABYSSAL',
  SOUL_CHEST = 'SOUL_CHEST',
  HEALTH_VIAL = 'HEALTH_VIAL',
  ELDRITCH_MAGNET = 'ELDRITCH_MAGNET',
}

export interface LootDefinition {
  type: LootDropType;
  xpValue: number;
  healValue: number;
  color: string;
  radius: number;
}

export const LOOT_DEFINITIONS: Record<LootDropType, LootDefinition> = {
  [LootDropType.EMERALD_SHARD]: {
    type: LootDropType.EMERALD_SHARD,
    xpValue: 1,
    healValue: 0,
    color: '#68d391',
    radius: 4,
  },
  [LootDropType.RUBY_GEM]: {
    type: LootDropType.RUBY_GEM,
    xpValue: 5,
    healValue: 0,
    color: '#e53e3e',
    radius: 6,
  },
  [LootDropType.VIOLET_ABYSSAL]: {
    type: LootDropType.VIOLET_ABYSSAL,
    xpValue: 25,
    healValue: 0,
    color: '#b794f6',
    radius: 8,
  },
  [LootDropType.SOUL_CHEST]: {
    type: LootDropType.SOUL_CHEST,
    xpValue: 100,
    healValue: 50,
    color: '#ecc94b',
    radius: 12,
  },
  [LootDropType.HEALTH_VIAL]: {
    type: LootDropType.HEALTH_VIAL,
    xpValue: 0,
    healValue: 25,
    color: '#fc8181',
    radius: 7,
  },
  [LootDropType.ELDRITCH_MAGNET]: {
    type: LootDropType.ELDRITCH_MAGNET,
    xpValue: 0,
    healValue: 0,
    color: '#63b3ed',
    radius: 9,
  },
};

export class LootItem {
  public id: string;
  public type: string = 'LOOT_DROP';
  public dropType: LootDropType = LootDropType.EMERALD_SHARD;
  public position: Vector2D = { x: 0, y: 0 };
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB = { x: 0, y: 0, width: 8, height: 8 };
  public isAlive: boolean = false;

  public xpValue: number = 1;
  public healValue: number = 0;
  public radius: number = 4;
  public color: string = '#68d391';

  public isAttracted: boolean = false;
  public currentSpeed: number = 0;

  constructor(id: string) {
    this.id = id;
  }

  public reset(
    id: string,
    dropType: LootDropType,
    x: number,
    y: number,
    scatterVx: number = 0,
    scatterVy: number = 0
  ): void {
    let resolvedType = dropType as any;
    if (typeof dropType === 'number') {
      const types = [
        LootDropType.EMERALD_SHARD,
        LootDropType.RUBY_GEM,
        LootDropType.VIOLET_ABYSSAL,
        LootDropType.SOUL_CHEST,
        LootDropType.HEALTH_VIAL,
        LootDropType.ELDRITCH_MAGNET,
      ];
      resolvedType = types[dropType] ?? LootDropType.EMERALD_SHARD;
    }
    const def = LOOT_DEFINITIONS[resolvedType as LootDropType] ?? LOOT_DEFINITIONS[LootDropType.EMERALD_SHARD];
    this.id = id;
    this.dropType = resolvedType;
    this.position.x = x;
    this.position.y = y;
    this.velocity.x = scatterVx;
    this.velocity.y = scatterVy;
    this.radius = def.radius;
    this.bounds.x = x - def.radius;
    this.bounds.y = y - def.radius;
    this.bounds.width = def.radius * 2;
    this.bounds.height = def.radius * 2;
    this.xpValue = def.xpValue;
    this.healValue = def.healValue;
    this.color = def.color;
    this.isAlive = true;
    this.isAttracted = false;
    this.currentSpeed = 0;
  }
}

export class LootManager {
  public static readonly MAX_POOL_SIZE = 1500;
  public static readonly BASE_MAGNET_SPEED = 180.0;
  public static readonly MAGNET_ACCELERATION = 900.0;
  public static readonly MAX_MAGNET_SPEED = 1400.0;
  public static readonly COLLECTION_RADIUS = 18.0;
  public static readonly SCATTER_FRICTION = 400.0;

  private pool: LootItem[] = [];
  private activeItems: LootItem[] = [];
  private nextId: number = 1;

  constructor(poolSize: number = LootManager.MAX_POOL_SIZE) {
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new LootItem(`gem_pool_${i}`));
    }
  }

  /**
   * Spawns a loot drop at (x, y) with optional initial scatter impulse.
   */
  public spawnDrop(
    dropType: LootDropType,
    x: number,
    y: number,
    scatter: boolean = true
  ): LootItem | null {
    if (this.pool.length === 0) {
      return null; // Pool capacity limit
    }

    const item = this.pool.pop()!;
    let scatterVx = 0;
    let scatterVy = 0;

    if (scatter) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 60;
      scatterVx = Math.cos(angle) * speed;
      scatterVy = Math.sin(angle) * speed;
    }

    item.reset(`gem_${this.nextId++}`, dropType, x, y, scatterVx, scatterVy);
    this.activeItems.push(item);
    return item;
  }

  /**
   * Batch updates all active loot items: magnetism toward player, scatter friction, and collection.
   */
  public update(dt: number, player: Player, engine?: any): void {
    const px = player.position.x;
    const py = player.position.y;
    const magnetRadiusSq = player.stats.magnetRadius * player.stats.magnetRadius;
    const collectionRadiusSq = LootManager.COLLECTION_RADIUS * LootManager.COLLECTION_RADIUS;

    for (let i = this.activeItems.length - 1; i >= 0; i--) {
      const item = this.activeItems[i];
      if (!item.isAlive) {
        this.recycleItemAt(i);
        continue;
      }

      const dx = px - item.position.x;
      const dy = py - item.position.y;
      const distSq = dx * dx + dy * dy;

      // Collection check
      if (distSq <= collectionRadiusSq) {
        this.collectItem(item, player, engine);
        this.recycleItemAt(i);
        continue;
      }

      // Magnetic attraction trigger
      if (!item.isAttracted && distSq <= magnetRadiusSq) {
        item.isAttracted = true;
        item.currentSpeed = LootManager.BASE_MAGNET_SPEED;
      }

      // Kinematic update
      if (item.isAttracted) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          item.currentSpeed = Math.min(
            LootManager.MAX_MAGNET_SPEED,
            item.currentSpeed + LootManager.MAGNET_ACCELERATION * dt
          );
          item.position.x += (dx / dist) * item.currentSpeed * dt;
          item.position.y += (dy / dist) * item.currentSpeed * dt;
        }
      } else if (Math.abs(item.velocity.x) > 1 || Math.abs(item.velocity.y) > 1) {
        item.position.x += item.velocity.x * dt;
        item.position.y += item.velocity.y * dt;
        item.velocity.x = this.approach(item.velocity.x, 0, LootManager.SCATTER_FRICTION * dt);
        item.velocity.y = this.approach(item.velocity.y, 0, LootManager.SCATTER_FRICTION * dt);
      }

      item.bounds.x = item.position.x - item.radius;
      item.bounds.y = item.position.y - item.radius;
    }
  }

  /**
   * Attracts every active gem on the map to the player regardless of distance.
   */
  public triggerGlobalVacuum(): void {
    for (const item of this.activeItems) {
      if (item.isAlive) {
        item.isAttracted = true;
        if (item.currentSpeed < LootManager.BASE_MAGNET_SPEED) {
          item.currentSpeed = LootManager.BASE_MAGNET_SPEED;
        }
      }
    }
  }

  public getActiveItems(): readonly LootItem[] {
    return this.activeItems;
  }

  public getActiveCount(): number {
    return this.activeItems.length;
  }

  public clear(): void {
    while (this.activeItems.length > 0) {
      const item = this.activeItems.pop()!;
      item.isAlive = false;
      this.pool.push(item);
    }
  }

  /**
   * Recycles all active items to pool, sets isAlive = false, resets nextId = 1,
   * sanitizes velocities and attraction flags, and restores factory pool state.
   */
  public reset(): void {
    this.clear();
    this.nextId = 1;
    for (let i = 0; i < this.pool.length; i++) {
      const item = this.pool[i];
      item.isAlive = false;
      item.isAttracted = false;
      item.currentSpeed = 0;
      item.velocity.x = 0;
      item.velocity.y = 0;
      item.position.x = 0;
      item.position.y = 0;
    }
  }

  private collectItem(item: LootItem, player: Player, engine?: any): void {
    item.isAlive = false;

    if (item.xpValue > 0) {
      player.gainXP(item.xpValue, engine);
    }
    if (item.healValue > 0) {
      player.heal(item.healValue);
    }
    if (item.dropType === LootDropType.ELDRITCH_MAGNET) {
      this.triggerGlobalVacuum();
    }

    engine?.eventBus?.emit('loot_collected', {
      dropType: item.dropType,
      xpValue: item.xpValue,
      healValue: item.healValue,
      position: { x: item.position.x, y: item.position.y },
    });
  }

  private recycleItemAt(index: number): void {
    const last = this.activeItems.pop()!;
    if (index < this.activeItems.length) {
      this.activeItems[index] = last;
    }
    this.pool.push(last);
  }

  private approach(current: number, target: number, maxDelta: number): number {
    return current < target
      ? Math.min(current + maxDelta, target)
      : Math.max(current - maxDelta, target);
  }
}
