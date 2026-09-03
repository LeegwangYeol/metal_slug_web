import { describe, it, expect } from 'vitest';
import { GameEngine, GameEntity } from '../../src/core/engine/GameEngine';
import { PlayerController } from '../../src/core/player/PlayerController';
import {
  PlayerActionState,
  PlayerInputSnapshot,
} from '../../src/core/player/PlayerKinematics';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { vec2, Vector2D } from '../../src/core/math/Vector2D';
import { AABB, createAABB } from '../../src/core/physics/AABB';
import { SpatialGrid } from '../../src/core/physics/SpatialGrid';

function makeInput(overrides: Partial<PlayerInputSnapshot> = {}): PlayerInputSnapshot {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpPressed: false,
    jumpHeld: false,
    shootPressed: false,
    shootHeld: false,
    grenadePressed: false,
    ...overrides,
  };
}

/**
 * Stationary test dummy entity with configurable AABB bounds and melee vulnerability.
 */
class StationaryTarget implements GameEntity {
  public position: Vector2D;
  public velocity: Vector2D = { x: 0, y: 0 };
  public bounds: AABB;
  public isAlive: boolean = true;
  public health: number = 100;
  public damageTaken: number = 0;

  constructor(
    public id: string,
    public type: string,
    x: number,
    y: number,
    width: number,
    height: number,
    public isMeleeVulnerable: boolean = true
  ) {
    this.position = { x, y };
    this.bounds = createAABB(x, y, width, height);
  }

  update(): void {
    // Stationary: do not move
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    this.damageTaken += amount;
    if (this.health <= 0) {
      this.isAlive = false;
    }
  }
}

describe('Adversarial Challenge Suite — challenger_1', () => {
  // =========================================================================
  // TASK 1: Melee Boundary Conditions
  // =========================================================================
  describe('Task 1: Melee Boundary Conditions', () => {
    const anchorX = 100;
    const anchorY = 200;

    const setupTest = (targetBounds: AABB, isMeleeVulnerable = true) => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController(vec2(anchorX, anchorY));
      player.facing = 1; // Facing right
      engine.addEntity(player);

      const target = new StationaryTarget(
        'target_1',
        'SOLDIER_RIFLE',
        targetBounds.x,
        targetBounds.y,
        targetBounds.width,
        targetBounds.height,
        isMeleeVulnerable
      );
      engine.addEntity(target);
      engine.tick(); // Register into engine and spatial grid

      // Issue shoot press
      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');

      return {
        player,
        target,
        isAttackingMelee: player.isAttackingMelee,
        actionState: player.actionState,
        projectilesCount: projectiles.length,
        projectileType: projectiles.length > 0 ? (projectiles[0] as any).weaponType : null,
      };
    };

    it('Melee boundary at 37.9px forward: MUST trigger knife slash (0 projectiles)', () => {
      // Player at anchorX = 100. ScanBox forward reach = 38px (x reaches 138).
      // Target nearest edge at 100 + 37.9 = 137.9
      const res = setupTest(createAABB(anchorX + 37.9, anchorY - 30, 20, 30));
      expect(res.isAttackingMelee).toBe(true);
      expect(res.actionState).toBe(PlayerActionState.MELEE_SLASH);
      expect(res.projectilesCount).toBe(0);
    });

    it('Melee boundary at 38.0px forward: Boundary test', () => {
      // Target nearest edge at 100 + 38.0 = 138.0.
      // scanBox.x + scanBox.width = 138.05.
      // BoundingBox.intersects evaluates: scanBox.x + scanBox.width > target.x -> 138.05 > 138.0
      const res = setupTest(createAABB(anchorX + 38.0, anchorY - 30, 20, 30));
      console.log('Empirical result at distance 38.0px:', {
        isAttackingMelee: res.isAttackingMelee,
        projectilesCount: res.projectilesCount,
        actionState: res.actionState,
      });
      // Inclusively within knife scan reach: MUST trigger knife slash
      expect(res.isAttackingMelee).toBe(true);
      expect(res.actionState).toBe(PlayerActionState.MELEE_SLASH);
      expect(res.projectilesCount).toBe(0);
    });

    it('Melee boundary at 38.1px forward: MUST trigger pistol shot (not knife)', () => {
      // Target nearest edge at 100 + 38.1 = 138.1
      const res = setupTest(createAABB(anchorX + 38.1, anchorY - 30, 20, 30));
      expect(res.isAttackingMelee).toBe(false);
      expect(res.projectilesCount).toBe(1);
      expect(res.projectileType).toBe('PISTOL');
    });

    it('Vertical range limits: [-34px, +10px]', () => {
      // anchorY = 200. ScanBox Y range is [200 - 34, 200 + 10] = [166, 210].

      // 1. Just inside top boundary: target bottom edge at 166.1 (33.9px above anchor) -> KNIFE
      const topInside = setupTest(createAABB(anchorX + 20, 166.1 - 20, 20, 20));
      expect(topInside.isAttackingMelee).toBe(true);

      // 2. Just outside top boundary: target bottom edge at 165.9 (34.1px above anchor) -> PISTOL
      const topOutside = setupTest(createAABB(anchorX + 20, 165.9 - 20, 20, 20));
      expect(topOutside.isAttackingMelee).toBe(false);
      expect(topOutside.projectilesCount).toBe(1);

      // 3. Just inside bottom boundary: target top edge at 209.9 (9.9px below anchor) -> KNIFE
      const bottomInside = setupTest(createAABB(anchorX + 20, 209.9, 20, 20));
      expect(bottomInside.isAttackingMelee).toBe(true);

      // 4. Just outside bottom boundary: target top edge at 210.1 (10.1px below anchor) -> PISTOL
      const bottomOutside = setupTest(createAABB(anchorX + 20, 210.1, 20, 20));
      expect(bottomOutside.isAttackingMelee).toBe(false);
      expect(bottomOutside.projectilesCount).toBe(1);
    });

    it('Rear tolerance limits: 6px behind anchor', () => {
      // Facing right (+1): scanBox minX = 100 - 6 = 94.
      // 1. Inside rear reach: target right edge at 94.1 (5.9px behind anchor) -> KNIFE
      const rearInside = setupTest(createAABB(94.1 - 20, anchorY - 20, 20, 20));
      expect(rearInside.isAttackingMelee).toBe(true);

      // 2. Outside rear reach: target right edge at 93.9 (6.1px behind anchor) -> PISTOL
      const rearOutside = setupTest(createAABB(93.9 - 20, anchorY - 20, 20, 20));
      expect(rearOutside.isAttackingMelee).toBe(false);
      expect(rearOutside.projectilesCount).toBe(1);
    });
  });

  // =========================================================================
  // TASK 2: Armored Target Melee Rejection
  // =========================================================================
  describe('Task 2: Armored Target Melee Rejection', () => {
    it('Mid-Boss Iron Technical at point-blank range strictly rejects knife and fires bullets', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController(vec2(100, 200));
      player.facing = 1;
      engine.addEntity(player);

      // Place MidBossVehicle directly next to player at point blank range (x = 105)
      const midBoss = new MidBossVehicle('midboss_armored', { x: 105, y: 150 });
      expect(midBoss.isMeleeVulnerable).toBe(false);
      engine.addEntity(midBoss);
      engine.tick();

      // Point-blank shoot press
      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      // Knife attack must be strictly rejected
      expect(player.isAttackingMelee).toBe(false);
      expect(player.actionState).not.toBe(PlayerActionState.MELEE_SLASH);

      // Projectile must be fired instead
      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
      expect((projectiles[0] as any).weaponType).toBe('PISTOL');
    });

    it('Tetsuyuki Boss at point-blank range strictly rejects knife and fires bullets without monkey-patching', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController(vec2(100, 200));
      player.facing = 1;
      engine.addEntity(player);

      // Place Tetsuyuki Boss overlapping the player knife box
      const boss = new TetsuyukiBoss('tetsuyuki_armored', { x: 105, y: 120 });
      expect(boss.isMeleeVulnerable).toBe(false);
      engine.addEntity(boss);
      engine.tick();

      player.handleInput(makeInput({ shootPressed: true }), 1 / 60, engine);
      engine.tick();

      expect(player.isAttackingMelee).toBe(false);
      expect(player.actionState).not.toBe(PlayerActionState.MELEE_SLASH);

      const projectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      expect(projectiles.length).toBe(1);
    });
  });

  // =========================================================================
  // TASK 3: Rapid Weapon Switching & Ammo Starvation Stress Test
  // =========================================================================
  describe('Task 3: Rapid Weapon Switching & Ammo Starvation', () => {
    it('Continuous high-frequency firing transitioning Pistol -> HMG -> Flame -> 0 ammo -> Pistol fallback', () => {
      const engine = new GameEngine();
      engine.start();
      const player = new PlayerController(vec2(100, 200));
      engine.addEntity(player);
      engine.tick();

      let negativeAmmoObserved = false;
      let droppedFrames = 0;
      let totalFramesRun = 0;

      const checkInvariants = () => {
        const state = player.weaponManager.getWeaponState();
        if (state.ammo < 0) {
          negativeAmmoObserved = true;
        }
        if (Number.isNaN(player.position.x) || Number.isNaN(player.position.y)) {
          droppedFrames++;
        }
      };

      // Phase A: Rapid pistol firing (50 frames)
      for (let i = 0; i < 50; i++) {
        // Semi-auto pistol requires pressing shoot button
        const shootPress = i % 8 === 0;
        player.handleInput(makeInput({ shootPressed: shootPress }), 1 / 60, engine);
        engine.tick();
        totalFramesRun++;
        checkInvariants();
      }
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');

      // Phase B: Pickup HMG (200 ammo) while holding shoot
      player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
      expect(player.weaponManager.getActiveWeapon()).toBe('HEAVY_MACHINE_GUN');
      expect(player.weaponManager.getAmmo('HEAVY_MACHINE_GUN')).toBe(200);

      // Fire 50 rounds of HMG
      for (let i = 0; i < 50; i++) {
        player.handleInput(makeInput({ shootHeld: true, shootPressed: i === 0 }), 1 / 60, engine);
        engine.tick();
        totalFramesRun++;
        checkInvariants();
      }
      expect(player.weaponManager.getAmmo('HEAVY_MACHINE_GUN')).toBeLessThan(200);

      // Phase C: Pickup FLAME_SHOT (30 ammo) while holding shoot
      player.weaponManager.acquireWeapon('FLAME_SHOT', 30, engine);
      expect(player.weaponManager.getActiveWeapon()).toBe('FLAME_SHOT');
      expect(player.weaponManager.getAmmo('FLAME_SHOT')).toBe(30);

      // Fire until Flame Shot is completely depleted to 0 ammo
      // Flame Shot has fireCooldownFrames = 18, so 30 * 18 = 540 frames. Run 600 frames.
      for (let i = 0; i < 600; i++) {
        player.handleInput(makeInput({ shootPressed: i % 18 === 0, shootHeld: true }), 1 / 60, engine);
        engine.tick();
        totalFramesRun++;
        checkInvariants();
      }

      // Assert clean fallback to PISTOL
      expect(player.weaponManager.getActiveWeapon()).toBe('PISTOL');
      expect(player.weaponManager.getAmmo('FLAME_SHOT')).toBe(0);
      expect(player.weaponManager.getAmmo('PISTOL')).toBe(Infinity);

      // Phase D: Attempt starved firing on depleted weapon (60 frames)
      for (let i = 0; i < 60; i++) {
        const shootPress = i % 8 === 0;
        player.handleInput(makeInput({ shootPressed: shootPress }), 1 / 60, engine);
        engine.tick();
        totalFramesRun++;
        checkInvariants();
      }

      // Assertions
      expect(negativeAmmoObserved).toBe(false);
      expect(droppedFrames).toBe(0);
      expect(totalFramesRun).toBe(50 + 50 + 600 + 60);

      // Assert no memory leaks in projectile manager: in-flight projectiles must not grow unboundedly
      const allProjectiles = engine.getAllEntities().filter((e) => e.type === 'PROJECTILE');
      console.log(`Remaining in-flight projectiles after 760 frames: ${allProjectiles.length}`);
      expect(allProjectiles.length).toBeLessThanOrEqual(10); // Projectiles expire via lifetime or bounds
    });
  });

  // =========================================================================
  // TASK 4: Spatial Hash Grid Saturation Stress Test
  // =========================================================================
  describe('Task 4: Spatial Hash Grid Saturation', () => {
    it('Injects 500 active projectiles and 100 moving entities, asserting O(1)/O(K) query performance and no corruption', () => {
      const grid = new SpatialGrid(64);

      interface TestItem {
        id: string;
        bounds: AABB;
        vx: number;
        vy: number;
      }

      const projectiles: TestItem[] = [];
      const entities: TestItem[] = [];

      // 1. Inject 500 projectiles across arena [0..2000, 50..250]
      for (let i = 0; i < 500; i++) {
        const p: TestItem = {
          id: `proj_${i}`,
          bounds: createAABB(
            Math.random() * 2000,
            50 + Math.random() * 200,
            8,
            4
          ),
          vx: 300 + Math.random() * 200,
          vy: (Math.random() - 0.5) * 50,
        };
        projectiles.push(p);
        grid.insert(p);
      }

      // 2. Inject 100 moving entities across arena
      for (let i = 0; i < 100; i++) {
        const e: TestItem = {
          id: `ent_${i}`,
          bounds: createAABB(
            Math.random() * 2000,
            160 + Math.random() * 40,
            24,
            38
          ),
          vx: (Math.random() - 0.5) * 80,
          vy: 0,
        };
        entities.push(e);
        grid.insert(e);
      }

      expect(grid.count()).toBe(600);

      // 3. Measure query latency for small query box (player knife scan / projectile hit)
      const queryBox = createAABB(500, 160, 44, 44);
      const queryIterations = 1000;
      const startTime = performance.now();

      let matchCount = 0;
      for (let q = 0; q < queryIterations; q++) {
        const matches = grid.query(queryBox);
        matchCount += matches.length;
      }

      const totalTimeMs = performance.now() - startTime;
      const avgLatencyUs = (totalTimeMs / queryIterations) * 1000; // in microseconds

      console.log(`SpatialGrid Saturation Benchmark (600 items):`);
      console.log(`Total query time for ${queryIterations} queries: ${totalTimeMs.toFixed(3)} ms`);
      console.log(`Average query latency: ${avgLatencyUs.toFixed(3)} µs/query`);

      // O(1) cell lookup + O(K) local candidates: must be well under 50 µs per query
      expect(avgLatencyUs).toBeLessThan(50); // Under 0.05ms per query

      // 4. Simulate 120 movement frames: update all 600 items and assert no corruption or frozen state
      for (let frame = 0; frame < 120; frame++) {
        const dt = 1 / 60;
        for (const p of projectiles) {
          p.bounds.x += p.vx * dt;
          p.bounds.y += p.vy * dt;
          grid.update(p);
        }
        for (const e of entities) {
          e.bounds.x += e.vx * dt;
          grid.update(e);
        }
      }

      expect(grid.count()).toBe(600);

      // 5. Assert clean removal
      for (let i = 0; i < 300; i++) {
        grid.remove(projectiles[i]);
      }
      expect(grid.count()).toBe(300);

      // Grid query encompassing entire world volume after 120 frames movement
      const finalMatches = grid.query(createAABB(-1000, -500, 6000, 2000));
      expect(finalMatches.every((item) => !item.id.startsWith('proj_') || parseInt(item.id.split('_')[1]) >= 300)).toBe(true);
    });

    it('Worst-case pathological crowding test (all 600 items in the same cell)', () => {
      const grid = new SpatialGrid(64);
      for (let i = 0; i < 600; i++) {
        grid.insert({
          id: `crowd_${i}`,
          bounds: createAABB(100 + (i % 5), 100 + (i % 5), 10, 10),
        });
      }
      expect(grid.count()).toBe(600);

      const matches = grid.query(createAABB(90, 90, 30, 30));
      expect(matches.length).toBe(600);
    });
  });
});
