/**
 * BubbleManager.ts
 *
 * Coordinates bubble projectiles, chain-reaction pop cascades ("Sweet Cascade"),
 * combo multipliers (1x -> 2x -> 3x -> 5x -> 10x Miracle Bloom), dropped candy/star pickups,
 * and Rainbow Sugar Rush (Sweet Fever) charge.
 */

import { BubbleTrapEntity, TrappedEnemyInfo } from './BubbleTrapEntity';
import {
  StarShard,
  RenderBubbleState,
  RenderPickupState,
  RenderFeverState,
} from './CuteGameTypes';

export interface CutePickup {
  id: string;
  type: 'candy' | 'star' | 'heart' | 'cake';
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  feverCharge: number;
  age: number;
  lifespan: number; // 12.0s
  isAlive: boolean;
}

export class BubbleManager {
  public readonly bubbles: BubbleTrapEntity[] = [];
  public readonly shards: StarShard[] = [];
  public readonly pickups: CutePickup[] = [];

  private nextBubbleId: number = 1;
  private nextPickupId: number = 1;

  // Combo system
  public comboCount: number = 0;
  public comboTimer: number = 0;
  public static readonly COMBO_TIMEOUT: number = 2.2; // seconds before combo resets

  // Fever (Rainbow Sugar Rush)
  public feverMeter: number = 0.0; // 0.0 to 1.0
  public isFeverActive: boolean = false;
  public feverTimeRemaining: number = 0.0;
  public static readonly FEVER_DURATION: number = 8.0;

  // Callbacks for decoupled integration
  public onScoreAwarded?: (points: number, x: number, y: number, text?: string) => void;
  public onAltarInfluence?: (x: number, y: number, combo: number) => void;
  public onFeverStateChange?: (active: boolean) => void;

  /**
   * Spawns a bubble projectile fired by player or companion.
   */
  public shootBubble(x: number, y: number, vx: number, vy: number): BubbleTrapEntity {
    const id = `bubble_${this.nextBubbleId++}_${Date.now()}`;
    const bubble = new BubbleTrapEntity(id, x, y, vx, vy);
    this.bubbles.push(bubble);
    return bubble;
  }

  /**
   * Instantly encases an enemy into a buoyant trapped bubble.
   */
  public trapEnemy(x: number, y: number, enemy: TrappedEnemyInfo): BubbleTrapEntity {
    const id = `bubble_trap_${this.nextBubbleId++}_${Date.now()}`;
    const bubble = new BubbleTrapEntity(id, x, y, 0, 0, enemy);
    this.bubbles.push(bubble);
    return bubble;
  }

  /**
   * Resolves combo multiplier tier.
   */
  public getComboMultiplier(combo: number): number {
    if (combo <= 1) return 1;
    if (combo === 2) return 2;
    if (combo === 3) return 3;
    if (combo <= 5) return 5;
    return 10; // Miracle Bloom!
  }

  /**
   * Gets combo praise title.
   */
  public getComboTitle(combo: number): string | undefined {
    if (combo === 2) return 'SWEET!';
    if (combo === 3) return 'DELICIOUS!';
    if (combo === 4 || combo === 5) return 'FANTASTIC!';
    if (combo >= 6) return '★ MIRACLE BLOOM! ★';
    return undefined;
  }

  /**
   * Pops a bubble, triggering 6-shard radial burst, drops, combo tracking, and cascade search.
   */
  public popBubble(bubbleId: string, _originX?: number, _originY?: number): boolean {
    const bubble = this.bubbles.find((b) => b.id === bubbleId && b.isAlive && b.state !== 'POPPING');
    if (!bubble) return false;

    // Advance combo
    this.comboCount++;
    this.comboTimer = BubbleManager.COMBO_TIMEOUT;
    const multiplier = this.getComboMultiplier(this.comboCount);

    // Burst into 6 star shards
    const newShards = bubble.pop(this.comboCount);
    this.shards.push(...newShards);

    // Calculate score & notify
    const baseScore = bubble.getScorePoints(this.comboCount);
    const totalScore = baseScore * multiplier;
    const comboTitle = this.getComboTitle(this.comboCount);
    if (this.onScoreAwarded) {
      this.onScoreAwarded(totalScore, bubble.x, bubble.y, comboTitle);
    }

    // Spawn dropped candy & star crystal pickups
    const dropCount = bubble.getCandyDropCount(this.comboCount);
    this.spawnPickups(bubble.x, bubble.y, dropCount, this.comboCount);

    // Notify altar manager if nearby
    if (this.onAltarInfluence) {
      this.onAltarInfluence(bubble.x, bubble.y, this.comboCount);
    }

    // Immediate blast radius cascade: pop any adjacent bubbles within 65px
    const blastRadius = BubbleTrapEntity.POP_BLAST_RADIUS;
    for (const other of this.bubbles) {
      if (other.id !== bubble.id && other.isAlive && other.state === 'TRAPPED') {
        const dx = other.x - bubble.x;
        const dy = other.y - bubble.y;
        const distSq = dx * dx + dy * dy;
        if (distSq <= blastRadius * blastRadius) {
          // Cascade pop adjacent bubble
          this.popBubble(other.id);
        }
      }
    }

    return true;
  }

  /**
   * Spawns confectionery pickup entities.
   */
  private spawnPickups(originX: number, originY: number, count: number, combo: number): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 70 + Math.random() * 90;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 60; // Initial upward bounce

      let type: 'candy' | 'star' | 'heart' | 'cake' = 'candy';
      let value = 50;
      let feverCharge = 0.05; // 20 candies = 100%

      if (combo >= 4 && i === 0) {
        type = 'star';
        value = 200;
        feverCharge = 0.12;
      } else if (this.isFeverActive && i === 1) {
        type = 'heart';
        value = 300;
        feverCharge = 0.08;
      }

      this.pickups.push({
        id: `pickup_${this.nextPickupId++}`,
        type,
        x: originX,
        y: originY,
        vx,
        vy,
        value,
        feverCharge,
        age: 0,
        lifespan: 12.0,
        isAlive: true,
      });
    }
  }

  /**
   * Charges the Rainbow Sugar Rush fever meter.
   */
  public addFeverCharge(amount: number): void {
    if (this.isFeverActive) return;

    this.feverMeter = Math.min(1.0, Math.max(0, this.feverMeter + amount));
    if (this.feverMeter >= 1.0) {
      this.activateFever();
    }
  }

  /**
   * Triggers Rainbow Sugar Rush (Sweet Fever).
   */
  public activateFever(): void {
    this.isFeverActive = true;
    this.feverMeter = 1.0;
    this.feverTimeRemaining = BubbleManager.FEVER_DURATION;
    if (this.onFeverStateChange) {
      this.onFeverStateChange(true);
    }
  }

  /**
   * Updates all bubbles, star shards, pickups, fever, and combo countdown.
   */
  public update(dt: number, playerPos?: { x: number; y: number }): void {
    // 1. Update Combo Timer
    if (this.comboCount > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }

    // 2. Update Fever Timer
    if (this.isFeverActive) {
      this.feverTimeRemaining -= dt;
      this.feverMeter = Math.max(0, this.feverTimeRemaining / BubbleManager.FEVER_DURATION);
      if (this.feverTimeRemaining <= 0) {
        this.isFeverActive = false;
        this.feverMeter = 0;
        this.feverTimeRemaining = 0;
        if (this.onFeverStateChange) {
          this.onFeverStateChange(false);
        }
      }
    }

    // 3. Update Living Bubbles
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const bubble = this.bubbles[i];
      if (bubble.isAlive && bubble.state === 'TRAPPED' && bubble.age >= bubble.lifespan) {
        this.popBubble(bubble.id, playerPos?.x, playerPos?.y);
      } else {
        bubble.update(dt);
      }
      if (!bubble.isAlive) {
        this.bubbles.splice(i, 1);
      }
    }

    // 4. Update Star Shards & Check Collisions with Living Trapped Bubbles
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];
      shard.age += dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;

      // Check collision with living trapped bubbles (cascade pop)
      let shardHit = false;
      for (const b of this.bubbles) {
        if (b.isAlive && b.state === 'TRAPPED') {
          const dx = b.x - shard.x;
          const dy = b.y - shard.y;
          if (dx * dx + dy * dy <= (b.radius + 8) * (b.radius + 8)) {
            this.popBubble(b.id);
            shardHit = true;
            break;
          }
        }
      }

      if (shardHit || shard.age >= shard.maxAge) {
        this.shards.splice(i, 1);
      }
    }

    // 5. Update Pickups & Physics / Vacuum Magnet
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.age += dt;

      if (this.isFeverActive && playerPos) {
        // Full-screen rainbow vacuum magnet towards player
        const dx = playerPos.x - p.x;
        const dy = playerPos.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
          const magnetSpeed = 520;
          p.vx = (dx / dist) * magnetSpeed;
          p.vy = (dy / dist) * magnetSpeed;
        }
      } else {
        // Standard gravity & floating air resistance
        p.vy += 220 * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Ground bounce / settle at y = 230 (or arena bottom)
      if (p.y > 230 && !this.isFeverActive) {
        p.y = 230;
        p.vy = -p.vy * 0.35;
      }

      // Check player collection contact
      if (playerPos) {
        const dx = playerPos.x - p.x;
        const dy = playerPos.y - p.y;
        if (dx * dx + dy * dy <= 28 * 28) {
          this.collectPickup(p.id);
          continue;
        }
      }

      if (p.age >= p.lifespan || !p.isAlive) {
        this.pickups.splice(i, 1);
      }
    }
  }

  /**
   * Collects a pickup, awarding points and charging fever.
   */
  public collectPickup(pickupId: string): boolean {
    const idx = this.pickups.findIndex((p) => p.id === pickupId && p.isAlive);
    if (idx === -1) return false;

    const pickup = this.pickups[idx];
    pickup.isAlive = false;
    this.pickups.splice(idx, 1);

    this.addFeverCharge(pickup.feverCharge);

    if (this.onScoreAwarded) {
      this.onScoreAwarded(pickup.value, pickup.x, pickup.y, `+${pickup.value}`);
    }

    return true;
  }

  /**
   * Snapshots for renderer.
   */
  public getRenderBubbles(): RenderBubbleState[] {
    return this.bubbles.map((b) => b.toRenderState());
  }

  public getRenderPickups(): RenderPickupState[] {
    return this.pickups.map((p) => ({
      id: p.id,
      type: p.type,
      x: p.x,
      y: p.y,
      value: p.value,
      feverCharge: p.feverCharge,
    }));
  }

  public getFeverState(): RenderFeverState {
    return {
      isActive: this.isFeverActive,
      meterProgress: this.feverMeter,
      remainingTime: this.feverTimeRemaining,
      multiplier: this.getComboMultiplier(this.comboCount),
    };
  }
}
