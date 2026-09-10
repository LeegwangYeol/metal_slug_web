/**
 * HordeManager.ts - High-Performance Undead Swarm Object Pool & Simulation Core.
 *
 * Capabilities:
 * - Pre-allocated 2048-entity pool with O(1) swap-and-pop free list.
 * - Zero runtime heap allocations during spawn, update, culling, and despawn.
 * - Decoupled fixed-timestep simulation (dt = 1/60s).
 * - SpatialHashGrid integration for neighborhood queries & soft flocking separation.
 */

import { SpatialHashGrid } from './SpatialHashGrid';
import { Enemy, EnemyType, GemType } from './entities/Enemy';

export interface DamageResult {
  killed: boolean;
  xpValue: number;
  gemType: GemType;
  x: number;
  y: number;
  enemyType: EnemyType;
}

export interface HordeConfig {
  maxCapacity?: number;
  maxEnemies?: number;
  cullDistance?: number;
  gridCellSize?: number;
  separationStrength?: number;
  worldBounds?: { minX: number; minY: number; maxX: number; maxY: number };
}

export type HordeManagerConfig = HordeConfig;

export class HordeManager {
  public readonly pool: Enemy[];
  public readonly spatialGrid: SpatialHashGrid;
  public readonly maxEnemies: number;
  public readonly separationStrength: number;
  public readonly cullDistance: number;
  public readonly worldBounds: { minX: number; minY: number; maxX: number; maxY: number };

  private readonly freeIndices: Int32Array;
  private freeCount: number;

  private readonly activeIndices: Int32Array;
  private activeCount: number;

  private readonly indexInActive: Int32Array;
  private readonly scratchNeighbors: Int32Array;
  private readonly scratchQuery: Int32Array;

  public totalSpawned: number = 0;
  public totalKilled: number = 0;

  constructor(config: HordeConfig | number = {}) {
    const cfg: HordeConfig = typeof config === 'number' ? { maxCapacity: config } : config;
    this.maxEnemies = cfg.maxCapacity ?? cfg.maxEnemies ?? 2048;
    this.cullDistance = cfg.cullDistance ?? 1500;
    this.separationStrength = cfg.separationStrength ?? 50.0;
    this.worldBounds = cfg.worldBounds ?? {
      minX: -2500,
      minY: -2500,
      maxX: 2500,
      maxY: 2500,
    };

    const cellSize = cfg.gridCellSize ?? 64;
    this.spatialGrid = new SpatialHashGrid({
      cellSize,
      worldMinX: this.worldBounds.minX,
      worldMinY: this.worldBounds.minY,
      worldMaxX: this.worldBounds.maxX,
      worldMaxY: this.worldBounds.maxY,
      maxEntities: this.maxEnemies,
    });

    this.pool = new Array(this.maxEnemies);
    this.freeIndices = new Int32Array(this.maxEnemies);
    this.activeIndices = new Int32Array(this.maxEnemies);
    this.indexInActive = new Int32Array(this.maxEnemies);
    this.scratchNeighbors = new Int32Array(64);
    this.scratchQuery = new Int32Array(this.maxEnemies);

    for (let i = 0; i < this.maxEnemies; i++) {
      this.pool[i] = new Enemy(i);
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }

    this.freeCount = this.maxEnemies;
    this.activeCount = 0;
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getPoolAvailableCount(): number {
    return this.freeCount;
  }

  public getPoolCapacity(): number {
    return this.maxEnemies;
  }

  /**
   * O(1) Zero-allocation spawn from pool.
   */
  public spawn(
    type: EnemyType | string,
    x: number,
    y: number,
    hpMultiplier: number = 1.0,
    speedMultiplier: number = 1.0
  ): Enemy | null {
    if (this.freeCount <= 0) {
      return null; // Pool exhausted
    }

    const id = this.freeIndices[--this.freeCount];
    const enemy = this.pool[id];
    enemy.reset(type, x, y, hpMultiplier, speedMultiplier);

    const activeIdx = this.activeCount++;
    this.activeIndices[activeIdx] = id;
    this.indexInActive[id] = activeIdx;
    this.totalSpawned++;

    this.spatialGrid.insert(id, x, y);

    return enemy;
  }

  /**
   * Alias for spawn to support multiple consumer conventions.
   */
  public spawnEnemy(
    type: EnemyType | string,
    x: number,
    y: number,
    hpMultiplier: number = 1.0,
    speedMultiplier: number = 1.0
  ): Enemy | null {
    return this.spawn(type, x, y, hpMultiplier, speedMultiplier);
  }

  /**
   * Spawns a ring/wave cluster of enemies around a central origin.
   */
  public spawnWave(
    type: EnemyType | string,
    count: number,
    center: { x: number; y: number },
    radius: number
  ): Enemy[] {
    const spawned: Enemy[] = [];
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const angle = i * step;
      const x = center.x + Math.cos(angle) * radius;
      const y = center.y + Math.sin(angle) * radius;
      const e = this.spawn(type, x, y);
      if (e) {
        spawned.push(e);
      }
    }
    return spawned;
  }

  /**
   * O(1) Zero-allocation despawn with swap-and-pop.
   */
  public despawn(id: number): void {
    if (id < 0 || id >= this.maxEnemies) return;
    const enemy = this.pool[id];
    if (!enemy.active) return;

    enemy.active = false;
    enemy.isAlive = false;

    const activeIdx = this.indexInActive[id];
    if (activeIdx < 0 || activeIdx >= this.activeCount) return;

    const lastIdx = --this.activeCount;
    const lastId = this.activeIndices[lastIdx];

    if (activeIdx !== lastIdx) {
      this.activeIndices[activeIdx] = lastId;
      this.indexInActive[lastId] = activeIdx;
    }

    this.indexInActive[id] = -1;
    this.freeIndices[this.freeCount++] = id;
    this.totalKilled++;
  }

  public killEnemy(enemy: Enemy): void {
    this.despawn(enemy.id);
  }

  /**
   * Apply damage and knockback impulse to enemy.
   */
  public applyDamage(
    id: number,
    amount: number,
    knockbackX: number = 0,
    knockbackY: number = 0
  ): DamageResult {
    const enemy = this.pool[id];
    if (!enemy || !enemy.active) {
      return {
        killed: false,
        xpValue: 0,
        gemType: 'emerald',
        x: 0,
        y: 0,
        enemyType: 'skeleton',
      };
    }

    enemy.takeDamage(amount, knockbackX, knockbackY);
    const killed = !enemy.isAlive;
    const result: DamageResult = {
      killed,
      xpValue: enemy.xpValue,
      gemType: enemy.gemType,
      x: enemy.x,
      y: enemy.y,
      enemyType: enemy.type,
    };

    if (killed) {
      this.despawn(id);
    }

    return result;
  }

  /**
   * Removes enemies that exceed cullDistance from the target point.
   */
  public cullEnemies(playerPos: { x: number; y: number }): number {
    let culled = 0;
    const cullDistSq = this.cullDistance * this.cullDistance;

    for (let i = this.activeCount - 1; i >= 0; i--) {
      const id = this.activeIndices[i];
      const enemy = this.pool[id];
      const dx = enemy.x - playerPos.x;
      const dy = enemy.y - playerPos.y;
      if (dx * dx + dy * dy > cullDistSq) {
        this.despawn(id);
        culled++;
      }
    }

    return culled;
  }

  /**
   * Discrete fixed-timestep simulation step.
   * Performs culling of dead entities, spatial rebuild, AI steering, soft separation, and kinematic integration.
   */
  public update(
    dt: number,
    playerXOrPos: number | { x: number; y: number },
    playerYArg?: number
  ): void {
    const px = typeof playerXOrPos === 'number' ? playerXOrPos : playerXOrPos.x;
    const py = typeof playerXOrPos === 'number' ? (playerYArg ?? 0) : playerXOrPos.y;

    // 1. Cull any dead enemies
    for (let i = this.activeCount - 1; i >= 0; i--) {
      const id = this.activeIndices[i];
      const enemy = this.pool[id];
      if (!enemy.isAlive || enemy.hp <= 0) {
        this.despawn(id);
      }
    }

    // 2. Rebuild spatial grid for active entities
    this.spatialGrid.rebuild(this.pool, this.activeIndices, this.activeCount);

    // 3. Update kinematics & soft flocking separation
    const minX = this.worldBounds.minX;
    const maxX = this.worldBounds.maxX;
    const minY = this.worldBounds.minY;
    const maxY = this.worldBounds.maxY;
    const scratch = this.scratchNeighbors;

    for (let i = 0; i < this.activeCount; i++) {
      const id = this.activeIndices[i];
      const enemy = this.pool[id];

      // Primary steering toward player
      const dx = px - enemy.x;
      const dy = py - enemy.y;
      const dist = Math.hypot(dx, dy);

      let chaseVx = 0;
      let chaseVy = 0;
      if (dist > 0.001) {
        chaseVx = (dx / dist) * enemy.speed;
        chaseVy = (dy / dist) * enemy.speed;
      }

      // Soft flocking separation to prevent cluster collapse
      let sepX = 0;
      let sepY = 0;
      const neighborCount = this.spatialGrid.queryRadius(
        enemy.x,
        enemy.y,
        enemy.radius * 2,
        scratch
      );

      for (let n = 0; n < neighborCount; n++) {
        const otherId = scratch[n];
        if (otherId === id) continue;

        const other = this.pool[otherId];
        const ndx = enemy.x - other.x;
        const ndy = enemy.y - other.y;
        const ndist = Math.hypot(ndx, ndy);
        const minDist = enemy.radius + other.radius;

        if (ndist < minDist && ndist > 0.0001) {
          const overlap = (minDist - ndist) / minDist;
          sepX += (ndx / ndist) * overlap * this.separationStrength;
          sepY += (ndy / ndist) * overlap * this.separationStrength;
        }
      }

      // Knockback damping
      if (enemy.pushVx !== 0) {
        enemy.pushVx = this.approach(enemy.pushVx, 0, 800 * dt);
      }
      if (enemy.pushVy !== 0) {
        enemy.pushVy = this.approach(enemy.pushVy, 0, 800 * dt);
      }

      // Total velocity & integration
      enemy.vx = chaseVx + sepX + enemy.pushVx;
      enemy.vy = chaseVy + sepY + enemy.pushVy;

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Arena bounds clamping
      if (enemy.x < minX) enemy.x = minX;
      else if (enemy.x > maxX) enemy.x = maxX;
      if (enemy.y < minY) enemy.y = minY;
      else if (enemy.y > maxY) enemy.y = maxY;

      // Damage flash decay
      if (enemy.flashTimer > 0) {
        enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);
      }

      // Orientation
      if (enemy.vx > 1) {
        enemy.facingRight = true;
      } else if (enemy.vx < -1) {
        enemy.facingRight = false;
      }
    }

    // Refresh spatial grid with freshly integrated positions
    this.spatialGrid.rebuild(this.pool, this.activeIndices, this.activeCount);
  }

  /**
   * Queries nearby enemies within a given radius using the spatial grid.
   * Returns a fresh or filtered array for test harnesses and weapon targeting.
   */
  public queryNearby(x: number, y: number, radius: number): Enemy[] {
    const count = this.spatialGrid.queryRadius(x, y, radius, this.scratchQuery);
    const results: Enemy[] = [];
    for (let i = 0; i < count; i++) {
      const id = this.scratchQuery[i];
      const enemy = this.pool[id];
      if (enemy && enemy.active && enemy.isAlive) {
        results.push(enemy);
      }
    }
    return results;
  }

  /**
   * Zero-allocation radius query writing IDs into user buffer.
   */
  public getEnemiesInRadius(
    x: number,
    y: number,
    radius: number,
    outIds: Int32Array | number[]
  ): number {
    return this.spatialGrid.queryRadius(x, y, radius, outIds);
  }

  /**
   * Finds nearest living active enemy to (x, y).
   */
  public getNearestEnemy(x: number, y: number, maxRadius: number = 1000): Enemy | null {
    let nearest: Enemy | null = null;
    let minDistanceSq = maxRadius * maxRadius;

    this.spatialGrid.forEachInRadius(x, y, maxRadius, (id) => {
      const enemy = this.pool[id];
      if (enemy && enemy.active && enemy.isAlive) {
        const dx = enemy.x - x;
        const dy = enemy.y - y;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistanceSq) {
          minDistanceSq = dSq;
          nearest = enemy;
        }
      }
    });

    return nearest;
  }

  /**
   * Zero-allocation callback iteration over enemies within radius.
   */
  public forEachEnemyInRadius(
    x: number,
    y: number,
    radius: number,
    callback: (enemy: Enemy) => boolean | void
  ): void {
    this.spatialGrid.forEachInRadius(x, y, radius, (id) => {
      const enemy = this.pool[id];
      if (enemy && enemy.active && enemy.isAlive) {
        return callback(enemy);
      }
    });
  }

  /**
   * Returns all active, living enemies.
   */
  public getActiveEnemies(): Enemy[] {
    const list: Enemy[] = [];
    for (let i = 0; i < this.activeCount; i++) {
      list.push(this.pool[this.activeIndices[i]]);
    }
    return list;
  }

  /**
   * Resets all active enemies back into the free pool.
   */
  public clear(): void {
    while (this.activeCount > 0) {
      this.despawn(this.activeIndices[this.activeCount - 1]);
    }
    this.spatialGrid.clear();
  }

  private approach(current: number, target: number, maxDelta: number): number {
    return current < target
      ? Math.min(current + maxDelta, target)
      : Math.max(current - maxDelta, target);
  }
}
