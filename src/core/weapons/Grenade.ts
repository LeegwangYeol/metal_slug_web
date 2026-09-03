import { Vector2D, vec2, vec2Dist } from '../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../physics/AABB';
import { PlatformPhysics } from '../physics/Platform';
import { GameEngine, GameEntity } from '../engine/GameEngine';
import { FacingDirection, PlayerPosture } from '../player/PlayerKinematics';

export interface GrenadeBlastEvent {
  position: Vector2D;
  innerRadius: number;
  outerRadius: number;
  maxDamage: number;
}

export class Grenade implements GameEntity {
  static readonly GRAVITY: number = 780.0; // px/s^2
  static readonly RESTITUTION_Y: number = 0.5; // ey
  static readonly RESTITUTION_X: number = 0.7; // ex
  static readonly REST_VELOCITY_THRESHOLD: number = 30.0; // px/s
  static readonly FUSE_TIME_SECONDS: number = 1.25; // 75 frames at 60Hz
  static readonly BLAST_INNER_RADIUS: number = 18.0; // px
  static readonly BLAST_OUTER_RADIUS: number = 52.0; // px
  static readonly MAX_DAMAGE: number = 10.0; // HP
  static readonly MIN_DAMAGE: number = 4.0; // HP
  static readonly EXPLOSION_DURATION: number = 0.25; // 15 frames at 60Hz

  public id: string;
  public type: string = 'GRENADE';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public isExploded: boolean = false;

  private fuseTimer: number;
  private explosionTimer: number = 0;
  private hasDealtDamage: boolean = false;

  constructor(id: string, startPos: Vector2D, velocity: Vector2D) {
    this.id = id;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: velocity.x, y: velocity.y };
    this.fuseTimer = Grenade.FUSE_TIME_SECONDS;
    this.bounds = createAABB(startPos.x - 4, startPos.y - 4, 8, 8);
  }

  /**
   * Factory method to spawn a grenade based on player posture and facing direction.
   */
  static spawnForPlayer(
    id: string,
    anchorPos: Vector2D,
    facing: FacingDirection,
    posture: PlayerPosture,
    isThrowingDown: boolean = false
  ): Grenade {
    let startPos: Vector2D;
    let initialVelocity: Vector2D;

    if (posture === PlayerPosture.CROUCHING) {
      // Crouch Throw: low roll arc
      startPos = vec2(anchorPos.x + facing * 12, anchorPos.y - 12);
      initialVelocity = vec2(facing * 288.0, -90.0);
    } else if (posture === PlayerPosture.AIRBORNE && isThrowingDown) {
      // Downwards Airborne Throw
      startPos = vec2(anchorPos.x + facing * 8, anchorPos.y - 8);
      initialVelocity = vec2(facing * 120.0, 240.0);
    } else {
      // Standing Throw
      startPos = vec2(anchorPos.x + facing * 12, anchorPos.y - 28);
      initialVelocity = vec2(facing * 240.0, -312.0);
    }

    return new Grenade(id, startPos, initialVelocity);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (this.isExploded) {
      // Currently displaying explosion blast
      this.explosionTimer -= dt;
      if (this.explosionTimer <= 0) {
        this.isAlive = false;
      }
      return;
    }

    // 1. Fuse Countdown
    this.fuseTimer -= dt;
    if (this.fuseTimer <= 0) {
      this.detonate(engine);
      return;
    }

    // 2. Semi-implicit Euler integration
    const prevY = this.position.y;
    this.velocity.y += Grenade.GRAVITY * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 3. Platform Collision & Bouncing
    const platforms = engine.getPlatforms();
    if (platforms.length > 0 && this.velocity.y > 0) {
      const contact = PlatformPhysics.resolveGroundContact(
        this.position.x,
        prevY,
        this.position.y,
        this.velocity.y,
        4.0, // grenade half width
        platforms
      );

      if (contact.isGrounded) {
        this.position.y = contact.groundY;
        // Restitution bounce
        this.velocity.y = -this.velocity.y * Grenade.RESTITUTION_Y;
        this.velocity.x = this.velocity.x * Grenade.RESTITUTION_X;

        // Bring to rest if below bounce threshold
        if (Math.abs(this.velocity.y) < Grenade.REST_VELOCITY_THRESHOLD) {
          this.velocity.y = 0;
        }
      }
    }

    // 4. Update AABB bounds
    this.bounds.x = this.position.x - 4;
    this.bounds.y = this.position.y - 4;
    this.bounds.width = 8;
    this.bounds.height = 8;
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (this.isExploded || !this.isAlive) return;

    // Detonate immediately on impact with enemies or bosses
    const typeStr = other?.type ?? '';
    const isEnemy =
      typeStr.startsWith('SOLDIER') ||
      typeStr.includes('ENEMY') ||
      typeStr.includes('BOSS') ||
      typeStr === 'MID_BOSS_VEHICLE' ||
      typeStr === 'TETSUYUKI_BOSS';

    if (isEnemy && (other as any).isAlive) {
      this.detonate(engine);
    }
  }

  detonate(engine: GameEngine): void {
    if (this.isExploded) return;
    this.isExploded = true;
    this.explosionTimer = Grenade.EXPLOSION_DURATION;
    this.velocity = vec2(0, 0);

    // Expand bounds to blast outer radius for rendering / spatial query
    this.bounds = createAABB(
      this.position.x - Grenade.BLAST_OUTER_RADIUS,
      this.position.y - Grenade.BLAST_OUTER_RADIUS,
      Grenade.BLAST_OUTER_RADIUS * 2,
      Grenade.BLAST_OUTER_RADIUS * 2
    );

    // Broadcast explosion events
    engine.eventBus.emit<GrenadeBlastEvent>('grenade_exploded', {
      position: { x: this.position.x, y: this.position.y },
      innerRadius: Grenade.BLAST_INNER_RADIUS,
      outerRadius: Grenade.BLAST_OUTER_RADIUS,
      maxDamage: Grenade.MAX_DAMAGE,
    });

    engine.eventBus.emit('screen_shake', { amplitude: 5.0, durationFrames: 12 });
    engine.eventBus.emit('play_sound', { sound: 'sfx_grenade_explosion' });

    // Deal damage to all eligible entities in blast radius
    if (!this.hasDealtDamage) {
      this.applyBlastDamage(engine);
      this.hasDealtDamage = true;
    }
  }

  private applyBlastDamage(engine: GameEngine): void {
    const candidates = engine.spatialGrid.query(this.bounds);

    for (const entity of candidates) {
      if (!entity.isAlive || entity.id === this.id) continue;

      // Check distance from grenade epicenter to entity center
      const entityCenter = BoundingBox.getCenter(entity.bounds);
      const dist = vec2Dist(this.position, entityCenter);

      if (dist <= Grenade.BLAST_OUTER_RADIUS) {
        // Calculate linear falloff damage
        let damage = Grenade.MAX_DAMAGE;
        if (dist > Grenade.BLAST_INNER_RADIUS) {
          const t =
            (dist - Grenade.BLAST_INNER_RADIUS) /
            (Grenade.BLAST_OUTER_RADIUS - Grenade.BLAST_INNER_RADIUS);
          damage = Grenade.MAX_DAMAGE - (Grenade.MAX_DAMAGE - Grenade.MIN_DAMAGE) * t;
        }

        // Apply damage to entity
        if (typeof (entity as any).takeDamage === 'function') {
          (entity as any).takeDamage(damage, 'explosion', { x: this.position.x, y: this.position.y });
        } else if (typeof (entity as any).applyDamage === 'function') {
          (entity as any).applyDamage(damage);
        }

        // Hostage POW freeing from blast
        if (entity.type === 'POW' && typeof (entity as any).freeHostage === 'function') {
          (entity as any).freeHostage();
        }
      }
    }
  }
}
