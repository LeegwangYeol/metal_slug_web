import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { PlayerController } from '../../src/core/player/PlayerController';
import { vec2 } from '../../src/core/math/Vector2D';
import { createAABB } from '../../src/core/physics/AABB';
import { Platform } from '../../src/core/physics/Platform';
import { PowEntity } from '../../src/core/entities/pow/PowEntity';
import { ItemDropType } from '../../src/core/weapons/WeaponTypes';
import { FullMetalSlugGame } from '../../src/main';

describe('CHALLENGER_2: Boss AI, Health Gating & Long-Run Stability Stress Suite', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine();
    const floor: Platform = {
      id: 'ground_platform',
      type: 'SOLID',
      bounds: createAABB(0, 230, 2400, 40),
    };
    engine.addPlatform(floor);
    engine.start();
  });

  // =========================================================================
  // TASK 1: Tetsuyuki Boss Damage-Gating Stress Test
  // =========================================================================
  describe('Task 1: Tetsuyuki Boss Damage-Gating Adversarial Stress Test', () => {
    it('ORACLE CONTRACT 1A: Phase 1 must clamp at 975 HP on 2000 HP burst and not skip to death', () => {
      const boss = new TetsuyukiBoss('tetsuyuki_oracle_1a', vec2(360, 50), {
        customHp: 1500,
        initialPhase: 'PHASE_1_ARTILLERY',
      });
      boss.takeDamage(2000);

      // Contract requirement from task specification:
      // "verify that Phase 1 clamps at 975 HP, Phase 2 clamps at 450 HP,
      // and the boss does not skip directly to death without triggering the required phases."
      expect(boss.health).toBe(975);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
    });

    it('ORACLE CONTRACT 1B: Phase 2 must clamp at 450 HP on 2000 HP burst and not skip to death', () => {
      const boss = new TetsuyukiBoss('tetsuyuki_oracle_1b', vec2(360, 50), {
        customHp: 900,
        initialPhase: 'PHASE_2_LASER_SWEEP',
      });
      boss.takeDamage(2000);

      expect(boss.health).toBe(450);
      expect(boss.phase).toBe('PHASE_3_MELTDOWN');
    });

    it('EMPIRICAL DIAGNOSTIC 1A: Verifies defect resolution — boss health clamps to 975 and enters PHASE_2_LASER_SWEEP', () => {
      const boss = new TetsuyukiBoss('tetsuyuki_diag_1a', vec2(360, 50), {
        customHp: 1500,
        initialPhase: 'PHASE_1_ARTILLERY',
      });
      boss.takeDamage(2000);

      console.log(`[Diagnostic 1A] Post-2000 burst: health = ${boss.health}, phase = ${boss.phase}`);
      expect(boss.health).toBe(975);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
    });

    it('EMPIRICAL DIAGNOSTIC 1B: Verifies defect resolution — 1200 HP burst clamps at 975 and transitions to Phase 2', () => {
      const boss = new TetsuyukiBoss('tetsuyuki_diag_1b', vec2(360, 50), {
        customHp: 1500,
        initialPhase: 'PHASE_1_ARTILLERY',
      });
      boss.takeDamage(1200);

      console.log(`[Diagnostic 1B] Post-1200 burst: health = ${boss.health}, phase = ${boss.phase}`);
      expect(boss.health).toBe(975);
      expect(boss.phase).toBe('PHASE_2_LASER_SWEEP');
    });
  });

  // =========================================================================
  // TASK 2: Mid-Boss Technical Add Flood Test
  // =========================================================================
  describe('Task 2: Mid-Boss Technical Add Flood Adversarial Test', () => {
    it('should reject reinforcements when attempting to trigger deployment 50 times rapidly (activeAdds <= 3)', () => {
      const midboss = new MidBossVehicle('midboss_stress_1', vec2(400, 180));
      engine.addEntity(midboss);
      engine.tick();

      let successfulSpawns = 0;
      let rejectedSpawns = 0;
      const maxObservedAddsList: number[] = [];

      // Attempt reinforcement deployment 50 times in rapid succession
      for (let i = 0; i < 50; i++) {
        const spawned = midboss.trySpawnTroops(engine);
        if (spawned !== null) {
          successfulSpawns++;
        } else {
          rejectedSpawns++;
        }

        const activeAddsCount = midboss.getActiveAddsCount();
        const rawAddsLength = (midboss as any).activeAdds.length;

        maxObservedAddsList.push(Math.max(activeAddsCount, rawAddsLength));

        // Strict assertion: activeAdds length must NEVER exceed 3 at any iteration
        expect(activeAddsCount).toBeLessThanOrEqual(3);
        expect(rawAddsLength).toBeLessThanOrEqual(3);
      }

      const peakAdds = Math.max(...maxObservedAddsList);
      console.log(`[Task 2 Result] 50 rapid spawns -> successful: ${successfulSpawns}, rejected: ${rejectedSpawns}, peak active adds: ${peakAdds}`);

      expect(successfulSpawns).toBe(3);
      expect(rejectedSpawns).toBe(47);
      expect(peakAdds).toBe(3);
      expect(midboss.getActiveAddsCount()).toBe(3);
    });

    it('should maintain activeAdds <= 3 under combined rapid spawns and active engine ticks', () => {
      const midboss = new MidBossVehicle('midboss_stress_2', vec2(400, 180));
      engine.addEntity(midboss);
      engine.tick();

      for (let i = 0; i < 50; i++) {
        midboss.trySpawnTroops(engine);
        // Step physics simulation
        engine.tick(1 / 60);

        const addsCount = midboss.getActiveAddsCount();
        expect(addsCount).toBeLessThanOrEqual(3);
        expect((midboss as any).activeAdds.length).toBeLessThanOrEqual(3);
      }

      expect(midboss.getActiveAddsCount()).toBeLessThanOrEqual(3);
    });

    it('should safely replenish up to 3 adds when prior adds are killed during 50 repeated attempts', () => {
      const midboss = new MidBossVehicle('midboss_stress_3', vec2(400, 180));
      engine.addEntity(midboss);
      engine.tick();

      let totalSpawnedOverTime = 0;

      for (let i = 0; i < 50; i++) {
        const add = midboss.trySpawnTroops(engine);
        if (add) totalSpawnedOverTime++;

        // Every 5 iterations, kill the oldest active add
        if (i % 5 === 0) {
          const adds = midboss.getActiveAdds();
          if (adds.length > 0) {
            adds[0].takeDamage(10, 'bullet');
            adds[0].isAlive = false;
          }
        }

        engine.tick(1 / 60);

        expect(midboss.getActiveAddsCount()).toBeLessThanOrEqual(3);
        expect((midboss as any).activeAdds.length).toBeLessThanOrEqual(3);
      }

      console.log(`[Task 2 Churn Result] Total spawned through churn: ${totalSpawnedOverTime}, final active adds: ${midboss.getActiveAddsCount()}`);
      expect(midboss.getActiveAddsCount()).toBeLessThanOrEqual(3);
    });
  });

  // =========================================================================
  // TASK 3: 60-Second Headless Long-Run Simulation (3,600 Ticks)
  // =========================================================================
  describe('Task 3: 60-Second Headless Long-Run Simulation (3,600 Ticks @ 60Hz)', () => {
    it('should execute 3,600 ticks of intense combat with zero exceptions, zero NaN/Inf, stable entity count, and stable memory', () => {
      const simEngine = new GameEngine({ fixedTimestep: 1 / 60 });
      simEngine.start();

      // Setup terrain
      simEngine.addPlatform({
        id: 'floor_longrun',
        type: 'SOLID',
        bounds: createAABB(0, 230, 3000, 50),
      });

      // 1. Add Player
      const player = new PlayerController(vec2(100, 220));
      simEngine.addEntity(player);

      // 2. Add MidBossVehicle
      const midboss = new MidBossVehicle('sim_midboss', vec2(600, 180), {
        patrolMinX: 500,
        patrolMaxX: 900,
        customHp: 400,
      });
      simEngine.addEntity(midboss);

      // 3. Add TetsuyukiBoss
      const boss = new TetsuyukiBoss('sim_boss', vec2(1200, 70), {
        customHp: 1500,
      });
      simEngine.addEntity(boss);

      // Pre-populate with initial enemies and POW
      simEngine.addEntity(new SoldierEnemy('soldier_init_1', 'SOLDIER_RIFLE', vec2(300, 230)));
      simEngine.addEntity(new SoldierEnemy('soldier_init_2', 'SOLDIER_KNIFE', vec2(400, 230)));
      simEngine.addEntity(new SoldierEnemy('soldier_init_3', 'SOLDIER_GRENADE', vec2(480, 230)));
      simEngine.addEntity(new SoldierEnemy('soldier_init_4', 'SOLDIER_SHIELD', vec2(550, 230)));
      simEngine.addEntity(new PowEntity('pow_init_1', vec2(250, 230), ItemDropType.WEAPON_HMG));

      // Flush additions
      simEngine.tick(1 / 60);

      // Memory tracking
      if (typeof (globalThis as any).gc === 'function') (globalThis as any).gc();
      const initialMem = process.memoryUsage();
      const memorySnapshots: Array<{ tick: number; heapUsedMB: number; entityCount: number }> = [];

      let uncaughtExceptionsCount = 0;
      let nanInfiniteCount = 0;
      let maxConcurrentEntities = 0;
      let minConcurrentEntities = 999999;
      let totalSpawnedEntities = 0;

      const TOTAL_TICKS = 3600; // Exact 60 seconds at 60Hz
      const dt = 1 / 60;

      const startTime = Date.now();

      for (let tick = 1; tick <= TOTAL_TICKS; tick++) {
        try {
          // --- Dynamic Combat Driver ---
          // Simulate player action (move, jump, shoot)
          const aimX = (tick % 120 < 60) ? 1 : -1;
          const isShooting = tick % 4 === 0;
          const isJumping = tick % 180 === 0;
          const isGrenade = tick % 300 === 0;

          // Switch weapons dynamically every 600 ticks
          if (tick === 600) {
            player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200);
          } else if (tick === 1800) {
            player.weaponManager.acquireWeapon('FLAME_SHOT', 30);
          } else if (tick === 2800) {
            player.weaponManager.setGrenadeCount(10);
          }

          player.handleInput(
            {
              left: aimX < 0,
              right: aimX > 0,
              up: tick % 90 < 20,
              down: false,
              jumpPressed: isJumping,
              jumpHeld: isJumping,
              shootPressed: isShooting,
              shootHeld: isShooting,
              grenadePressed: isGrenade,
            },
            dt,
            simEngine
          );

          // Periodic soldier wave injection (simulating stage spawns) every 180 ticks
          if (tick % 180 === 0 && tick < 3000) {
            const soldierId = `wave_soldier_${tick}`;
            const types: Array<'SOLDIER_RIFLE' | 'SOLDIER_KNIFE' | 'SOLDIER_GRENADE' | 'SOLDIER_SHIELD'> = [
              'SOLDIER_RIFLE', 'SOLDIER_KNIFE', 'SOLDIER_GRENADE', 'SOLDIER_SHIELD'
            ];
            const chosenType = types[tick % types.length];
            const soldier = new SoldierEnemy(soldierId, chosenType, vec2(300 + (tick % 600), 230));
            simEngine.addEntity(soldier);
            totalSpawnedEntities++;
          }

          // Periodic MidBoss reinforcement attempts
          if (tick % 120 === 0 && midboss.isAlive) {
            const add = midboss.trySpawnTroops(simEngine);
            if (add) totalSpawnedEntities++;
          }

          // Damage boss slightly over time to stimulate phase transitions
          if (tick % 60 === 0 && boss.isAlive && boss.phase !== 'DESTROYED') {
            boss.takeDamage(15);
          }

          // Advance physics simulation
          simEngine.tick(dt);

          // Entity count tracking
          const allEntities = simEngine.getAllEntities();
          const currentCount = allEntities.length;
          if (currentCount > maxConcurrentEntities) maxConcurrentEntities = currentCount;
          if (currentCount < minConcurrentEntities) minConcurrentEntities = currentCount;

          // --- Sanity Check: Coordinates & Velocities ---
          for (const ent of allEntities) {
            // Check position
            if (
              !Number.isFinite(ent.position.x) ||
              !Number.isFinite(ent.position.y) ||
              Number.isNaN(ent.position.x) ||
              Number.isNaN(ent.position.y)
            ) {
              nanInfiniteCount++;
              console.error(`[NaN/Inf Position Detected] tick ${tick}, entity: ${ent.id} (${ent.type}), pos: (${ent.position.x}, ${ent.position.y})`);
            }

            // Check velocity
            if (
              !Number.isFinite(ent.velocity.x) ||
              !Number.isFinite(ent.velocity.y) ||
              Number.isNaN(ent.velocity.x) ||
              Number.isNaN(ent.velocity.y)
            ) {
              nanInfiniteCount++;
              console.error(`[NaN/Inf Velocity Detected] tick ${tick}, entity: ${ent.id} (${ent.type}), vel: (${ent.velocity.x}, ${ent.velocity.y})`);
            }

            // Check bounds
            if (
              !Number.isFinite(ent.bounds.x) ||
              !Number.isFinite(ent.bounds.y) ||
              !Number.isFinite(ent.bounds.width) ||
              !Number.isFinite(ent.bounds.height)
            ) {
              nanInfiniteCount++;
              console.error(`[NaN/Inf Bounds Detected] tick ${tick}, entity: ${ent.id} (${ent.type})`);
            }
          }

          // Periodic memory snapshots
          if (tick % 600 === 0) {
            const mem = process.memoryUsage();
            const heapMB = Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100;
            memorySnapshots.push({
              tick,
              heapUsedMB: heapMB,
              entityCount: currentCount,
            });
          }
        } catch (err) {
          uncaughtExceptionsCount++;
          console.error(`[Exception at tick ${tick}]:`, err);
        }
      }

      const elapsedMs = Date.now() - startTime;
      const finalMem = process.memoryUsage();
      const initialHeapMB = Math.round((initialMem.heapUsed / 1024 / 1024) * 100) / 100;
      const finalHeapMB = Math.round((finalMem.heapUsed / 1024 / 1024) * 100) / 100;
      const finalEntityCount = simEngine.getAllEntities().length;

      console.log(`\n================ LONG-RUN SIMULATION METRICS (3600 TICKS) ================`);
      console.log(`Execution Time: ${elapsedMs}ms (${Math.round((3600 / (elapsedMs / 1000)))} ticks/sec)`);
      console.log(`Uncaught Exceptions: ${uncaughtExceptionsCount}`);
      console.log(`NaN/Infinite Occurrences: ${nanInfiniteCount}`);
      console.log(`Entity Count -> Min: ${minConcurrentEntities}, Max: ${maxConcurrentEntities}, Final: ${finalEntityCount}`);
      console.log(`Initial Heap: ${initialHeapMB} MB, Final Heap: ${finalHeapMB} MB`);
      console.log(`Memory Snapshots:`, memorySnapshots);
      console.log(`==========================================================================\n`);

      // Assertions
      expect(uncaughtExceptionsCount).toBe(0);
      expect(nanInfiniteCount).toBe(0);
      // Entity cleanup assertion: entity count should be stable and bounded (not exploding)
      expect(maxConcurrentEntities).toBeLessThan(150);
      expect(finalEntityCount).toBeLessThan(80);
      // Memory check: heap growth bounded under 100MB increase
      expect(finalHeapMB - initialHeapMB).toBeLessThan(100);
    });

    it('should run 3,600 ticks on the complete FullMetalSlugGame instance headless without errors', () => {
      const game = new FullMetalSlugGame();
      expect(game).toBeDefined();

      let gameExceptions = 0;
      let nanCount = 0;

      for (let tick = 1; tick <= 3600; tick++) {
        try {
          game.step(1 / 60);

          if (tick % 600 === 0) {
            const entities = game.engine.getAllEntities();
            for (const e of entities) {
              if (
                !Number.isFinite(e.position.x) ||
                !Number.isFinite(e.position.y) ||
                Number.isNaN(e.position.x) ||
                Number.isNaN(e.position.y)
              ) {
                nanCount++;
              }
            }
          }
        } catch (err) {
          gameExceptions++;
          console.error(`[FullMetalSlugGame Exception at tick ${tick}]:`, err);
        }
      }

      console.log(`[FullMetalSlugGame 3600 Ticks] Exceptions: ${gameExceptions}, NaN: ${nanCount}, Final Stage State: ${game.stageManager.getState()}`);
      expect(gameExceptions).toBe(0);
      expect(nanCount).toBe(0);
    });
  });
});
