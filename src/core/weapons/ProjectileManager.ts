import { Vector2D, vec2 } from '../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../physics/AABB';
import { PlatformPhysics } from '../physics/Platform';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { WeaponType, BrassCasing, GroundFireAOE } from './WeaponTypes';
import { FacingDirection } from '../player/PlayerKinematics';

export interface DamageableEntity {
  id: string;
  isAlive: boolean;
  takeDamage?(amount: number, isExplosive?: boolean, isFire?: boolean): void;
  applyDamage?(amount: number): void;
}

export class BulletProjectile implements GameEntity {
  public id: string;
  public type: string = 'PROJECTILE';
  public weaponType: WeaponType;
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public damage: number;
  public pierces: boolean;
  public lifeTime: number;
  public maxLifeTime: number;

  // Flame Shot specific properties
  public currentRadius: number = 10.0;
  public static readonly FLAME_START_RADIUS: number = 10.0;
  public static readonly FLAME_MAX_RADIUS: number = 36.0;

  // Track entities already hit or immunity timestamps for piercing weapons
  public damagedEntityIds: Set<string> = new Set();
  public targetImmunityMap: Map<string, number> = new Map(); // entityId -> immunity remaining in seconds

  constructor(
    id: string,
    weaponType: WeaponType,
    startPos: Vector2D,
    velocity: Vector2D,
    damage: number,
    pierces: boolean,
    maxLifeTime: number
  ) {
    this.id = id;
    this.weaponType = weaponType;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: velocity.x, y: velocity.y };
    this.damage = damage;
    this.pierces = pierces;
    this.maxLifeTime = maxLifeTime;
    this.lifeTime = maxLifeTime;

    if (weaponType === 'FLAME_SHOT') {
      this.currentRadius = BulletProjectile.FLAME_START_RADIUS;
      this.bounds = createAABB(
        this.position.x - this.currentRadius,
        this.position.y - this.currentRadius,
        this.currentRadius * 2,
        this.currentRadius * 2
      );
    } else {
      // 6x4 or 8x4 oriented box
      const w = weaponType === 'HEAVY_MACHINE_GUN' ? 8 : 6;
      this.bounds = createAABB(this.position.x - w / 2, this.position.y - 2, w, 4);
    }
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.isAlive = false;
      return;
    }

    // Semi-implicit Euler integration
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // Update flame expansion
    if (this.weaponType === 'FLAME_SHOT') {
      const elapsed = this.maxLifeTime - this.lifeTime;
      const progress = Math.min(1.0, elapsed / this.maxLifeTime);
      this.currentRadius =
        BulletProjectile.FLAME_START_RADIUS +
        (BulletProjectile.FLAME_MAX_RADIUS - BulletProjectile.FLAME_START_RADIUS) * progress;

      this.bounds.x = this.position.x - this.currentRadius;
      this.bounds.y = this.position.y - this.currentRadius;
      this.bounds.width = this.currentRadius * 2;
      this.bounds.height = this.currentRadius * 2;

      // Update immunity timers for pierced targets (6 frames = 0.1s tick immunity)
      for (const [entityId, timer] of this.targetImmunityMap.entries()) {
        const remaining = timer - dt;
        if (remaining <= 0) {
          this.targetImmunityMap.delete(entityId);
        } else {
          this.targetImmunityMap.set(entityId, remaining);
        }
      }
    } else {
      const w = this.weaponType === 'HEAVY_MACHINE_GUN' ? 8 : 6;
      this.bounds.x = this.position.x - w / 2;
      this.bounds.y = this.position.y - 2;
    }

    // Solid obstacle collision
    const platforms = engine.getPlatforms();
    for (const plat of platforms) {
      if (plat.type === 'SOLID' && BoundingBox.intersects(this.bounds, plat.bounds)) {
        if (this.weaponType === 'FLAME_SHOT') {
          // Flame shot spawns ground fire on ground collision
          engine.eventBus.emit('spawn_ground_fire', {
            position: { x: this.position.x, y: plat.bounds.y },
          });
        }
        this.isAlive = false;
        return;
      }
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;

    const typeStr = other?.type ?? '';

    // Ignore player or other friendly projectiles
    if (typeStr === 'PLAYER' || typeStr === 'PROJECTILE' || typeStr === 'GRENADE') {
      return;
    }

    // Check if target is a hostage POW to free them
    if (typeStr === 'POW') {
      if (typeof (other as any).freeHostage === 'function') {
        (other as any).freeHostage();
      }
      if (!this.pierces) {
        this.isAlive = false;
      }
      return;
    }

    // Check if target is an enemy
    const isEnemy =
      typeStr.startsWith('SOLDIER') ||
      typeStr.includes('ENEMY') ||
      typeStr.includes('BOSS') ||
      typeStr === 'MID_BOSS_VEHICLE' ||
      typeStr === 'TETSUYUKI_BOSS';

    if (isEnemy && (other as any).isAlive) {
      if (this.weaponType === 'FLAME_SHOT') {
        // Piercing multi-hit with 6-frame (0.1s) per-target tick immunity
        const immunityRemaining = this.targetImmunityMap.get(other.id) ?? 0;
        if (immunityRemaining <= 0) {
          this.dealDamageTo(other, engine);
          // Set 6-frame (0.10s) immunity
          this.targetImmunityMap.set(other.id, 0.1);
        }
      } else {
        // Non-piercing (Pistol, HMG)
        this.dealDamageTo(other, engine);
        this.isAlive = false; // Bullet consumed
      }
    }
  }

  private dealDamageTo(entity: GameEntity, engine: GameEngine): void {
    const isFire = this.weaponType === 'FLAME_SHOT';
    const sourceType = isFire ? 'flame' : 'bullet';
    const origin = { x: this.position.x, y: this.position.y };

    if (typeof (entity as any).takeDamage === 'function') {
      (entity as any).takeDamage(this.damage, sourceType, origin);
    } else if (typeof (entity as any).applyDamage === 'function') {
      (entity as any).applyDamage(this.damage);
    }

    engine.eventBus.emit('projectile_hit', {
      projectileId: this.id,
      targetId: entity.id,
      weaponType: this.weaponType,
      damage: this.damage,
      position: { x: this.position.x, y: this.position.y },
    });
  }
}

export class ProjectileManager {
  private static readonly MAX_PISTOL_BULLETS: number = 4;
  private static readonly CASING_GRAVITY: number = 900.0; // px/s^2
  private static readonly CASING_BOUNCE: number = 0.4;
  private static readonly CASING_MAX_LIFE: number = 2.0; // seconds

  private nextBulletId: number = 1;
  private nextCasingId: number = 1;
  private nextGroundFireId: number = 1;

  private brassCasings: BrassCasing[] = [];
  private groundFires: GroundFireAOE[] = [];

  constructor() {}

  private addBulletToEngine(bullet: BulletProjectile, engine: GameEngine): void {
    engine.addEntity(bullet);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(bullet.id, bullet);
      engine.spatialGrid.insert(bullet);
    }
  }

  /**
   * Spawns a pistol bullet if under the 4 concurrent on-screen limit.
   */
  spawnPistolBullet(
    muzzlePos: Vector2D,
    aimVec: Vector2D,
    engine: GameEngine
  ): BulletProjectile | null {
    const activePistolCount = this.getActivePistolBulletCount(engine);
    if (activePistolCount >= ProjectileManager.MAX_PISTOL_BULLETS) {
      return null; // Locked: maximum 4 on-screen bullets allowed
    }

    const speed = 660.0; // px/s
    const velocity = vec2(aimVec.x * speed, aimVec.y * speed);
    const bullet = new BulletProjectile(
      `pistol_bullet_${this.nextBulletId++}`,
      'PISTOL',
      muzzlePos,
      velocity,
      1.0, // damage
      false, // piercing
      1.0 // 1.0s max lifetime
    );

    this.addBulletToEngine(bullet, engine);
    return bullet;
  }

  /**
   * Spawns a Heavy Machine Gun bullet with spray dispersion and brass casing ejection.
   */
  spawnHmgBullet(
    muzzlePos: Vector2D,
    fireDirection: Vector2D,
    facing: FacingDirection,
    engine: GameEngine
  ): BulletProjectile {
    const speed = 780.0; // px/s
    const velocity = vec2(fireDirection.x * speed, fireDirection.y * speed);
    const bullet = new BulletProjectile(
      `hmg_bullet_${this.nextBulletId++}`,
      'HEAVY_MACHINE_GUN',
      muzzlePos,
      velocity,
      1.0, // damage
      false, // piercing
      1.0 // 1.0s max lifetime
    );

    this.addBulletToEngine(bullet, engine);

    // Eject brass casing particle
    this.ejectBrassCasing(muzzlePos, facing);

    return bullet;
  }

  /**
   * Spawns a Flame Shot expanding fireball.
   */
  spawnFlameShot(
    muzzlePos: Vector2D,
    aimVec: Vector2D,
    engine: GameEngine
  ): BulletProjectile {
    const speed = 330.0; // px/s
    const velocity = vec2(aimVec.x * speed, aimVec.y * speed);
    const flame = new BulletProjectile(
      `flame_shot_${this.nextBulletId++}`,
      'FLAME_SHOT',
      muzzlePos,
      velocity,
      1.5, // 1.5 HP damage per tick
      true, // piercing
      0.55 // 0.55s lifetime (33 frames)
    );

    this.addBulletToEngine(flame, engine);
    return flame;
  }

  /**
   * Ejects a brass spent casing with realistic parabolic bounce kinematics.
   */
  private ejectBrassCasing(muzzlePos: Vector2D, facing: FacingDirection): void {
    const startX = muzzlePos.x - facing * 4;
    const startY = muzzlePos.y - 2;

    // Backward velocity: -Fx * (70 + rand(0, 30))
    const vx = -facing * (70 + Math.random() * 30);
    // Upward velocity: -(120 + rand(0, 40))
    const vy = -(120 + Math.random() * 40);

    const casing: BrassCasing = {
      id: `casing_${this.nextCasingId++}`,
      position: vec2(startX, startY),
      velocity: vec2(vx, vy),
      isGrounded: false,
      lifeFrames: 0,
      maxLifeFrames: Math.round(ProjectileManager.CASING_MAX_LIFE * 60),
      rotation: Math.random() * Math.PI * 2,
    };

    this.brassCasings.push(casing);
  }

  /**
   * Spawns a stationary Ground Fire AOE.
   */
  spawnGroundFire(position: Vector2D): GroundFireAOE {
    const aoe: GroundFireAOE = {
      id: `ground_fire_${this.nextGroundFireId++}`,
      position: { x: position.x, y: position.y },
      bounds: createAABB(position.x - 16, position.y - 16, 32, 16),
      damage: 1.0,
      tickIntervalFrames: 10,
      lifeFrames: 0,
      maxLifeFrames: 72, // 1.2s at 60Hz
      isAlive: true,
    };

    this.groundFires.push(aoe);
    return aoe;
  }

  /**
   * Updates brass casings and ground fire AOEs every tick.
   */
  update(dt: number, engine: GameEngine): void {
    const platforms = engine.getPlatforms();

    // 1. Update brass casings
    for (let i = this.brassCasings.length - 1; i >= 0; i--) {
      const casing = this.brassCasings[i];
      casing.lifeFrames++;

      if (casing.lifeFrames >= casing.maxLifeFrames) {
        this.brassCasings.splice(i, 1);
        continue;
      }

      if (!casing.isGrounded) {
        const prevY = casing.position.y;
        casing.velocity.y += ProjectileManager.CASING_GRAVITY * dt;
        casing.position.x += casing.velocity.x * dt;
        casing.position.y += casing.velocity.y * dt;
        casing.rotation += casing.velocity.x * 0.05;

        // Ground contact check
        if (platforms.length > 0 && casing.velocity.y > 0) {
          const contact = PlatformPhysics.resolveGroundContact(
            casing.position.x,
            prevY,
            casing.position.y,
            casing.velocity.y,
            2.0,
            platforms
          );

          if (contact.isGrounded) {
            casing.position.y = contact.groundY;
            casing.velocity.y = -casing.velocity.y * ProjectileManager.CASING_BOUNCE;
            casing.velocity.x *= 0.6;

            if (Math.abs(casing.velocity.y) < 20.0) {
              casing.velocity.y = 0;
              casing.velocity.x = 0;
              casing.isGrounded = true;
            }
          }
        }
      }
    }

    // 2. Update ground fire AOEs
    for (let i = this.groundFires.length - 1; i >= 0; i--) {
      const fire = this.groundFires[i];
      fire.lifeFrames++;

      if (fire.lifeFrames >= fire.maxLifeFrames) {
        fire.isAlive = false;
        this.groundFires.splice(i, 1);
        continue;
      }

      // Deal damage on interval tick (every 10 frames = 0.166s)
      if (fire.lifeFrames % fire.tickIntervalFrames === 0) {
        const candidates = engine.spatialGrid.query(fire.bounds);
        for (const candidate of candidates) {
          if (
            candidate.isAlive &&
            (candidate.type.startsWith('SOLDIER') ||
              candidate.type.includes('ENEMY') ||
              candidate.type.includes('BOSS'))
          ) {
            if (typeof (candidate as any).takeDamage === 'function') {
              (candidate as any).takeDamage(fire.damage, 'flame', { x: fire.position.x, y: fire.position.y });
            } else if (typeof (candidate as any).applyDamage === 'function') {
              (candidate as any).applyDamage(fire.damage);
            }
          }
        }
      }
    }
  }

  getActivePistolBulletCount(engine: GameEngine): number {
    let count = 0;
    const seen = new Set<string>();
    for (const entity of engine.getAllEntities()) {
      if (entity.isAlive && (entity as BulletProjectile).weaponType === 'PISTOL') {
        seen.add(entity.id);
        count++;
      }
    }
    if (Array.isArray((engine as any).entitiesToAdd)) {
      for (const entity of (engine as any).entitiesToAdd) {
        if (!seen.has(entity.id) && entity.isAlive && (entity as BulletProjectile).weaponType === 'PISTOL') {
          seen.add(entity.id);
          count++;
        }
      }
    }
    return count;
  }

  getBrassCasings(): readonly BrassCasing[] {
    return this.brassCasings;
  }

  getGroundFires(): readonly GroundFireAOE[] {
    return this.groundFires;
  }

  clear(): void {
    this.brassCasings = [];
    this.groundFires = [];
  }
}
