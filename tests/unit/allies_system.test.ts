import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { AllyNPC } from '../../src/core/entities/allies/AllyNPC';
import { AllyKiBlast } from '../../src/core/entities/allies/AllyKiBlast';
import { AllyManager } from '../../src/core/entities/allies/AllyManager';
import { PlayerController } from '../../src/core/player/PlayerController';
import { BulletProjectile } from '../../src/core/weapons/ProjectileManager';

class MockEnemy implements GameEntity {
  public id: string;
  public type: string;
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public health: number = 20.0;
  public hitCount: number = 0;
  public lastDamage: number = 0;
  public lastSourceType?: string;

  constructor(id: string, x: number, y: number, type: string = 'SOLDIER_RIFLE', health: number = 20.0) {
    this.id = id;
    this.type = type;
    this.position = vec2(x, y);
    this.bounds = createAABB(x - 10, y - 30, 20, 30);
    this.health = health;
  }

  update(): void {}
  onCollision(): void {}

  takeDamage(amount: number, sourceType?: string, _origin?: Vector2D): void {
    this.hitCount++;
    this.lastDamage = amount;
    this.lastSourceType = sourceType;
    this.health -= amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

describe('Autonomous Ally NPC System (Hyakutaro Ichimonji)', () => {
  let engine: GameEngine;
  let player: PlayerController;
  let allyManager: AllyManager;

  beforeEach(() => {
    engine = new GameEngine();
    allyManager = new AllyManager();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 200, 2000, 20),
    });

    player = new PlayerController(vec2(200, 200));
    engine.addEntity(player);
    if ((engine as any).entities instanceof Map) {
      (engine as any).entities.set(player.id, player);
      engine.spatialGrid.insert(player);
    }
  });

  describe('Autonomous State Transitions & Locomotion', () => {
    it('should initialize in SPAWN_SALUTE and transition to FOLLOW after salute duration', () => {
      const ally = allyManager.spawnAlly(vec2(100, 200), engine);
      expect(ally.getState()).toBe('SPAWN_SALUTE');

      // Update for 0.55s (salute is 0.5s)
      for (let i = 0; i < 35; i++) {
        ally.update(1 / 60, engine);
      }

      expect(ally.getState()).toBe('FOLLOW');
    });

    it('should autonomously follow player with walk and sprint pacing', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Player at X=200 facing 1 (+X). Target offset is 200 - 45 = 155.
      // Ally at X=100. Delta = 155 - 100 = 55px (> 12px and < 90px -> walk speed 115 px/s)
      ally.update(1 / 60, engine);
      expect(ally.getState()).toBe('FOLLOW');
      expect(ally.facing).toBe(1);
      expect(ally.velocity.x).toBe(115.0);

      // Sprint test: Place ally far behind (e.g. X=0 -> Delta = 155 > 90px)
      ally.position.x = 0;
      ally.update(1 / 60, engine);
      expect(ally.velocity.x).toBe(165.0); // Sprints at 165 px/s!

      // Idle stop test: Place ally at target offset X=155 (Delta = 0 <= 12px)
      ally.position.x = 155;
      ally.update(1 / 60, engine);
      expect(ally.velocity.x).toBe(0);
      expect(ally.getState()).toBe('IDLE');
      expect(ally.facing).toBe(player.facing);
    });

    it('should jump autonomously when player is on an elevated platform', () => {
      const ally = new AllyNPC('ally_test', vec2(150, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Elevate player by > 22px
      player.position.y = 160; // 40px higher

      ally.update(1 / 60, engine);
      expect(ally.velocity.y).toBe(-350.0); // Jump impulse
      expect(ally.isGrounded).toBe(false);
    });
  });

  describe('Autonomous Target Acquisition (0 Player Input)', () => {
    it('should acquire living enemy targets in 380px radius without any player input', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const minion = new MockEnemy('enemy_minion', 250, 200, 'SOLDIER_RIFLE');
      engine.addEntity(minion);

      // No player inputs provided at all!
      const target = ally.findBestTarget(engine);
      expect(target).not.toBeNull();
      expect(target?.id).toBe('enemy_minion');

      // Ally update should transition to CHARGE_ATTACK
      ally.update(1 / 60, engine);
      expect(ally.getState()).toBe('CHARGE_ATTACK');
      expect(ally.currentTarget?.id).toBe('enemy_minion');
      expect(ally.facing).toBe(1); // Oriented toward target
      expect(ally.velocity.x).toBe(0); // Halts during charge
    });

    it('should prioritize Bosses and Mid-Bosses over standard minions', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Place a closer minion at 180 (dist = 80)
      const minion = new MockEnemy('minion_close', 180, 200, 'SOLDIER_RIFLE');
      // Place a boss further at 300 (dist = 200)
      const boss = new MockEnemy('boss_far', 300, 200, 'TETSUYUKI_BOSS');

      engine.addEntity(minion);
      engine.addEntity(boss);

      const target = ally.findBestTarget(engine);
      expect(target).not.toBeNull();
      // Boss has higher threat weight (+100 * 100) vs minion (+10 * 100), overcoming distance
      expect(target?.id).toBe('boss_far');
    });

    it('should ignore dead enemies or enemies outside vision radius', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      // Dead enemy within range
      const deadEnemy = new MockEnemy('dead_enemy', 200, 200, 'SOLDIER_RIFLE');
      deadEnemy.isAlive = false;

      // Far enemy (> 380px)
      const farEnemy = new MockEnemy('far_enemy', 550, 200, 'SOLDIER_RIFLE');

      engine.addEntity(deadEnemy);
      engine.addEntity(farEnemy);

      const target = ally.findBestTarget(engine);
      expect(target).toBeNull();
    });
  });

  describe('Ki Blast Combat Resolution & Friendly Fire Safety', () => {
    it('should charge for 0.35s and emit AllyKiBlast dealing 3.5 HP damage', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FOLLOW');
      engine.addEntity(ally);

      const enemy = new MockEnemy('target_enemy', 180, 200, 'SOLDIER_RIFLE');
      engine.addEntity(enemy);

      // Advance through target acquisition and 0.35s ki gathering charge
      // 0.35s at 60Hz is ~21 frames
      for (let i = 0; i < 25; i++) {
        ally.update(1 / 60, engine);
      }

      // Check if AllyKiBlast was spawned into engine
      const kiBlasts = engine.getAllEntities().filter((e) => e instanceof AllyKiBlast) as AllyKiBlast[];
      expect(kiBlasts.length).toBeGreaterThanOrEqual(1);

      const kiBlast = kiBlasts[0];
      expect(kiBlast.velocity.x).toBe(520.0);
      expect(kiBlast.damage).toBe(3.5);

      // Test combat resolution: blast collides with enemy
      kiBlast.onCollision(enemy, engine);
      expect(enemy.hitCount).toBe(1);
      expect(enemy.lastDamage).toBe(3.5);
      expect(enemy.lastSourceType).toBe('energy');
      expect(kiBlast.isAlive).toBe(false); // Consumed on impact
    });

    it('should guarantee friendly fire immunity for player and allies', () => {
      const kiBlast = new AllyKiBlast('blast_test', vec2(100, 200), 1, 520, 3.5);
      const otherAlly = new AllyNPC('ally_companion', vec2(120, 200));

      const playerHealthBefore = player.health;

      // Ki blast hits player -> should do nothing!
      kiBlast.onCollision(player, engine);
      expect(player.health).toBe(playerHealthBefore);
      expect(kiBlast.isAlive).toBe(true);

      // Ki blast hits other ally -> should do nothing!
      kiBlast.onCollision(otherAlly, engine);
      expect(otherAlly.isAlive).toBe(true);
      expect(kiBlast.isAlive).toBe(true);

      // Player bullet hits ally -> should do nothing!
      const playerBullet = new BulletProjectile(
        'bullet_1',
        'HEAVY_MACHINE_GUN',
        vec2(100, 200),
        vec2(780, 0),
        1.0,
        false,
        1.0
      );
      playerBullet.onCollision(otherAlly, engine);
      expect(otherAlly.isAlive).toBe(true);
      expect(playerBullet.isAlive).toBe(true);
    });

    it('should transition through RECOVERY and enforce attack cooldown', () => {
      const ally = new AllyNPC('ally_test', vec2(100, 200));
      ally.setState('FIRE_ATTACK');
      engine.addEntity(ally);

      ally.update(1 / 60, engine);
      expect(ally.getState()).toBe('RECOVERY');
      expect(ally.attackCooldownTimer).toBeCloseTo(1.2, 1);

      // Complete recovery duration (0.2s = 12 frames)
      for (let i = 0; i < 15; i++) {
        ally.update(1 / 60, engine);
      }

      expect(ally.getState()).toBe('FOLLOW');
      // Cooldown still active
      expect(ally.attackCooldownTimer).toBeGreaterThan(0.5);
    });
  });

  describe('AllyManager Lifecycle', () => {
    it('should coordinate spawning, updating, and clearing allies', () => {
      expect(allyManager.getAllyCount()).toBe(0);
      expect(allyManager.hasActiveAlly()).toBe(false);

      const ally = allyManager.spawnAlly(vec2(100, 200), engine);
      expect(allyManager.getAllyCount()).toBe(1);
      expect(allyManager.hasActiveAlly()).toBe(true);
      expect(allyManager.getAllies()[0]).toBe(ally);

      // Update
      allyManager.update(1 / 60, engine);
      expect(allyManager.getAllyCount()).toBe(1);

      // Clear
      allyManager.clear();
      expect(allyManager.getAllyCount()).toBe(0);
      expect(allyManager.hasActiveAlly()).toBe(false);
    });
  });
});
