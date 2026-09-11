/**
 * Enemy.ts - Pooled Undead Enemy Entity.
 *
 * Implements genuine mutable state for object pool reuse with zero GC allocation.
 */

import {
  EnemyType,
  GemType,
  ENEMY_BASE_STATS,
  normalizeEnemyType,
} from './EnemyTypes';

export * from './EnemyTypes';

export class Enemy {
  public readonly id: number;
  public active: boolean = false;
  public isAlive: boolean = false;
  public type: EnemyType = 'skeleton';

  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public pushVx: number = 0;
  public pushVy: number = 0;

  public radius: number = 11;
  public hp: number = 25;
  public maxHp: number = 25;
  public speed: number = 65;
  public damage: number = 10;
  public mass: number = 1.0;
  public gemType: GemType = 'emerald';
  public xpValue: number = 1;

  public flashTimer: number = 0;
  public behaviorTimer: number = 0;
  public facingRight: boolean = true;

  // Procedural Animation & Motion State (flat zero-allocation numbers)
  public walkPhase: number = 0;
  public hoverPhase: number = 0;
  public squashX: number = 1.0;
  public squashY: number = 1.0;
  public flinchRot: number = 0;
  public flinchTimer: number = 0;

  private _pos = { x: 0, y: 0 };

  public get collisionRadius(): number {
    return this.radius;
  }

  public set collisionRadius(val: number) {
    this.radius = val;
  }

  public get position(): { x: number; y: number } {
    this._pos.x = this.x;
    this._pos.y = this.y;
    return this._pos;
  }

  constructor(id: number) {
    this.id = id;
  }

  public get isActive(): boolean {
    return this.active;
  }

  public set isActive(val: boolean) {
    this.active = val;
  }

  public get health(): number {
    return this.hp;
  }

  public set health(val: number) {
    this.hp = val;
    if (this.hp <= 0) {
      this.isAlive = false;
    }
  }

  public get maxHealth(): number {
    return this.maxHp;
  }

  public set maxHealth(val: number) {
    this.maxHp = val;
  }

  /**
   * Resets all entity state cleanly for object pool reuse.
   * Zero heap allocations.
   */
  public reset(
    type: EnemyType | string,
    x: number,
    y: number,
    hpMultiplier: number = 1.0,
    speedMultiplier: number = 1.0
  ): void {
    const key = normalizeEnemyType(type);
    const base = ENEMY_BASE_STATS[key];

    this.type = type as EnemyType;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.pushVx = 0;
    this.pushVy = 0;

    this.radius = base.radius;
    this.maxHp = Math.round(base.hp * hpMultiplier);
    this.hp = this.maxHp;
    this.speed = base.speed * speedMultiplier;
    this.damage = base.damage;
    this.mass = base.mass;
    this.gemType = base.gemType;
    this.xpValue = base.xpValue;

    this.flashTimer = 0;
    this.behaviorTimer = 0;
    this.facingRight = true;

    this.walkPhase = 0;
    this.hoverPhase = 0;
    this.squashX = 1.0;
    this.squashY = 1.0;
    this.flinchRot = 0;
    this.flinchTimer = 0;

    this.active = true;
    this.isAlive = true;
  }

  /**
   * Inflicts damage on enemy and sets damage flash timer.
   * Applies impulse deformation squash and rotational flinch stumble.
   * Returns actual damage dealt.
   */
  public takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0): number {
    if (!this.isAlive || amount <= 0) return 0;

    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    this.flashTimer = 0.10; // 100ms visual flash cascade (50ms white -> 50ms crimson)

    // Tier 1: Impulse Squash & Stretch deformation
    this.squashX = 1.25;
    this.squashY = 0.75;

    // Tier 2: Rotational Flinch / Stumble proportional to knockback impulse
    this.flinchTimer = 0.15;
    if (this.mass > 0) {
      const impulseRot = (knockbackX * 0.002) / this.mass;
      this.flinchRot = Math.max(
        -0.35,
        Math.min(0.35, impulseRot !== 0 ? impulseRot : (this.facingRight ? -0.15 : 0.15))
      );
      this.pushVx += knockbackX / this.mass;
      this.pushVy += knockbackY / this.mass;
    } else {
      this.flinchRot = this.facingRight ? -0.15 : 0.15;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
    }

    return actual;
  }
}
