/**
 * BubbleTrapEntity.ts
 *
 * Iridescent pastel bubble projectile and trap entity.
 * Encapsulates foes into buoyant floating spheres with sinusoidal sway,
 * and bursts into 6-shard radial star cascades upon popping.
 */

import { StarShard, RenderBubbleState } from './CuteGameTypes';

export type BubbleState = 'FREE_PROJECTILE' | 'TRAPPED' | 'POPPING';

export interface TrappedEnemyInfo {
  id: string;
  type: string;
  maxHp: number;
  remainingHp: number;
  width: number;
  height: number;
  facing: 1 | -1;
  sourceData?: any;
}

export class BubbleTrapEntity {
  public readonly id: string;
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public radius: number = 24;
  public isAlive: boolean = true;
  public state: BubbleState = 'FREE_PROJECTILE';

  public trappedEnemy?: TrappedEnemyInfo;
  public age: number = 0;
  public lifespan: number = 8.0; // 8 seconds before auto-escape
  public popProgress: number = 0.0;
  public popDuration: number = 0.25; // 250ms popping animation
  public swayAngle: number = 0;
  public color: string = '#BAE6FD'; // Iridescent pastel sky

  // Swirling omega for buoyancy oscillations
  public static readonly SWAY_OMEGA: number = 4.0;
  public static readonly BASE_BUOYANCY_VY: number = -42;
  public static readonly BUOYANCY_AMPLITUDE: number = 8;
  public static readonly SHARD_COUNT: number = 6;
  public static readonly SHARD_SPEED: number = 320;
  public static readonly SHARD_LIFESPAN: number = 0.35;
  public static readonly POP_BLAST_RADIUS: number = 65;

  constructor(id: string, x: number, y: number, vx: number = 0, vy: number = 0, trappedEnemy?: TrappedEnemyInfo) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;

    if (trappedEnemy) {
      this.trappedEnemy = trappedEnemy;
      this.state = 'TRAPPED';
    } else {
      this.state = 'FREE_PROJECTILE';
    }
  }

  /**
   * Traps an enemy inside this bubble.
   */
  public trapEnemy(enemy: TrappedEnemyInfo): void {
    this.trappedEnemy = enemy;
    this.state = 'TRAPPED';
    this.age = 0;
    this.color = '#FBCFE8'; // Pastel pink-rose iridescent when holding a foe
  }

  /**
   * Updates bubble physics, sway math, and lifespan.
   */
  public update(dt: number, bounds = { minX: 20, maxX: 940, minY: 30, maxY: 510 }): void {
    if (!this.isAlive) return;

    this.age += dt;

    if (this.state === 'POPPING') {
      this.popProgress += dt / this.popDuration;
      if (this.popProgress >= 1.0) {
        this.popProgress = 1.0;
        this.isAlive = false;
      }
      return;
    }

    if (this.state === 'TRAPPED') {
      // Buoyancy: vy = -42 px/s + sin(omega * t) * 8 px/s
      const buoyantVy =
        BubbleTrapEntity.BASE_BUOYANCY_VY +
        Math.sin(BubbleTrapEntity.SWAY_OMEGA * this.age) * BubbleTrapEntity.BUOYANCY_AMPLITUDE;
      const buoyantVx =
        Math.cos(BubbleTrapEntity.SWAY_OMEGA * 0.7 * this.age) * 14;

      this.vx = buoyantVx;
      this.vy = buoyantVy;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.swayAngle = Math.sin(BubbleTrapEntity.SWAY_OMEGA * this.age) * 0.18;

      // Soft clamp inside play arena
      if (this.y < bounds.minY) {
        this.y = bounds.minY;
        this.vy = 0;
      }
      if (this.x < bounds.minX) {
        this.x = bounds.minX;
        this.vx = Math.abs(this.vx);
      } else if (this.x > bounds.maxX) {
        this.x = bounds.maxX;
        this.vx = -Math.abs(this.vx);
      }

      // Auto-escape if lifespan exceeded
      if (this.age >= this.lifespan) {
        this.pop(1);
      }
    } else if (this.state === 'FREE_PROJECTILE') {
      // Free bubble projectile fired by player or pet
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      // Gentle floating upward friction
      this.vy -= 20 * dt;
      this.swayAngle = Math.sin(this.age * 6.0) * 0.12;

      // If traveling past range or lifespan without hit, gently transition to buoyant floating sphere
      if (this.age > 1.2) {
        this.state = 'TRAPPED';
        this.color = '#E0E7FF'; // Soft lavender
      }
    }
  }

  /**
   * Pops this bubble, initiating popping state, radial star burst shards, and returns shards.
   */
  public pop(comboStep: number = 1): StarShard[] {
    if (this.state === 'POPPING') return [];

    this.state = 'POPPING';
    this.popProgress = 0.0;

    // Generate 6 star shards at 60-degree increments (theta_k = k * PI / 3)
    const shards: StarShard[] = [];
    for (let k = 0; k < BubbleTrapEntity.SHARD_COUNT; k++) {
      const angle = k * (Math.PI / 3);
      const vx = Math.cos(angle) * BubbleTrapEntity.SHARD_SPEED;
      const vy = Math.sin(angle) * BubbleTrapEntity.SHARD_SPEED;

      shards.push({
        id: `shard_${this.id}_${k}_${Date.now()}`,
        x: this.x,
        y: this.y,
        vx,
        vy,
        angle,
        age: 0,
        maxAge: BubbleTrapEntity.SHARD_LIFESPAN,
        comboStep,
      });
    }

    return shards;
  }

  /**
   * Calculates candy drop count based on combo: min(2 + comboStep, 8).
   */
  public getCandyDropCount(comboStep: number = 1): number {
    return Math.min(2 + comboStep, 8);
  }

  /**
   * Calculates score points based on combo: 100 * min(comboStep, 10).
   */
  public getScorePoints(comboStep: number = 1): number {
    return 100 * Math.min(comboStep, 10);
  }

  /**
   * Converts to render state snapshot.
   */
  public toRenderState(): RenderBubbleState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      radius: this.radius,
      trappedType: this.trappedEnemy?.type,
      trappedHp: this.trappedEnemy?.remainingHp,
      isPopping: this.state === 'POPPING',
      popProgress: this.popProgress,
      swayAngle: this.swayAngle,
      color: this.color,
    };
  }
}
