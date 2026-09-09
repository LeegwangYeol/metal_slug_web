import { Vector2D, vec2 } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { FacingDirection } from '../../player/PlayerKinematics';

export class AllyKiBlast implements GameEntity {
  public id: string;
  public type: string = 'ALLY_PROJECTILE';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public damage: number;
  public lifeTime: number;
  public maxLifeTime: number;
  public facing: FacingDirection;

  constructor(
    id: string,
    startPos: Vector2D,
    facing: FacingDirection,
    speed: number = 520.0,
    damage: number = 3.5,
    maxLifeTime: number = 1.2
  ) {
    this.id = id;
    this.facing = facing;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = vec2(facing * speed, 0);
    this.damage = damage;
    this.maxLifeTime = maxLifeTime;
    this.lifeTime = maxLifeTime;
    this.bounds = createAABB(startPos.x - 8, startPos.y - 8, 16, 16);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    this.lifeTime -= dt;
    if (this.lifeTime <= 0) {
      this.isAlive = false;
      return;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    this.bounds.x = this.position.x - 8;
    this.bounds.y = this.position.y - 8;
    this.bounds.width = 16;
    this.bounds.height = 16;

    // Solid obstacle collision check
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

    // Ignore player, friendly allies, and friendly projectiles
    if (
      typeStr === 'PLAYER' ||
      typeStr === 'ALLY_NPC' ||
      typeStr === 'ALLY_PROJECTILE' ||
      typeStr === 'PROJECTILE' ||
      typeStr === 'GRENADE' ||
      typeStr === 'ITEM_PICKUP'
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
        (other as any).takeDamage(this.damage, 'energy', origin);
      } else if (typeof (other as any).applyDamage === 'function') {
        (other as any).applyDamage(this.damage);
      }

      engine.eventBus.emit('projectile_hit', {
        projectileId: this.id,
        targetId: other.id,
        weaponType: 'KI_BLAST',
        damage: this.damage,
        position: { x: this.position.x, y: this.position.y },
      });

      this.isAlive = false;
    }
  }
}
