import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { DestructibleObstacle } from '../../src/core/entities/obstacles/DestructibleObstacle';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { PlayerController } from '../../src/core/player/PlayerController';
import { FullMetalSlugGame } from '../../src/main';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { Camera } from '../../src/render/Camera';

describe('CHALLENGER_M2_OVERHAUL_2: Destructible Obstacles, Mid-Boss Patrol & Invariant Suite', () => {

  describe('1. DestructibleObstacle Health Depletion & Bullet Absorption', () => {
    let engine: GameEngine;

    beforeEach(() => {
      engine = new GameEngine();
      engine.start();
    });

    it('EMPIRICAL DEPLETION: Gradual multi-hit damage correctly depletes health and disables obstacle', () => {
      const obstacle = new DestructibleObstacle(
        'sandbag_deplete',
        'SANDBAG_BARRICADE',
        vec2(200, 216),
        28,
        14,
        { health: 20 }
      );
      engine.addEntity(obstacle);
      engine.tick(1 / 60);

      expect(obstacle.health).toBe(20);
      expect(obstacle.isAlive).toBe(true);

      // Hit 10 times with 2 damage each
      for (let i = 1; i <= 9; i++) {
        obstacle.takeDamage(2, engine);
        expect(obstacle.health).toBe(20 - i * 2);
        expect(obstacle.isAlive).toBe(true);
      }

      // 10th hit reduces HP from 2 to 0 -> destroyed
      obstacle.takeDamage(2, engine);
      expect(obstacle.health).toBe(0);
      expect(obstacle.isAlive).toBe(false);

      // Subsequent damage to dead obstacle must not reduce HP below 0 or throw
      obstacle.takeDamage(5, engine);
      expect(obstacle.health).toBe(0);
      expect(obstacle.isAlive).toBe(false);
    });

    it('EMPIRICAL OVERKILL: Massive overkill damage clamps health at 0 and destroys cleanly', () => {
      const obstacle = new DestructibleObstacle(
        'crate_overkill',
        'SUPPLY_CRATE',
        vec2(300, 160),
        18,
        18,
        { health: 8 }
      );
      engine.addEntity(obstacle);
      engine.tick(1 / 60);

      // Overkill hit of 100 damage against 8 HP
      obstacle.takeDamage(100, engine);
      expect(obstacle.health).toBe(0);
      expect(obstacle.isAlive).toBe(false);
    });

    it('EMPIRICAL BULLET ABSORPTION: Non-piercing bullets are absorbed and killed, piercing bullets survive', () => {
      const obstacle = new DestructibleObstacle(
        'sandbag_absorb',
        'SANDBAG_BARRICADE',
        vec2(250, 216),
        28,
        14,
        { health: 30 }
      );
      engine.addEntity(obstacle);

      // Non-piercing projectile (standard pistol/HMG)
      const normalBullet = {
        id: 'bullet_normal',
        type: 'PROJECTILE',
        bounds: createAABB(255, 220, 4, 4),
        isAlive: true,
        damage: 1,
        pierces: false,
      } as any;

      obstacle.onCollision(normalBullet, engine);
      expect(obstacle.health).toBe(29);
      expect(normalBullet.isAlive).toBe(false); // ABSORPTION: bullet consumed

      // Piercing projectile (laser / flame / ultimate)
      const piercingBullet = {
        id: 'bullet_pierce',
        type: 'PROJECTILE',
        bounds: createAABB(255, 220, 4, 4),
        isAlive: true,
        damage: 5,
        pierces: true,
      } as any;

      obstacle.onCollision(piercingBullet, engine);
      expect(obstacle.health).toBe(24);
      expect(piercingBullet.isAlive).toBe(true); // PIERCING: bullet survives
    });

    it('EMPIRICAL GRENADE DETONATION: Grenade detonates immediately on obstacle contact', () => {
      const obstacle = new DestructibleObstacle(
        'barrel_grenade',
        'EXPLOSIVE_BARREL',
        vec2(400, 200),
        16,
        18,
        { health: 20 }
      );
      engine.addEntity(obstacle);

      let detonationTriggered = false;
      const mockGrenade = {
        id: 'grenade_test',
        type: 'GRENADE',
        bounds: createAABB(402, 205, 8, 8),
        isAlive: true,
        detonate: (eng: GameEngine) => {
          detonationTriggered = true;
          expect(eng).toBe(engine);
        },
      } as any;

      obstacle.onCollision(mockGrenade, engine);
      expect(detonationTriggered).toBe(true);
      expect(obstacle.health).toBe(10); // 20 - 10 grenade damage = 10
    });
  });

  describe('2. Supply Crate Drops & Item Pickup Lifecycle', () => {
    let engine: GameEngine;

    beforeEach(() => {
      engine = new GameEngine();
      engine.start();
    });

    it('EMPIRICAL CRATE DROPS: Various item types drop correctly with initial upward velocity', () => {
      const testDropTypes = [
        ItemDropType.WEAPON_HMG,
        ItemDropType.WEAPON_SHOTGUN,
        ItemDropType.WEAPON_FLAME,
        ItemDropType.SCORE_CHICKEN,
      ];

      for (const dropType of testDropTypes) {
        const crateId = `crate_${dropType}`;
        const crate = new DestructibleObstacle(
          crateId,
          'SUPPLY_CRATE',
          vec2(100, 150),
          18,
          18,
          { health: 5, dropItem: dropType }
        );
        engine.addEntity(crate);
        engine.tick(1 / 60);

        crate.takeDamage(5, engine);
        expect(crate.isAlive).toBe(false);

        // Step engine to process entity addition
        engine.tick(1 / 60);

        const droppedEntity = engine.getEntity(`drop_${crateId}`) as any;
        expect(droppedEntity).toBeDefined();
        expect(droppedEntity.dropType).toBe(dropType);
        expect(droppedEntity.position.x).toBe(100 + 18 / 2);
        // Ascended slightly from y = 150 due to initial upward velocity vy = -120
        expect(droppedEntity.position.y).toBeLessThanOrEqual(150);
        expect(droppedEntity.velocity.y).toBeLessThan(0);

        // Clean up entity for next iteration
        engine.removeEntity(droppedEntity.id);
      }
    });

    it('EMPIRICAL ITEM CONSUMPTION: Player collects dropped weapon pickup and updates inventory', () => {
      const player = new PlayerController(vec2(150, 200));
      engine.addEntity(player);

      const crate = new DestructibleObstacle(
        'crate_collect',
        'SUPPLY_CRATE',
        vec2(250, 190), // Spaced apart so narrowphase doesn't touch player before collection
        18,
        18,
        { health: 1, dropItem: ItemDropType.WEAPON_HMG }
      );
      engine.addEntity(crate);
      engine.tick(1 / 60);

      // Verify player initial weapon is PISTOL with 0 HMG ammo
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');
      expect(player.weaponManager.getAmmo('HEAVY_MACHINE_GUN')).toBe(0);

      // Destroy crate -> drops HMG
      crate.takeDamage(1, engine);
      engine.tick(1 / 60);

      const drop = engine.getEntity('drop_crate_collect') as any;
      expect(drop).toBeDefined();

      // Trigger player pickup collision directly
      player.onCollision(drop, engine);

      // Verify weapon upgraded to HMG with exactly 200 ammo
      expect(player.weaponManager.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');
      expect(player.weaponManager.getAmmo('HEAVY_MACHINE_GUN')).toBe(200);
      expect(drop.isAlive).toBe(false);
    });
  });

  describe('3. Explosive Barrel Blast Radius (54px) & Damage (10) Mathematical Oracle', () => {
    let engine: GameEngine;

    beforeEach(() => {
      engine = new GameEngine();
      engine.start();
    });

    it('EMPIRICAL BLAST ORACLE: Precise Euclidean boundary verification (53.9px inside vs 54.1px outside)', () => {
      const barrelPos = vec2(500, 200);
      const barrelWidth = 16;
      const barrelHeight = 18;
      const barrelCenterX = barrelPos.x + barrelWidth / 2; // 508
      const barrelCenterY = barrelPos.y + barrelHeight / 2; // 209

      const barrel = new DestructibleObstacle(
        'barrel_oracle',
        'EXPLOSIVE_BARREL',
        barrelPos,
        barrelWidth,
        barrelHeight,
        { health: 10, blastRadius: 54, blastDamage: 10 }
      );
      engine.addEntity(barrel);

      // Soldier dimensions: width = 24, height = 38
      // Soldier center offset: +12, +19
      const soldierHalfW = 12;
      const soldierHalfH = 19;

      // Helper to position stationary soldier whose center is at exact Euclidean distance from barrel center
      const createStationarySoldierAtDist = (id: string, dist: number, angleRad: number): SoldierEnemy => {
        const targetCenterX = barrelCenterX + Math.cos(angleRad) * dist;
        const targetCenterY = barrelCenterY + Math.sin(angleRad) * dist;
        const soldier = new SoldierEnemy(
          id,
          'SOLDIER_RIFLE',
          vec2(targetCenterX - soldierHalfW, targetCenterY - soldierHalfH),
          { walkSpeed: 0 }
        );
        soldier.health = 20;
        (soldier as any).gravity = 0; // Freeze vertical gravity drift for geometric precision
        (soldier as any).velocity.x = 0;
        (soldier as any).velocity.y = 0;
        return soldier;
      };

      // Test cases with extreme boundary precision:
      // dist 0 (direct hit), 27 (midway), 53.0 (inside), 53.9 (just inside), 54.0 (exact boundary) -> MUST TAKE 10 DAMAGE
      // dist 54.1 (just outside), 55.0 (outside), 80.0 (far outside) -> MUST TAKE 0 DAMAGE
      const testCases = [
        { id: 's_dist_0', dist: 0.0, angle: 0, expectHit: true },
        { id: 's_dist_27', dist: 27.0, angle: Math.PI / 4, expectHit: true },
        { id: 's_dist_53', dist: 53.0, angle: Math.PI / 2, expectHit: true },
        { id: 's_dist_53_9', dist: 53.9, angle: (3 * Math.PI) / 4, expectHit: true },
        { id: 's_dist_54_0', dist: 54.0, angle: Math.PI, expectHit: true },
        { id: 's_dist_54_1', dist: 54.1, angle: -(3 * Math.PI) / 4, expectHit: false },
        { id: 's_dist_55', dist: 55.0, angle: -Math.PI / 2, expectHit: false },
        { id: 's_dist_80', dist: 80.0, angle: -Math.PI / 4, expectHit: false },
      ];

      const soldiers: SoldierEnemy[] = [];
      for (const tc of testCases) {
        const soldier = createStationarySoldierAtDist(tc.id, tc.dist, tc.angle);
        engine.addEntity(soldier);
        soldiers.push(soldier);
      }

      // Flush additions into engine without stepping physics simulation
      const eng = engine as any;
      for (const entity of eng.entitiesToAdd) {
        eng.entities.set(entity.id, entity);
        eng.spatialGrid.insert(entity);
      }
      eng.entitiesToAdd = [];

      // Trigger barrel explosion
      barrel.takeDamage(10, engine);
      expect(barrel.isAlive).toBe(false);
      expect(barrel.isExploded).toBe(true);

      // Verify each soldier's resulting HP
      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        const s = soldiers[i];
        if (tc.expectHit) {
          expect(s.health).toBe(10); // 20 - 10 damage = 10
        } else {
          expect(s.health).toBe(20); // 0 damage received (retains 20 HP)
        }
      }
    });

    it('EMPIRICAL CHAIN REACTION: Adjacent explosive barrels cascade into secondary explosions', () => {
      // Barrel A at x = 100, Barrel B at x = 135 (dist 35px <= 54px), Barrel C at x = 170 (dist 35px from B)
      const barrelA = new DestructibleObstacle('barrel_A', 'EXPLOSIVE_BARREL', vec2(100, 200), 16, 18, { health: 10, blastRadius: 54, blastDamage: 10 });
      const barrelB = new DestructibleObstacle('barrel_B', 'EXPLOSIVE_BARREL', vec2(135, 200), 16, 18, { health: 10, blastRadius: 54, blastDamage: 10 });
      const barrelC = new DestructibleObstacle('barrel_C', 'EXPLOSIVE_BARREL', vec2(170, 200), 16, 18, { health: 10, blastRadius: 54, blastDamage: 10 });

      engine.addEntity(barrelA);
      engine.addEntity(barrelB);
      engine.addEntity(barrelC);

      const farEnemy = new SoldierEnemy('far_enemy', 'SOLDIER_RIFLE', vec2(205, 192));
      farEnemy.health = 20;
      engine.addEntity(farEnemy);

      // Flush additions and bind engine references as in active game loop
      const eng = engine as any;
      for (const entity of eng.entitiesToAdd) {
        eng.entities.set(entity.id, entity);
        eng.spatialGrid.insert(entity);
        (entity as any).engineRef = engine;
      }
      eng.entitiesToAdd = [];

      let explosionsSpawned = 0;
      engine.eventBus.on('explosion_spawned', () => {
        explosionsSpawned++;
      });

      // Detonate ONLY Barrel A
      barrelA.takeDamage(10, engine);

      // All 3 barrels must have exploded through chain cascade
      expect(barrelA.isAlive).toBe(false);
      expect(barrelB.isAlive).toBe(false);
      expect(barrelC.isAlive).toBe(false);
      expect(explosionsSpawned).toBe(3);

      // The far enemy, which was only reachable via Barrel C, must have taken blast damage!
      expect(farEnemy.health).toBe(10);
    });
  });

  describe('4. Mid-Boss Patrol Range & 1100px Arena Camera Bounds', () => {
    let game: FullMetalSlugGame;

    beforeEach(() => {
      game = new FullMetalSlugGame();
    });

    it('EMPIRICAL ARENA AUDIT: Stage 1 mid-boss trigger configures exactly 1100px camera lockdown arena', () => {
      const stageData = game.buildStage1Data();
      const trigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');
      expect(trigger).toBeDefined();
      expect(trigger!.lockCameraBounds).toBeDefined();

      const { minX, maxX } = trigger!.lockCameraBounds!;
      expect(minX).toBe(720);
      expect(maxX).toBe(1820);
      expect(maxX - minX).toBe(1100); // Strictly 1100px arena
    });

    it('EMPIRICAL MID-BOSS RANGE: Mid-Boss patrols up to 1650 and stays strictly within [720, 1820] arena bounds', () => {
      const midBoss = new MidBossVehicle('mb_test', vec2(1050, 162), {
        customHp: 400,
        patrolMinX: 800,
        patrolMaxX: 1650,
      });

      expect(midBoss.width).toBe(130);

      // Run 2,400 ticks (40 seconds of gameplay) in Phase 1 (Patrol)
      let minObservedX = Infinity;
      let maxObservedX = -Infinity;
      let minObservedBoundX = Infinity;
      let maxObservedBoundX = -Infinity;

      for (let tick = 0; tick < 2400; tick++) {
        midBoss.update(1 / 60);

        minObservedX = Math.min(minObservedX, midBoss.position.x);
        maxObservedX = Math.max(maxObservedX, midBoss.position.x);
        minObservedBoundX = Math.min(minObservedBoundX, midBoss.bounds.x);
        maxObservedBoundX = Math.max(maxObservedBoundX, midBoss.bounds.x + midBoss.bounds.width);

        // Invariant: At EVERY tick, midBoss must be within camera bounds [720, 1820]
        expect(midBoss.bounds.x).toBeGreaterThanOrEqual(720);
        expect(midBoss.bounds.x + midBoss.bounds.width).toBeLessThanOrEqual(1820);
      }

      // Assert that mid-boss actually exercises its full patrol span
      expect(minObservedX).toBeLessThanOrEqual(800);
      expect(maxObservedX).toBeGreaterThanOrEqual(1650);

      // Leftmost edge reached >= 720
      expect(minObservedBoundX).toBeGreaterThanOrEqual(720);
      // Rightmost edge reached <= 1820 (1650 + 130 = 1780, with sub-pixel Euler step <= 1781 <= 1820)
      expect(maxObservedBoundX).toBeGreaterThanOrEqual(1780);
      expect(maxObservedBoundX).toBeLessThanOrEqual(1782);
      expect(maxObservedBoundX).toBeLessThanOrEqual(1820);
    });

    it('EMPIRICAL CAMERA CLAMP: Camera tracking in 1100px arena never scrolls past minX: 720 or maxX: 1820', () => {
      const camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
      camera.lock({ minX: 720, maxX: 1820, minY: 0, maxY: 540 });

      // Player positions from 0 to 3000 across the stage
      for (let px = 0; px <= 3000; px += 25) {
        camera.update(px, 200, 1 / 60);

        // Camera top-left X must be clamped to [720, 1820 - 960] = [720, 860]
        expect(camera.x).toBeGreaterThanOrEqual(720);
        expect(camera.x).toBeLessThanOrEqual(860);

        // Visible right edge of viewport = camera.x + 960 must be <= 1820
        expect(camera.x + camera.viewportWidth).toBeLessThanOrEqual(1820);
        // Visible left edge of viewport = camera.x must be >= 720
        expect(camera.x).toBeGreaterThanOrEqual(720);
      }
    });

    it('EMPIRICAL PHASE 2 & 3 STRESS: Mid-Boss handles phase transitions and ramming bounds', () => {
      const midBoss = new MidBossVehicle('mb_stress', vec2(1050, 162), {
        customHp: 400,
        patrolMinX: 800,
        patrolMaxX: 1650,
      });

      // Fast-forward to Phase 2 (HP <= 240)
      midBoss.takeDamage(165); // 400 - 165 = 235 HP
      // Run through Gate 1
      for (let i = 0; i < 90; i++) midBoss.update(1 / 60);
      expect(midBoss.phase).toBe('PHASE_2_MORTAR');

      // Fast-forward to Phase 3 (HP <= 80)
      midBoss.takeDamage(160); // 235 - 160 = 75 HP
      // Run through Gate 2
      for (let i = 0; i < 90; i++) midBoss.update(1 / 60);
      expect(midBoss.phase).toBe('PHASE_3_RAMMING');

      // Check ramming bounds over 600 ticks
      for (let i = 0; i < 600; i++) {
        midBoss.update(1 / 60);
        expect(Number.isFinite(midBoss.position.x)).toBe(true);
        expect(Number.isFinite(midBoss.position.y)).toBe(true);
        expect(Number.isFinite(midBoss.turretAngle)).toBe(true);
      }
    });
  });

  describe('5. Regression Verification of Critical Invariants', () => {
    it('verifies stage 1 static obstacles exist in production diverse mode', () => {
      const game = new FullMetalSlugGame(undefined, { spawnMode: 'diverse' });
      const obstacles = game.engine.getAllEntities().filter((e) => e instanceof DestructibleObstacle);

      expect(obstacles.length).toBe(11);
      const sandbags = obstacles.filter((o: any) => o.obstacleType === 'SANDBAG_BARRICADE');
      const crates = obstacles.filter((o: any) => o.obstacleType === 'SUPPLY_CRATE');
      const barrels = obstacles.filter((o: any) => o.obstacleType === 'EXPLOSIVE_BARREL');

      expect(sandbags.length).toBe(7);
      expect(crates.length).toBe(2);
      expect(barrels.length).toBe(2);
    });

    it('strictly verifies boss_arena_left coordinate invariant (1860, 170, 100, 12)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const bossPlat = stageData.platforms.find((p) => p.id === 'boss_arena_left');

      expect(bossPlat).toBeDefined();
      expect(bossPlat!.bounds.x).toBe(1860);
      expect(bossPlat!.bounds.y).toBe(170);
      expect(bossPlat!.bounds.width).toBe(100);
      expect(bossPlat!.bounds.height).toBe(12);
      expect(bossPlat!.type).toBe('SEMI_SOLID');
    });

    it('verifies ground line base remains continuous at Y = 230 across all 5 zones', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const groundPlatforms = stageData.platforms.filter((p) => p.id.startsWith('ground_'));

      expect(groundPlatforms.length).toBeGreaterThanOrEqual(5);
      for (const gp of groundPlatforms) {
        expect(gp.bounds.y).toBe(230);
        expect(gp.type).toBe('SOLID');
      }
    });
  });
});
