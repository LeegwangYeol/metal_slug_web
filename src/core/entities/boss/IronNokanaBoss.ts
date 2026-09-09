import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { BossEntity, IronNokanaPhase } from './BossTypes';
import { GroundFlameHazard } from './EnvironmentalHazard';
import { TargetPlayer } from '../enemies/EnemyTypes';

export interface IronNokanaConfig {
  customHp?: number;
  initialPhase?: IronNokanaPhase;
  patrolMinX?: number;
  patrolMaxX?: number;
}

/**
 * High-explosive parabolic artillery shell fired by Iron Nokana's dorsal cannon.
 */
export class IronNokanaCannonShell implements GameEntity {
  public id: string;
  public type: string = 'ENEMY_BULLET';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public blastRadius: number = 44;
  public damage: number = 2;
  public gravity: number = 520;
  public targetGroundY: number = 230;

  constructor(
    id: string,
    startX: number,
    startY: number,
    vx: number = -220,
    vy: number = -280,
    targetGroundY: number = 230
  ) {
    this.id = id;
    this.position = { x: startX, y: startY };
    this.velocity = { x: vx, y: vy };
    this.targetGroundY = targetGroundY;
    this.bounds = createAABB(startX - 5, startY - 5, 10, 10);
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) {
      engine.removeEntity(this.id);
      return;
    }

    this.velocity.y += this.gravity * dt;
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    this.bounds.x = this.position.x - 5;
    this.bounds.y = this.position.y - 5;

    if (this.position.y >= this.targetGroundY || this.position.x < 1700 || this.position.y > 320) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (!this.isAlive) return;
    this.isAlive = false;

    if (engine) {
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x, y: this.position.y },
        radius: this.blastRadius,
        damage: this.damage,
        isLarge: false,
        friendly: false,
      });

      const player = engine.getEntity('player') as any;
      if (player && player.isAlive && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        const dist = Math.hypot(player.position.x - this.position.x, player.position.y - this.position.y);
        if (dist <= this.blastRadius && typeof player.takeDamage === 'function') {
          player.takeDamage(this.damage);
        }
      }

      engine.removeEntity(this.id);
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (other.id === 'player' || other.type === 'PLAYER') {
      const player = other as any;
      if (player.takeDamage && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        player.takeDamage(this.damage);
      }
      this.detonate(engine);
    }
  }
}

/**
 * Destructible rocket projectile launched from Iron Nokana's rear rocket pods.
 */
export class IronNokanaRocket implements GameEntity {
  public id: string;
  public type: string = 'HOMING_MISSILE';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public health: number = 1;
  public speed: number = 190;
  public blastRadius: number = 36;
  public damage: number = 2;
  private lifetime: number = 4.0;
  private targetPlayer: TargetPlayer | null = null;

  constructor(id: string, startPos: Vector2D, target: TargetPlayer | null = null) {
    this.id = id;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: -this.speed, y: 0 };
    this.bounds = createAABB(startPos.x, startPos.y, 12, 6);
    this.targetPlayer = target;
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
    }
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive) {
      engine.removeEntity(this.id);
      return;
    }

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
      this.detonate(engine);
      return;
    }

    if (this.targetPlayer && this.targetPlayer.isAlive !== false) {
      const dy = this.targetPlayer.position.y - this.position.y;
      this.velocity.y += Math.sign(dy) * 220 * dt;
      this.velocity.y = Math.max(-120, Math.min(120, this.velocity.y));
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;

    if (this.position.y >= 230) {
      this.detonate(engine);
    }
  }

  detonate(engine?: GameEngine): void {
    if (!this.isAlive) return;
    this.isAlive = false;
    if (engine) {
      engine.eventBus.emit('explosion_spawned', {
        position: { ...this.position },
        radius: this.blastRadius,
        damage: this.damage,
        isLarge: false,
        friendly: false,
      });
      engine.removeEntity(this.id);
    }
  }

  onCollision(other: GameEntity, engine: GameEngine): void {
    if (other.id === 'player' || other.type === 'PLAYER') {
      const player = other as any;
      if (player.takeDamage && (!player.invulnerabilityTimer || player.invulnerabilityTimer <= 0)) {
        player.takeDamage(this.damage);
      }
      this.detonate(engine);
    }
  }
}

/**
 * Iron Nokana - Legendary Heavy Armored Siege Crawler Dreadnought.
 * Multi-phase ground fortress featuring hydraulic flame sweeps, high-angle mortars,
 * rear rocket pods, deployable auxiliary Girida-O turret, and enraged overdrive state.
 */
export class IronNokanaBoss implements BossEntity, GameEntity {
  public readonly id: string;
  public readonly type: string = 'BOSS_IRON_NOKANA';
  public position: Vector2D;
  public velocity: Vector2D = { x: 0, y: 0 };
  public health: number;
  public maxHealth: number = 400;
  public phase: IronNokanaPhase = 'PHASE_1_CRAWLER_BARRAGE';
  public isAlive: boolean = true;
  public isMeleeVulnerable: boolean = false;
  public turretsAlive: number = 3;
  public weakPointExposed: boolean = false;
  public weakPointBox: AABB;

  // Boss dimensions: heavy ground fortress
  public readonly width: number = 220;
  public readonly height: number = 140;
  public bounds: AABB;

  get boundingBox(): AABB {
    return this.bounds;
  }

  // Rage Overdrive State
  public isRaging: boolean = false;
  public rageSpeedMultiplier: number = 1.0;

  // Patrol Bounds
  public patrolMinX: number = 2000;
  public patrolMaxX: number = 2080;
  private patrolDirection: number = -1;

  // Attack Cooldowns & State
  public cannonCooldownTimer: number = 3.0;
  public baseCannonCooldown: number = 3.0;
  public isCannonTelegraphing: boolean = false;
  public cannonTelegraphTimer: number = 0;

  public rocketCooldownTimer: number = 4.2;
  public baseRocketCooldown: number = 4.2;

  // Flame Attack State (Phase 2 & 4)
  public flameCooldownTimer: number = 5.0;
  public baseFlameCooldown: number = 5.0;
  public isFlameTelegraphing: boolean = false;
  public flameTelegraphTimer: number = 0;
  public isFlameActive: boolean = false;
  public flameActiveDuration: number = 2.0;

  // Girida-O Auxiliary State (Phase 3 & 4)
  public giridaDeployed: boolean = false;
  public giridaCooldownTimer: number = 2.5;
  public baseGiridaCooldown: number = 2.5;

  // Tread Ramming Surge State
  public isSurging: boolean = false;
  public surgeTimer: number = 0;

  // Death Demolition State
  public deathTimer: number = 0;
  public deathStage: number = 0;

  // Target Player Reference
  private targetPlayer: TargetPlayer | null = null;

  constructor(
    id: string,
    initialPosition: Vector2D = { x: 2050, y: 90 },
    config: IronNokanaConfig = {}
  ) {
    this.id = id;
    this.position = { x: initialPosition.x, y: initialPosition.y };
    this.maxHealth = config.customHp ?? 400;
    this.health = this.maxHealth;
    this.phase = config.initialPhase ?? 'PHASE_1_CRAWLER_BARRAGE';

    if (config.patrolMinX !== undefined) this.patrolMinX = config.patrolMinX;
    if (config.patrolMaxX !== undefined) this.patrolMaxX = config.patrolMaxX;

    this.bounds = createAABB(this.position.x, this.position.y, this.width, this.height);

    // Weak point: exposed engine exhaust manifold behind forward armor
    this.weakPointBox = createAABB(this.position.x + 30, this.position.y + 50, 40, 36);
  }

  setTargetPlayer(target: TargetPlayer | null): void {
    this.targetPlayer = target;
  }

  public enterRageState(): void {
    this.isRaging = true;
    this.rageSpeedMultiplier = 1.5;
    if (this.phase !== 'PHASE_4_OVERDRIVE_RAGE' && this.phase !== 'DEATH_EXPLODING' && this.phase !== 'DESTROYED') {
      this.phase = 'PHASE_4_OVERDRIVE_RAGE';
    }
    this.weakPointExposed = true;
  }

  update(dt: number, engine: GameEngine): void {
    if (!this.isAlive || this.phase === 'DESTROYED') return;

    if (this.phase === 'DEATH_EXPLODING') {
      this.updateDeathExplosion(dt, engine);
      return;
    }

    // Kinematics and patrol
    this.updateMovement(dt);

    // Sync hitboxes
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;
    this.weakPointBox.x = this.position.x + 30;
    this.weakPointBox.y = this.position.y + 50;

    // Cooldown multiplier based on rage state
    const speedMult = this.isRaging ? this.rageSpeedMultiplier : 1.0;

    // Phase 1: High-angle cannon and rocket salvos
    if (this.phase === 'PHASE_1_CRAWLER_BARRAGE') {
      this.updateCannonAttack(dt * speedMult, engine);
      this.updateRocketAttack(dt * speedMult, engine);
    }
    // Phase 2: Hydraulic flame sweep + high-angle cannon
    else if (this.phase === 'PHASE_2_FLAME_SWEEP') {
      this.updateFlameSweep(dt * speedMult, engine);
      this.updateCannonAttack(dt * speedMult, engine);
    }
    // Phase 3: Girida-O auxiliary mini-turret + dual barrage + tread surges
    else if (this.phase === 'PHASE_3_GIRIDA_DEPLOY') {
      this.updateGiridaAuxiliary(dt * speedMult, engine);
      this.updateCannonAttack(dt * speedMult, engine);
      this.updateTreadSurge(dt * speedMult);
    }
    // Phase 4: Overdrive Rage - all systems firing simultaneously with halved cooldowns
    else if (this.phase === 'PHASE_4_OVERDRIVE_RAGE') {
      this.updateCannonAttack(dt * speedMult * 1.5, engine);
      this.updateRocketAttack(dt * speedMult * 1.5, engine);
      this.updateFlameSweep(dt * speedMult * 1.3, engine);
      this.updateGiridaAuxiliary(dt * speedMult * 1.5, engine);
    }
  }

  private updateMovement(dt: number): void {
    if (this.isSurging) return;

    const speed = 25 * (this.isRaging ? 1.3 : 1.0);
    this.position.x += this.patrolDirection * speed * dt;

    if (this.position.x <= this.patrolMinX) {
      this.position.x = this.patrolMinX;
      this.patrolDirection = 1;
    } else if (this.position.x >= this.patrolMaxX) {
      this.position.x = this.patrolMaxX;
      this.patrolDirection = -1;
    }
  }

  private updateTreadSurge(dt: number): void {
    this.surgeTimer += dt;
    if (this.surgeTimer > 8.0) {
      this.surgeTimer = 0;
      this.isSurging = true;
      this.velocity.x = -80; // Sudden forward surge
      setTimeout(() => {
        this.velocity.x = 0;
        this.isSurging = false;
      }, 1000);
    }
  }

  private updateCannonAttack(dt: number, engine: GameEngine): void {
    if (this.isCannonTelegraphing) {
      this.cannonTelegraphTimer += dt;
      if (this.cannonTelegraphTimer >= 0.5) {
        this.isCannonTelegraphing = false;
        this.cannonTelegraphTimer = 0;
        this.fireCannon(engine);
      }
      return;
    }

    this.cannonCooldownTimer -= dt;
    if (this.cannonCooldownTimer <= 0) {
      this.cannonCooldownTimer = this.baseCannonCooldown;
      this.isCannonTelegraphing = true;
      this.cannonTelegraphTimer = 0;
      engine.eventBus.emit('boss_cannon_telegraph', { bossId: this.id });
    }
  }

  private fireCannon(engine: GameEngine): void {
    const muzzleX = this.position.x + 30;
    const muzzleY = this.position.y + 20;

    let targetX = 1880;
    if (this.targetPlayer) {
      targetX = this.targetPlayer.position.x;
    }
    const dist = Math.abs(targetX - muzzleX);
    const vx = -Math.max(140, Math.min(280, dist * 0.9));

    const shell = new IronNokanaCannonShell(
      `nokana_shell_${Date.now()}_${Math.random()}`,
      muzzleX,
      muzzleY,
      vx,
      -290,
      230
    );
    engine.addEntity(shell);
    engine.eventBus.emit('boss_cannon_fired', { bossId: this.id, shellId: shell.id });
  }

  private updateRocketAttack(dt: number, engine: GameEngine): void {
    this.rocketCooldownTimer -= dt;
    if (this.rocketCooldownTimer <= 0) {
      this.rocketCooldownTimer = this.baseRocketCooldown;
      this.fireRocketSalvo(engine);
    }
  }

  private fireRocketSalvo(engine: GameEngine): void {
    const podX = this.position.x + 180;
    const podY = this.position.y + 15;

    for (let i = 0; i < 3; i++) {
      const rocket = new IronNokanaRocket(
        `nokana_rocket_${Date.now()}_${i}`,
        { x: podX, y: podY - i * 8 },
        this.targetPlayer
      );
      engine.addEntity(rocket);
    }
    engine.eventBus.emit('boss_rocket_salvo', { bossId: this.id });
  }

  private updateFlameSweep(dt: number, engine: GameEngine): void {
    // If telegraphing flame attack
    if (this.isFlameTelegraphing) {
      this.flameTelegraphTimer += dt;
      if (this.flameTelegraphTimer >= 0.8) {
        this.isFlameTelegraphing = false;
        this.flameTelegraphTimer = 0;
        this.activateFlame(engine);
      }
      return;
    }

    if (this.isFlameActive) {
      this.flameActiveDuration -= dt;
      if (this.flameActiveDuration <= 0) {
        this.isFlameActive = false;
        this.flameActiveDuration = 2.0;
        this.weakPointExposed = this.isRaging; // Return to closed unless raging
      }
      return;
    }

    this.flameCooldownTimer -= dt;
    if (this.flameCooldownTimer <= 0) {
      this.flameCooldownTimer = this.baseFlameCooldown;
      this.isFlameTelegraphing = true;
      this.flameTelegraphTimer = 0;
      engine.eventBus.emit('boss_flame_telegraph', { bossId: this.id });
    }
  }

  private activateFlame(engine: GameEngine): void {
    this.isFlameActive = true;
    this.weakPointExposed = true; // Overheating vent opens

    // Spawn flame hazard at nozzle base
    const flameNozzleX = this.position.x - 10;
    const flame = new GroundFlameHazard(
      `flame_hazard_${Date.now()}`,
      flameNozzleX - 90,
      216,
      100,
      2.0,
      2
    );
    engine.addEntity(flame);
    engine.eventBus.emit('boss_flame_active', { bossId: this.id, flameId: flame.id });
  }

  private updateGiridaAuxiliary(dt: number, engine: GameEngine): void {
    this.giridaDeployed = true;
    this.giridaCooldownTimer -= dt;
    if (this.giridaCooldownTimer <= 0) {
      this.giridaCooldownTimer = this.baseGiridaCooldown;
      this.fireGiridaCannon(engine);
    }
  }

  private fireGiridaCannon(engine: GameEngine): void {
    const giridaX = this.position.x + 150;
    const giridaY = this.position.y - 10;

    const shell = new IronNokanaCannonShell(
      `girida_shell_${Date.now()}`,
      giridaX,
      giridaY,
      -250,
      -140,
      230
    );
    shell.damage = 1;
    engine.addEntity(shell);
    engine.eventBus.emit('boss_girida_fired', { bossId: this.id });
  }

  private updateDeathExplosion(dt: number, engine: GameEngine): void {
    this.deathTimer += dt;

    if (this.deathTimer >= 0.0 && this.deathStage === 0) {
      this.deathStage = 1;
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x + 40, y: this.position.y + 110 },
        radius: 35,
        damage: 0,
        isLarge: false,
        friendly: true,
      });
    }

    if (this.deathTimer >= 1.0 && this.deathStage === 1) {
      this.deathStage = 2;
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x + 160, y: this.position.y + 80 },
        radius: 45,
        damage: 0,
        isLarge: true,
        friendly: true,
      });
    }

    if (this.deathTimer >= 2.2 && this.deathStage === 2) {
      this.deathStage = 3;
      engine.eventBus.emit('explosion_spawned', {
        position: { x: this.position.x + 100, y: this.position.y + 40 },
        radius: 65,
        damage: 0,
        isLarge: true,
        friendly: true,
      });
    }

    if (this.deathTimer >= 3.6 && this.deathStage === 3) {
      this.deathStage = 4;
      this.phase = 'DESTROYED';
      this.isAlive = false;
      engine.eventBus.emit('boss_destroyed', { bossId: this.id });
      engine.eventBus.emit('mission_complete', { stage: 1 });
      engine.removeEntity(this.id);
    }
  }

  takeDamage(amount: number, isWeakPoint: boolean = false): void {
    if (!this.isAlive || this.phase === 'DEATH_EXPLODING' || this.phase === 'DESTROYED') {
      return;
    }

    let effectiveDamage = amount;
    if (isWeakPoint && this.weakPointExposed) {
      effectiveDamage = amount * 1.5;
    }

    // Fatal Overkill / Test Demolition Bypass
    if (effectiveDamage >= this.maxHealth) {
      this.health = 0;
      this.transitionToDeath();
      return;
    }

    const p1Threshold = Math.round(this.maxHealth * 0.75); // 300 HP
    const p2Threshold = Math.round(this.maxHealth * 0.50); // 200 HP
    const p3Threshold = Math.round(this.maxHealth * 0.25); // 100 HP

    if (this.phase === 'PHASE_1_CRAWLER_BARRAGE') {
      this.health = Math.max(p1Threshold, this.health - effectiveDamage);
      if (this.health <= p1Threshold) {
        this.transitionToPhase2();
      }
      return;
    }

    if (this.phase === 'PHASE_2_FLAME_SWEEP') {
      this.health = Math.max(p2Threshold, this.health - effectiveDamage);
      if (this.health <= p2Threshold) {
        this.transitionToPhase3();
      }
      return;
    }

    if (this.phase === 'PHASE_3_GIRIDA_DEPLOY') {
      this.health = Math.max(p3Threshold, this.health - effectiveDamage);
      if (this.health <= p3Threshold) {
        this.transitionToPhase4();
      }
      return;
    }

    if (this.phase === 'PHASE_4_OVERDRIVE_RAGE') {
      this.health = Math.max(0, this.health - effectiveDamage);
      if (this.health <= 0) {
        this.transitionToDeath();
      }
      return;
    }
  }

  private transitionToPhase2(): void {
    this.phase = 'PHASE_2_FLAME_SWEEP';
    this.isFlameTelegraphing = false;
    this.flameTelegraphTimer = 0;
    this.flameCooldownTimer = this.baseFlameCooldown;
  }

  private transitionToPhase3(): void {
    this.phase = 'PHASE_3_GIRIDA_DEPLOY';
    this.giridaDeployed = true;
    this.turretsAlive = 3;
  }

  private transitionToPhase4(): void {
    this.phase = 'PHASE_4_OVERDRIVE_RAGE';
    this.enterRageState();
  }

  private transitionToDeath(): void {
    this.phase = 'DEATH_EXPLODING';
    this.deathTimer = 0;
    this.deathStage = 0;
  }

  render?(ctx: CanvasRenderingContext2D, cameraX: number = 0, cameraY: number = 0): void {
    const rx = this.position.x - cameraX;
    const ry = this.position.y - cameraY;

    ctx.save();

    // Rage aura
    if (this.isRaging && this.phase !== 'DESTROYED') {
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(255, 60, 0, 0.6)';
      ctx.strokeRect(rx - 4, ry - 4, this.width + 8, this.height + 8);
    }

    // Heavy tread assembly
    ctx.fillStyle = '#2b2a2a';
    ctx.fillRect(rx, ry + this.height - 35, this.width, 35);
    ctx.fillStyle = '#42413e';
    for (let x = rx + 10; x < rx + this.width - 10; x += 22) {
      ctx.beginPath();
      ctx.arc(x, ry + this.height - 18, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main armored crawler chassis
    ctx.fillStyle = this.isRaging ? '#6e382b' : '#576249';
    ctx.fillRect(rx + 15, ry + 30, this.width - 25, this.height - 60);

    // Front ram / plow
    ctx.fillStyle = '#3a3a38';
    ctx.beginPath();
    ctx.moveTo(rx + 15, ry + 40);
    ctx.lineTo(rx - 8, ry + this.height - 10);
    ctx.lineTo(rx + 25, ry + this.height - 10);
    ctx.closePath();
    ctx.fill();

    // Dorsal Heavy Mortar Cannon
    ctx.fillStyle = '#222521';
    ctx.fillRect(rx + 25, ry + 12, 50, 22);

    // Rear Girida-O auxiliary turret (if in phase 3 or 4)
    if (this.giridaDeployed) {
      ctx.fillStyle = '#7a6642';
      ctx.fillRect(rx + 140, ry - 5, 45, 35);
      // Girida barrel
      ctx.fillStyle = '#222';
      ctx.fillRect(rx + 115, ry + 5, 30, 8);
    }

    // Underbelly Flame Emitter
    ctx.fillStyle = this.isFlameActive ? '#ff5500' : '#444';
    ctx.fillRect(rx + 5, ry + this.height - 40, 24, 14);

    // Weak point exhaust manifold
    if (this.weakPointExposed) {
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(rx + 30, ry + 50, 40, 36);
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx + 30, ry + 50, 40, 36);
    }

    ctx.restore();
  }
}
