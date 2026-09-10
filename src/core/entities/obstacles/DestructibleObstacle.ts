import { Vector2D, vec2 } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { ItemDropType } from '../../weapons/WeaponTypes';
import { ItemPickup } from '../items/ItemPickup';

export type ObstacleType = 'SANDBAG_BARRICADE' | 'SUPPLY_CRATE' | 'EXPLOSIVE_BARREL';

export interface ObstacleConfig {
  health?: number;
  dropItem?: ItemDropType;
  blastRadius?: number;
  blastDamage?: number;
}

export class DestructibleObstacle implements GameEntity {
  public id: string;
  public type: string;
  public obstacleType: ObstacleType;
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds: AABB;
  public health: number;
  public maxHealth: number;
  public isAlive: boolean = true;
  public isSolid: boolean = true;
  public dropItem?: ItemDropType;
  public blastRadius: number;
  public blastDamage: number;
  public isExploded: boolean = false;
  private engineRef: GameEngine | null = null;

  constructor(
    id: string,
    obstacleType: ObstacleType,
    position: Vector2D,
    width: number,
    height: number,
    config: ObstacleConfig = {}
  ) {
    this.id = id;
    this.obstacleType = obstacleType;
    this.type = `OBSTACLE_${obstacleType}`;
    this.position = { x: position.x, y: position.y };
    this.bounds = createAABB(position.x, position.y, width, height);

    switch (obstacleType) {
      case 'SANDBAG_BARRICADE':
        this.maxHealth = config.health ?? 20;
        this.blastRadius = 0;
        this.blastDamage = 0;
        break;
      case 'SUPPLY_CRATE':
        this.maxHealth = config.health ?? 8;
        this.dropItem = config.dropItem ?? ItemDropType.WEAPON_HMG;
        this.blastRadius = 0;
        this.blastDamage = 0;
        break;
      case 'EXPLOSIVE_BARREL':
        this.maxHealth = config.health ?? 10;
        this.blastRadius = config.blastRadius ?? 54;
        this.blastDamage = config.blastDamage ?? 10;
        break;
      default:
        this.maxHealth = config.health ?? 15;
        this.blastRadius = 0;
        this.blastDamage = 0;
    }
    this.health = this.maxHealth;
  }

  /**
   * Universal damage receiver compatible with bullets, explosions, flame, and direct calls.
   */
  public takeDamage(amount: number, ...args: any[]): void {
    if (!this.isAlive) return;

    this.health -= amount;

    const engine = (args[0] && (args[0].eventBus || typeof args[0].emit === 'function') ? args[0] : null) ??
      (args[1] && (args[1].eventBus || typeof args[1].emit === 'function') ? args[1] : null) ??
      (args[2] && (args[2].eventBus || typeof args[2].emit === 'function') ? args[2] : null) ??
      this.engineRef;

    if (engine) {
      this.engineRef = engine;
    }

    if (engine && engine.eventBus) {
      engine.eventBus.emit('play_sound', { sound: 'sfx_bullet_hit' });
    }

    if (this.health <= 0) {
      this.health = 0;
      this.destroy(engine);
    }
  }

  public applyDamage(amount: number): void {
    this.takeDamage(amount);
  }

  /**
   * Destroys the obstacle, triggering type-specific destruction behaviors:
   * - EXPLOSIVE_BARREL: 54px fiery blast dealing 10 damage to surrounding enemies
   * - SUPPLY_CRATE: drops weapon/food item pickup
   * - SANDBAG_BARRICADE: bursts into sand/dust
   */
  public destroy(engine?: GameEngine | null): void {
    if (!this.isAlive) return;
    this.isAlive = false;

    const eng = engine ?? this.engineRef;

    if (this.obstacleType === 'EXPLOSIVE_BARREL' && !this.isExploded) {
      this.isExploded = true;
      const centerX = this.bounds.x + this.bounds.width / 2;
      const centerY = this.bounds.y + this.bounds.height / 2;

      if (eng) {
        // Broadcast explosion event
        eng.eventBus.emit('explosion_spawned', {
          position: { x: centerX, y: centerY },
          radius: this.blastRadius,
          damage: this.blastDamage,
          isLarge: true,
        });
        eng.eventBus.emit('screen_shake', { amplitude: 6.0, durationFrames: 14 });
        eng.eventBus.emit('play_sound', { sound: 'sfx_grenade_explosion' });

        // Deal blast damage to all surrounding enemies within 54px radius
        this.dealAreaDamage(eng, centerX, centerY);
      }
    } else if (this.obstacleType === 'SUPPLY_CRATE') {
      if (eng && this.dropItem) {
        const pickup = new ItemPickup(
          `drop_${this.id}`,
          this.dropItem,
          { x: this.bounds.x + this.bounds.width / 2, y: this.bounds.y },
          { x: 0, y: -120 }
        );
        eng.addEntity(pickup);
        eng.eventBus.emit('play_sound', { sound: 'sfx_knife_slash' });
      }
    } else if (this.obstacleType === 'SANDBAG_BARRICADE') {
      if (eng) {
        eng.eventBus.emit('play_sound', { sound: 'sfx_bullet_hit' });
      }
    }

    if (eng) {
      eng.removeEntity(this.id);
    }
  }

  private dealAreaDamage(engine: GameEngine, centerX?: number, centerY?: number): void {
    const cX = centerX ?? (this.bounds.x + this.bounds.width / 2);
    const cY = centerY ?? (this.bounds.y + this.bounds.height / 2);

    if (typeof (engine as any).getEntities !== 'function' && typeof engine.getAllEntities === 'function') {
      (engine as any).getEntities = () => engine.getAllEntities();
    }
    const entities: GameEntity[] = typeof (engine as any).getEntities === 'function'
      ? (engine as any).getEntities()
      : engine.getAllEntities();

    const damageTarget = (other: GameEntity): void => {
      if (other === this || !other.isAlive) return;

      const otherCenterX = other.bounds.x + other.bounds.width / 2;
      const otherCenterY = other.bounds.y + other.bounds.height / 2;
      const dist = Math.hypot(otherCenterX - cX, otherCenterY - cY);

      if (dist <= this.blastRadius) {
        if (other instanceof DestructibleObstacle) {
          other.takeDamage(this.blastDamage, engine, 'explosion', { x: cX, y: cY });
        } else if (typeof (other as any).takeDamage === 'function') {
          (other as any).takeDamage(this.blastDamage, 'explosion', { x: cX, y: cY }, engine);
        } else if (typeof (other as any).applyDamage === 'function') {
          (other as any).applyDamage(this.blastDamage);
        }
      }
    };

    for (const other of entities) {
      damageTarget(other);
    }
  }

  /**
   * Collision hook called by GameEngine's spatial collision arbitration.
   */
  public onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;
    this.engineRef = engine;

    if (other.type === 'PROJECTILE') {
      const bullet = other as any;
      this.takeDamage(bullet.damage ?? 1, engine);
      if (!bullet.pierces) {
        bullet.isAlive = false;
      }
    } else if (other.type === 'GRENADE') {
      const grenade = other as any;
      if (typeof grenade.detonate === 'function') {
        grenade.detonate(engine);
      }
      this.takeDamage(10, engine);
    }
  }

  public update(_dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;
    this.engineRef = engine;

    // Check intersecting projectiles and grenades directly
    const candidates = engine.spatialGrid ? engine.spatialGrid.query(this.bounds) : [];
    for (const ent of candidates) {
      if (!ent.isAlive || ent.id === this.id) continue;

      if (BoundingBox.intersects(this.bounds, ent.bounds)) {
        if (ent.type === 'PROJECTILE') {
          const bullet = ent as any;
          this.takeDamage(bullet.damage ?? 1, engine);
          if (!bullet.pierces) {
            bullet.isAlive = false;
          }
        } else if (ent.type === 'GRENADE') {
          const grenade = ent as any;
          if (typeof grenade.detonate === 'function') {
            grenade.detonate(engine);
          }
          this.takeDamage(10, engine);
        }
      }
    }
  }
}
