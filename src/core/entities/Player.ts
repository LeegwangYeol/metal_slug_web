/**
 * Player.ts - Top-Down Dark Sorcerer / Inquisitor Entity.
 *
 * Capabilities:
 * - Omnidirectional 360-degree top-down movement with zero diagonal speed bias.
 * - Linear acceleration (1800 px/s²) and deceleration friction (2400 px/s²).
 * - Arena perimeter collision clamping.
 * - Complete 11 core statistics model with 50% max CDR ceiling.
 * - 0.5s invulnerability window on damage.
 * - Integrated exponential XP curve progression.
 */

import { Vector2D, vec2 } from '../math/Vector2D';
import { AABB } from '../physics/AABB';
import { PlayerStats, DEFAULT_PLAYER_STATS } from '../player/PlayerStats';
import { PlayerProgression, LevelUpEvent } from '../progression/PlayerProgression';

export interface PlayerInputSnapshot {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface ArenaBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface AttackAnimState {
  active: boolean;
  phase: 'idle' | 'windup' | 'release' | 'followthrough';
  timer: number;
  duration: number;
  aimAngle: number;
  recoilOffset: { x: number; y: number };
  weaponAngleOffset: number;
  weaponScale: number;
  weaponType: string;
}

export class Player {
  public id: string = 'player';
  public type: string = 'PLAYER';
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds: AABB;
  public isAlive: boolean = true;

  public static readonly BASE_MOVE_SPEED = 200.0;
  public static readonly ACCELERATION = 1800.0;
  public static readonly DECELERATION = 2400.0;
  public static readonly COLLISION_RADIUS = 11.0;
  public static readonly INVULNERABILITY_DURATION = 0.5;

  // Exponential Relaxation Easing Coefficients (Spec 1)
  public static readonly LAMBDA_ACCEL = 14.0;
  public static readonly LAMBDA_BRAKE = 18.0;
  public static readonly TURNAROUND_MULTIPLIER = 1.6;

  public facingAngle: number = 0;
  public facingDirection: 1 | -1 = 1;
  public invulnerabilityTimer: number = 0;
  public arenaBounds: ArenaBounds | null = null;

  // Dynamic Motion & Procedural Animation States
  public prevVelocity: Vector2D = vec2(0, 0);
  public squashScale: { x: number; y: number } = { x: 1.0, y: 1.0 };
  public squashTimer: number = 0;
  public squashAmplitude: number = 0;
  public flinchRotation: number = 0;
  public flinchTimer: number = 0;
  public walkBobPhase: number = 0;
  public attackAnim: AttackAnimState = {
    active: false,
    phase: 'idle',
    timer: 0,
    duration: 0.26,
    aimAngle: 0,
    recoilOffset: { x: 0, y: 0 },
    weaponAngleOffset: 0,
    weaponScale: 1.0,
    weaponType: 'scythe',
  };

  public readonly stats: PlayerStats;
  public readonly progression: PlayerProgression;

  public baseXP: number = 10;

  constructor(
    startX: number = 0,
    startY: number = 0,
    customStats?: Partial<PlayerStats>,
    baseXP: number = 10
  ) {
    this.position = vec2(startX, startY);
    this.bounds = {
      x: startX - Player.COLLISION_RADIUS,
      y: startY - Player.COLLISION_RADIUS,
      width: Player.COLLISION_RADIUS * 2,
      height: Player.COLLISION_RADIUS * 2,
    };

    const rawSpeed = customStats?.moveSpeed ?? DEFAULT_PLAYER_STATS.moveSpeed;
    const initialSpeed = (rawSpeed > 0 && rawSpeed <= 5) ? rawSpeed * Player.BASE_MOVE_SPEED : rawSpeed;

    this.stats = {
      maxHealth: customStats?.maxHealth ?? DEFAULT_PLAYER_STATS.maxHealth,
      currentHealth: customStats?.currentHealth ?? (customStats?.maxHealth ?? DEFAULT_PLAYER_STATS.currentHealth),
      healthRegen: customStats?.healthRegen ?? DEFAULT_PLAYER_STATS.healthRegen,
      armor: customStats?.armor ?? DEFAULT_PLAYER_STATS.armor,
      moveSpeed: initialSpeed,
      might: customStats?.might ?? DEFAULT_PLAYER_STATS.might,
      area: customStats?.area ?? DEFAULT_PLAYER_STATS.area,
      projSpeed: customStats?.projSpeed ?? DEFAULT_PLAYER_STATS.projSpeed,
      cooldownReduction: customStats?.cooldownReduction ?? DEFAULT_PLAYER_STATS.cooldownReduction,
      magnetRadius: customStats?.magnetRadius ?? DEFAULT_PLAYER_STATS.magnetRadius,
      luck: customStats?.luck ?? DEFAULT_PLAYER_STATS.luck,
    };

    this.baseXP = baseXP;
    this.progression = new PlayerProgression(baseXP);
  }

  /**
   * Resets player entity position, kinematics, alive status, stats, and progression.
   */
  public reset(startX: number = 0, startY: number = 0, customStats?: Partial<PlayerStats>): void {
    this.position.x = startX;
    this.position.y = startY;
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.bounds.x = startX - Player.COLLISION_RADIUS;
    this.bounds.y = startY - Player.COLLISION_RADIUS;
    this.bounds.width = Player.COLLISION_RADIUS * 2;
    this.bounds.height = Player.COLLISION_RADIUS * 2;

    this.isAlive = true;
    this.facingAngle = 0;
    this.facingDirection = 1;
    this.invulnerabilityTimer = 0;

    this.prevVelocity.x = 0;
    this.prevVelocity.y = 0;
    this.squashScale.x = 1.0;
    this.squashScale.y = 1.0;
    this.squashTimer = 0;
    this.squashAmplitude = 0;
    this.flinchRotation = 0;
    this.flinchTimer = 0;
    this.walkBobPhase = 0;
    this.attackAnim.active = false;
    this.attackAnim.phase = 'idle';
    this.attackAnim.timer = 0;
    this.attackAnim.recoilOffset.x = 0;
    this.attackAnim.recoilOffset.y = 0;
    this.attackAnim.weaponAngleOffset = 0;
    this.attackAnim.weaponScale = 1.0;

    const rawSpeed = customStats?.moveSpeed ?? DEFAULT_PLAYER_STATS.moveSpeed;
    const initialSpeed = (rawSpeed > 0 && rawSpeed <= 5) ? rawSpeed * Player.BASE_MOVE_SPEED : rawSpeed;

    this.stats.maxHealth = customStats?.maxHealth ?? DEFAULT_PLAYER_STATS.maxHealth;
    this.stats.currentHealth = customStats?.currentHealth ?? (customStats?.maxHealth ?? DEFAULT_PLAYER_STATS.currentHealth);
    this.stats.healthRegen = customStats?.healthRegen ?? DEFAULT_PLAYER_STATS.healthRegen;
    this.stats.armor = customStats?.armor ?? DEFAULT_PLAYER_STATS.armor;
    this.stats.moveSpeed = initialSpeed;
    this.stats.might = customStats?.might ?? DEFAULT_PLAYER_STATS.might;
    this.stats.area = customStats?.area ?? DEFAULT_PLAYER_STATS.area;
    this.stats.projSpeed = customStats?.projSpeed ?? DEFAULT_PLAYER_STATS.projSpeed;
    this.stats.cooldownReduction = customStats?.cooldownReduction ?? DEFAULT_PLAYER_STATS.cooldownReduction;
    this.stats.magnetRadius = customStats?.magnetRadius ?? DEFAULT_PLAYER_STATS.magnetRadius;
    this.stats.luck = customStats?.luck ?? DEFAULT_PLAYER_STATS.luck;

    this.progression.reset();
  }

  public get level(): number {
    return this.progression.getLevel();
  }

  public get currentXP(): number {
    return this.progression.getCurrentXP();
  }

  public get totalXPEarned(): number {
    return this.progression.getTotalXP();
  }

  public get xpToNextLevel(): number {
    return this.progression.getXPToNextLevel();
  }

  public calculateXPRequired(level: number): number {
    return this.progression.calculateXPRequired(level);
  }

  /**
   * Handles 360-degree omnidirectional input with vector normalization,
   * dynamic exponential relaxation easing, turnaround traction boost,
   * and directional squash/stretch triggers.
   */
  public handleInput(input: PlayerInputSnapshot, dt: number): void {
    if (!this.isAlive) return;

    let dirX = 0;
    let dirY = 0;
    if (input.right) dirX += 1;
    if (input.left) dirX -= 1;
    if (input.down) dirY += 1;
    if (input.up) dirY -= 1;

    const len = Math.hypot(dirX, dirY);
    if (len > 0) {
      dirX /= len;
      dirY /= len;
    }

    const maxSpeed = this.stats.moveSpeed;
    const targetVx = dirX * maxSpeed;
    const targetVy = dirY * maxSpeed;

    const prevVx = this.prevVelocity.x;
    const prevVy = this.prevVelocity.y;

    this.velocity.x = this.approachExp(this.velocity.x, targetVx, dt);
    this.velocity.y = this.approachExp(this.velocity.y, targetVy, dt);

    // Bounded velocity invariant: speed cannot exceed maxSpeed
    const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
    if (currentSpeed > maxSpeed && maxSpeed > 0) {
      const ratio = maxSpeed / currentSpeed;
      this.velocity.x *= ratio;
      this.velocity.y *= ratio;
    }

    // Directional turnaround squash & stretch (Spec 2.1)
    if (
      (targetVx * prevVx < 0 && Math.abs(prevVx) > 30) ||
      (targetVy * prevVy < 0 && Math.abs(prevVy) > 30)
    ) {
      this.triggerSquashStretch(0.78, 1.28);
    }

    // Acceleration sprint stretch (Spec 2.2)
    const prevSpeed = Math.hypot(prevVx, prevVy);
    const accelMag = Math.abs(currentSpeed - prevSpeed) / Math.max(dt, 0.0001);
    if (accelMag > 2500 && this.squashAmplitude === 0) {
      const burstStretch = Math.min(0.20, accelMag / 15000);
      this.triggerSquashStretch(1.0 + burstStretch, 1.0 / (1.0 + burstStretch));
    }

    this.prevVelocity.x = this.velocity.x;
    this.prevVelocity.y = this.velocity.y;

    if (currentSpeed > 5) {
      this.facingAngle = Math.atan2(this.velocity.y, this.velocity.x);
      if (this.velocity.x > 5) this.facingDirection = 1;
      else if (this.velocity.x < -5) this.facingDirection = -1;
    }
  }

  /**
   * Advances player timers, passive regeneration, kinematics,
   * damped harmonic squash/stretch, walk bob phase, and attack state machine.
   */
  public update(dt: number, _engine?: any): void {
    if (!this.isAlive) return;

    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }

    if (this.stats.healthRegen > 0 && this.stats.currentHealth < this.stats.maxHealth) {
      this.stats.currentHealth = Math.min(
        this.stats.maxHealth,
        this.stats.currentHealth + this.stats.healthRegen * dt
      );
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    if (this.arenaBounds) {
      const r = Player.COLLISION_RADIUS;
      this.position.x = Math.max(
        this.arenaBounds.minX + r,
        Math.min(this.arenaBounds.maxX - r, this.position.x)
      );
      this.position.y = Math.max(
        this.arenaBounds.minY + r,
        Math.min(this.arenaBounds.maxY - r, this.position.y)
      );
    }

    this.bounds.x = this.position.x - Player.COLLISION_RADIUS;
    this.bounds.y = this.position.y - Player.COLLISION_RADIUS;

    // Damped harmonic oscillator squash & stretch update (Spec 2)
    if (this.squashAmplitude !== 0) {
      this.squashTimer += dt;
      const t = this.squashTimer;
      const zeta = 0.65;
      const omegaN = 28.0;
      const omegaD = 21.28;
      const decay = Math.exp(-zeta * omegaN * t);
      if (decay < 0.01 || t > 0.3) {
        this.squashAmplitude = 0;
        this.squashTimer = 0;
        this.squashScale.x = 1.0;
        this.squashScale.y = 1.0;
      } else {
        const osc = Math.cos(omegaD * t);
        const delta = this.squashAmplitude * decay * osc;
        this.squashScale.x = 1.0 + delta;
        this.squashScale.y = 1.0 / (1.0 + delta); // Strictly volume-conserving: Sx * Sy == 1.0
      }
    }

    // Flinch rotation decay
    if (this.flinchRotation !== 0) {
      this.flinchTimer += dt;
      this.flinchRotation *= Math.exp(-25.0 * dt);
      if (Math.abs(this.flinchRotation) < 0.005) {
        this.flinchRotation = 0;
        this.flinchTimer = 0;
      }
    }

    // Advance walk bob phase (Spec 4)
    const speed = Math.hypot(this.velocity.x, this.velocity.y);
    const maxSpeed = this.stats.moveSpeed || 1;
    if (speed > 5) {
      this.walkBobPhase = (this.walkBobPhase + (2.4 * 2 * Math.PI) * (speed / maxSpeed) * dt) % (2 * Math.PI);
    } else {
      this.walkBobPhase = 0;
    }

    // Advance attack animation state machine (Spec 3)
    this.updateAttackAnim(dt);
  }

  /**
   * Adds XP, advances levels, and fires event bus notifications.
   */
  public gainXP(amount: number, engine?: any): { levelsGained: number; newLevel: number } {
    if (amount <= 0 || !this.isAlive) {
      return { levelsGained: 0, newLevel: this.level };
    }

    const levelsGained = this.progression.addXP(amount);

    if (levelsGained > 0 && engine?.eventBus) {
      const event: LevelUpEvent = {
        newLevel: this.level,
        previousLevel: this.level - levelsGained,
        surplusXP: this.currentXP,
        xpRequiredForNext: this.xpToNextLevel,
        totalXPEarned: this.totalXPEarned,
      };
      engine.eventBus.emit('player_levelup', event);
    }

    return { levelsGained, newLevel: this.level };
  }

  /**
   * Resolves incoming damage with armor reduction and invulnerability period.
   * Triggers impulse deformation squash and rotational flinch stumble.
   */
  public takeDamage(amount: number, engine?: any): number {
    if (!this.isAlive || (this.invulnerabilityTimer > 0 && amount < 1000)) return 0;

    const effectiveDamage = Math.max(1, amount - this.stats.armor);
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - effectiveDamage);
    this.invulnerabilityTimer = Player.INVULNERABILITY_DURATION;

    // Tier 1: Impulse Squash & Stretch impact compression (Spec 2.3)
    this.triggerSquashStretch(1.25, 0.75);

    // Tier 2: Rotational Flinch / Stumble (Spec 6)
    this.flinchRotation = (Math.random() < 0.5 ? 1 : -1) * 0.20;
    this.flinchTimer = 0;

    engine?.eventBus?.emit('player_damaged', {
      damage: effectiveDamage,
      currentHealth: this.stats.currentHealth,
      maxHealth: this.stats.maxHealth,
    });

    if (this.stats.currentHealth <= 0) {
      this.isAlive = false;
      engine?.eventBus?.emit('player_died', {
        position: this.position,
        level: this.level,
      });
    }

    return effectiveDamage;
  }

  /**
   * Heals the player by specified amount up to maxHealth.
   */
  public heal(amount: number): number {
    if (!this.isAlive || amount <= 0) return 0;
    const prev = this.stats.currentHealth;
    this.stats.currentHealth = Math.min(this.stats.maxHealth, this.stats.currentHealth + amount);
    return this.stats.currentHealth - prev;
  }

  /**
   * Applies permanent or temporary deltas to player stats with safety clamps.
   */
  public applyStatDelta(stat: keyof PlayerStats, delta: number): void {
    if (stat === 'cooldownReduction') {
      this.stats.cooldownReduction = Math.min(0.50, Math.max(0.0, this.stats.cooldownReduction + delta));
    } else if (stat === 'maxHealth') {
      this.stats.maxHealth += delta;
      this.heal(delta);
    } else if (stat === 'currentHealth') {
      this.heal(delta);
    } else {
      this.stats[stat] += delta;
    }
  }

  /**
   * Triggers damped harmonic squash and stretch oscillation.
   * Conserves apparent volume (Sx * Sy = 1.0).
   */
  public triggerSquashStretch(initialSx: number, initialSy: number): void {
    this.squashTimer = 0;
    this.squashAmplitude = initialSx - 1.0;
    this.squashScale.x = initialSx;
    this.squashScale.y = initialSy;
  }

  /**
   * Triggers 3-phase attack animation state machine (wind-up, release, follow-through).
   */
  public triggerAttack(aimAngle: number = 0, weaponType: string = 'scythe'): void {
    this.attackAnim.active = true;
    this.attackAnim.phase = 'windup';
    this.attackAnim.timer = 0;
    this.attackAnim.duration = 0.26;
    this.attackAnim.aimAngle = aimAngle;
    this.attackAnim.weaponType = weaponType;
    this.attackAnim.recoilOffset.x = 0;
    this.attackAnim.recoilOffset.y = 0;
    this.attackAnim.weaponAngleOffset = 0;
    this.attackAnim.weaponScale = 1.0;
  }

  private updateAttackAnim(dt: number): void {
    if (!this.attackAnim.active) return;

    this.attackAnim.timer += dt;
    const t = this.attackAnim.timer;
    const cos = Math.cos(this.attackAnim.aimAngle);
    const sin = Math.sin(this.attackAnim.aimAngle);

    if (t < 0.08) {
      // Phase 1: Wind-Up (0.0s to 0.08s) - torso leans backward opposite aim
      this.attackAnim.phase = 'windup';
      const progress = t / 0.08;
      const backwardDist = -4.0 * Math.sin(progress * Math.PI * 0.5);
      this.attackAnim.recoilOffset.x = cos * backwardDist;
      this.attackAnim.recoilOffset.y = sin * backwardDist;
      this.attackAnim.weaponAngleOffset = -0.6 * progress;
      this.attackAnim.weaponScale = 1.0 + 0.15 * progress;
    } else if (t < 0.14) {
      // Phase 2: Release / Strike (0.08s to 0.14s) - explosive cleave forward
      this.attackAnim.phase = 'release';
      const progress = (t - 0.08) / 0.06;
      const ease = 1 - Math.pow(1 - progress, 3);
      const forwardDist = -4.0 + 9.0 * ease; // moves from -4.0 to +5.0 px
      this.attackAnim.recoilOffset.x = cos * forwardDist;
      this.attackAnim.recoilOffset.y = sin * forwardDist;
      this.attackAnim.weaponAngleOffset = -0.6 + 3.75 * ease;
      this.attackAnim.weaponScale = 1.15 - 0.15 * ease;
    } else if (t < 0.26) {
      // Phase 3: Follow-through & Elastic Recovery (0.14s to 0.26s) - damped return
      this.attackAnim.phase = 'followthrough';
      const followTime = t - 0.14;
      const progress = followTime / 0.12;
      const decay = Math.exp(-18.0 * followTime);
      const settle = 0.17 * decay * Math.cos(30.0 * followTime);
      this.attackAnim.weaponAngleOffset = settle;
      const returnEase = 1 - progress;
      this.attackAnim.recoilOffset.x = cos * 5.0 * returnEase * decay;
      this.attackAnim.recoilOffset.y = sin * 5.0 * returnEase * decay;
      this.attackAnim.weaponScale = 1.0;
    } else {
      // Return to neutral idle
      this.attackAnim.active = false;
      this.attackAnim.phase = 'idle';
      this.attackAnim.timer = 0;
      this.attackAnim.recoilOffset.x = 0;
      this.attackAnim.recoilOffset.y = 0;
      this.attackAnim.weaponAngleOffset = 0;
      this.attackAnim.weaponScale = 1.0;
    }
  }

  /**
   * Exponential relaxation velocity easing.
   * v(t+dt) = v(t) + (v_target - v(t)) * (1 - e^(-lambda * dt))
   */
  public approachExp(current: number, target: number, dt: number): number {
    if (current === target) return target;

    let lambda: number;
    if (target !== 0) {
      if (current * target < 0) {
        // Reversing direction: enhanced turnaround traction
        lambda = Player.LAMBDA_BRAKE * Player.TURNAROUND_MULTIPLIER; // 28.8 s^-1
      } else {
        // Accelerating towards non-zero target
        lambda = Player.LAMBDA_ACCEL; // 14.0 s^-1
      }
    } else {
      // Braking / decelerating to stop
      lambda = Player.LAMBDA_BRAKE; // 18.0 s^-1
    }

    const alpha = 1.0 - Math.exp(-lambda * dt);
    const next = current + (target - current) * alpha;

    // Numerical snap to zero or target to eliminate asymptotic tails
    if (target === 0 && Math.abs(next) < 0.5) {
      return 0;
    }
    if (target !== 0 && Math.abs(next - target) < 0.05) {
      return target;
    }

    return next;
  }

  public approach(current: number, target: number, maxDelta: number): number {
    return current < target
      ? Math.min(current + maxDelta, target)
      : Math.max(current - maxDelta, target);
  }
}
