import { Vector2D, vec2, vec2Dist } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { PlatformPhysics } from '../../physics/Platform';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { FacingDirection } from '../../player/PlayerKinematics';
import { AllyState, AllyConfig, DEFAULT_ALLY_CONFIG, TargetScore } from './AllyTypes';
import { AllyKiBlast } from './AllyKiBlast';

export class AllyNPC implements GameEntity {
  private static nextBlastId: number = 1;

  public id: string;
  public type: string = 'ALLY_NPC';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public isGrounded: boolean = true;
  public facing: FacingDirection = 1;

  public state: AllyState = 'SPAWN_SALUTE';
  public config: AllyConfig;
  public currentTarget: GameEntity | null = null;
  public stateTimer: number = 0;
  public attackCooldownTimer: number = 0;
  private justJumped: boolean = false;

  constructor(
    id: string,
    startPosition: Vector2D,
    config: Partial<AllyConfig> = {}
  ) {
    this.id = id;
    this.position = { x: startPosition.x, y: startPosition.y };
    this.velocity = vec2(0, 0);
    this.bounds = createAABB(startPosition.x - 12, startPosition.y - 36, 24, 36);
    this.config = { ...DEFAULT_ALLY_CONFIG, ...config };
    this.stateTimer = this.config.spawnSaluteDuration;
  }

  getState(): AllyState {
    return this.state;
  }

  setState(state: AllyState): void {
    this.state = state;
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) return;

    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - dt);
    }

    let player = engine.getEntity('player') as any;
    if (!player && Array.isArray((engine as any).entitiesToAdd)) {
      player = (engine as any).entitiesToAdd.find(
        (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
      );
    }

    switch (this.state) {
      case 'SPAWN_SALUTE': {
        this.stateTimer -= dt;
        this.velocity.x = 0;
        if (this.stateTimer <= 0) {
          this.state = 'FOLLOW';
        }
        break;
      }

      case 'FOLLOW':
      case 'IDLE': {
        // Autonomous locomotion following the player
        if (player && player.isAlive) {
          const targetX = player.position.x - player.facing * this.config.followOffset;
          const dx = targetX - this.position.x;
          const absDx = Math.abs(dx);

          if (absDx <= this.config.stopDistanceThreshold) {
            this.velocity.x = 0;
            this.facing = player.facing;
            this.state = 'IDLE';
          } else {
            this.state = 'FOLLOW';
            this.facing = dx > 0 ? 1 : -1;
            const speed =
              absDx > this.config.sprintDistanceThreshold
                ? this.config.sprintSpeed
                : this.config.walkSpeed;
            this.velocity.x = this.facing * speed;
          }

          // Platform jumping towards elevated player
          if (this.isGrounded && player.position.y < this.position.y - 22.0) {
            this.velocity.y = this.config.jumpVelocity;
            this.isGrounded = false;
            this.justJumped = true;
          }
        } else {
          this.velocity.x = 0;
          this.state = 'IDLE';
        }

        // Autonomous threat scanning without player input
        if (this.attackCooldownTimer <= 0) {
          const target = this.findBestTarget(engine);
          if (target) {
            this.currentTarget = target;
            this.state = 'CHARGE_ATTACK';
            this.stateTimer = this.config.chargeDuration;
            this.velocity.x = 0;
            this.facing = target.position.x >= this.position.x ? 1 : -1;
            engine.eventBus.emit('play_sound', { sound: 'sfx_ki_charge' });
          }
        }
        break;
      }

      case 'ACQUIRE_TARGET': {
        const target = this.findBestTarget(engine);
        if (target) {
          this.currentTarget = target;
          this.state = 'CHARGE_ATTACK';
          this.stateTimer = this.config.chargeDuration;
          this.velocity.x = 0;
          this.facing = target.position.x >= this.position.x ? 1 : -1;
        } else {
          this.state = 'FOLLOW';
        }
        break;
      }

      case 'CHARGE_ATTACK': {
        this.velocity.x = 0;
        if (this.currentTarget && this.currentTarget.isAlive) {
          this.facing = this.currentTarget.position.x >= this.position.x ? 1 : -1;
        }

        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'FIRE_ATTACK';
        }
        break;
      }

      case 'FIRE_ATTACK': {
        this.velocity.x = 0;
        this.fireKiBlast(engine);
        this.state = 'RECOVERY';
        this.stateTimer = 0.2; // recovery animation frames
        this.attackCooldownTimer = this.config.attackCooldown;
        this.currentTarget = null;
        break;
      }

      case 'RECOVERY': {
        this.velocity.x = 0;
        this.stateTimer -= dt;
        if (this.stateTimer <= 0) {
          this.state = 'FOLLOW';
        }
        break;
      }

      case 'CELEBRATE': {
        this.velocity.x = 0;
        // Salutes and cheers!
        break;
      }
    }

    // Kinematic integration and platform collision
    this.integrateKinematics(dt, engine);
  }

  private integrateKinematics(dt: number, engine: GameEngine): void {
    const platforms = engine.getPlatforms();

    if (!this.isGrounded) {
      const prevY = this.position.y;
      if (!this.justJumped) {
        this.velocity.y += this.config.gravity * dt;
      }
      this.justJumped = false;
      this.position.x += this.velocity.x * dt;
      this.position.y += this.velocity.y * dt;

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
          this.isGrounded = true;
        }
      }
    } else {
      this.position.x += this.velocity.x * dt;

      if (platforms.length > 0) {
        const contact = PlatformPhysics.resolveGroundContact(
          this.position.x,
          this.position.y - 1,
          this.position.y + 6,
          10,
          8.0,
          platforms
        );

        if (contact.isGrounded) {
          this.position.y = contact.groundY;
          this.isGrounded = true;
        } else {
          this.isGrounded = false;
        }
      }
    }

    this.bounds.x = this.position.x - 12;
    this.bounds.y = this.position.y - 36;
    this.bounds.width = 24;
    this.bounds.height = 36;
  }

  public findBestTarget(engine: GameEngine): GameEntity | null {
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

    const scoredTargets: TargetScore[] = [];

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

        if (dist <= this.config.visionRadius) {
          let priorityWeight = 10;
          if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
            priorityWeight = 50;
          } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
            priorityWeight = 100;
          }

          const score = priorityWeight * 100 - dist;
          scoredTargets.push({ target: entity, score, distance: dist });
        }
      }
    }

    if (scoredTargets.length === 0) return null;

    scoredTargets.sort((a, b) => b.score - a.score);
    return scoredTargets[0].target;
  }

  public fireKiBlast(engine: GameEngine): AllyKiBlast {
    const muzzlePos = vec2(this.position.x + this.facing * 16, this.position.y - 16);
    const blast = new AllyKiBlast(
      `ally_ki_blast_${AllyNPC.nextBlastId++}`,
      muzzlePos,
      this.facing,
      this.config.kiSpeed,
      this.config.kiDamage,
      this.config.kiLifeTime
    );

    engine.addEntity(blast);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(blast.id, blast);
      engine.spatialGrid.insert(blast);
    }

    engine.eventBus.emit('play_sound', { sound: 'sfx_ki_blast' });
    engine.eventBus.emit('play_voice', { voice: 'voice_hadouken' });

    return blast;
  }

  onCollision(_other: GameEntity, _engine: GameEngine): void {
    if (!this.isAlive) return;

    // Friendly ally is invincible to standard minion collisions
    // and ignores player / friendly projectiles
  }

  takeDamage(_amount: number = 1.0): void {
    // Resilient companion NPC (cannot be permanently killed by minions)
  }
}
