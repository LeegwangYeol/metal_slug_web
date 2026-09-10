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

  public radius: number = 12;
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

    this.active = true;
    this.isAlive = true;
  }

  /**
   * Inflicts damage on enemy and sets damage flash timer.
   * Returns actual damage dealt.
   */
  public takeDamage(amount: number, knockbackX: number = 0, knockbackY: number = 0): number {
    if (!this.isAlive || amount <= 0) return 0;

    const actual = Math.min(this.hp, amount);
    this.hp -= actual;
    this.flashTimer = 0.1; // 100ms visual flash

    if (this.mass > 0) {
      this.pushVx += knockbackX / this.mass;
      this.pushVy += knockbackY / this.mass;
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.isAlive = false;
    }

    return actual;
  }
}
