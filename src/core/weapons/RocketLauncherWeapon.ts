import { Vector2D, vec2, vec2Dist } from '../math/Vector2D';
import { createAABB, BoundingBox } from '../physics/AABB';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { BulletProjectile, ProjectileManager } from './ProjectileManager';
import { FacingDirection } from '../player/PlayerKinematics';

export class PlayerRocketProjectile extends BulletProjectile {
  public static readonly INITIAL_SPEED: number = 220.0; // px/s
  public static readonly MAX_SPEED: number = 650.0; // px/s
  public static readonly ACCELERATION: number = 750.0; // px/s^2
  public static readonly STEERING_RATE: number = 3.5; // rad/s
  public static readonly BLAST_RADIUS: number = 48.0; // px
  public static readonly MAX_DAMAGE: number = 8.0;

  public facing: FacingDirection;
  private currentSpeed: number;

  constructor(
    id: string,
    startPos: Vector2D,
    direction: Vector2D,
    facing: FacingDirection,
    maxLifeTime: number = 2.5
  ) {
    const initialVelocity = vec2(
      direction.x * PlayerRocketProjectile.INITIAL_SPEED,
      direction.y * PlayerRocketProjectile.INITIAL_SPEED
    );
    super(id, 'ROCKET_LAUNCHER', startPos, initialVelocity, PlayerRocketProjectile.MAX_DAMAGE, false, maxLifeTime);
    this.facing = facing;
    this.currentSpeed = PlayerRocketProjectile.INITIAL_SPEED;
    this.bounds = createAABB(startPos.x - 7, startPos.y - 4, 14, 8);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    this.lifeTime -= dt;
    if (this.lifeTime <= 1e-4) {
      this.detonate(engine);
      return;
    }

    // Accelerate along forward trajectory
    this.currentSpeed = Math.min(
      PlayerRocketProjectile.MAX_SPEED,
      this.currentSpeed + PlayerRocketProjectile.ACCELERATION * dt
    );

    // Active homing steering
    this.steerTowardsNearestEnemy(dt, engine);

    // Integrate position
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    this.bounds.x = this.position.x - 7;
    this.bounds.y = this.position.y - 4;
    this.bounds.width = 14;
    this.bounds.height = 8;

    // Solid obstacle collision
    const platforms = engine.getPlatforms();
    for (const plat of platforms) {
      if (plat.type === 'SOLID' && BoundingBox.intersects(this.bounds, plat.bounds)) {
        this.detonate(engine);
        return;
      }
    }
  }

  private steerTowardsNearestEnemy(dt: number, engine: GameEngine): void {
    let nearestEnemy: GameEntity | null = null;
    let minDist = 450.0;

    const seen = new Set<string>();
    const allEntities: GameEntity[] = [];

    for (const entity of engine.getAllEntities()) {
      seen.add(entity.id);
      allEntities.push(entity);
    }

    const pending = (engine as any).entitiesToAdd as GameEntity[] | undefined;
    if (Array.isArray(pending)) {
      for (const entity of pending) {
        if (!seen.has(entity.id)) {
          seen.add(entity.id);
          allEntities.push(entity);
        }
      }
    }

    for (const entity of allEntities) {
      if (!entity.isAlive || entity.id === this.id) continue;

      const typeStr = entity.type ?? '';
      const isEnemy =
        typeStr.startsWith('SOLDIER') ||
        typeStr.includes('ENEMY') ||
        typeStr.includes('BOSS') ||
        typeStr === 'MID_BOSS_VEHICLE' ||
        typeStr === 'TETSUYUKI_BOSS';

      if (isEnemy) {
        const center = BoundingBox.getCenter(entity.bounds);
        const dist = vec2Dist(this.position, center);
        if (dist < minDist) {
          minDist = dist;
          nearestEnemy = entity;
        }
      }
    }

    let currentAngle = Math.atan2(this.velocity.y, this.velocity.x);

    if (nearestEnemy) {
      const targetCenter = BoundingBox.getCenter(nearestEnemy.bounds);
      const targetAngle = Math.atan2(targetCenter.y - this.position.y, targetCenter.x - this.position.x);

      let angleDiff = targetAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      const maxSteer = PlayerRocketProjectile.STEERING_RATE * dt;
      if (Math.abs(angleDiff) <= maxSteer) {
        currentAngle = targetAngle;
      } else {
        currentAngle += Math.sign(angleDiff) * maxSteer;
      }
    }

    this.velocity.x = Math.cos(currentAngle) * this.currentSpeed;
    this.velocity.y = Math.sin(currentAngle) * this.currentSpeed;
  }

  detonate(engine: GameEngine): void {
    if (!this.isAlive) return;
    this.isAlive = false;

    const blastRadius = PlayerRocketProjectile.BLAST_RADIUS;
    const blastBounds = createAABB(
      this.position.x - blastRadius,
      this.position.y - blastRadius,
      blastRadius * 2,
      blastRadius * 2
    );

    // Apply blast damage to entities in radius
    const candidates = engine.spatialGrid.query(blastBounds);
    for (const entity of candidates) {
      if (!entity.isAlive || entity.id === this.id) continue;

      const typeStr = entity.type ?? '';
      // Friendly entities safety check
      if (
        typeStr === 'PLAYER' ||
        typeStr === 'PROJECTILE' ||
        typeStr === 'GRENADE' ||
        typeStr === 'ALLY_NPC' ||
        typeStr === 'ALLY_PROJECTILE'
      ) {
        continue;
      }

      // POW rescue from blast
      if (typeStr === 'POW' && typeof (entity as any).freeHostage === 'function') {
        (entity as any).freeHostage();
        continue;
      }

      const targetPos = entity.position ?? BoundingBox.getCenter(entity.bounds);
      const dist = vec2Dist(this.position, targetPos);

      if (dist <= blastRadius) {
        // Damage falloff: 8.0 * (1 - dist / 48)
        const damage = PlayerRocketProjectile.MAX_DAMAGE * Math.max(0, 1.0 - dist / blastRadius);
        const origin = { x: this.position.x, y: this.position.y };

        if (typeof (entity as any).takeDamage === 'function') {
          (entity as any).takeDamage(damage, 'explosion', origin);
        } else if (typeof (entity as any).applyDamage === 'function') {
          (entity as any).applyDamage(damage);
        }
      }
    }

    engine.eventBus.emit('spawn_explosion', {
      position: { x: this.position.x, y: this.position.y },
      radius: blastRadius,
    });
    engine.eventBus.emit('play_sound', { sound: 'sfx_rocket_explode' });
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;

    const typeStr = other?.type ?? '';
    if (
      typeStr === 'PLAYER' ||
      typeStr === 'PROJECTILE' ||
      typeStr === 'GRENADE' ||
      typeStr === 'ALLY_NPC' ||
      typeStr === 'ALLY_PROJECTILE'
    ) {
      return;
    }

    this.detonate(engine);
  }
}

export class RocketLauncherWeapon {
  private static nextRocketId: number = 1;

  static fire(
    muzzlePos: Vector2D,
    aimVec: Vector2D,
    facing: FacingDirection,
    engine: GameEngine,
    _projectileManager?: ProjectileManager
  ): PlayerRocketProjectile {
    const rocket = new PlayerRocketProjectile(
      `rocket_${RocketLauncherWeapon.nextRocketId++}`,
      muzzlePos,
      aimVec,
      facing
    );

    engine.addEntity(rocket);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(rocket.id, rocket);
      engine.spatialGrid.insert(rocket);
    }

    return rocket;
  }
}
