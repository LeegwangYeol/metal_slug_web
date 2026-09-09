import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import {
  WEAPON_CONFIGS,
  ItemDropType,
  POW_LOOT_TABLE,
} from '../../src/core/weapons/WeaponTypes';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { ShotgunWeapon, ShotgunPelletProjectile } from '../../src/core/weapons/ShotgunWeapon';
import { LaserGunWeapon, LaserBeamProjectile } from '../../src/core/weapons/LaserGunWeapon';
import { RocketLauncherWeapon, PlayerRocketProjectile } from '../../src/core/weapons/RocketLauncherWeapon';
import { ItemPickup } from '../../src/core/entities/items/ItemPickup';
import { PlayerController } from '../../src/core/player/PlayerController';

// Mock Enemy Entity for testing combat resolutions
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
  public knockbackReceived: Vector2D = vec2(0, 0);

  constructor(id: string, x: number, y: number, type: string = 'SOLDIER_RIFLE') {
    this.id = id;
    this.type = type;
    this.position = vec2(x, y);
    this.bounds = createAABB(x - 10, y - 30, 20, 30);
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

  applyKnockback(kx: number, ky: number): void {
    this.knockbackReceived.x += kx;
    this.knockbackReceived.y += ky;
  }
}

describe('Diverse Weapons & Items System', () => {
  let engine: GameEngine;
  let weaponManager: WeaponManager;

  beforeEach(() => {
    engine = new GameEngine();
    weaponManager = new WeaponManager();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 200, 1000, 20),
    });
  });

  describe('Weapon Types & Configurations', () => {
    it('should define configs for SHOTGUN, LASER_GUN, and ROCKET_LAUNCHER', () => {
      expect(WEAPON_CONFIGS.SHOTGUN).toBeDefined();
      expect(WEAPON_CONFIGS.SHOTGUN.name).toBe('Shotgun');
      expect(WEAPON_CONFIGS.SHOTGUN.isAutomatic).toBe(false);
      expect(WEAPON_CONFIGS.SHOTGUN.projectileSpeed).toBe(680.0);
      expect(WEAPON_CONFIGS.SHOTGUN.projectileDamage).toBe(2.0);

      expect(WEAPON_CONFIGS.LASER_GUN).toBeDefined();
      expect(WEAPON_CONFIGS.LASER_GUN.name).toBe('Laser Gun');
      expect(WEAPON_CONFIGS.LASER_GUN.isAutomatic).toBe(true);
      expect(WEAPON_CONFIGS.LASER_GUN.projectileSpeed).toBe(1200.0);
      expect(WEAPON_CONFIGS.LASER_GUN.piercing).toBe(true);

      expect(WEAPON_CONFIGS.ROCKET_LAUNCHER).toBeDefined();
      expect(WEAPON_CONFIGS.ROCKET_LAUNCHER.name).toBe('Rocket Launcher');
      expect(WEAPON_CONFIGS.ROCKET_LAUNCHER.isAutomatic).toBe(false);
      expect(WEAPON_CONFIGS.ROCKET_LAUNCHER.projectileSpeed).toBe(220.0);
      expect(WEAPON_CONFIGS.ROCKET_LAUNCHER.projectileDamage).toBe(8.0);
    });

    it('should include new weapons and powerups in ItemDropType and POW_LOOT_TABLE', () => {
      expect(ItemDropType.WEAPON_SHOTGUN).toBe('ITEM_WEAPON_SHOTGUN');
      expect(ItemDropType.WEAPON_LASER).toBe('ITEM_WEAPON_LASER');
      expect(ItemDropType.WEAPON_ROCKET).toBe('ITEM_WEAPON_ROCKET');
      expect(ItemDropType.MEDKIT).toBe('ITEM_MEDKIT');
      expect(ItemDropType.SHIELD).toBe('ITEM_SHIELD');

      const lootTypes = POW_LOOT_TABLE.map((e) => e.type);
      expect(lootTypes).toContain(ItemDropType.WEAPON_SHOTGUN);
      expect(lootTypes).toContain(ItemDropType.WEAPON_LASER);
      expect(lootTypes).toContain(ItemDropType.WEAPON_ROCKET);
      expect(lootTypes).toContain(ItemDropType.MEDKIT);
      expect(lootTypes).toContain(ItemDropType.SHIELD);
    });
  });

  describe('Shotgun Mechanics', () => {
    it('should fire a 7-pellet fan spread spanning +-14 degrees', () => {
      const muzzlePos = vec2(100, 100);
      const aimVec = vec2(1, 0); // Facing right (0 degrees)

      const centerPellet = ShotgunWeapon.fire(muzzlePos, aimVec, 1, engine);
      expect(centerPellet).toBeInstanceOf(ShotgunPelletProjectile);

      const allPellets = engine.getAllEntities().filter((e) => e instanceof ShotgunPelletProjectile) as ShotgunPelletProjectile[];
      expect(allPellets.length).toBe(7);

      // Check angles of pellets
      const angles = allPellets.map((p) => Math.atan2(p.velocity.y, p.velocity.x));
      const minAngle = Math.min(...angles);
      const maxAngle = Math.max(...angles);

      const expectedSpreadRad = (28 * Math.PI) / 180;
      expect(maxAngle - minAngle).toBeCloseTo(expectedSpreadRad, 3);
      expect(minAngle).toBeCloseTo(-expectedSpreadRad / 2, 3);
      expect(maxAngle).toBeCloseTo(expectedSpreadRad / 2, 3);

      // Verify pellet velocity and lifetime
      for (const pellet of allPellets) {
        const speed = Math.hypot(pellet.velocity.x, pellet.velocity.y);
        expect(speed).toBeCloseTo(680.0, 1);
        expect(pellet.maxLifeTime).toBe(0.18);
        expect(pellet.damage).toBe(2.0);
      }
    });

    it('should apply kinetic knockback impulse to enemy target on hit', () => {
      const enemy = new MockEnemy('enemy_1', 130, 100);
      engine.addEntity(enemy);

      const muzzlePos = vec2(100, 100);
      const pellet = new ShotgunPelletProjectile('pellet_test', muzzlePos, vec2(680, 0), 1, 2.0);

      pellet.onCollision(enemy, engine);

      expect(enemy.hitCount).toBe(1);
      expect(enemy.lastDamage).toBe(2.0);
      // Horizontal knockback impulse >= 100 px/s (specifically 160 px/s)
      expect(enemy.velocity.x).toBe(160.0);
      expect(enemy.velocity.y).toBe(-80.0);
      expect(enemy.knockbackReceived.x).toBe(160.0);
      expect(pellet.isAlive).toBe(false);
    });

    it('should respect shotgun semi-automatic fire cooldown', () => {
      weaponManager.acquireWeapon('SHOTGUN', 30, engine);
      expect(weaponManager.getActiveWeapon()).toBe('SHOTGUN');
      expect(weaponManager.getAmmo()).toBe(30);

      const p1 = weaponManager.tryFire(vec2(100, 100), vec2(1, 0), 1, engine, true, false);
      expect(p1).not.toBeNull();
      expect(weaponManager.getAmmo()).toBe(29);

      // Subsequent held press should be blocked by cooldown and semi-auto
      const p2 = weaponManager.tryFire(vec2(100, 100), vec2(1, 0), 1, engine, false, true);
      expect(p2).toBeNull();
    });
  });

  describe('Laser Gun Mechanics', () => {
    it('should fire a 1200 px/s continuous beam that pierces through multiple enemies', () => {
      const enemy1 = new MockEnemy('enemy_1', 150, 100);
      const enemy2 = new MockEnemy('enemy_2', 200, 100);
      engine.addEntity(enemy1);
      engine.addEntity(enemy2);

      const laser = LaserGunWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      expect(laser).toBeInstanceOf(LaserBeamProjectile);
      expect(laser.velocity.x).toBe(1200.0);
      expect(laser.pierces).toBe(true);
      expect(laser.damage).toBe(1.2);

      // Hit first enemy
      laser.onCollision(enemy1, engine);
      expect(enemy1.hitCount).toBe(1);
      expect(enemy1.lastDamage).toBe(1.2);
      expect(laser.isAlive).toBe(true); // Does NOT terminate!

      // Hit second enemy in same beam path
      laser.onCollision(enemy2, engine);
      expect(enemy2.hitCount).toBe(1);
      expect(enemy2.lastDamage).toBe(1.2);
      expect(laser.isAlive).toBe(true); // Continues piercing!
    });

    it('should enforce 0.1s tick immunity on pierced targets to prevent multi-hit spam', () => {
      const enemy = new MockEnemy('enemy_boss', 150, 100, 'TETSUYUKI_BOSS');
      const laser = new LaserBeamProjectile('laser_test', vec2(100, 100), vec2(1200, 0), 1, 1.2);

      // First tick deals damage
      laser.onCollision(enemy, engine);
      expect(enemy.hitCount).toBe(1);

      // Immediate collision in subsequent frame (within 0.1s) should be immune
      laser.update(1 / 60, engine); // 0.0166s elapsed (< 0.1s)
      laser.onCollision(enemy, engine);
      expect(enemy.hitCount).toBe(1); // Blocked by tick immunity

      // Advance time beyond 0.1s (6 frames)
      for (let i = 0; i < 6; i++) {
        laser.update(1 / 60, engine);
      }

      // Next tick deals damage again
      laser.onCollision(enemy, engine);
      expect(enemy.hitCount).toBe(2);
      expect(enemy.health).toBeCloseTo(20.0 - 2.4, 2);
    });
  });

  describe('Rocket Launcher Mechanics', () => {
    it('should accelerate from initial speed to max speed and steer toward enemies', () => {
      const enemy = new MockEnemy('target_enemy', 300, 160);
      engine.addEntity(enemy);

      // Launch rocket pointing horizontally (aim (1, 0)) while enemy is below-right
      const rocket = RocketLauncherWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      expect(rocket).toBeInstanceOf(PlayerRocketProjectile);
      expect(rocket.velocity.x).toBeCloseTo(220.0, 1);
      expect(rocket.velocity.y).toBeCloseTo(0.0, 1);

      // Update for several frames: should accelerate and steer downwards toward enemy Y=160
      for (let i = 0; i < 15; i++) {
        rocket.update(1 / 60, engine);
      }

      const speed = Math.hypot(rocket.velocity.x, rocket.velocity.y);
      expect(speed).toBeGreaterThan(220.0); // Accelerated
      expect(rocket.velocity.y).toBeGreaterThan(0.0); // Steered downward toward target!
    });

    it('should detonate with a 48px explosive AOE blast with damage falloff', () => {
      const directEnemy = new MockEnemy('direct_enemy', 100, 100);
      const nearbyEnemy = new MockEnemy('nearby_enemy', 124, 100); // 24px away (half radius)
      const distantEnemy = new MockEnemy('distant_enemy', 160, 100); // 60px away (> 48px radius)

      engine.addEntity(directEnemy);
      engine.addEntity(nearbyEnemy);
      engine.addEntity(distantEnemy);

      // Put entities in spatial grid
      if ((engine as any).entities instanceof Map) {
        (engine as any).entities.set(directEnemy.id, directEnemy);
        (engine as any).entities.set(nearbyEnemy.id, nearbyEnemy);
        (engine as any).entities.set(distantEnemy.id, distantEnemy);
        engine.spatialGrid.insert(directEnemy);
        engine.spatialGrid.insert(nearbyEnemy);
        engine.spatialGrid.insert(distantEnemy);
      }

      const rocket = new PlayerRocketProjectile('rocket_blast_test', vec2(100, 100), vec2(1, 0), 1);

      // Detonate at (100, 100)
      rocket.detonate(engine);

      expect(directEnemy.hitCount).toBe(1);
      expect(directEnemy.lastDamage).toBeCloseTo(8.0, 1); // Epicenter full damage

      expect(nearbyEnemy.hitCount).toBe(1);
      expect(nearbyEnemy.lastDamage).toBeCloseTo(4.0, 1); // 50% falloff at 24px/48px

      expect(distantEnemy.hitCount).toBe(0); // Outside 48px AOE blast
      expect(rocket.isAlive).toBe(false);
    });
  });

  describe('Item Pickups & Player Integration', () => {
    let player: PlayerController;

    beforeEach(() => {
      player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);
    });

    it('should heal player with Medkit or grant extra life if already at full health', () => {
      // 1. Damaged state: health 0.5 -> full health 1.0
      player.health = 0.5;
      player.lives = 3;

      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(3);

      // 2. Full health state: grants +1 extra life
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(4);
    });

    it('should absorb 2 hits of damage when Shield is active', () => {
      expect(player.shieldCharges).toBe(0);
      player.health = 1.0;
      player.lives = 3;

      // Acquire shield
      weaponManager.applyItemPickup(ItemDropType.SHIELD, engine, player);
      expect(player.shieldCharges).toBe(2);

      // Hit 1: absorbed by shield
      player.takeDamage(1.0, engine);
      expect(player.health).toBe(1.0);
      expect(player.shieldCharges).toBe(1);
      expect(player.lives).toBe(3);

      // Reset invulnerability to test second hit
      (player as any).invulnerabilityTimer = 0;

      // Hit 2: absorbed by shield (shield now depleted)
      player.takeDamage(1.0, engine);
      expect(player.health).toBe(1.0);
      expect(player.shieldCharges).toBe(0);
      expect(player.lives).toBe(3);

      // Reset invulnerability to test third hit
      (player as any).invulnerabilityTimer = 0;

      // Hit 3: shield broken, takes real damage!
      player.takeDamage(1.0, engine);
      expect(player.lives).toBe(2); // Lost a life on lethal hit
    });

    it('should support ItemPickup entity falling, platform landing, and bobbing', () => {
      const item = new ItemPickup('crate_1', ItemDropType.WEAPON_SHOTGUN, vec2(100, 100));
      expect(item.isGrounded).toBe(false);

      // Update through gravity until landing on ground (Y=200)
      for (let i = 0; i < 60; i++) {
        item.update(1 / 60, engine);
      }

      expect(item.isGrounded).toBe(true);
      expect(item.position.y).toBe(200);

      // Update while grounded to test bobbing timer
      const initialBob = item.bobTimer;
      item.update(1 / 60, engine);
      expect(item.bobTimer).toBeGreaterThan(initialBob);
    });
  });
});
