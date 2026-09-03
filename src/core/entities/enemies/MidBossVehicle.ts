import { Vector2D } from '../../math/Vector2D';
import { AABB, createAABB, BoundingBox } from '../../physics/AABB';
import { GameEngine, GameEntity } from '../../engine/GameEngine';
import { EnemyEntity, EnemyType, DamageSourceType, TargetPlayer } from './EnemyTypes';
import { SoldierEnemy } from './SoldierEnemy';

/**
 * CannonShell - Heavy high-caliber shell fired by the Mid-Boss armored vehicle.
 * Detonates with an explosive blast radius upon hitting ground or target.
 */
export class CannonShell implements GameEntity {
  public id: string;
  public type: string = 'CANNON_SHELL';
  public position: Vector2D;
  public velocity: Vector2D;
  public bounds: AABB;
  public isAlive: boolean = true;
  public blastRadius: number = 48;
  public damage: number = 3;
  private lifetime: number = 3.0;

  constructor(id: string, startPos: Vector2D, velocity: Vector2D, blastRadius: number = 48) {
    this.id = id;
    this.position = { x: startPos.x, y: startPos.y };
    this.velocity = { x: velocity.x, y: velocity.y };
    this.blastRadius = blastRadius;
    this.bounds = createAABB(this.position.x, this.position.y, 10, 8);
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive) return;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;

    // Check collision against ground platforms
    if (engine && engine.getPlatforms().length > 0) {
      for (const plat of engine.getPlatforms()) {
        if (plat.type === 'SOLID' && BoundingBox.intersects(this.bounds, plat.bounds)) {
          this.detonate(engine);
          return;
        }
      }
    }

    this.lifetime -= dt;
    if (this.lifetime <= 0) {
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
      });
      engine.removeEntity(this.id);
    }
  }
}

export type MidBossPhase =
  | 'PHASE_1_PATROL'
  | 'GATE_1_TRANSITION'
  | 'PHASE_2_MORTAR'
  | 'GATE_2_TRANSITION'
  | 'PHASE_3_RAMMING'
  | 'DESTRUCTION_SEQUENCE'
  | 'WRECKAGE';

export interface MidBossConfig {
  patrolMinX?: number;
  patrolMaxX?: number;
  customHp?: number;
}

/**
 * Mid-Boss Rebel Iron Technical:
 * - Armored half-track / technical vehicle with tread kinematics and suspension oscillation.
 * - 360° rotating turret tracking player with angular velocity clamp (1.8 rad/s).
 * - Heavy cannon shell attacks with explosive impact.
 * - Reinforcement deployment (spawns soldier waves, capped at 3 active adds).
 * - isMeleeVulnerable: false (immune to knife).
 */
export class MidBossVehicle implements EnemyEntity {
  public readonly id: string;
  public readonly type: EnemyType = 'MID_BOSS_VEHICLE';
  public position: Vector2D;
  public velocity: Vector2D;
  public health: number;
  public maxHealth: number = 400;
  public isAlive: boolean = true;
  public isMeleeVulnerable: boolean = false; // Required: immune to knife
  public facing: 1 | -1 = -1;
  public state: string = 'PHASE_1_PATROL';
  public phase: MidBossPhase = 'PHASE_1_PATROL';

  // Vehicle dimensions
  public readonly width: number = 130;
  public readonly height: number = 68;
  public bounds: AABB;

  get boundingBox(): AABB {
    return this.bounds;
  }

  // Tread Kinematics & Suspension
  public treadRotation: number = 0;
  private readonly wheelRadius: number = 14;
  private baseGroundY: number;
  private engineTime: number = 0;
  private readonly engineOmega: number = 20; // rad/s
  private readonly idleBobAmplitude: number = 1.5; // px

  // 360° Turret Tracking
  public turretAngle: number = Math.PI; // default facing left (Math.PI)
  public readonly maxTurretSlewRate: number = 1.8; // 1.8 rad/s clamp

  // Troop Reinforcement Tracking (Cap at 3 active adds)
  private activeAdds: SoldierEnemy[] = [];
  public readonly maxActiveAdds: number = 3;
  private spawnTimer: number = 8.0;

  // Attack & Burst Timers
  private cannonCooldownTimer: number = 2.0;
  private mortarCooldownTimer: number = 5.0;

  // Ramming state
  private ramPrepTimer: number = 0;
  private isRamming: boolean = false;

  // Gate / Invulnerability Locks
  private gateLockTimer: number = 0;
  private destructionTimer: number = 0;

  // Target Player & Arena Bounds
  private targetPlayer: TargetPlayer | null = null;
  private patrolMinX: number;
  private patrolMaxX: number;

  constructor(
    id: string,
    initialPosition: Vector2D,
    config: MidBossConfig = {}
  ) {
    this.id = id;
    this.position = { x: initialPosition.x, y: initialPosition.y };
    this.baseGroundY = initialPosition.y;
    this.velocity = { x: 0, y: 0 };
    this.bounds = createAABB(this.position.x, this.position.y, this.width, this.height);

    this.maxHealth = config.customHp ?? 400;
    this.health = this.maxHealth;

    this.patrolMinX = config.patrolMinX ?? (this.position.x - 180);
    this.patrolMaxX = config.patrolMaxX ?? (this.position.x + 180);
  }

  setTargetPlayer(target: TargetPlayer | null): void {
    this.targetPlayer = target;
  }

  getTurretPivot(): Vector2D {
    return {
      x: this.position.x + (this.facing === 1 ? 80 : 50),
      y: this.position.y + 16,
    };
  }

  getTroopHatchPosition(): Vector2D {
    return {
      x: this.position.x + (this.facing === 1 ? 10 : this.width - 20),
      y: this.position.y + 20,
    };
  }

  getActiveAddsCount(): number {
    this.cleanDeadAdds();
    return this.activeAdds.length;
  }

  getActiveAdds(): SoldierEnemy[] {
    this.cleanDeadAdds();
    return [...this.activeAdds];
  }

  private cleanDeadAdds(): void {
    this.activeAdds = this.activeAdds.filter((add) => add.isAlive);
  }

  update(dt: number, engine?: GameEngine): void {
    if (!this.isAlive && this.phase === 'WRECKAGE') return;

    this.engineTime += dt;
    this.cleanDeadAdds();

    // 1. Resolve player target from engine if not explicitly assigned
    if (!this.targetPlayer && engine) {
      const playerEntity = engine.getEntity('player');
      if (playerEntity && playerEntity.isAlive) {
        this.targetPlayer = {
          position: playerEntity.position,
          bounds: playerEntity.bounds,
          isAlive: playerEntity.isAlive,
        };
      }
    }

    // 2. Turret Slew Logic (Clamped at 1.8 rad/s)
    this.updateTurretSlew(dt);

    // 3. Phase State Machine
    switch (this.phase) {
      case 'PHASE_1_PATROL':
        this.updatePhase1(dt, engine);
        break;
      case 'GATE_1_TRANSITION':
        this.updateGate1(dt, engine);
        break;
      case 'PHASE_2_MORTAR':
        this.updatePhase2(dt, engine);
        break;
      case 'GATE_2_TRANSITION':
        this.updateGate2(dt, engine);
        break;
      case 'PHASE_3_RAMMING':
        this.updatePhase3(dt, engine);
        break;
      case 'DESTRUCTION_SEQUENCE':
        this.updateDestruction(dt, engine);
        break;
    }

    // 4. Kinematics & Suspension
    this.updateKinematics(dt);

    // 5. Synchronize bounds
    this.bounds.x = this.position.x;
    this.bounds.y = this.position.y;
  }

  /**
   * 360° rotating turret tracking player with angular velocity clamp (1.8 rad/s).
   */
  private updateTurretSlew(dt: number): void {
    if (!this.targetPlayer || this.phase === 'DESTRUCTION_SEQUENCE' || this.phase === 'WRECKAGE') {
      return;
    }

    const pivot = this.getTurretPivot();
    const targetAngle = Math.atan2(
      this.targetPlayer.position.y - pivot.y,
      this.targetPlayer.position.x - pivot.x
    );

    // Normalize angle difference to [-PI, PI]
    let deltaAngle = Math.atan2(
      Math.sin(targetAngle - this.turretAngle),
      Math.cos(targetAngle - this.turretAngle)
    );

    // Clamp by max slew rate (1.8 rad/s)
    const maxStep = this.maxTurretSlewRate * dt;
    deltaAngle = Math.max(-maxStep, Math.min(maxStep, deltaAngle));

    this.turretAngle += deltaAngle;
  }

  private updateKinematics(dt: number): void {
    // Horizontal movement integration
    this.position.x += this.velocity.x * dt;

    // Tread rotation update
    this.treadRotation += (this.velocity.x * dt) / this.wheelRadius;

    // Suspension vertical oscillation
    this.position.y = this.baseGroundY + Math.sin(this.engineTime * this.engineOmega) * this.idleBobAmplitude;
  }

  // --- Phase 1: Heavy Patrol & Reinforcements (100% -> 60% HP: 400 -> 240) ---
  private updatePhase1(dt: number, engine?: GameEngine): void {
    // Patrol back and forth
    this.velocity.x = this.facing * 45;
    if (this.position.x <= this.patrolMinX && this.facing === -1) {
      this.facing = 1;
    } else if (this.position.x >= this.patrolMaxX && this.facing === 1) {
      this.facing = -1;
    }

    // Autocannon 3-round burst every 3.5s
    this.cannonCooldownTimer -= dt;
    if (this.cannonCooldownTimer <= 0) {
      this.fireAutocannonBurst(3, engine);
      this.cannonCooldownTimer = 3.5;
    }

    // Reinforcement troop spawn (capped at 3 active adds)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.trySpawnTroops(engine);
      this.spawnTimer = 12.0;
    }
  }

  private updateGate1(dt: number, engine?: GameEngine): void {
    this.velocity.x = 0;
    this.gateLockTimer -= dt;

    if (engine) {
      engine.eventBus.emit('vehicle_smoke', { position: this.getTurretPivot() });
    }

    if (this.gateLockTimer <= 0) {
      this.phase = 'PHASE_2_MORTAR';
      this.state = 'PHASE_2_MORTAR';
      this.cannonCooldownTimer = 2.0;
      this.mortarCooldownTimer = 4.0;
      this.spawnTimer = 6.0;
    }
  }

  // --- Phase 2: Mortar & Faster Reinforcements (60% -> 20% HP: 240 -> 80) ---
  private updatePhase2(dt: number, engine?: GameEngine): void {
    // Increased patrol speed
    this.velocity.x = this.facing * 70;
    if (this.position.x <= this.patrolMinX && this.facing === -1) {
      this.facing = 1;
    } else if (this.position.x >= this.patrolMaxX && this.facing === 1) {
      this.facing = -1;
    }

    // Autocannon 5-round burst every 3.0s
    this.cannonCooldownTimer -= dt;
    if (this.cannonCooldownTimer <= 0) {
      this.fireAutocannonBurst(5, engine);
      this.cannonCooldownTimer = 3.0;
    }

    // Mortar attack every 6.0s
    this.mortarCooldownTimer -= dt;
    if (this.mortarCooldownTimer <= 0) {
      this.fireMortar(engine);
      this.mortarCooldownTimer = 6.0;
    }

    // Reinforcements spawn every 8s (capped at 3 adds)
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.trySpawnTroops(engine);
      this.spawnTimer = 8.0;
    }
  }

  private updateGate2(dt: number, engine?: GameEngine): void {
    this.velocity.x = 0;
    this.gateLockTimer -= dt;

    if (engine) {
      engine.eventBus.emit('vehicle_fire_alarm', { position: this.position });
    }

    if (this.gateLockTimer <= 0) {
      this.phase = 'PHASE_3_RAMMING';
      this.state = 'PHASE_3_RAMMING';
      this.ramPrepTimer = 1.0;
      this.isRamming = false;
    }
  }

  // --- Phase 3: Desperation Ramming (20% -> 0% HP: 80 -> 0) ---
  private updatePhase3(dt: number, engine?: GameEngine): void {
    if (!this.isRamming) {
      this.velocity.x = 0;
      this.ramPrepTimer -= dt;
      if (this.ramPrepTimer <= 0) {
        this.isRamming = true;
        // Determine charge direction towards player
        if (this.targetPlayer) {
          this.facing = this.targetPlayer.position.x >= this.position.x ? 1 : -1;
        }
      }
    } else {
      // High-speed charge across screen at 220 px/s
      this.velocity.x = this.facing * 220;

      // Erratic rapid cannon sprays while charging
      this.cannonCooldownTimer -= dt;
      if (this.cannonCooldownTimer <= 0) {
        this.fireSingleCannonShell(engine);
        this.cannonCooldownTimer = 0.4;
      }

      // Turn around if reaching arena boundaries
      if (this.position.x <= this.patrolMinX - 50 && this.facing === -1) {
        this.facing = 1;
        this.isRamming = false;
        this.ramPrepTimer = 0.8;
      } else if (this.position.x >= this.patrolMaxX + 50 && this.facing === 1) {
        this.facing = -1;
        this.isRamming = false;
        this.ramPrepTimer = 0.8;
      }
    }
  }

  private updateDestruction(dt: number, engine?: GameEngine): void {
    this.velocity.x = 0;
    this.destructionTimer += dt;

    if (engine) {
      if (this.destructionTimer <= 0.75) {
        engine.eventBus.emit('explosion_spawned', {
          position: {
            x: this.position.x + Math.random() * this.width,
            y: this.position.y + Math.random() * this.height,
          },
          radius: 36,
          damage: 0,
        });
      }
    }

    if (this.destructionTimer >= 0.8) {
      this.phase = 'WRECKAGE';
      this.state = 'WRECKAGE';
      this.isAlive = false;
    }
  }

  private fireSingleCannonShell(engine?: GameEngine): void {
    const pivot = this.getTurretPivot();
    const speed = 320;
    const vel: Vector2D = {
      x: Math.cos(this.turretAngle) * speed,
      y: Math.sin(this.turretAngle) * speed,
    };

    const shell = new CannonShell(
      `shell_${this.id}_${Date.now()}_${Math.random()}`,
      pivot,
      vel,
      48
    );

    if (engine) {
      engine.addEntity(shell);
      engine.eventBus.emit('cannon_fired', {
        position: pivot,
        angle: this.turretAngle,
        velocity: vel,
      });
    }
  }

  private fireAutocannonBurst(count: number, engine?: GameEngine): void {
    for (let i = 0; i < count; i++) {
      // Slight angle dispersion for burst realism
      const spread = (Math.random() - 0.5) * 0.08;
      const angle = this.turretAngle + spread;
      const speed = 320;
      const pivot = this.getTurretPivot();
      const vel: Vector2D = {
        x: Math.cos(angle) * speed,
        y: Math.sin(angle) * speed,
      };

      const shell = new CannonShell(
        `autocannon_${this.id}_${i}_${Date.now()}_${Math.random()}`,
        pivot,
        vel,
        36
      );

      if (engine) {
        engine.addEntity(shell);
      }
    }

    if (engine) {
      engine.eventBus.emit('cannon_burst', {
        position: this.getTurretPivot(),
        count,
      });
    }
  }

  private fireMortar(engine?: GameEngine): void {
    const pivot = this.getTurretPivot();
    let targetX = this.targetPlayer ? this.targetPlayer.position.x : this.position.x - 140;
    const flightTime = 1.2;
    const v0x = (targetX - pivot.x) / flightTime;
    const v0y = -380; // High arc upward launch

    const mortarShell = new CannonShell(
      `mortar_${this.id}_${Date.now()}_${Math.random()}`,
      pivot,
      { x: v0x, y: v0y },
      64 // Bigger blast radius
    );

    if (engine) {
      engine.addEntity(mortarShell);
      engine.eventBus.emit('mortar_fired', {
        origin: pivot,
        targetX,
      });
    }
  }

  /**
   * Spawns reinforcement soldiers from the rear vehicle hatch.
   * Strictly capped at 3 active adds at any time.
   */
  public trySpawnTroops(engine?: GameEngine): SoldierEnemy | null {
    this.cleanDeadAdds();

    // Cap check: strictly do not spawn if 3 active adds are present
    if (this.activeAdds.length >= this.maxActiveAdds) {
      return null;
    }

    const hatchPos = this.getTroopHatchPosition();
    const addTypes: EnemyType[] = ['SOLDIER_RIFLE', 'SOLDIER_KNIFE', 'SOLDIER_SHIELD'];
    const selectedType = addTypes[Math.floor(Math.random() * addTypes.length)];

    const soldier = new SoldierEnemy(
      `midboss_add_${this.id}_${Date.now()}_${Math.random()}`,
      selectedType,
      { x: hatchPos.x, y: this.position.y + this.height - 38 }
    );
    soldier.facing = this.facing;
    if (this.targetPlayer) {
      soldier.setTargetPlayer(this.targetPlayer);
    }

    this.activeAdds.push(soldier);

    if (engine) {
      engine.addEntity(soldier);
      engine.eventBus.emit('reinforcement_spawned', {
        id: soldier.id,
        type: soldier.type,
        position: soldier.position,
      });
    }

    return soldier;
  }

  /**
   * Damage processing with health gates and knife immunity:
   * isMeleeVulnerable is false, so melee knife attacks deal 0 damage.
   * Health gates prevent skipping Phase 2 or Phase 3 on massive single-frame burst damage.
   */
  takeDamage(
    amount: number,
    sourceType: DamageSourceType = 'bullet',
    _origin?: Vector2D
  ): boolean {
    if (!this.isAlive) return false;

    // Immune to melee knife!
    if (sourceType === 'melee') {
      return false;
    }

    // Invulnerable during gate transitions
    if (this.phase === 'GATE_1_TRANSITION' || this.phase === 'GATE_2_TRANSITION') {
      return false;
    }

    // Health Gate 1 (240 HP / 60%)
    if (this.phase === 'PHASE_1_PATROL') {
      const remainingHp = this.health - amount;
      if (remainingHp <= 240) {
        this.health = 240;
        this.phase = 'GATE_1_TRANSITION';
        this.state = 'GATE_1_TRANSITION';
        this.gateLockTimer = 1.0;
        return true;
      }
      this.health = remainingHp;
      return true;
    }

    // Health Gate 2 (80 HP / 20%)
    if (this.phase === 'PHASE_2_MORTAR') {
      const remainingHp = this.health - amount;
      if (remainingHp <= 80) {
        this.health = 80;
        this.phase = 'GATE_2_TRANSITION';
        this.state = 'GATE_2_TRANSITION';
        this.gateLockTimer = 0.8;
        return true;
      }
      this.health = remainingHp;
      return true;
    }

    // Phase 3: to 0 HP
    if (this.phase === 'PHASE_3_RAMMING') {
      this.health -= amount;
      if (this.health <= 0) {
        this.health = 0;
        this.phase = 'DESTRUCTION_SEQUENCE';
        this.state = 'DESTRUCTION_SEQUENCE';
        this.destructionTimer = 0;
      }
      return true;
    }

    return true;
  }
}
