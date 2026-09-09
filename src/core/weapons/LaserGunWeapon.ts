import { Vector2D, vec2 } from '../math/Vector2D';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { BulletProjectile, ProjectileManager } from './ProjectileManager';
import { FacingDirection } from '../player/PlayerKinematics';
import { BoundingBox } from '../physics/AABB';

export class LaserBeamProjectile extends BulletProjectile {
  public facing: FacingDirection;

  constructor(
    id: string,
    startPos: Vector2D,
    velocity: Vector2D,
    facing: FacingDirection,
    damage: number = 1.2,
    maxLifeTime: number = 0.4
  ) {
    super(id, 'LASER_GUN', startPos, velocity, damage, true, maxLifeTime);
    this.facing = facing;
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

    // Laser bounds: elongated beam (16x6)
    this.bounds.x = this.position.x - 8;
    this.bounds.y = this.position.y - 3;
    this.bounds.width = 16;
    this.bounds.height = 6;

    // Update tick immunity timers
    for (const [entityId, timer] of this.targetImmunityMap.entries()) {
      const remaining = timer - dt;
      if (remaining <= 0) {
        this.targetImmunityMap.delete(entityId);
      } else {
        this.targetImmunityMap.set(entityId, remaining);
      }
    }

    // Solid obstacle collision
    const platforms = engine.getPlatforms();
    for (const plat of platforms) {
      if (plat.type === 'SOLID' && BoundingBox.intersects(this.bounds, plat.bounds)) {
        this.isAlive = false;
        return;
      }
    }
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

    if (typeStr === 'POW') {
      if (typeof (other as any).freeHostage === 'function') {
        (other as any).freeHostage();
      }
      return;
    }

    const isEnemy =
      typeStr.startsWith('SOLDIER') ||
      typeStr.includes('ENEMY') ||
      typeStr.includes('BOSS') ||
      typeStr === 'MID_BOSS_VEHICLE' ||
      typeStr === 'TETSUYUKI_BOSS';

    if (isEnemy && (other as any).isAlive) {
      const immunityRemaining = this.targetImmunityMap.get(other.id) ?? 0;
      if (immunityRemaining <= 0) {
        const origin = { x: this.position.x, y: this.position.y };
        if (typeof (other as any).takeDamage === 'function') {
          (other as any).takeDamage(this.damage, 'laser', origin);
        } else if (typeof (other as any).applyDamage === 'function') {
          (other as any).applyDamage(this.damage);
        }

        // Apply 0.1s tick immunity to prevent frame-by-frame damage spam
        this.targetImmunityMap.set(other.id, 0.1);

        engine.eventBus.emit('projectile_hit', {
          projectileId: this.id,
          targetId: other.id,
          weaponType: 'LASER_GUN',
          damage: this.damage,
          position: { x: this.position.x, y: this.position.y },
        });
      }
      // Pierces through without dying!
    }
  }
}

export class LaserGunWeapon {
  private static nextLaserId: number = 1;
  public static readonly BEAM_SPEED: number = 1200.0; // px/s
  public static readonly BEAM_DAMAGE: number = 1.2;
  public static readonly BEAM_LIFETIME: number = 0.4; // seconds
  public static readonly TICK_IMMUNITY_SECONDS: number = 0.1;

  static fire(
    muzzlePos: Vector2D,
    aimVec: Vector2D,
    facing: FacingDirection,
    engine: GameEngine,
    _projectileManager?: ProjectileManager
  ): LaserBeamProjectile {
    const vx = aimVec.x * LaserGunWeapon.BEAM_SPEED;
    const vy = aimVec.y * LaserGunWeapon.BEAM_SPEED;

    const laser = new LaserBeamProjectile(
      `laser_beam_${LaserGunWeapon.nextLaserId++}`,
      muzzlePos,
      vec2(vx, vy),
      facing,
      LaserGunWeapon.BEAM_DAMAGE,
      LaserGunWeapon.BEAM_LIFETIME
    );

    engine.addEntity(laser);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(laser.id, laser);
      engine.spatialGrid.insert(laser);
    }

    return laser;
  }
}
