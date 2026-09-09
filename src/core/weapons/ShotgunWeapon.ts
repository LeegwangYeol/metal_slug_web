import { Vector2D, vec2 } from '../math/Vector2D';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { BulletProjectile, ProjectileManager } from './ProjectileManager';
import { FacingDirection } from '../player/PlayerKinematics';

export class ShotgunPelletProjectile extends BulletProjectile {
  public facing: FacingDirection;

  constructor(
    id: string,
    startPos: Vector2D,
    velocity: Vector2D,
    facing: FacingDirection,
    damage: number = 2.0,
    maxLifeTime: number = 0.18
  ) {
    super(id, 'SHOTGUN', startPos, velocity, damage, false, maxLifeTime);
    this.facing = facing;
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
      this.isAlive = false;
      return;
    }

    const isEnemy =
      typeStr.startsWith('SOLDIER') ||
      typeStr.includes('ENEMY') ||
      typeStr.includes('BOSS') ||
      typeStr === 'MID_BOSS_VEHICLE' ||
      typeStr === 'TETSUYUKI_BOSS';

    if (isEnemy && (other as any).isAlive) {
      const origin = { x: this.position.x, y: this.position.y };
      if (typeof (other as any).takeDamage === 'function') {
        (other as any).takeDamage(this.damage, 'shotgun', origin);
      } else if (typeof (other as any).applyDamage === 'function') {
        (other as any).applyDamage(this.damage);
      }

      // Kinetic knockback impulse (160 px/s horizontal, -80 px/s vertical)
      const knockbackX = this.facing * 160.0;
      const knockbackY = -80.0;

      if ((other as any).velocity) {
        (other as any).velocity.x += knockbackX;
        (other as any).velocity.y += knockbackY;
      }
      if (typeof (other as any).applyKnockback === 'function') {
        (other as any).applyKnockback(knockbackX, knockbackY);
      }

      engine.eventBus.emit('projectile_hit', {
        projectileId: this.id,
        targetId: other.id,
        weaponType: 'SHOTGUN',
        damage: this.damage,
        position: { x: this.position.x, y: this.position.y },
        knockback: { x: knockbackX, y: knockbackY },
      });

      this.isAlive = false;
    }
  }
}

export class ShotgunWeapon {
  private static nextPelletId: number = 1;
  public static readonly PELLET_COUNT: number = 7;
  public static readonly SPREAD_ARC_RAD: number = (28 * Math.PI) / 180; // +- 14 degrees
  public static readonly PELLET_SPEED: number = 680.0; // px/s
  public static readonly PELLET_DAMAGE: number = 2.0;
  public static readonly PELLET_LIFETIME: number = 0.18; // seconds
  public static readonly KNOCKBACK_IMPULSE_X: number = 160.0;

  static fire(
    muzzlePos: Vector2D,
    aimVec: Vector2D,
    facing: FacingDirection,
    engine: GameEngine,
    _projectileManager?: ProjectileManager
  ): ShotgunPelletProjectile {
    const baseAngle = Math.atan2(aimVec.y, aimVec.x);
    const halfArc = ShotgunWeapon.SPREAD_ARC_RAD / 2;
    const angleStep = ShotgunWeapon.SPREAD_ARC_RAD / (ShotgunWeapon.PELLET_COUNT - 1);

    let centerPellet: ShotgunPelletProjectile | null = null;

    for (let i = 0; i < ShotgunWeapon.PELLET_COUNT; i++) {
      const angle = baseAngle - halfArc + i * angleStep;
      const vx = Math.cos(angle) * ShotgunWeapon.PELLET_SPEED;
      const vy = Math.sin(angle) * ShotgunWeapon.PELLET_SPEED;

      const pellet = new ShotgunPelletProjectile(
        `shotgun_pellet_${ShotgunWeapon.nextPelletId++}`,
        muzzlePos,
        vec2(vx, vy),
        facing,
        ShotgunWeapon.PELLET_DAMAGE,
        ShotgunWeapon.PELLET_LIFETIME
      );

      engine.addEntity(pellet);
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(pellet.id, pellet);
        engine.spatialGrid.insert(pellet);
      }

      if (i === Math.floor(ShotgunWeapon.PELLET_COUNT / 2)) {
        centerPellet = pellet;
      }
    }

    return centerPellet!;
  }
}
