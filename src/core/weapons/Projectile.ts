/**
 * Projectile.ts - Pre-allocated Pooled Projectile Entity.
 *
 * Capabilities:
 * - Fixed 256 capacity pool with O(1) swap-and-pop lifecycle.
 * - Intrusive hit history buffer (Int16Array) preventing duplicate hits without heap allocations.
 * - Straight kinematics with lifetime expiration and pierce countdown.
 */

import { WeaponId } from './WeaponTypes';

export class Projectile {
  public readonly id: number;
  public active: boolean = false;
  public weaponId: WeaponId | string = 'spear';

  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public speed: number = 0;
  public radius: number = 8;
  public damage: number = 20;
  public knockback: number = 100;
  public pierceRemaining: number = 3;
  public life: number = 0;
  public maxLife: number = 2.0;
  public rotation: number = 0;

  // Intrusive hit history buffer to prevent multiple hits on the same enemy
  public readonly hitEnemyIds: Int16Array = new Int16Array(16);
  public hitCount: number = 0;

  constructor(id: number) {
    this.id = id;
  }

  public reset(
    weaponId: WeaponId | string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    speed: number,
    radius: number,
    damage: number,
    knockback: number,
    pierce: number,
    maxLife: number = 2.0
  ): void {
    this.weaponId = weaponId;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.speed = speed;
    this.radius = radius;
    this.damage = damage;
    this.knockback = knockback;
    this.pierceRemaining = pierce;
    this.life = 0;
    this.maxLife = maxLife;
    this.rotation = Math.atan2(vy, vx);
    this.hitCount = 0;
    this.hitEnemyIds.fill(-1);
    this.active = true;
  }

  public hasHit(enemyId: number): boolean {
    for (let i = 0; i < this.hitCount; i++) {
      if (this.hitEnemyIds[i] === enemyId) return true;
    }
    return false;
  }

  public recordHit(enemyId: number): void {
    if (this.hitCount < 16) {
      this.hitEnemyIds[this.hitCount++] = enemyId;
    }
  }
}

export class ProjectilePool {
  public readonly capacity: number;
  public readonly pool: Projectile[];
  private readonly freeIndices: Int32Array;
  private freeCount: number;
  private readonly activeIndices: Int32Array;
  private activeCount: number;
  private readonly indexInActive: Int32Array;

  constructor(capacity: number = 256) {
    this.capacity = capacity;
    this.pool = new Array(capacity);
    this.freeIndices = new Int32Array(capacity);
    this.activeIndices = new Int32Array(capacity);
    this.indexInActive = new Int32Array(capacity);

    for (let i = 0; i < capacity; i++) {
      this.pool[i] = new Projectile(i);
      this.freeIndices[i] = i;
      this.indexInActive[i] = -1;
    }
    this.freeCount = capacity;
    this.activeCount = 0;
  }

  public spawn(): Projectile | null {
    if (this.freeCount <= 0) return null;
    const idx = this.freeIndices[--this.freeCount];
    const p = this.pool[idx];
    const activeIdx = this.activeCount++;
    this.activeIndices[activeIdx] = idx;
    this.indexInActive[idx] = activeIdx;
    return p;
  }

  public allocate(): Projectile | null {
    return this.spawn();
  }

  public free(idx: number): void {
    if (idx < 0 || idx >= this.capacity) return;
    const p = this.pool[idx];
    if (!p.active) return;
    p.active = false;

    const activeIdx = this.indexInActive[idx];
    if (activeIdx >= 0 && activeIdx < this.activeCount) {
      const lastIdx = --this.activeCount;
      const lastId = this.activeIndices[lastIdx];
      if (activeIdx !== lastIdx) {
        this.activeIndices[activeIdx] = lastId;
        this.indexInActive[lastId] = activeIdx;
      }
      this.indexInActive[idx] = -1;
      this.freeIndices[this.freeCount++] = idx;
    }
  }

  public recycleProjectile(p: Projectile): void {
    if (p) {
      this.free(p.id);
    }
  }

  public getActiveCount(): number {
    return this.activeCount;
  }

  public getCapacity(): number {
    return this.capacity;
  }

  public getAvailableCount(): number {
    return this.freeCount;
  }

  public getActiveProjectile(index: number): Projectile {
    return this.pool[this.activeIndices[index]];
  }

  public clear(): void {
    while (this.activeCount > 0) {
      this.free(this.activeIndices[this.activeCount - 1]);
    }
  }
}
