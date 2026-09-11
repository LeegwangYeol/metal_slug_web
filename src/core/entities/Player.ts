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

  public facingAngle: number = 0;
  public facingDirection: 1 | -1 = 1;
  public invulnerabilityTimer: number = 0;
  public arenaBounds: ArenaBounds | null = null;

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
   * linear acceleration, and crisp deceleration friction.
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

    if (len > 0) {
      this.velocity.x = this.approach(this.velocity.x, targetVx, Player.ACCELERATION * dt);
      this.velocity.y = this.approach(this.velocity.y, targetVy, Player.ACCELERATION * dt);
    } else {
      this.velocity.x = this.approach(this.velocity.x, 0, Player.DECELERATION * dt);
      this.velocity.y = this.approach(this.velocity.y, 0, Player.DECELERATION * dt);
    }

    if (Math.hypot(this.velocity.x, this.velocity.y) > 5) {
      this.facingAngle = Math.atan2(this.velocity.y, this.velocity.x);
      if (this.velocity.x > 5) this.facingDirection = 1;
      else if (this.velocity.x < -5) this.facingDirection = -1;
    }
  }

  /**
   * Advances player timers, passive regeneration, and kinematic position.
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
   */
  public takeDamage(amount: number, engine?: any): number {
    if (!this.isAlive || (this.invulnerabilityTimer > 0 && amount < 1000)) return 0;

    const effectiveDamage = Math.max(1, amount - this.stats.armor);
    this.stats.currentHealth = Math.max(0, this.stats.currentHealth - effectiveDamage);
    this.invulnerabilityTimer = Player.INVULNERABILITY_DURATION;

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

  private approach(current: number, target: number, maxDelta: number): number {
    return current < target
      ? Math.min(current + maxDelta, target)
      : Math.max(current - maxDelta, target);
  }
}
