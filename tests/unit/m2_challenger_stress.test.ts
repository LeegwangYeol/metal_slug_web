import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { Vector2D, vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { WeaponManager } from '../../src/core/weapons/WeaponManager';
import { ShotgunWeapon, ShotgunPelletProjectile } from '../../src/core/weapons/ShotgunWeapon';
import { LaserGunWeapon, LaserBeamProjectile } from '../../src/core/weapons/LaserGunWeapon';
import { RocketLauncherWeapon, PlayerRocketProjectile } from '../../src/core/weapons/RocketLauncherWeapon';
import { PlayerController } from '../../src/core/player/PlayerController';

// Adversarial Mock Target for exact measurement of damage, knockback, and hit counts
class AdversarialTarget implements GameEntity {
  public id: string;
  public type: string;
  public position: Vector2D;
  public velocity: Vector2D = vec2(0, 0);
  public bounds = createAABB(0, 0, 20, 30);
  public isAlive: boolean = true;
  public health: number = 100.0;
  public hitCount: number = 0;
  public totalDamageReceived: number = 0;
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
    this.totalDamageReceived += amount;
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

describe('Challenger M2 Adversarial Stress Suite', () => {
  let engine: GameEngine;
  let weaponManager: WeaponManager;

  beforeEach(() => {
    engine = new GameEngine();
    weaponManager = new WeaponManager();
    engine.addPlatform({
      id: 'ground',
      type: 'SOLID',
      bounds: createAABB(0, 300, 2000, 20),
    });
  });

  // =========================================================================
  // FOCUS 1: Shotgun 7-Pellet Spread Cone and Kinetic Knockback
  // =========================================================================
  describe('Focus 1: Shotgun 7-pellet spread cone & kinetic knockback', () => {
    it('generates exactly 7 pellets with a precise +-14 degree cone across multiple aim directions', () => {
      const directions = [
        { name: 'Facing Right (1, 0)', aim: vec2(1, 0), baseAngle: 0 },
        { name: 'Facing Up (0, -1)', aim: vec2(0, -1), baseAngle: -Math.PI / 2 },
        { name: 'Facing Left (-1, 0)', aim: vec2(-1, 0), baseAngle: Math.PI },
        { name: 'Facing Down (0, 1)', aim: vec2(0, 1), baseAngle: Math.PI / 2 },
        { name: 'Diagonal (1, 1)', aim: vec2(1, 1), baseAngle: Math.PI / 4 },
      ];

      for (const dir of directions) {
        const testEngine = new GameEngine();
        const center = ShotgunWeapon.fire(vec2(100, 100), dir.aim, 1, testEngine);
        expect(center).toBeInstanceOf(ShotgunPelletProjectile);

        const allPellets = testEngine.getAllEntities().filter(
          (e) => e instanceof ShotgunPelletProjectile
        ) as ShotgunPelletProjectile[];

        // 1. Exact pellet count
        expect(allPellets.length).toBe(7);

        // 2. Exact arc range: 28 degrees = 28 * PI / 180
        const expectedArc = (28 * Math.PI) / 180;
        const halfArc = expectedArc / 2;

        const angles = allPellets.map((p) => {
          let a = Math.atan2(p.velocity.y, p.velocity.x);
          let diff = a - dir.baseAngle;
          while (diff > Math.PI) diff -= 2 * Math.PI;
          while (diff < -Math.PI) diff += 2 * Math.PI;
          return diff;
        });

        angles.sort((a, b) => a - b);

        expect(angles[0]).toBeCloseTo(-halfArc, 4);
        expect(angles[angles.length - 1]).toBeCloseTo(halfArc, 4);
        expect(angles[angles.length - 1] - angles[0]).toBeCloseTo(expectedArc, 4);

        // Center pellet is index 3 in raw fire order
        const centerAngle = Math.atan2(center.velocity.y, center.velocity.x);
        let centerDiff = centerAngle - dir.baseAngle;
        while (centerDiff > Math.PI) centerDiff -= 2 * Math.PI;
        while (centerDiff < -Math.PI) centerDiff += 2 * Math.PI;
        expect(centerDiff).toBeCloseTo(0, 4);

        // All pellets must have uniform speed 680 px/s, life 0.18s, damage 2.0
        for (const pellet of allPellets) {
          const speed = Math.hypot(pellet.velocity.x, pellet.velocity.y);
          expect(speed).toBeCloseTo(680.0, 2);
          expect(pellet.maxLifeTime).toBe(0.18);
          expect(pellet.damage).toBe(2.0);
        }
      }
    });

    it('applies directional kinetic knockback impulse (160 px/s horizontal, -80 px/s vertical)', () => {
      // Test Right Facing (facing = 1)
      const enemyRight = new AdversarialTarget('target_r', 150, 100);
      const pelletRight = new ShotgunPelletProjectile('p_r', vec2(100, 100), vec2(680, 0), 1, 2.0);
      pelletRight.onCollision(enemyRight, engine);

      expect(enemyRight.hitCount).toBe(1);
      expect(enemyRight.lastDamage).toBe(2.0);
      expect(enemyRight.velocity.x).toBe(160.0);
      expect(enemyRight.velocity.y).toBe(-80.0);
      expect(enemyRight.knockbackReceived.x).toBe(160.0);
      expect(enemyRight.knockbackReceived.y).toBe(-80.0);
      expect(pelletRight.isAlive).toBe(false);

      // Test Left Facing (facing = -1)
      const enemyLeft = new AdversarialTarget('target_l', 50, 100);
      const pelletLeft = new ShotgunPelletProjectile('p_l', vec2(100, 100), vec2(-680, 0), -1, 2.0);
      pelletLeft.onCollision(enemyLeft, engine);

      expect(enemyLeft.hitCount).toBe(1);
      expect(enemyLeft.velocity.x).toBe(-160.0);
      expect(enemyLeft.velocity.y).toBe(-80.0);
      expect(enemyLeft.knockbackReceived.x).toBe(-160.0);
      expect(enemyLeft.knockbackReceived.y).toBe(-80.0);
      expect(pelletLeft.isAlive).toBe(false);
    });

    it('point-blank blast deals full composite damage (7 pellets * 2.0 = 14.0) to a massive enemy', () => {
      const bossEnemy = new AdversarialTarget('boss_target', 105, 100, 'TETSUYUKI_BOSS');
      bossEnemy.health = 50.0;

      ShotgunWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      const pellets = engine.getAllEntities().filter(
        (e) => e instanceof ShotgunPelletProjectile
      ) as ShotgunPelletProjectile[];

      for (const pellet of pellets) {
        pellet.onCollision(bossEnemy, engine);
      }

      expect(bossEnemy.hitCount).toBe(7);
      expect(bossEnemy.totalDamageReceived).toBe(14.0);
      expect(bossEnemy.health).toBe(50.0 - 14.0);
      // All 7 pellets terminated upon hit
      expect(pellets.every((p) => !p.isAlive)).toBe(true);
    });
  });

  // =========================================================================
  // FOCUS 2: Laser Continuous Piercing Beam and Duplicate Tick Immunity
  // =========================================================================
  describe('Focus 2: Laser continuous piercing beam & duplicate tick immunity', () => {
    it('pierces continuously through an entire line of enemies without dying', () => {
      const enemies: AdversarialTarget[] = [];
      for (let i = 0; i < 8; i++) {
        const e = new AdversarialTarget(`convoy_${i}`, 150 + i * 40, 100);
        enemies.push(e);
        engine.addEntity(e);
      }

      const laser = LaserGunWeapon.fire(vec2(100, 100), vec2(1, 0), 1, engine);
      expect(laser.velocity.x).toBe(1200.0);
      expect(laser.pierces).toBe(true);

      for (const enemy of enemies) {
        laser.onCollision(enemy, engine);
        expect(enemy.hitCount).toBe(1);
        expect(enemy.lastDamage).toBe(1.2);
        expect(laser.isAlive).toBe(true); // Continues living
      }

      expect(laser.isAlive).toBe(true);
    });

    it('rigorously enforces 0.1s tick immunity window frame-by-frame', () => {
      const boss = new AdversarialTarget('boss_immune', 120, 100, 'ENEMY_HEAVY');
      const laser = new LaserBeamProjectile('laser_tick_test', vec2(100, 100), vec2(1200, 0), 1, 1.2);

      // Tick 0: Initial hit
      laser.onCollision(boss, engine);
      expect(boss.hitCount).toBe(1);
      expect(boss.totalDamageReceived).toBe(1.2);

      // Frames 1 through 6 (0.0167s to 0.1000s): strictly immune!
      for (let f = 1; f <= 6; f++) {
        laser.update(1 / 60, engine);
        laser.onCollision(boss, engine);
        expect(boss.hitCount).toBe(1); // Blocked
        expect(boss.totalDamageReceived).toBe(1.2);
      }

      // Frame 7: reaches > 0.1s elapsed, immunity expires -> new hit must register!
      laser.update(1 / 60, engine);
      laser.onCollision(boss, engine);
      expect(boss.hitCount).toBe(2);
      expect(boss.totalDamageReceived).toBeCloseTo(2.4, 4);

      // Immediate subsequent hit in same frame or next frame is immune again
      laser.update(1 / 60, engine);
      laser.onCollision(boss, engine);
      expect(boss.hitCount).toBe(2);
    });

    it('maintains independent tick immunity timers per entity', () => {
      const enemyA = new AdversarialTarget('target_A', 120, 100);
      const enemyB = new AdversarialTarget('target_B', 160, 100);

      const laser = new LaserBeamProjectile('laser_multi_immune', vec2(100, 100), vec2(1200, 0), 1, 1.2);

      // Hit A at t=0
      laser.onCollision(enemyA, engine);
      expect(enemyA.hitCount).toBe(1);
      expect(enemyB.hitCount).toBe(0);

      // Advance 3 frames (0.05s)
      for (let f = 0; f < 3; f++) laser.update(1 / 60, engine);

      // Now hit B at t=0.05s -> B must be damaged!
      laser.onCollision(enemyB, engine);
      expect(enemyB.hitCount).toBe(1);

      // A is still within 0.1s immunity (0.05s elapsed < 0.1s)
      laser.onCollision(enemyA, engine);
      expect(enemyA.hitCount).toBe(1); // A still immune

      // Advance 4 more frames (total 0.1167s for A, but only 0.0667s for B)
      for (let f = 0; f < 4; f++) laser.update(1 / 60, engine);

      // A's immunity expired -> can be hit
      laser.onCollision(enemyA, engine);
      expect(enemyA.hitCount).toBe(2);

      // B's immunity NOT yet expired -> blocked
      laser.onCollision(enemyB, engine);
      expect(enemyB.hitCount).toBe(1);
    });
  });

  // =========================================================================
  // FOCUS 3: Rocket Blast Falloff at Exact Boundaries
  // =========================================================================
  describe('Focus 3: Rocket blast falloff at exact boundaries (0px, 24px, 47.9px, 48.0px, 48.1px)', () => {
    it('verifies exact mathematical blast damage falloff at each boundary distance', () => {
      const rocketOrigin = vec2(200, 200);

      // Test points:
      // 0.0px -> 100% damage = 8.0
      // 24.0px -> 50% damage = 4.0
      // 47.9px -> (1 - 47.9/48) = 0.1/48 * 8 = 1/60 ≈ 0.0166667 > 0
      // 48.0px -> (1 - 48.0/48) = 0 * 8 = 0.0
      // 48.1px -> dist > blastRadius (48.0px) -> outside radius, 0 damage / not hit
      const testCases = [
        { dist: 0.0, expectedHit: true, expectedDamage: 8.0, desc: 'dist = 0px (100% damage)' },
        { dist: 24.0, expectedHit: true, expectedDamage: 4.0, desc: 'dist = 24px (50% damage)' },
        { dist: 47.9, expectedHit: true, expectedDamage: 8.0 * (1 - 47.9 / 48.0), desc: 'dist = 47.9px (>0 damage)' },
        { dist: 48.0, expectedHit: true, expectedDamage: 0.0, desc: 'dist = 48.0px (0 damage)' },
        { dist: 48.1, expectedHit: false, expectedDamage: 0.0, desc: 'dist = 48.1px (0 damage / unaffected)' },
        { dist: 60.0, expectedHit: false, expectedDamage: 0.0, desc: 'dist = 60.0px (outside AOE)' },
      ];

      for (const tc of testCases) {
        const freshEngine = new GameEngine();
        const target = new AdversarialTarget(`target_dist_${tc.dist}`, rocketOrigin.x + tc.dist, rocketOrigin.y);
        freshEngine.addEntity(target);

        // Put in engine map & spatial grid
        (freshEngine as any).entities.set(target.id, target);
        freshEngine.spatialGrid.insert(target);

        const rocket = new PlayerRocketProjectile('rocket_test', rocketOrigin, vec2(1, 0), 1);
        rocket.detonate(freshEngine);

        if (tc.expectedHit) {
          expect(target.hitCount, `Failed for ${tc.desc}`).toBe(1);
          expect(target.lastDamage, `Failed damage for ${tc.desc}`).toBeCloseTo(tc.expectedDamage, 4);
          if (tc.dist === 47.9) {
            expect(target.lastDamage).toBeGreaterThan(0.0);
          } else if (tc.dist === 48.0) {
            expect(target.lastDamage).toBe(0.0);
          }
        } else {
          expect(target.hitCount, `Expected no hit for ${tc.desc}`).toBe(0);
          expect(target.lastDamage, `Expected 0 damage for ${tc.desc}`).toBe(0.0);
          expect(target.health, `Expected health untouched for ${tc.desc}`).toBe(100.0);
        }
      }
    });

    it('verifies radial symmetry in all 4 cardinal directions at half radius (24px)', () => {
      const rocketPos = vec2(300, 300);
      const offsets = [
        { name: '+X (East)', pos: vec2(324, 300) },
        { name: '-X (West)', pos: vec2(276, 300) },
        { name: '+Y (South)', pos: vec2(300, 324) },
        { name: '-Y (North)', pos: vec2(300, 276) },
      ];

      for (const off of offsets) {
        const testEngine = new GameEngine();
        const target = new AdversarialTarget(`target_${off.name}`, off.pos.x, off.pos.y);
        testEngine.addEntity(target);
        (testEngine as any).entities.set(target.id, target);
        testEngine.spatialGrid.insert(target);

        const rocket = new PlayerRocketProjectile('rocket_cardinal', rocketPos, vec2(1, 0), 1);
        rocket.detonate(testEngine);

        expect(target.hitCount).toBe(1);
        expect(target.lastDamage).toBeCloseTo(4.0, 4);
      }
    });
  });

  // =========================================================================
  // FOCUS 4: Shield 2-Hit Damage Absorption and Depletion
  // =========================================================================
  describe('Focus 4: Shield 2-hit damage absorption and depletion', () => {
    it('absorbs exactly 2 hits of damage regardless of attack magnitude, then depletes', () => {
      const player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);

      expect(player.shieldCharges).toBe(0);
      player.health = 1.0;
      player.lives = 3;

      // Apply Shield pickup
      weaponManager.applyItemPickup(ItemDropType.SHIELD, engine, player);
      expect(player.shieldCharges).toBe(2);

      // Track event bus emissions
      const emittedEvents: Array<{ event: string; data: any }> = [];
      engine.eventBus.on('shield_hit', (data) => emittedEvents.push({ event: 'shield_hit', data }));
      engine.eventBus.on('play_sound', (data) => emittedEvents.push({ event: 'play_sound', data }));

      // HIT 1: Absorb massive 999 damage
      player.takeDamage(999.0, engine);
      expect(player.health).toBe(1.0); // Zero health loss!
      expect(player.lives).toBe(3);
      expect(player.shieldCharges).toBe(1);
      expect(emittedEvents.some((e) => e.event === 'shield_hit' && e.data.remainingCharges === 1)).toBe(true);

      // Clear invulnerability timer
      (player as any).invulnerabilityTimer = 0;

      // HIT 2: Absorb second hit
      player.takeDamage(50.0, engine);
      expect(player.health).toBe(1.0); // Zero health loss!
      expect(player.lives).toBe(3);
      expect(player.shieldCharges).toBe(0);
      expect(emittedEvents.some((e) => e.event === 'shield_hit' && e.data.remainingCharges === 0)).toBe(true);
      expect(emittedEvents.some((e) => e.event === 'play_sound' && e.data.sound === 'sfx_shield_break')).toBe(true);

      // Clear invulnerability timer
      (player as any).invulnerabilityTimer = 0;

      // HIT 3: Shield depleted -> takes real health damage!
      player.takeDamage(1.0, engine);
      expect(player.lives).toBe(2); // Lethal hit consumes 1 life!
    });

    it('refreshes shield charges back to 2 upon collecting another Shield pickup', () => {
      const player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);

      weaponManager.applyItemPickup(ItemDropType.SHIELD, engine, player);
      expect(player.shieldCharges).toBe(2);

      // Consume 1 charge
      player.takeDamage(1.0, engine);
      expect(player.shieldCharges).toBe(1);

      // Pick up another Shield
      weaponManager.applyItemPickup(ItemDropType.SHIELD, engine, player);
      expect(player.shieldCharges).toBe(2); // Refreshed back to full charges
    });
  });

  // =========================================================================
  // FOCUS 5: Medkit HP Restoration up to Max HP and Extra Lives
  // =========================================================================
  describe('Focus 5: Medkit HP restoration up to max HP and extra lives', () => {
    it('restores health to maxHealth when damaged (partial HP), without incrementing lives', () => {
      const player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);

      player.health = 0.25;
      player.maxHealth = 1.0;
      player.lives = 3;

      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(3);

      // Test with tiny HP fraction (0.01)
      player.health = 0.01;
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(3);
    });

    it('grants +1 extra life each time when collected at full health', () => {
      const player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);

      player.health = 1.0;
      player.maxHealth = 1.0;
      player.lives = 3;

      // Medkit 1 at full HP
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(4);

      // Medkit 2 at full HP
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(5);

      // Medkit 3 at full HP
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(player.health).toBe(1.0);
      expect(player.lives).toBe(6);
    });

    it('emits award_score and plays sfx_item_pickup upon Medkit collection', () => {
      const player = new PlayerController(vec2(100, 150));
      engine.addEntity(player);

      let scoreAwarded = 0;
      let soundPlayed = '';
      engine.eventBus.on('award_score', (data: any) => { scoreAwarded = data.score; });
      engine.eventBus.on('play_sound', (data: any) => { soundPlayed = data.sound; });
      weaponManager.applyItemPickup(ItemDropType.MEDKIT, engine, player);
      expect(scoreAwarded).toBe(1000);
      expect(soundPlayed).toBe('sfx_item_pickup');
    });
  });

  // =========================================================================
  // ADDITIONAL ADVERSARIAL EDGE CASES
  // =========================================================================
  describe('Additional Adversarial Edge Cases', () => {
    it('laser terminates immediately on SOLID platform but passes through ONE_WAY platform', () => {
      engine.addPlatform({
        id: 'solid_wall',
        type: 'SOLID',
        bounds: createAABB(200, 50, 20, 100),
      });
      engine.addPlatform({
        id: 'oneway_plat',
        type: 'SEMI_SOLID',
        bounds: createAABB(120, 50, 20, 100),
      });

      // Laser fires from (100, 80) heading right
      const laser = LaserGunWeapon.fire(vec2(100, 80), vec2(1, 0), 1, engine);
      expect(laser.isAlive).toBe(true);

      // Advance through SEMI_SOLID platform
      for (let i = 0; i < 2; i++) {
        laser.update(1 / 60, engine); // moves 20px per frame (speed 1200 / 60)
      }
      expect(laser.position.x).toBeGreaterThan(120);
      expect(laser.isAlive).toBe(true); // SEMI_SOLID didn't block it!

      // Advance until hitting SOLID wall at X=200
      for (let i = 0; i < 6; i++) {
        laser.update(1 / 60, engine);
      }
      expect(laser.isAlive).toBe(false); // SOLID platform destroyed it!
    });

    it('rocket detonates and damages adjacent enemies upon hitting a SOLID platform', () => {
      engine.addPlatform({
        id: 'blast_wall',
        type: 'SOLID',
        bounds: createAABB(150, 50, 20, 100),
      });

      const nearWallEnemy = new AdversarialTarget('wall_enemy', 140, 80);
      engine.addEntity(nearWallEnemy);
      (engine as any).entities.set(nearWallEnemy.id, nearWallEnemy);
      engine.spatialGrid.insert(nearWallEnemy);

      const rocket = RocketLauncherWeapon.fire(vec2(100, 80), vec2(1, 0), 1, engine);
      expect(rocket.isAlive).toBe(true);

      // Step until rocket hits the solid wall at X=150
      for (let i = 0; i < 20; i++) {
        if (!rocket.isAlive) break;
        rocket.update(1 / 60, engine);
      }

      expect(rocket.isAlive).toBe(false); // Detonated on wall!
      expect(nearWallEnemy.hitCount).toBe(1); // Caught in blast!
      expect(nearWallEnemy.lastDamage).toBeGreaterThan(0);
    });

    it('all expansion weapons automatically revert to PISTOL when ammo is exhausted', () => {
      // 1. Shotgun depletion
      weaponManager.acquireWeapon('SHOTGUN', 1, engine);
      expect(weaponManager.getActiveWeapon()).toBe('SHOTGUN');
      expect(weaponManager.getAmmo()).toBe(1);
      weaponManager.tryFire(vec2(100, 100), vec2(1, 0), 1, engine, true, false);
      expect(weaponManager.getActiveWeapon()).toBe('PISTOL');

      // 2. Laser depletion
      weaponManager.acquireWeapon('LASER_GUN', 1, engine);
      expect(weaponManager.getActiveWeapon()).toBe('LASER_GUN');
      expect(weaponManager.getAmmo()).toBe(1);
      weaponManager.tryFire(vec2(100, 100), vec2(1, 0), 1, engine, true, false);
      expect(weaponManager.getActiveWeapon()).toBe('PISTOL');

      // 3. Rocket depletion
      weaponManager.acquireWeapon('ROCKET_LAUNCHER', 1, engine);
      expect(weaponManager.getActiveWeapon()).toBe('ROCKET_LAUNCHER');
      expect(weaponManager.getAmmo()).toBe(1);
      weaponManager.tryFire(vec2(100, 100), vec2(1, 0), 1, engine, true, false);
      expect(weaponManager.getActiveWeapon()).toBe('PISTOL');
    });

    it('friendly entities (PLAYER, ALLY_NPC, ALLY_PROJECTILE) are strictly immune to player weapon projectiles and blast', () => {
      const player = new PlayerController(vec2(100, 100));
      player.health = 1.0;

      const mockAlly: GameEntity = {
        id: 'ally_companion',
        type: 'ALLY_NPC',
        position: vec2(100, 100),
        velocity: vec2(0, 0),
        bounds: createAABB(90, 80, 20, 40),
        isAlive: true,
        update: () => {},
        onCollision: () => {},
      };

      // Shotgun pellet check
      const pellet = new ShotgunPelletProjectile('p_safe', vec2(100, 100), vec2(680, 0), 1, 2.0);
      pellet.onCollision(player, engine);
      pellet.onCollision(mockAlly, engine);
      expect(pellet.isAlive).toBe(true); // Ignored friendly entities
      expect(player.health).toBe(1.0);

      // Laser beam check
      const laser = new LaserBeamProjectile('l_safe', vec2(100, 100), vec2(1200, 0), 1, 1.2);
      laser.onCollision(player, engine);
      laser.onCollision(mockAlly, engine);
      expect(laser.isAlive).toBe(true);
      expect(player.health).toBe(1.0);

      // Rocket blast check
      const rocket = new PlayerRocketProjectile('r_safe', vec2(100, 100), vec2(1, 0), 1);
      engine.addEntity(player);
      engine.addEntity(mockAlly);
      (engine as any).entities.set(player.id, player);
      (engine as any).entities.set(mockAlly.id, mockAlly);
      engine.spatialGrid.insert(player);
      engine.spatialGrid.insert(mockAlly);

      rocket.detonate(engine);
      expect(player.health).toBe(1.0); // Completely unharmed by blast!
    });
  });
});

