/**
 * PetCompanion.ts
 *
 * "Mochi the Cloud Bunny" - Faithful, adorable companion that follows the player
 * using spring physics, vacuums dropped candies and stars, auto-fires heart bolts
 * at un-bubbled enemies, and provides a periodic shimmering Bubble Shield.
 */

import { RenderPetState, HeartBolt } from './CuteGameTypes';
import { BubbleManager } from './BubbleManager';
import { CuteEnemyState } from './CuteGameTypes';

export interface PetPerkModifiers {
  speedMultiplier: number;
  fireCooldownMultiplier: number;
  vacuumRadius: number;
  shieldCooldown: number;
}

export class PetCompanion {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public facing: 1 | -1 = 1;
  public state: 'hover' | 'fetch' | 'zap' | 'cheer' = 'hover';
  public actionTimer: number = 0;

  // Auto-fire heart bolts
  public autoFireTimer: number = 0;
  public baseFireCooldown: number = 1.5; // seconds
  public activeHeartBolts: HeartBolt[] = [];
  private nextBoltId: number = 1;

  // Shimmering Bubble Shield
  public isShieldActive: boolean = true;
  public shieldRechargeTimer: number = 0;
  public baseShieldCooldown: number = 12.0; // seconds

  // Modifiers applied by Sweet Perks
  public modifiers: PetPerkModifiers = {
    speedMultiplier: 1.0,
    fireCooldownMultiplier: 1.0,
    vacuumRadius: 160.0,
    shieldCooldown: 12.0,
  };

  public time: number = 0;

  // Callbacks
  public onHeartBoltHitEnemy?: (bolt: HeartBolt, enemy: CuteEnemyState) => void;
  public onShieldAbsorbedHit?: () => void;

  constructor(initialX: number = 80, initialY: number = 200) {
    this.x = initialX;
    this.y = initialY;
  }

  /**
   * Resets or triggers cheer animation on major events (e.g. combo, boss defeat).
   */
  public cheer(duration: number = 1.2): void {
    this.state = 'cheer';
    this.actionTimer = duration;
  }

  /**
   * Updates spring-damper follower physics, vacuuming, heart bolts, and shield.
   */
  public update(
    dt: number,
    player: { x: number; y: number; facing: 1 | -1; isAlive: boolean },
    bubbleManager: BubbleManager,
    enemies: CuteEnemyState[] = []
  ): void {
    // Sanitize dt against NaN, Infinity, non-positive numbers
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    this.time += dt;

    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) {
        this.state = 'hover';
      }
    }

    // 1. Spring-Damper Follower Physics
    // Target anchor is slightly behind and above the player with gentle sine bobbing
    const targetX = player.x - player.facing * 42;
    const targetY = player.y - 30 + Math.sin(this.time * 3.5) * 8;

    const stiffness = 22.0 * this.modifiers.speedMultiplier;
    const damping = 5.0;

    let remainingDt = dt;
    let maxSubsteps = 1000; // Guard against infinite loop
    while (remainingDt > 0 && maxSubsteps-- > 0) {
      const stepDt = Math.min(remainingDt, 1 / 60);
      const fx = (targetX - this.x) * stiffness - this.vx * damping;
      const fy = (targetY - this.y) * stiffness - this.vy * damping;

      this.vx += fx * stepDt;
      this.vy += fy * stepDt;

      this.x += this.vx * stepDt;
      this.y += this.vy * stepDt;
      remainingDt -= stepDt;
    }

    // Face player or motion direction
    if (Math.abs(this.vx) > 10) {
      this.facing = this.vx > 0 ? 1 : -1;
    } else {
      this.facing = player.facing;
    }

    // 2. Candy & Star Crystal Vacuum
    const vacuumRadius = this.modifiers.vacuumRadius;
    let isFetching = false;
    const toCollect: string[] = [];

    for (const pickup of bubbleManager.pickups) {
      if (!pickup.isAlive) continue;

      const dx = this.x - pickup.x;
      const dy = this.y - pickup.y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= vacuumRadius * vacuumRadius) {
        isFetching = true;
        const dist = Math.max(1, Math.sqrt(distSq));
        const vacuumSpeed = 440 * this.modifiers.speedMultiplier;

        // Pull pickup towards Mochi
        pickup.vx = (dx / dist) * vacuumSpeed;
        pickup.vy = (dy / dist) * vacuumSpeed;

        // Collect if close enough
        if (dist < 22) {
          toCollect.push(pickup.id);
        }
      }
    }

    for (const pickupId of toCollect) {
      bubbleManager.collectPickup(pickupId);
    }

    if (isFetching && this.state !== 'zap' && this.state !== 'cheer') {
      this.state = 'fetch';
    } else if (!isFetching && this.state === 'fetch') {
      this.state = 'hover';
    }

    // 3. Update Active Heart Bolts
    for (let i = this.activeHeartBolts.length - 1; i >= 0; i--) {
      const bolt = this.activeHeartBolts[i];
      bolt.age += dt;

      // Gentle homing if target enemy is still valid
      const target = enemies.find((e) => e.id === bolt.targetId && e.isAlive && !e.isBubbled);
      if (target) {
        const dx = target.x - bolt.x;
        const dy = target.y - bolt.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 380;
        bolt.vx += (dx / dist) * 1200 * dt;
        bolt.vy += (dy / dist) * 1200 * dt;
        const currentSpeed = Math.sqrt(bolt.vx * bolt.vx + bolt.vy * bolt.vy) || 1;
        bolt.vx = (bolt.vx / currentSpeed) * speed;
        bolt.vy = (bolt.vy / currentSpeed) * speed;
      }

      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;

      // Check collision with enemies
      let hit = false;
      for (const enemy of enemies) {
        if (enemy.isAlive && !enemy.isBubbled) {
          const dx = enemy.x - bolt.x;
          const dy = enemy.y - bolt.y;
          if (dx * dx + dy * dy <= 24 * 24) {
            hit = true;
            if (this.onHeartBoltHitEnemy) {
              this.onHeartBoltHitEnemy(bolt, enemy);
            }
            break;
          }
        }
      }

      if (hit || bolt.age >= bolt.maxAge) {
        this.activeHeartBolts.splice(i, 1);
      }
    }

    // 4. Auto-Fire Heart Bolts at Nearest Un-Bubbled Foe
    const fireInterval = this.baseFireCooldown * this.modifiers.fireCooldownMultiplier;
    this.autoFireTimer += dt;
    if (this.autoFireTimer >= fireInterval && player.isAlive) {
      const nearestEnemy = this.findNearestUnbubbledEnemy(enemies, 360);
      if (nearestEnemy) {
        this.fireHeartBolt(nearestEnemy);
        this.autoFireTimer = 0;
      }
    }

    // 5. Shimmering Bubble Shield Recharge Cycle
    if (!this.isShieldActive) {
      this.shieldRechargeTimer += dt;
      if (this.shieldRechargeTimer >= this.modifiers.shieldCooldown) {
        this.isShieldActive = true;
        this.shieldRechargeTimer = 0;
        this.cheer(0.6); // Mochi cheers when shield is restored
      }
    }
  }

  /**
   * Fires a shimmering heart bolt at target enemy.
   */
  private fireHeartBolt(target: CuteEnemyState): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const speed = 360;

    const bolt: HeartBolt = {
      id: `heart_bolt_${this.nextBoltId++}`,
      x: this.x,
      y: this.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      targetId: target.id,
      age: 0,
      maxAge: 1.4, // Max 1.4s flight time
      damage: 1,
    };

    this.activeHeartBolts.push(bolt);
    this.state = 'zap';
    this.actionTimer = 0.25;
  }

  /**
   * Finds closest un-bubbled enemy within range.
   */
  private findNearestUnbubbledEnemy(enemies: CuteEnemyState[], maxRange: number): CuteEnemyState | undefined {
    let bestDistSq = maxRange * maxRange;
    let closest: CuteEnemyState | undefined = undefined;

    for (const enemy of enemies) {
      if (!enemy.isAlive || enemy.isBubbled) continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        closest = enemy;
      }
    }

    return closest;
  }

  /**
   * Absorbs a player hit if shield is active. Returns true if hit was blocked.
   */
  public tryAbsorbHit(): boolean {
    if (this.isShieldActive) {
      this.isShieldActive = false;
      this.shieldRechargeTimer = 0;
      if (this.onShieldAbsorbedHit) {
        this.onShieldAbsorbedHit();
      }
      return true;
    }
    return false;
  }

  /**
   * Snapshots render state for CanvasRenderer.
   */
  public toRenderState(): RenderPetState {
    return {
      x: this.x,
      y: this.y,
      facing: this.facing,
      state: this.state,
      actionProgress: this.actionTimer,
      shieldActive: this.isShieldActive,
    };
  }
}
