import { Vector2D, vec2 } from '../../math/Vector2D';
import { AABB, createAABB } from '../../physics/AABB';
import { PlatformPhysics } from '../../physics/Platform';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { ItemDropType, POW_LOOT_TABLE } from '../../weapons/WeaponTypes';
import { FacingDirection } from '../../player/PlayerKinematics';

export enum PowState {
  TIED_UP = 'TIED_UP',
  FREED = 'FREED',
  SALUTE = 'SALUTE',
  OFFERING_ITEM = 'OFFERING_ITEM',
  ESCAPING = 'ESCAPING',
  SAVED = 'SAVED',
}

export class ItemPickupEntity implements GameEntity {
  static readonly GRAVITY: number = 600.0; // px/s^2

  public id: string;
  public type: string = 'ITEM_PICKUP';
  public dropType: ItemDropType;
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public isGrounded: boolean = false;

  constructor(id: string, dropType: ItemDropType, startPos: Vector2D) {
    this.id = id;
    this.dropType = dropType;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = vec2(0, -120.0); // slight upward pop
    this.bounds = createAABB(startPos.x - 8, startPos.y - 16, 16, 16);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (!this.isGrounded) {
      const prevY = this.position.y;
      this.velocity.y += ItemPickupEntity.GRAVITY * dt;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

      const platforms = engine.getPlatforms();
      if (platforms.length > 0 && this.velocity.y > 0) {
        const contact = PlatformPhysics.resolveGroundContact(
          this.position.x,
          prevY,
          this.position.y,
          this.velocity.y,
          8.0,
          platforms
        );

        if (contact.isGrounded) {
          this.position.y = contact.groundY;
          this.velocity.y = 0;
          this.velocity.x = 0;
          this.isGrounded = true;
        }
      }
    }

    this.bounds.x = this.position.x - 8;
    this.bounds.y = this.position.y - 16;
  }
}

export class PowEntity implements GameEntity {
  static readonly TIED_WIDTH: number = 20;
  static readonly TIED_HEIGHT: number = 32;
  static readonly ESCAPE_SPEED: number = 100.0; // px/s
  static readonly SAVED_SCORE_BONUS: number = 10000;

  // Frame Durations at 60Hz
  static readonly FREED_FRAMES: number = 30; // 0.5s
  static readonly SALUTE_FRAMES: number = 25; // ~0.42s
  static readonly OFFERING_FRAMES: number = 35; // ~0.58s
  static readonly ESCAPE_TIMEOUT_SECONDS: number = 5.0; // backup escape timer

  public id: string;
  public type: string = 'POW';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public state: PowState = PowState.TIED_UP;
  public assignedDropType: ItemDropType;
  public facing: FacingDirection = 1;

  private stateTimer: number = 0; // seconds
  private hasSpawnedItem: boolean = false;
  private escapeTimer: number = 0;

  constructor(
    id: string,
    startPosition: Vector2D,
    scriptedDropType?: ItemDropType
  ) {
    this.id = id;
    this.position = { x: startPosition.x, y: startPosition.y };
    this.velocity = vec2(0, 0);
    this.bounds = createAABB(
      startPosition.x - PowEntity.TIED_WIDTH / 2,
      startPosition.y - PowEntity.TIED_HEIGHT,
      PowEntity.TIED_WIDTH,
      PowEntity.TIED_HEIGHT
    );
    this.assignedDropType = scriptedDropType ?? PowEntity.selectWeightedDrop();
  }

  /**
   * Samples a random item drop from the weighted loot table.
   */
  static selectWeightedDrop(): ItemDropType {
    const totalWeight = POW_LOOT_TABLE.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const entry of POW_LOOT_TABLE) {
      if (roll <= entry.weight) {
        return entry.type;
      }
      roll -= entry.weight;
    }

    return ItemDropType.SCORE_BANANA; // Fallback
  }

  /**
   * Called when player weapon bullet, knife slash, grenade blast, or player contact frees the POW.
   */
  freeHostage(): void {
    if (this.state !== PowState.TIED_UP) return;

    this.state = PowState.FREED;
    this.stateTimer = PowEntity.FREED_FRAMES * GameEngine.DEFAULT_TIMESTEP;
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    switch (this.state) {
      case PowState.TIED_UP:
        // Wait for player hit or collision
        break;

      case PowState.FREED:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          // Transition to SALUTE
          this.state = PowState.SALUTE;
          this.stateTimer = PowEntity.SALUTE_FRAMES * GameEngine.DEFAULT_TIMESTEP;
          engine.eventBus.emit('play_voice', { voice: 'voice_thank_you' });
          engine.eventBus.emit('play_sound', { sound: 'sfx_pow_freed' });
        }
        break;

      case PowState.SALUTE:
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          // Transition to OFFERING_ITEM
          this.state = PowState.OFFERING_ITEM;
          this.stateTimer = PowEntity.OFFERING_FRAMES * GameEngine.DEFAULT_TIMESTEP;
        }
        break;

      case PowState.OFFERING_ITEM:
        if (!this.hasSpawnedItem) {
          this.spawnItemDrop(engine);
          this.hasSpawnedItem = true;
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          // Transition to ESCAPING
          this.state = PowState.ESCAPING;
          this.escapeTimer = PowEntity.ESCAPE_TIMEOUT_SECONDS;
          // Determine escape direction (run away from player or towards edge)
          const player = engine.getEntity('player');
          if (player) {
            this.facing = this.position.x < player.position.x ? -1 : 1;
          }
          this.velocity.x = this.facing * PowEntity.ESCAPE_SPEED;
        }
        break;

      case PowState.ESCAPING:
        this.escapeTimer -= dt;
        this.position.x += this.velocity.x * dt;

        // Check if escaped off screen or timed out
        if (this.escapeTimer <= 0 || this.position.x < -100 || this.position.x > 3000) {
          this.markSaved(engine);
        }
        break;

      case PowState.SAVED:
        this.isAlive = false;
        break;
    }

    // Update bounds
    this.bounds.x = this.position.x - PowEntity.TIED_WIDTH / 2;
    this.bounds.y = this.position.y - PowEntity.TIED_HEIGHT;
  }

  private spawnItemDrop(engine: GameEngine): void {
    const item = new ItemPickupEntity(
      `item_drop_${this.id}`,
      this.assignedDropType,
      vec2(this.position.x + this.facing * 16, this.position.y - 12)
    );
    engine.addEntity(item);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(item.id, item);
      engine.spatialGrid.insert(item);
    }
    engine.eventBus.emit('play_sound', { sound: 'sfx_item_spawn' });
  }

  public markSaved(engine: GameEngine): void {
    if (this.state === PowState.SAVED) return;
    this.state = PowState.SAVED;
    this.isAlive = false;

    // Increment player rescued tally and award bonus
    const player = engine.getEntity('player') as any;
    if (player && typeof player.rescuedPowCount === 'number') {
      player.rescuedPowCount++;
      player.score += PowEntity.SAVED_SCORE_BONUS;
    }

    engine.eventBus.emit('pow_saved', {
      powId: this.id,
      scoreAwarded: PowEntity.SAVED_SCORE_BONUS,
    });
    engine.eventBus.emit('play_sound', { sound: 'sfx_pow_saved' });
  }

  onCollision(other: GameEntity, _engine: GameEngine): void {
    if (!this.isAlive) return;

    // Contact with player frees the POW
    if (this.state === PowState.TIED_UP && other.type === 'PLAYER') {
      this.freeHostage();
    }
  }

  // Compatibility with melee / damage interface
  takeDamage(): void {
    if (this.state === PowState.TIED_UP) {
      this.freeHostage();
    }
  }

  applyDamage(): void {
    if (this.state === PowState.TIED_UP) {
      this.freeHostage();
    }
  }
}
