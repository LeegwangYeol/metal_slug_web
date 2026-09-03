import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB } from '../../physics/AABB';
import { PlatformPhysics } from '../../physics/Platform';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import {
  EnemyEntity,
  EnemyType,
  SoldierRole,
  DamageSourceType,
  TargetPlayer,
} from './EnemyTypes';

/**
 * Enemy bullet projectile fired by riflemen and gun turrets.
 */
export class EnemyBullet implements GameEntity {
  public id: string;
  public type: string = 'ENEMY_BULLET';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public damage: number;
  private lifetime: number = 2.5;

  constructor(id: string, startPos: Vector2D, velocity: Vector2D, damage: number = 1) {
    this.id = id;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: velocity.x, y: velocity.y };
    this.damage = damage;
    this.bounds = createAABB(this.position.x, this.position.y, 6, 4);
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive) return;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.isAlive = false;
      if (engine) {
        engine.removeEntity(this.id);
      }
    }
  }
}

/**
 * Enemy grenade projectile tossed in a curved parabolic trajectory.
 */
export class EnemyGrenade implements GameEntity {
  public id: string;
  public type: string = 'ENEMY_GRENADE';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public isDetonated: boolean = false;
  public blastRadius: number = 52;
  public damage: number = 2;

  private gravity: number = 550;
  private fuseTime: number = 1.6;
  private bounceRestitutionY: number = 0.5;
  private bounceRestitutionX: number = 0.7;

  constructor(id: string, startPos: Vector2D, initialVelocity: Vector2D) {
    this.id = id;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: initialVelocity.x, y: initialVelocity.y };
    this.bounds = createAABB(this.position.x, this.position.y, 8, 8);
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive) return;

    this.velocity.y += this.gravity * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;

    // Platform ground bounce
    if (engine && engine.getPlatforms().length > 0) {
      const footX = this.position.x + 4;
      const prevFootY = this.position.y + 8 - this.velocity.y * dt;
      const currFootY = this.position.y + 8;
      const groundContact = PlatformPhysics.resolveGroundContact(
        footX,
        prevFootY,
        currFootY,
        this.velocity.y,
        4,
        engine.getPlatforms()
      );

      if (groundContact.isGrounded) {
        this.position.y = groundContact.groundY - 8;
        this.velocity.y = -this.velocity.y * this.bounceRestitutionY;
        this.velocity.x *= this.bounceRestitutionX;
        if (Math.abs(this.velocity.y) < 30) {
          this.velocity.y = 0;
        }
      }
    }

    this.fuseTime -= dt;
    if (this.fuseTime <= 0) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (this.isDetonated) return;
    this.isDetonated = true;
    this.isAlive = false;

    if (engine) {
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x, y: this.position.y },
        radius: this.blastRadius,
        damage: this.damage,
      });
      engine.removeEntity(this.id);
    }
  }
}

export interface SoldierConfig {
  patrolMinX?: number;
  patrolMaxX?: number;
  customHp?: number;
  walkSpeed?: number;
}

/**
 * Rebel Infantry AI implementing 4 distinct roles:
 * - SOLDIER_RIFLE: Patrol, sight detection, aim, burst rifle fire (3 shots).
 * - SOLDIER_KNIFE: Sprint charger when player in range, knife attack triggering melee counter.
 * - SOLDIER_GRENADE: Curved parabolic grenade toss bypassing low obstacles.
 * - SOLDIER_SHIELD: Directional frontal shield (deflects frontal bullets; vulnerable to rear attacks, melee knife, and explosives).
 *
 * All 4 soldier types have isMeleeVulnerable: true.
 */
export class SoldierEnemy implements EnemyEntity {
  public readonly id: string;
  public readonly type: EnemyType;
  public readonly role: SoldierRole;
  public position: Vector2D;
  public velocity: Vector2D;
  public health: number;
  public maxHealth: number;
  public isAlive: boolean = true;
  public isMeleeVulnerable: boolean = true; // Required: all 4 soldiers are melee vulnerable
  public facing: 1 | -1 = -1; // Default faces left
  public state: string = 'IDLE';

  // Dimensions & bounds
  public readonly width: number = 24;
  public readonly height: number = 38;
  public bounds: AABB;

  get boundingBox(): AABB {
    return this.bounds;
  }

  // Active melee hitbox for knife charger & shield bash
  public meleeAttackBox: AABB | null = null;
  public isAttackingMelee: boolean = false;

  // Trackers for spawned projectiles
  public spawnedBullets: EnemyBullet[] = [];
  public spawnedGrenades: EnemyGrenade[] = [];

  // AI & Kinematics state
  private targetPlayer: TargetPlayer | null = null;
  private patrolMinX: number;
  private patrolMaxX: number;
  private walkSpeed: number = 40;
  private stateTimer: number = 0;
  private isGrounded: boolean = true;
  private gravity: number = 720;

  // Rifle burst fire tracker
  private burstShotsRemaining: number = 0;
  private burstShotTimer: number = 0;
  private fireCooldownTimer: number = 0;

  // Grenade throw tracker
  private grenadeCooldownTimer: number = 0;

  // Shield mechanics
  private exposedThrustCooldown: number = 3.0;

  constructor(
    id: string,
    type: EnemyType,
    initialPosition: Vector2D,
    config: SoldierConfig = {}
  ) {
    this.id = id;
    this.type = type;
    this.position = { x: initialPosition.x, y: initialPosition.y };
    this.velocity = { x: 0, y: 0 };
    this.bounds = createAABB(this.position.x, this.position.y, this.width, this.height);

    this.patrolMinX = config.patrolMinX ?? (this.position.x - 120);
    this.patrolMaxX = config.patrolMaxX ?? (this.position.x + 120);
    if (config.walkSpeed !== undefined) {
      this.walkSpeed = config.walkSpeed;
    }

    // Role setup
    switch (type) {
      case 'SOLDIER_RIFLE':
        this.role = 'RIFLE';
        this.maxHealth = config.customHp ?? 1;
        this.health = this.maxHealth;
        this.state = 'PATROL';
        break;
      case 'SOLDIER_KNIFE':
        this.role = 'KNIFE';
        this.maxHealth = config.customHp ?? 2;
        this.health = this.maxHealth;
        this.state = 'IDLE';
        break;
      case 'SOLDIER_GRENADE':
        this.role = 'GRENADE';
        this.maxHealth = config.customHp ?? 2;
        this.health = this.maxHealth;
        this.state = 'IDLE';
        break;
      case 'SOLDIER_SHIELD':
        this.role = 'SHIELD';
        this.maxHealth = config.customHp ?? 4;
        this.health = this.maxHealth;
        this.state = 'GUARD_ADVANCE';
        break;
      default:
        throw new Error(`Unsupported soldier enemy type: ${type}`);
    }
  }

  // Factory methods for convenience
  static createRifleman(id: string, pos: Vector2D, config?: SoldierConfig): SoldierEnemy {
    return new SoldierEnemy(id, 'SOLDIER_RIFLE', pos, config);
  }

  static createKnifeCharger(id: string, pos: Vector2D, config?: SoldierConfig): SoldierEnemy {
    return new SoldierEnemy(id, 'SOLDIER_KNIFE', pos, config);
  }

  static createGrenadeThrower(id: string, pos: Vector2D, config?: SoldierConfig): SoldierEnemy {
    return new SoldierEnemy(id, 'SOLDIER_GRENADE', pos, config);
  }

  static createShieldTrooper(id: string, pos: Vector2D, config?: SoldierConfig): SoldierEnemy {
    return new SoldierEnemy(id, 'SOLDIER_SHIELD', pos, config);
  }

  setTargetPlayer(target: TargetPlayer | null): void {
    this.targetPlayer = target;
  }

  getTargetPlayer(): TargetPlayer | null {
    return this.targetPlayer;
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive) return;

    this.stateTimer += dt;

    // 1. Resolve player target from engine if not explicitly assigned
    if (!this.targetPlayer && engine) {
      const playerEntity = engine.getEntity('player');
      if (playerEntity && playerEntity.isAlive) {
        this.targetPlayer = {
          position: playerEntity.position,
          bounds: playerEntity.bounds,
          isAlive: playerEntity.isAlive,
        };
      }
    }

    // 2. State machine execution based on role
    switch (this.role) {
      case 'RIFLE':
        this.updateRiflemanAI(dt, engine);
        break;
      case 'KNIFE':
        this.updateKnifeChargerAI(dt, engine);
        break;
      case 'GRENADE':
        this.updateGrenadeThrowerAI(dt, engine);
        break;
      case 'SHIELD':
        this.updateShieldTrooperAI(dt, engine);
        break;
    }

    // 3. Platform & Gravity Physics
    this.applyPhysics(dt, engine);

    // 4. Synchronize bounding box
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;
  }

  private applyPhysics(dt: number, engine?: GameEngine): void {
    const prevFootY = this.position.y + this.height;

    // Apply gravity if not grounded
    if (!this.isGrounded) {
      this.velocity.y += this.gravity * dt;
    }

    // Integrate velocities
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    const footX = this.position.x + this.width / 2;
    const currFootY = this.position.y + this.height;

    if (engine && engine.getPlatforms().length > 0) {
      const groundContact = PlatformPhysics.resolveGroundContact(
        footX,
        prevFootY,
        currFootY,
        this.velocity.y,
        this.width / 2,
        engine.getPlatforms()
      );

      if (groundContact.isGrounded) {
        this.position.y = groundContact.groundY - this.height;
        this.velocity.y = 0;
        this.isGrounded = true;
      } else {
        this.isGrounded = false;
      }
    } else {
      // Standalone simulation fallback
      this.isGrounded = true;
    }
  }

  // ==========================================
  // 1. SOLDIER_RIFLE: Patrol, Sight, Burst Fire
  // ==========================================
  private updateRiflemanAI(dt: number, engine?: GameEngine): void {
    const target = this.targetPlayer;
    if (this.fireCooldownTimer > 0) {
      this.fireCooldownTimer -= dt;
    }

    switch (this.state) {
      case 'PATROL': {
        this.velocity.x = this.facing * this.walkSpeed;
        if (this.position.x <= this.patrolMinX && this.facing === -1) {
          this.facing = 1;
        } else if (this.position.x >= this.patrolMaxX && this.facing === 1) {
          this.facing = -1;
        }

        // Sight detection: range 240px and in facing direction
        if (target && target.isAlive !== false) {
          const dx = target.position.x - this.position.x;
          const dist = Math.abs(dx);
          const inFront = (dx > 0 && this.facing === 1) || (dx < 0 && this.facing === -1);

          if (dist <= 240 && inFront) {
            this.transitionTo('ALERT');
            if (engine) {
              engine.eventBus.emit('enemy_alert', { id: this.id, position: this.position });
            }
          }
        }
        break;
      }

      case 'ALERT': {
        this.velocity.x = 0;
        if (target) {
          this.facing = target.position.x >= this.position.x ? 1 : -1;
        }
        if (this.stateTimer >= 0.2) {
          this.transitionTo('AIM');
        }
        break;
      }

      case 'AIM': {
        this.velocity.x = 0;
        if (target) {
          this.facing = target.position.x >= this.position.x ? 1 : -1;
        }
        if (this.stateTimer >= 0.25) {
          this.burstShotsRemaining = 3;
          this.burstShotTimer = 0;
          this.transitionTo('FIRE');
        }
        break;
      }

      case 'FIRE': {
        this.velocity.x = 0;
        if (target) {
          this.facing = target.position.x >= this.position.x ? 1 : -1;
        }

        this.burstShotTimer -= dt;
        while (this.burstShotTimer <= 0 && this.burstShotsRemaining > 0) {
          this.spawnRifleBullet(engine);
          this.burstShotsRemaining--;
          this.burstShotTimer += 0.12; // 120ms between burst shots
        }

        if (this.burstShotsRemaining <= 0) {
          this.fireCooldownTimer = 1.2;
          this.transitionTo('COOLDOWN');
        }
        break;
      }

      case 'COOLDOWN': {
        this.velocity.x = 0;
        if (target) {
          const dist = Math.abs(target.position.x - this.position.x);
          // If player gets too close (< 50px), flee backwards
          if (dist < 50) {
            this.transitionTo('FLEE');
            break;
          }
        }

        if (this.fireCooldownTimer <= 0) {
          this.transitionTo('PATROL');
        }
        break;
      }

      case 'FLEE': {
        // Run away from player
        if (target) {
          this.facing = target.position.x >= this.position.x ? 1 : -1;
          this.velocity.x = -this.facing * 90;
        }
        if (this.stateTimer >= 0.8) {
          this.transitionTo('PATROL');
        }
        break;
      }
    }
  }

  private spawnRifleBullet(engine?: GameEngine): void {
    const muzzleX = this.facing === 1 ? this.position.x + this.width + 2 : this.position.x - 8;
    const muzzleY = this.position.y + 16;
    const bulletSpeed = 280;
    const bulletVel: Vector2D = { x: this.facing * bulletSpeed, y: 0 };

    const bullet = new EnemyBullet(
      `bullet_${this.id}_${Date.now()}_${Math.random()}`,
      { x: muzzleX, y: muzzleY },
      bulletVel,
      1
    );

    this.spawnedBullets.push(bullet);

    if (engine) {
      engine.addEntity(bullet);
      engine.eventBus.emit('enemy_fire', {
        id: this.id,
        type: this.type,
        muzzle: { x: muzzleX, y: muzzleY },
        velocity: bulletVel,
      });
    }
  }

  // ===============================================
  // 2. SOLDIER_KNIFE: Sprint Charger & Melee Attack
  // ===============================================
  private updateKnifeChargerAI(_dt: number, _engine?: GameEngine): void {
    const target = this.targetPlayer;

    switch (this.state) {
      case 'IDLE':
      case 'PATROL': {
        this.velocity.x = 0;
        if (target && target.isAlive !== false) {
          const dist = Math.abs(target.position.x - this.position.x);
          if (dist <= 180) {
            this.facing = target.position.x >= this.position.x ? 1 : -1;
            this.velocity.x = this.facing * 170;
            this.transitionTo('SPRINT');
          }
        }
        break;
      }

      case 'SPRINT': {
        if (target) {
          this.facing = target.position.x >= this.position.x ? 1 : -1;
          const dist = Math.abs(target.position.x - this.position.x);
          this.velocity.x = this.facing * 170;

          // Within leap range (<= 65px)
          if (dist <= 65) {
            this.velocity.y = -190;
            this.velocity.x = this.facing * 220;
            this.isGrounded = false;
            this.transitionTo('LEAP_LUNGE');
          }
        } else {
          this.velocity.x = this.facing * 170;
        }
        break;
      }

      case 'LEAP_LUNGE': {
        // Airborne knife strike
        this.isAttackingMelee = true;
        const knifeX = this.facing === 1 ? this.position.x + this.width : this.position.x - 24;
        this.meleeAttackBox = createAABB(knifeX, this.position.y + 10, 24, 18);

        if (this.isGrounded && this.stateTimer > 0.1) {
          this.isAttackingMelee = false;
          this.meleeAttackBox = null;
          this.velocity.x = 0;
          this.transitionTo('LAND_RECOVERY');
        }
        break;
      }

      case 'LAND_RECOVERY': {
        this.velocity.x = 0;
        this.isAttackingMelee = false;
        this.meleeAttackBox = null;
        if (this.stateTimer >= 0.45) {
          this.transitionTo('IDLE');
        }
        break;
      }
    }
  }

  // ==================================================
  // 3. SOLDIER_GRENADE: Curved Parabolic Grenade Toss
  // ==================================================
  private updateGrenadeThrowerAI(dt: number, engine?: GameEngine): void {
    const target = this.targetPlayer;
    if (this.grenadeCooldownTimer > 0) {
      this.grenadeCooldownTimer -= dt;
    }

    switch (this.state) {
      case 'IDLE':
      case 'SEEK_STANDOFF': {
        if (target && target.isAlive !== false) {
          const dx = target.position.x - this.position.x;
          const dist = Math.abs(dx);
          this.facing = dx >= 0 ? 1 : -1;

          if (dist > 220) {
            this.velocity.x = this.facing * 50;
          } else if (dist < 120) {
            this.velocity.x = -this.facing * 50;
          } else {
            this.velocity.x = 0;
            if (this.grenadeCooldownTimer <= 0) {
              this.transitionTo('PULL_PIN');
            }
          }
        } else {
          this.velocity.x = 0;
        }
        break;
      }

      case 'PULL_PIN': {
        this.velocity.x = 0;
        if (this.stateTimer >= 0.3) {
          this.transitionTo('WINDUP');
        }
        break;
      }

      case 'WINDUP': {
        this.velocity.x = 0;
        if (this.stateTimer >= 0.2) {
          this.tossGrenade(engine);
          this.grenadeCooldownTimer = 1.8;
          this.transitionTo('COOLDOWN');
        }
        break;
      }

      case 'COOLDOWN': {
        this.velocity.x = 0;
        if (target) {
          const dist = Math.abs(target.position.x - this.position.x);
          if (dist < 50) {
            this.velocity.x = -this.facing * 80;
          }
        }
        if (this.grenadeCooldownTimer <= 0) {
          this.transitionTo('SEEK_STANDOFF');
        }
        break;
      }
    }
  }

  private tossGrenade(engine?: GameEngine): void {
    const originX = this.facing === 1 ? this.position.x + this.width : this.position.x - 8;
    const originY = this.position.y + 10;

    let targetX = this.facing === 1 ? this.position.x + 160 : this.position.x - 160;
    let targetY = this.position.y + this.height;

    if (this.targetPlayer) {
      targetX = this.targetPlayer.position.x;
      targetY = this.targetPlayer.position.y + 30;
    }

    const g = 550;
    const tf = 0.85; // 0.85 second flight time

    let v0x = (targetX - originX) / tf;
    let v0y = (targetY - originY - 0.5 * g * tf * tf) / tf;

    // Clamping velocities to natural human throw limits
    v0x = Math.max(-260, Math.min(260, v0x));
    v0y = Math.max(-320, Math.min(-180, v0y));

    const grenade = new EnemyGrenade(
      `grenade_${this.id}_${Date.now()}_${Math.random()}`,
      { x: originX, y: originY },
      { x: v0x, y: v0y }
    );

    this.spawnedGrenades.push(grenade);

    if (engine) {
      engine.addEntity(grenade);
      engine.eventBus.emit('enemy_grenade_thrown', {
        id: this.id,
        origin: { x: originX, y: originY },
        velocity: { x: v0x, y: v0y },
      });
    }
  }

  // =========================================================
  // 4. SOLDIER_SHIELD: Frontal Shield Deflection & Shield Bash
  // =========================================================
  private updateShieldTrooperAI(dt: number, _engine?: GameEngine): void {
    const target = this.targetPlayer;
    this.exposedThrustCooldown -= dt;

    switch (this.state) {
      case 'GUARD_ADVANCE': {
        this.isAttackingMelee = false;
        this.meleeAttackBox = null;

        if (target && target.isAlive !== false) {
          const dx = target.position.x - this.position.x;
          const dist = Math.abs(dx);
          this.facing = dx >= 0 ? 1 : -1;

          if (dist <= 40) {
            this.transitionTo('SHIELD_BASH');
            break;
          }

          if (this.exposedThrustCooldown <= 0) {
            this.exposedThrustCooldown = 3.0;
            this.transitionTo('EXPOSED_THRUST');
            break;
          }

          this.velocity.x = this.facing * 45;
        } else {
          this.velocity.x = this.facing * 45;
        }
        break;
      }

      case 'SHIELD_BASH': {
        this.velocity.x = 0;
        if (this.stateTimer >= 0.12 && this.stateTimer <= 0.27) {
          this.isAttackingMelee = true;
          const bashX = this.facing === 1 ? this.position.x + this.width : this.position.x - 20;
          this.meleeAttackBox = createAABB(bashX, this.position.y + 4, 20, 30);
        } else if (this.stateTimer > 0.27) {
          this.isAttackingMelee = false;
          this.meleeAttackBox = null;
        }

        if (this.stateTimer >= 0.45) {
          this.transitionTo('GUARD_ADVANCE');
        }
        break;
      }

      case 'EXPOSED_THRUST': {
        this.velocity.x = 0;
        // 350ms window where shield is lowered to strike
        if (this.stateTimer >= 0.35) {
          this.transitionTo('GUARD_ADVANCE');
        }
        break;
      }

      case 'STAGGER': {
        this.velocity.x = 0;
        this.isAttackingMelee = false;
        this.meleeAttackBox = null;
        // 600ms stagger stun after explosive or rear hit
        if (this.stateTimer >= 0.6) {
          this.transitionTo('GUARD_ADVANCE');
        }
        break;
      }
    }
  }

  /**
   * Evaluates damage reception with directional shield logic and melee vulnerability.
   * All 4 soldiers are melee vulnerable.
   * Shield trooper deflects frontal bullets, but is vulnerable to rear attacks, melee knife, and explosives.
   */
  takeDamage(
    amount: number,
    sourceType: DamageSourceType = 'bullet',
    origin?: Vector2D
  ): boolean {
    if (!this.isAlive) return false;

    // Melee attack: All soldiers are vulnerable to melee knife!
    if (sourceType === 'melee') {
      this.health -= amount;
      this.checkDeath(sourceType);
      return true;
    }

    // Shield trooper special directional defense
    if (this.role === 'SHIELD') {
      const isFrontal = origin
        ? (origin.x - this.position.x) * this.facing > 0
        : true;

      if (isFrontal) {
        if (sourceType === 'bullet') {
          // If in vulnerable window (EXPOSED_THRUST or STAGGER), takes bullet damage
          if (this.state === 'EXPOSED_THRUST' || this.state === 'STAGGER') {
            this.health -= amount;
            this.checkDeath(sourceType);
            return true;
          } else {
            // Frontal bullet deflected!
            return false;
          }
        } else if (sourceType === 'grenade') {
          // Explosives damage and stagger shield trooper
          this.health -= amount;
          this.transitionTo('STAGGER');
          this.checkDeath(sourceType);
          return true;
        } else if (sourceType === 'flame') {
          // Flame pierces and damages
          this.health -= amount;
          this.checkDeath(sourceType);
          return true;
        }
      }
    }

    // Standard damage reception (flanking, non-shield, rear hits)
    this.health -= amount;
    this.checkDeath(sourceType);
    return true;
  }

  private checkDeath(_sourceType: DamageSourceType): void {
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      this.state = 'DEAD';
      this.velocity = { x: 0, y: 0 };
    }
  }

  private transitionTo(newState: string): void {
    this.state = newState;
    this.stateTimer = 0;
  }
}
