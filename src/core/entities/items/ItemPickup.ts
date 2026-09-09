import { Vector2D, vec2 } from '../../math/Vector2D';
import { AABB, createAABB } from '../../physics/AABB';
import { PlatformPhysics } from '../../physics/Platform';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { ItemDropType } from '../../weapons/WeaponTypes';

export class ItemPickup implements GameEntity {
  static readonly GRAVITY: number = 600.0; // px/s^2

  public id: string;
  public type: string = 'ITEM_PICKUP';
  public dropType: ItemDropType;
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public isGrounded: boolean = false;
  public bobTimer: number = 0;

  constructor(
    id: string,
    dropType: ItemDropType,
    startPos: Vector2D,
    initialVelocity: Vector2D = vec2(0, 0)
  ) {
    this.id = id;
    this.dropType = dropType;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = vec2(initialVelocity.x, initialVelocity.y);
    this.bounds = createAABB(startPos.x - 8, startPos.y - 16, 16, 16);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (!this.isGrounded) {
      const prevY = this.position.y;
      this.velocity.y += ItemPickup.GRAVITY * dt;
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

      this.bounds.x = this.position.x - 8;
      this.bounds.y = this.position.y - 16;
    } else {
      this.bobTimer += dt;
      const bobOffset = Math.sin(this.bobTimer * 4.0) * 2.0;
      this.bounds.x = this.position.x - 8;
      this.bounds.y = this.position.y - 16 + bobOffset;
    }

    this.bounds.width = 16;
    this.bounds.height = 16;
  }
}

export { ItemPickup as ItemPickupEntity };
