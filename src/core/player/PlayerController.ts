import { Vector2D, vec2 } from '../math/Vector2D';
import { AABB, BoundingBox } from '../physics/AABB';
import { PlatformPhysics } from '../physics/Platform';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import {
  PlayerKinematics,
  FacingDirection,
  PlayerPosture,
  PlayerActionState,
  AimAngle,
  PlayerInputSnapshot,
} from './PlayerKinematics';
import { WeaponState, ItemDropType } from '../weapons/WeaponTypes';
import { WeaponManager } from '../weapons/WeaponManager';
import { Grenade } from '../weapons/Grenade';

export interface PlayerState {
  position: Vector2D;
  velocity: Vector2D;
  isGrounded: boolean;
  isCrouching: boolean;
  aimDirection: Vector2D;
  currentWeapon: WeaponState;
  grenadeCount: number;
  health: number;
  lives: number;
  score: number;
  isAttackingMelee: boolean;
  meleeCooldown: number;
}

export class PlayerController implements GameEntity {
  public id: string = 'player';
  public type: string = 'PLAYER';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;

  // Attributes
  public health: number = 1.0;
  public maxHealth: number = 1.0;
  public lives: number = 3;
  public score: number = 0;
  public rescuedPowCount: number = 0;

  // Locomotion & Posture
  public facing: FacingDirection = 1;
  public posture: PlayerPosture = PlayerPosture.STANDING;
  public actionState: PlayerActionState = PlayerActionState.IDLE;
  public isGrounded: boolean = true;
  public isCrouching: boolean = false;

  // Aiming
  public aimDirection: Vector2D = vec2(1, 0);
  public aimAngle: AimAngle = AimAngle.FORWARD;

  // Melee Knife
  public isAttackingMelee: boolean = false;
  public meleeTimer: number = 0; // in seconds
  public meleeCooldown: number = 0;
  private meleeHasDealtDamage: boolean = false;
  private currentMeleeTargetId: string | null = null;

  // Semi-solid drop-through
  private isDroppingThrough: boolean = false;
  private dropThroughTimer: number = 0;
  private ignoredPlatformId: string | null = null;

  // Jump Enhancements: Coyote Time, Jump Buffering, Single-shot Jump Cut
  public coyoteTimer: number = 0; // remaining coyote time in seconds
  public jumpBufferTimer: number = 0; // remaining jump buffer time in seconds
  public jumpCutApplied: boolean = false;

  // Invulnerability after hit / respawn
  public invulnerabilityTimer: number = 0;

  // Weapons & Inventory
  public readonly weaponManager: WeaponManager;

  // Grenade counter tracking
  private nextGrenadeId: number = 1;

  constructor(
    startPosition: Vector2D = vec2(100, 200),
    weaponManager?: WeaponManager
  ) {
    this.position = { x: startPosition.x, y: startPosition.y };
    this.velocity = vec2(0, 0);
    this.weaponManager = weaponManager ?? new WeaponManager();
    this.bounds = PlayerKinematics.getBoundingBox(
      this.position.x,
      this.position.y,
      this.posture
    );
    this.coyoteTimer = PlayerKinematics.COYOTE_FRAMES * GameEngine.DEFAULT_TIMESTEP;
    this.jumpBufferTimer = 0;
    this.jumpCutApplied = false;
  }

  /**
   * Executes a jump impulse with clean state reset and audio event dispatch.
   */
  public performJump(engine: GameEngine): void {
    this.velocity.y = PlayerKinematics.JUMP_IMPULSE; // -360 px/s
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpCutApplied = false;
    this.posture = PlayerPosture.AIRBORNE;
    this.actionState = PlayerActionState.JUMPING;
    engine.eventBus.emit('play_sound', { sound: 'sfx_player_jump' });
  }

  getPlayerState(): PlayerState {
    return {
      position: { x: this.position.x, y: this.position.y },
      velocity: { x: this.velocity.x, y: this.velocity.y },
      isGrounded: this.isGrounded,
      isCrouching: this.isCrouching,
      aimDirection: { x: this.aimDirection.x, y: this.aimDirection.y },
      currentWeapon: this.weaponManager.getWeaponState(),
      grenadeCount: this.weaponManager.getGrenadeCount(),
      health: this.health,
      lives: this.lives,
      score: this.score,
      isAttackingMelee: this.isAttackingMelee,
      meleeCooldown: this.meleeCooldown,
    };
  }

  /**
   * Main input handling and kinematic update step.
   */
  handleInput(input: PlayerInputSnapshot, dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    const timestep = dt > 0 ? dt : GameEngine.DEFAULT_TIMESTEP;

    // Refresh coyote timer while firmly grounded
    if (this.isGrounded) {
      this.coyoteTimer = PlayerKinematics.COYOTE_FRAMES * timestep;
    }

    // Buffer jump input on press (unless pressing DOWN to crouch/drop-through)
    if (input.jumpPressed && !input.down) {
      this.jumpBufferTimer = PlayerKinematics.JUMP_BUFFER_FRAMES * timestep;
    }

    // 1. Process Horizontal Facing Direction
    if (input.right && !input.left) {
      this.facing = 1;
    } else if (input.left && !input.right) {
      this.facing = -1;
    }

    // 2. Process Crouch / Posture
    if (this.isGrounded) {
      if (input.down) {
        this.isCrouching = true;
        this.posture = PlayerPosture.CROUCHING;
      } else {
        this.isCrouching = false;
        this.posture = PlayerPosture.STANDING;
      }
    } else {
      this.posture = PlayerPosture.AIRBORNE;
      this.isCrouching = false;
    }

    // 3. Process 8-Way Aiming
    const inputForward =
      (this.facing === 1 && input.right) || (this.facing === -1 && input.left);
    const aimResult = PlayerKinematics.calculateAim(
      input.up,
      input.down,
      inputForward,
      this.facing,
      this.isGrounded
    );
    this.aimDirection = aimResult.aimVector;
    this.aimAngle = aimResult.angleName;

    // 4. Process Melee Slash Action in Progress
    if (this.isAttackingMelee) {
      this.velocity.x = 0;
      return;
    }

    // 5. Process Semi-Solid Platform Drop-Through
    if (this.isGrounded && input.down && input.jumpPressed) {
      this.initiateDropThrough();
      return;
    }

    // 6. Process Jump (with Coyote Time and Jump Buffering)
    const wantsJump = (input.jumpPressed || this.jumpBufferTimer > 0) && !input.down;
    const canJump = (this.isGrounded || this.coyoteTimer > 0) && !this.isDroppingThrough;

    if (canJump && wantsJump) {
      this.performJump(engine);
    }

    // Single-Shot Variable Jump Apex Cut
    // Strictly execute ONCE upon releasing jump key (!input.jumpHeld && !input.jumpPressed) while ascending
    if (!this.isGrounded && this.velocity.y < 0 && !input.jumpHeld && !input.jumpPressed && !this.jumpCutApplied) {
      this.velocity.y = PlayerKinematics.applyJumpCut(this.velocity.y);
      this.jumpCutApplied = true;
    }

    // 7. Process Horizontal Movement
    if (input.right && !input.left) {
      if (this.isCrouching) {
        this.velocity.x = PlayerKinematics.CRAWL_SPEED; // 54 px/s
        this.actionState = PlayerActionState.CRAWLING;
      } else {
        this.velocity.x = PlayerKinematics.RUN_SPEED; // 132 px/s
        this.actionState = PlayerActionState.RUNNING;
      }
    } else if (input.left && !input.right) {
      if (this.isCrouching) {
        this.velocity.x = -PlayerKinematics.CRAWL_SPEED;
        this.actionState = PlayerActionState.CRAWLING;
      } else {
        this.velocity.x = -PlayerKinematics.RUN_SPEED;
        this.actionState = PlayerActionState.RUNNING;
      }
    } else {
      this.velocity.x = 0;
      if (this.isGrounded) {
        this.actionState = this.isCrouching
          ? PlayerActionState.CROUCH_IDLE
          : PlayerActionState.IDLE;
      }
    }

    // 8. Combat: Melee vs Ranged Arbitration
    if (input.shootPressed || (input.shootHeld && this.weaponManager.getWeaponState().isAutomatic)) {
      this.executeAttackDecision(input, engine);
    }

    // 9. Secondary Combat: Grenade Throw
    if (input.grenadePressed) {
      this.throwGrenade(engine);
    }
  }

  /**
   * Melee vs Ranged Arbitration:
   * Scan forward knife box (38px forward, 6px rear, [-34, +10]px vertical).
   * If an eligible living melee-vulnerable enemy is in range on shoot press:
   * allocate knife slash state and suppress bullet firing.
   * Otherwise, fire active ranged weapon.
   */
  private executeAttackDecision(input: PlayerInputSnapshot, engine: GameEngine): void {
    // Melee attack is strictly triggered on shoot button press (not continuous hold)
    if (input.shootPressed && this.meleeCooldown <= 0) {
      const meleeTarget = this.scanMeleeTarget(engine);

      if (meleeTarget) {
        // Allocate knife slash state
        this.isAttackingMelee = true;
        this.actionState = PlayerActionState.MELEE_SLASH;
        this.meleeTimer = PlayerKinematics.MELEE_TOTAL_FRAMES * engine.fixedTimestep; // 18 frames
        this.meleeCooldown = (PlayerKinematics.MELEE_TOTAL_FRAMES + 4) * engine.fixedTimestep;
        this.meleeHasDealtDamage = false;
        this.currentMeleeTargetId = meleeTarget.id;

        engine.eventBus.emit('play_sound', { sound: 'sfx_knife_slash' });
        engine.eventBus.emit('knife_slash_started', {
          position: { x: this.position.x, y: this.position.y },
          facing: this.facing,
        });

        // Suppress bullet firing!
        return;
      }
    }

    // No melee target in range -> Fire ranged weapon
    const muzzlePos = PlayerKinematics.getMuzzlePosition(
      this.position.x,
      this.position.y,
      this.facing,
      this.posture,
      this.aimAngle
    );

    this.weaponManager.tryFire(
      muzzlePos,
      this.aimDirection,
      this.facing,
      engine,
      input.shootPressed,
      input.shootHeld
    );
  }

  /**
   * Scans for melee-vulnerable alive enemies or tied-up POWs in the knife scan box.
   */
  public scanMeleeTarget(engine: GameEngine): GameEntity | null {
    const scanBox = PlayerKinematics.getMeleeScanBox(
      this.position.x,
      this.position.y,
      this.facing
    );
    const candidates = engine.spatialGrid.query(scanBox);
    if (Array.isArray((engine as any).entitiesToAdd)) {
      for (const ent of (engine as any).entitiesToAdd) {
        if (!candidates.some((c) => c.id === ent.id) && BoundingBox.intersects(scanBox, ent.bounds)) {
          candidates.push(ent);
        }
      }
    }

    for (const candidate of candidates) {
      if (candidate.id === this.id || !candidate.isAlive) continue;

      const typeStr = candidate.type ?? '';

      // Check tied-up POW rope
      if (typeStr === 'POW') {
        return candidate;
      }

      // Check enemy melee vulnerability
      const isEnemy =
        typeStr.startsWith('SOLDIER') ||
        typeStr.includes('ENEMY') ||
        typeStr.includes('BOSS') ||
        typeStr === 'MID_BOSS_VEHICLE' ||
        typeStr === 'TETSUYUKI_BOSS';

      if (isEnemy) {
        // Heavy vehicles or shielded fronts may reject melee
        const isVulnerable = (candidate as any).isMeleeVulnerable !== false;
        if (isVulnerable) {
          return candidate;
        }
      }
    }

    return null;
  }

  /**
   * Progresses the knife slash animation and delivers damage on active frames 5-9.
   */
  private updateMeleeAttack(dt: number, engine: GameEngine): void {
    this.meleeTimer -= dt;

    const totalSeconds = PlayerKinematics.MELEE_TOTAL_FRAMES * engine.fixedTimestep;
    const elapsedSeconds = totalSeconds - this.meleeTimer;
    const currentFrame = Math.floor(elapsedSeconds / engine.fixedTimestep);

    // Active frames: 5 to 9
    if (
      !this.meleeHasDealtDamage &&
      currentFrame >= PlayerKinematics.MELEE_ACTIVE_FRAME_START &&
      currentFrame <= PlayerKinematics.MELEE_ACTIVE_FRAME_END
    ) {
      let target: GameEntity | null = null;
      if (this.currentMeleeTargetId) {
        target = engine.getEntity(this.currentMeleeTargetId) ?? null;
        if (!target && Array.isArray((engine as any).entitiesToAdd)) {
          target = (engine as any).entitiesToAdd.find((e: any) => e.id === this.currentMeleeTargetId) ?? null;
        }
      }
      if (!target) {
        target = this.scanMeleeTarget(engine);
      }

      if (target && target.isAlive) {
        // Deal 3.0 HP knife damage
        if (typeof (target as any).takeDamage === 'function') {
          (target as any).takeDamage(PlayerKinematics.MELEE_DAMAGE, 'melee', false);
        } else if (typeof (target as any).applyDamage === 'function') {
          (target as any).applyDamage(PlayerKinematics.MELEE_DAMAGE);
        }

        // Check tied POW
        if (target.type === 'POW' && typeof (target as any).freeHostage === 'function') {
          (target as any).freeHostage();
        }

        this.score += PlayerKinematics.MELEE_SCORE_BONUS;
        engine.eventBus.emit('award_score', {
          score: PlayerKinematics.MELEE_SCORE_BONUS,
          reason: 'MELEE_KILL',
        });
        engine.eventBus.emit('play_sound', { sound: 'sfx_knife_hit' });
      }

      this.meleeHasDealtDamage = true;
    }

    if (this.meleeTimer <= 0.0001) {
      this.isAttackingMelee = false;
      this.currentMeleeTargetId = null;
      this.actionState = this.isGrounded
        ? this.isCrouching
          ? PlayerActionState.CROUCH_IDLE
          : PlayerActionState.IDLE
        : PlayerActionState.FALLING;
    }
  }

  /**
   * Spawns and throws a grenade.
   */
  private throwGrenade(engine: GameEngine): void {
    if (this.weaponManager.consumeGrenade()) {
      const isAimingDown = !this.isGrounded && this.aimAngle === AimAngle.DOWN;
      const grenade = Grenade.spawnForPlayer(
        `grenade_${this.nextGrenadeId++}`,
        this.position,
        this.facing,
        this.posture,
        isAimingDown
      );

      engine.addEntity(grenade);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(grenade.id, grenade);
        engine.spatialGrid.insert(grenade);
      }
      engine.eventBus.emit('play_sound', { sound: 'sfx_grenade_throw' });
    }
  }

  private initiateDropThrough(): void {
    this.isDroppingThrough = true;
    this.dropThroughTimer = PlayerKinematics.DROP_THROUGH_FRAMES * GameEngine.DEFAULT_TIMESTEP;
    this.velocity.y = PlayerKinematics.DROP_THROUGH_IMPULSE;
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (this.isAttackingMelee) {
      this.updateMeleeAttack(dt, engine);
      this.velocity.x = 0;
    }

    // Cooldown and jump timers
    if (this.meleeCooldown > 0) {
      this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    }
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    }
    if (this.isDroppingThrough) {
      this.dropThroughTimer -= dt;
      if (this.dropThroughTimer <= 0) {
        this.isDroppingThrough = false;
        this.ignoredPlatformId = null;
      }
    }
    if (!this.isGrounded && this.coyoteTimer > 0) {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Update weapon manager
    this.weaponManager.update(dt, engine);

    // Gravity Integration with Apex Float Dampening
    // When airborne and |velocity.y| < 40 px/s, apply 0.65 * GRAVITY for arcade apex hangtime
    if (!this.isGrounded) {
      const isApex = Math.abs(this.velocity.y) < PlayerKinematics.APEX_FLOAT_VELOCITY_THRESHOLD;
      const effectiveGravity = isApex
        ? PlayerKinematics.GRAVITY * PlayerKinematics.APEX_GRAVITY_SCALE
        : PlayerKinematics.GRAVITY;

      this.velocity.y += effectiveGravity * dt;
      if (this.velocity.y > PlayerKinematics.TERMINAL_FALL_VELOCITY) {
        this.velocity.y = PlayerKinematics.TERMINAL_FALL_VELOCITY;
      }
      if (this.velocity.y > 0 && this.actionState === PlayerActionState.JUMPING) {
        this.actionState = PlayerActionState.FALLING;
      }
    }

    // Position Integration
    const prevY = this.position.y;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Platform Collision & Grounding
    const platforms = engine.getPlatforms();
    if (platforms.length > 0) {
      const halfWidth = PlayerKinematics.STANDING_WIDTH / 2;
      const contact = PlatformPhysics.resolveGroundContact(
        this.position.x,
        prevY,
        this.position.y,
        this.velocity.y,
        halfWidth,
        platforms,
        this.isDroppingThrough ? this.ignoredPlatformId : null
      );

      if (contact.isGrounded) {
        // Clean platform landing snapping and velocity zeroing
        this.position.y = contact.groundY;
        this.velocity.y = 0;
        this.isGrounded = true;
        this.coyoteTimer = PlayerKinematics.COYOTE_FRAMES * dt;
        this.jumpCutApplied = false;
        if (contact.platform && this.isDroppingThrough) {
          this.ignoredPlatformId = contact.platform.id;
        }

        if (this.actionState === PlayerActionState.FALLING || this.actionState === PlayerActionState.JUMPING) {
          this.actionState = this.isCrouching
            ? (this.velocity.x !== 0 ? PlayerActionState.CRAWLING : PlayerActionState.CROUCH_IDLE)
            : (this.velocity.x !== 0 ? PlayerActionState.RUNNING : PlayerActionState.IDLE);
        }

        // Jump input buffering: execute jump on landing if buffer is active and not dropping through
        if (this.jumpBufferTimer > 0 && !this.isDroppingThrough) {
          this.performJump(engine);
        }
      } else {
        this.isGrounded = false;
      }
    }

    // Refresh AABB bounds
    this.bounds = PlayerKinematics.getBoundingBox(
      this.position.x,
      this.position.y,
      this.posture
    );
  }

  takeDamage(amount: number = 1.0): void {
    if (this.invulnerabilityTimer > 0 || !this.isAlive) return;

    this.health -= amount;
    if (this.health <= 0) {
      this.lives--;
      if (this.lives <= 0) {
        this.isAlive = false;
        this.actionState = PlayerActionState.DEAD;
      } else {
        // Respawn with full health and 2s invulnerability
        this.health = this.maxHealth;
        this.invulnerabilityTimer = 2.0;
        this.actionState = PlayerActionState.IDLE;
        this.coyoteTimer = PlayerKinematics.COYOTE_FRAMES * GameEngine.DEFAULT_TIMESTEP;
        this.jumpBufferTimer = 0;
        this.jumpCutApplied = false;
      }
    } else {
      this.invulnerabilityTimer = 1.0;
      this.actionState = PlayerActionState.HIT_STUN;
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;

    // Item Pickup collision
    if (other.type === 'ITEM_PICKUP') {
      const dropType = (other as any).dropType as ItemDropType;
      if (dropType) {
        this.weaponManager.applyItemPickup(dropType, engine);
        (other as any).isAlive = false;
      }
    }

    // Hostage POW touch collision
    if (other.type === 'POW') {
      if (typeof (other as any).freeHostage === 'function') {
        (other as any).freeHostage();
      }
    }
  }
}
