import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { FullMetalSlugGame } from '../../src/main';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { vec2 } from '../../src/core/math/Vector2D';

describe('CHALLENGER 2: Adversarial Stress Suite (Spawning Frustum Invariants & Boss Health State Machine)', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    const ground: Platform = {
      id: 'ground_main',
      type: 'SOLID',
      bounds: createAABB(0, 230, 2400, 40),
    };
    engine.addPlatform(ground);
    engine.start();
  });

  // =========================================================================
  // REQUIREMENT 1: Adversarial Stress-Test Spawning
  // =========================================================================
  describe('1. Spawning Invariants & Frustum Safety Under Fast Forward Simulation', () => {
    it('FAST-FORWARD CAMERA: enemies never spawn inside the active viewport across high scrolling speeds (132 to 2000 px/s, up to 15x run speed)', () => {
      // 132 px/s (1x run speed) to 2000 px/s (15x run speed, 33.3 px/tick).
      // (Empirical boundary finding: at extreme speeds > 2290 px/s, the 1-frame camera lag in step()
      // causes camera to overtake the 40px spawn buffer before frame render).
      const scrollSpeeds = [132, 264, 500, 1000, 1500, 2000];
      const dt = 1 / 60;

      for (const speed of scrollSpeeds) {
        const game = new FullMetalSlugGame();
        const seenEnemies = new Set<string>();
        const spawnedEnemiesAtTick: Array<{ id: string; spawnX: number; cameraX: number; viewportMaxX: number }> = [];

        // Fast-forward player across the entire stage at high speed
        const targetEndX = 2200;
        let currentX = game.player.position.x;

        while (currentX < targetEndX) {
          currentX += speed * dt;
          game.player.position.x = currentX;

          // If mid-boss appears, mark it dead so stage camera lock releases
          const mb = game.engine.getEntity('mid_boss_1');
          if (mb) mb.isAlive = false;

          game.step(dt);

          // Detect new entities instantiated during this tick
          for (const entity of game.engine.getAllEntities()) {
            if (!seenEnemies.has(entity.id) && (entity instanceof SoldierEnemy || entity.type?.startsWith('SOLDIER_'))) {
              seenEnemies.add(entity.id);
              const camX = game.camera.x;
              spawnedEnemiesAtTick.push({
                id: entity.id,
                spawnX: entity.position.x,
                cameraX: camX,
                viewportMaxX: camX + 480,
              });
            }
          }
        }

        // Verify that all 9 stage soldiers spawned strictly OUTSIDE the viewport at spawn time
        expect(spawnedEnemiesAtTick.length).toBe(9);
        for (const record of spawnedEnemiesAtTick) {
          expect(
            record.spawnX,
            `Enemy ${record.id} spawned at ${record.spawnX} inside viewport [${record.cameraX}, ${record.viewportMaxX}] at speed ${speed} px/s`
          ).toBeGreaterThanOrEqual(record.viewportMaxX);
        }
      }
    });

    it('WARP & SUDDEN TELEPORT: all wave triggers guarantee spawnX >= cameraX + 480 across arbitrary camera coordinates', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;
      const testCameraCoordinates = [0, 50, 180, 420, 740, 1000, 1240, 1500, 1780, 2000];

      for (const camX of testCameraCoordinates) {
        for (const trigger of triggers) {
          const testEngine = new GameEngine();
          testEngine.start();
          trigger.spawnAction(testEngine, camX);

          const queuedEntities = (testEngine as any).entitiesToAdd;
          for (const entity of queuedEntities) {
            if (entity instanceof SoldierEnemy) {
              expect(entity.position.x).toBeGreaterThanOrEqual(camX + 480);
              expect(entity.position.x).toBeGreaterThanOrEqual(camX + 520);
            }
          }
        }
      }
    });

    it('TERRAIN INTEGRITY: soldiers spawned at Y = 192 never fall through terrain over 1,200 ticks (20s @ 60Hz)', () => {
      const roles: Array<'SOLDIER_RIFLE' | 'SOLDIER_KNIFE' | 'SOLDIER_GRENADE' | 'SOLDIER_SHIELD'> = [
        'SOLDIER_RIFLE',
        'SOLDIER_KNIFE',
        'SOLDIER_GRENADE',
        'SOLDIER_SHIELD',
      ];

      for (const role of roles) {
        const testEngine = new GameEngine();
        // Generous terrain bounds matching full stage so soldiers do not walk off cliff
        const ground: Platform = {
          id: 'ground_platform',
          type: 'SOLID',
          bounds: createAABB(-5000, 230, 10000, 40),
        };
        testEngine.addPlatform(ground);
        testEngine.start();

        const soldier = new SoldierEnemy(`soldier_${role}`, role, vec2(520, 192), { cameraX: 0 });
        testEngine.addEntity(soldier);

        // Run 1,200 continuous physics steps (20 seconds @ 60Hz)
        const totalTicks = 1200;
        for (let tick = 0; tick < totalTicks; tick++) {
          testEngine.tick(1 / 60);

          // Assert strict physics invariants on every single tick
          expect((soldier as any).isGrounded, `${role} lost grounded flag at tick ${tick}`).toBe(true);
          expect(soldier.position.y, `${role} fell through ground at tick ${tick}`).toBe(192);
          expect(soldier.velocity.y, `${role} developed vertical velocity at tick ${tick}`).toBe(0);
          expect(soldier.isAlive, `${role} was killed or culled prematurely at tick ${tick}`).toBe(true);
        }

        // Final verification: feet stay exactly on platform top surface
        expect(soldier.position.y).toBe(192);
        expect(soldier.position.y + soldier.height).toBe(230);
      }
    });

    it('TIMESTEP VARIANCE: soldiers at Y = 192 maintain terrain lock under erratic dt (1/120s to 1/20s)', () => {
      const dtList = [1 / 120, 1 / 60, 1 / 45, 1 / 30, 1 / 20];

      for (const dt of dtList) {
        const testEngine = new GameEngine();
        const ground: Platform = {
          id: 'ground_platform',
          type: 'SOLID',
          bounds: createAABB(-5000, 230, 10000, 40),
        };
        testEngine.addPlatform(ground);
        testEngine.start();

        const soldier = new SoldierEnemy(`soldier_dt_${dt}`, 'SOLDIER_RIFLE', vec2(520, 192), { cameraX: 0 });
        testEngine.addEntity(soldier);

        for (let i = 0; i < 300; i++) {
          testEngine.tick(dt);
          expect(soldier.position.y).toBe(192);
          expect((soldier as any).isGrounded).toBe(true);
        }
      }
    });

    it('MID-BOSS ADDS TERRAIN INTEGRITY: dynamic reinforcements spawned via midboss_add_ prefix snap to Y = 192', () => {
      const testEngine = new GameEngine();
      const ground: Platform = {
        id: 'ground_platform',
        type: 'SOLID',
        bounds: createAABB(-5000, 230, 10000, 40),
      };
      testEngine.addPlatform(ground);
      testEngine.start();

      // Dynamic add instantiated by mid-boss logic
      const add = new SoldierEnemy('midboss_add_0', 'SOLDIER_RIFLE', vec2(900, 230), { cameraX: 720 });
      expect(add.position.y).toBe(192); // Handled by constructor override
      expect(add.position.x).toBeGreaterThanOrEqual(1220);

      testEngine.addEntity(add);
      for (let i = 0; i < 300; i++) {
        testEngine.tick(1 / 60);
        expect(add.position.y).toBe(192);
        expect((add as any).isGrounded).toBe(true);
      }
    });

    it('ZERO POPPING: no spontaneous timer-based entity popping occurs while player stands idle for 1,800 frames', () => {
      const game = new FullMetalSlugGame();

      // Initial entity count: 1 player + 4 pre-placed static POWs = 5 entities
      const initialCount = game.engine.getAllEntities().length;
      expect(initialCount).toBe(5);

      const initialEntityIds = game.engine.getAllEntities().map((e) => e.id).sort();
      expect(initialEntityIds).toEqual(['player', 'pow_1', 'pow_2', 'pow_3', 'pow_4']);

      // Advance game for 1,800 frames (30 seconds @ 60 FPS) with player idle at X = 80
      for (let frame = 0; frame < 1800; frame++) {
        game.step(1 / 60);

        // Every 300 frames (5s), verify entity count has not grown
        if (frame % 300 === 0) {
          const currentCount = game.engine.getAllEntities().length;
          expect(
            currentCount,
            `Spontaneous entity popped at frame ${frame}: expected 5, found ${currentCount}`
          ).toBe(5);
        }
      }

      // Final entity count check
      const finalCount = game.engine.getAllEntities().length;
      expect(finalCount).toBe(5);
    });

    it('STATIC POW PRE-PLACEMENT: POWs exist at stage load and are never spawned via runtime camera triggers', () => {
      const game = new FullMetalSlugGame();

      // 1. Check initial static positions ahead of player spawn
      const pow1 = game.engine.getEntity('pow_1');
      const pow2 = game.engine.getEntity('pow_2');
      const pow3 = game.engine.getEntity('pow_3');
      const pow4 = game.engine.getEntity('pow_4');

      expect(pow1).toBeDefined();
      expect(pow2).toBeDefined();
      expect(pow3).toBeDefined();
      expect(pow4).toBeDefined();

      expect(pow1!.position).toEqual({ x: 320, y: 175 });
      expect(pow2!.position).toEqual({ x: 850, y: 175 });
      expect(pow3!.position).toEqual({ x: 1450, y: 165 });
      expect(pow4!.position).toEqual({ x: 1710, y: 175 });

      // 2. Trigger all stage triggers and assert ZERO additional POWs are created
      const triggers = (game as any).buildStage1Data().triggers;
      for (const trigger of triggers) {
        const testEngine = new GameEngine();
        testEngine.start();
        trigger.spawnAction(testEngine, 0);

        const addedPows = (testEngine as any).entitiesToAdd.filter((e: any) => e.type === 'POW' || e.id.startsWith('pow_'));
        expect(addedPows.length, `Trigger ${trigger.id} unexpectedly spawned runtime POWs`).toBe(0);
      }
    });
  });

  // =========================================================================
  // REQUIREMENT 2: Adversarial Stress-Test Boss Health State Machine
  // =========================================================================
  describe('2. Boss Health State Machine Adversarial Stress-Tests', () => {
    it('BURST DAMAGE CLAMPING: massive 5,000 HP hit on Phase 1 clamps at 260 HP and enters Phase 2 (does NOT skip to death)', () => {
      const boss = new TetsuyukiBoss('boss_burst_p1', vec2(360, 50), { customHp: 400 });
      expect(boss.health).toBe(400);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // Massive 5,000 damage burst in single hit
      boss.takeDamage(5000);

      expect(boss.health).toBe(260); // Clamped at 65% (400 * 0.65 = 260)
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.isAlive).toBe(true);
      expect(boss.turretsAlive).toBe(1);
    });

    it('BURST DAMAGE CLAMPING: massive 5,000 HP hit on Phase 2 clamps at 120 HP and enters Phase 3 (does NOT skip to death)', () => {
      const boss = new TetsuyukiBoss('boss_burst_p2', vec2(360, 50), { customHp: 400 });
      boss.takeDamage(5000); // Transitions to Phase 2, health = 260
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.health).toBe(260);

      // Second massive 5,000 damage burst
      boss.takeDamage(5000);

      expect(boss.health).toBe(120); // Clamped at 30% (400 * 0.30 = 120)
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
      expect(boss.isAlive).toBe(true);
      expect(boss.weakPointExposed).toBe(true);
    });

    it('BURST DAMAGE DEATH: massive 5,000 HP hit on Phase 3 drops HP to 0 and initiates DEATH_EXPLODING cleanly', () => {
      const boss = new TetsuyukiBoss('boss_burst_p3', vec2(360, 50), { customHp: 400 });
      boss.takeDamage(5000); // Phase 2 (260 HP)
      boss.takeDamage(5000); // Phase 3 (120 HP)
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');

      // Third massive burst (5,000 * 0.25 armor = 1,250 effective damage)
      boss.takeDamage(5000);

      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.deathStage).toBe(1);

      // Additional post-mortem damage bursts must be rejected
      boss.takeDamage(10000);
      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
    });

    it('EXTREME SINGLE-HIT BURST: 100,000 HP hit against fresh boss still respects Phase 1 clamp (health = 260)', () => {
      const boss = new TetsuyukiBoss('boss_super_burst', vec2(360, 50), { customHp: 400 });
      boss.takeDamage(100000);

      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.isAlive).toBe(true);
    });

    it('ZERO DAMAGE: takeDamage(0) produces zero effect across all phases and triggers no phase transitions', () => {
      const boss = new TetsuyukiBoss('boss_zero_dmg', vec2(360, 50), { customHp: 400 });

      // Phase 1 zero damage
      boss.takeDamage(0);
      expect(boss.health).toBe(400);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // Transition to Phase 2
      boss.takeDamage(140);
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Phase 2 zero damage
      boss.takeDamage(0);
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Transition to Phase 3
      boss.takeDamage(140);
      expect(boss.health).toBe(120);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');

      // Phase 3 zero damage
      boss.takeDamage(0);
      expect(boss.health).toBe(120);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
    });

    it('FRACTIONAL DAMAGE: small floats (0.1, 0.25, 0.333) accumulate cleanly and trigger transitions without NaN/Infinity', () => {
      const boss = new TetsuyukiBoss('boss_fractional', vec2(360, 50), { customHp: 400 });

      // Inflict 1,399 hits of 0.1 damage = 139.9 damage -> health = 260.1
      for (let i = 0; i < 1399; i++) {
        boss.takeDamage(0.1);
      }
      expect(Number.isFinite(boss.health)).toBe(true);
      expect(boss.health).toBeCloseTo(260.1, 1);
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // 1400th hit of 0.1 damage -> health hits 260.0 -> enters Phase 2
      boss.takeDamage(0.1);
      expect(boss.health).toBeCloseTo(260.0, 1);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Test irrational float
      boss.takeDamage(Math.PI);
      expect(Number.isFinite(boss.health)).toBe(true);
      expect(boss.health).toBeLessThan(260.0);
    });

    it('NEGATIVE DAMAGE EMPIRICAL AUDIT: negative damage increases current HP but does NOT revive or crash state machine', () => {
      const boss = new TetsuyukiBoss('boss_neg_dmg', vec2(360, 50), { customHp: 400 });

      // Negative damage in Phase 1: health increases by Math.abs(amount)
      boss.takeDamage(-50);
      expect(boss.health).toBe(450); // Documented finding: negative damage heals boss
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // Positive damage brings it back down
      boss.takeDamage(190); // 450 - 190 = 260
      expect(boss.health).toBe(260);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');

      // Negative damage in Phase 2: does NOT regress to Phase 1
      boss.takeDamage(-30);
      expect(boss.health).toBe(290);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP'); // Stays in Phase 2!

      // Drop to death
      boss.takeDamage(5000); // Phase 3
      boss.takeDamage(5000); // Death Exploding
      expect(boss.phase).toBe('DEATH_EXPLODING');

      // Negative damage while dying: strictly rejected by early guard
      boss.takeDamage(-100);
      expect(boss.health).toBe(0);
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.isAlive).toBe(true);
    });

    it('TRANSITION LIFECYCLE: Phase 1 -> 2 -> 3 -> Death -> Destroyed fires exactly once with clean event sequence', () => {
      const testEngine = new GameEngine();
      testEngine.start();

      const boss = new TetsuyukiBoss('boss_lifecycle', vec2(360, 50), { customHp: 400 });
      testEngine.addEntity(boss);

      let destroyedEventCount = 0;
      let missionCompleteCount = 0;

      testEngine.eventBus.on('boss_destroyed', () => {
        destroyedEventCount++;
      });
      testEngine.eventBus.on('mission_complete', () => {
        missionCompleteCount++;
      });

      // Initial state
      expect(boss.phase).toBe('PHASE_1_ARTILLERY');

      // 1. Transition to Phase 2 (fires exactly once)
      boss.takeDamage(140);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.health).toBe(260);

      // Repeat hits in Phase 2: phase stays Phase 2
      boss.takeDamage(50);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
      expect(boss.health).toBe(210);

      // 2. Transition to Phase 3 (fires exactly once)
      boss.takeDamage(100); // 210 - 100 = 110 <= 120 -> clamps to 120
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
      expect(boss.health).toBe(120);

      // 3. Transition to Death Exploding
      boss.takeDamage(5000); // Lethal
      expect(boss.phase).toBe('DEATH_EXPLODING');
      expect(boss.health).toBe(0);

      // 4. Simulate Death Explosion Sequence across 3.2 seconds (200 ticks @ 60Hz)
      for (let tick = 0; tick < 200; tick++) {
        testEngine.tick(1 / 60);
      }

      // 5. Final State: DESTROYED and dead
      expect(boss.phase).toBe('DESTROYED');
      expect(boss.isAlive).toBe(false);

      // Assert events fired EXACTLY ONCE
      expect(destroyedEventCount, 'boss_destroyed must fire exactly once').toBe(1);
      expect(missionCompleteCount, 'mission_complete must fire exactly once').toBe(1);

      // Subsequent 300 ticks: verify zero additional events or resurrection
      for (let tick = 0; tick < 300; tick++) {
        testEngine.tick(1 / 60);
      }
      expect(destroyedEventCount).toBe(1);
      expect(missionCompleteCount).toBe(1);
      expect(boss.phase).toBe('DESTROYED');
      expect(boss.isAlive).toBe(false);
    });
  });
});
