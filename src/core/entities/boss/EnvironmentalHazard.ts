import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';

/**
 * Visual warning reticle placed on the ground prior to artillery shell impact.
 */
export class ArtilleryTargetReticle implements GameEntity {
  public id: string;
  public type: string = 'HAZARD_RETICLE';
  public position: Vector2D;
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB;
  public isAlive: boolean = true;
  public duration: number;
  public timer: number = 0;

  constructor(id: string, x: number, groundY: number = 230, duration: number = 1.0) {
    this.id = id;
    this.position = { x, y: groundY };
    this.bounds = createAABB(x - 16, groundY - 8, 32, 16);
    this.duration = duration;
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;
    this.timer += dt;
    if (this.timer >= this.duration) {
      this.isAlive = false;
      engine.removeEntity(this.id);
    }
  }

  render?(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const rx = this.position.x - cameraX;
    const ry = this.position.y - cameraY;
    const alpha = (Math.sin(this.timer * 16) + 1) * 0.4 + 0.2;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 40, 40, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rx, ry, 14, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(rx - 18, ry);
    ctx.lineTo(rx + 18, ry);
    ctx.moveTo(rx, ry - 18);
    ctx.lineTo(rx, ry + 18);
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * Concrete physical entity representing an incoming high-explosive artillery shell.
 * Falls vertically (or parabolic) and detonates upon contacting the ground or player.
 */
export class ArtilleryShellHazard implements GameEntity {
  public id: string;
  public type: string = 'ENVIRONMENTAL_HAZARD';
  public hazardSubtype: string = 'ARTILLERY_SHELL';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public blastRadius: number = 55;
  public damage: number = 2;
  public targetGroundY: number = 230;
  public hasDetonated: boolean = false;

  constructor(
    id: string,
    startX: number,
    startY: number = -20,
    vy: number = 380,
    targetGroundY: number = 230
  ) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.velocity = { x: 0, y: vy };
    this.targetGroundY = targetGroundY;
    this.bounds = createAABB(startX - 6, startY, 12, 18);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) {
      engine.removeEntity(this.id);
      return;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x - 6;
    this.bounds.y = this.position.y;

    if (this.position.y >= this.targetGroundY) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (!this.isAlive || this.hasDetonated) return;
    this.isAlive = false;
    this.hasDetonated = true;

    if (engine) {
      const impactPos = { x: this.position.x, y: this.targetGroundY };
      engine.eventBus.emit('explosion_spawned', {
        position: impactPos,
        radius: this.blastRadius,
        damage: this.damage,
        isLarge: true,
        friendly: false,
      });

      // Directly verify and damage player if within blast radius
      const player = engine.getEntity('player') as any;
      if (player && player.isAlive && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        const dist = Math.hypot(player.position.x - impactPos.x, player.position.y - impactPos.y);
        if (dist <= this.blastRadius && typeof player.takeDamage === 'function') {
          player.takeDamage(this.damage);
        }
      }

      engine.removeEntity(this.id);
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (other.id === 'player' || other.type === 'PLAYER') {
      const player = other as any;
      if (player.takeDamage && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        player.takeDamage(this.damage);
      }
      this.detonate(engine);
    }
  }

  render?(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const rx = this.position.x - cameraX;
    const ry = this.position.y - cameraY;

    ctx.save();
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(rx - 5, ry, 10, 16);

    // Shell nose cone
    ctx.fillStyle = '#ffee00';
    ctx.beginPath();
    ctx.moveTo(rx - 5, ry + 16);
    ctx.lineTo(rx + 5, ry + 16);
    ctx.lineTo(rx, ry + 22);
    ctx.closePath();
    ctx.fill();

    // Smoke trail
    ctx.fillStyle = 'rgba(180, 180, 180, 0.6)';
    ctx.fillRect(rx - 3, ry - 8, 6, 8);
    ctx.restore();
  }
}

/**
 * Concrete physical entity representing falling rubble/debris during arena collapse.
 */
export class FallingDebrisHazard implements GameEntity {
  public id: string;
  public type: string = 'ENVIRONMENTAL_HAZARD';
  public hazardSubtype: string = 'FALLING_DEBRIS';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public blastRadius: number = 32;
  public damage: number = 1;
  public targetGroundY: number = 230;
  public hasDetonated: boolean = false;

  constructor(
    id: string,
    startX: number,
    startY: number = -10,
    vx: number = 0,
    vy: number = 260,
    targetGroundY: number = 230
  ) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.velocity = { x: vx, y: vy };
    this.targetGroundY = targetGroundY;
    this.bounds = createAABB(startX - 7, startY, 14, 14);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) {
      engine.removeEntity(this.id);
      return;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x - 7;
    this.bounds.y = this.position.y;

    if (this.position.y >= this.targetGroundY || this.position.y > 280) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (!this.isAlive || this.hasDetonated) return;
    this.isAlive = false;
    this.hasDetonated = true;

    if (engine) {
      const impactPos = { x: this.position.x, y: Math.min(this.position.y, this.targetGroundY) };
      engine.eventBus.emit('explosion_spawned', {
        position: impactPos,
        radius: this.blastRadius,
        damage: this.damage,
        isLarge: false,
        friendly: false,
      });

      const player = engine.getEntity('player') as any;
      if (player && player.isAlive && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        const dist = Math.hypot(player.position.x - impactPos.x, player.position.y - impactPos.y);
        if (dist <= this.blastRadius && typeof player.takeDamage === 'function') {
          player.takeDamage(this.damage);
        }
      }

      engine.removeEntity(this.id);
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (other.id === 'player' || other.type === 'PLAYER') {
      const player = other as any;
      if (player.takeDamage && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        player.takeDamage(this.damage);
      }
      this.detonate(engine);
    }
  }

  render?(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const rx = this.position.x - cameraX;
    const ry = this.position.y - cameraY;

    ctx.save();
    ctx.fillStyle = '#6e6259';
    ctx.fillRect(rx - 7, ry, 14, 14);
    ctx.strokeStyle = '#3e342f';
    ctx.strokeRect(rx - 7, ry, 14, 14);
    ctx.restore();
  }
}

/**
 * Concrete physical entity representing burning napalm/flame patches on the floor.
 * Persists for a configured duration, dealing continuous damage to anyone touching the floor.
 */
export class GroundFlameHazard implements GameEntity {
  public id: string;
  public type: string = 'ENVIRONMENTAL_HAZARD';
  public hazardSubtype: string = 'GROUND_FLAME';
  public position: Vector2D;
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB;
  public isAlive: boolean = true;
  public duration: number;
  public timer: number = 0;
  public damage: number = 2;
  public tickInterval: number = 0.5;
  private tickTimer: number = 0;

  constructor(
    id: string,
    x: number,
    y: number = 216,
    width: number = 48,
    duration: number = 2.5,
    damage: number = 2
  ) {
    this.id = id;
    this.position = { x, y };
    this.duration = duration;
    this.damage = damage;
    this.bounds = createAABB(x, y, width, 20);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) {
      engine.removeEntity(this.id);
      return;
    }

    this.timer += dt;
    this.tickTimer += dt;

    if (this.timer >= this.duration) {
      this.isAlive = false;
      engine.removeEntity(this.id);
      return;
    }

    // Periodic damage tick against player overlapping bounds
    if (this.tickTimer >= this.tickInterval) {
      this.tickTimer = 0;
      const player = engine.getEntity('player') as any;
      if (player && player.isAlive && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        if (BoundingBox.intersects(this.bounds, player.bounds)) {
          if (typeof player.takeDamage === 'function') {
            player.takeDamage(this.damage);
          }
        }
      }
    }
  }

  onCollision(other: GameEntity, _engine: GameEngine): void {
    if (!this.isAlive) return;

    if (other.id === 'player' || other.type === 'PLAYER') {
      const player = other as any;
      if (player && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        if (typeof player.takeDamage === 'function') {
          player.takeDamage(this.damage);
        }
      }
    }
  }

  render?(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const rx = this.position.x - cameraX;
    const ry = this.position.y - cameraY;

    ctx.save();
    const flicker = Math.sin(this.timer * 20) * 3;
    ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
    ctx.fillRect(rx, ry - flicker, this.bounds.width, this.bounds.height + flicker);

    ctx.fillStyle = 'rgba(255, 220, 50, 0.9)';
    ctx.fillRect(rx + 4, ry + 4 - flicker, this.bounds.width - 8, this.bounds.height - 8 + flicker);
    ctx.restore();
  }
}
