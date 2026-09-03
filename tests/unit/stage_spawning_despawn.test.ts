import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { StageManager, StageData } from '../../src/core/engine/StageManager';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { TetsuyukiBoss } from '../../src/core/entities/boss/TetsuyukiBoss';
import { PowEntity } from '../../src/core/entities/pow/PowEntity';
import { FullMetalSlugGame } from '../../src/main';
import { createAABB } from '../../src/core/physics/AABB';

describe('Smooth Spawning & Clean Off-Screen Despawn Suite (Milestone M2 Overhaul)', () => {
  let engine: GameEngine;
  let stageManager: StageManager;

  beforeEach(() => {
    engine = new GameEngine();
    engine.start();
    stageManager = new StageManager(engine);
  });

  describe('1. StageTrigger & spawnAction Camera Parameter Passing', () => {
    it('should pass cameraX to spawnAction when trigger fires', () => {
      const spawnActionMock = vi.fn();
      const testStage: StageData = {
        id: 'test_stage',
        name: 'Test Beachhead',
        width: 2400,
        height: 270,
        initialCameraBounds: { minX: 0, maxX: 480, minY: 0, maxY: 270 },
        platforms: [{ id: 'ground', type: 'SOLID', bounds: createAABB(0, 230, 2400, 40) }],
        triggers: [
          {
            id: 'test_wave',
            triggerX: 200,
            triggered: false,
            spawnAction: spawnActionMock,
          },
        ],
      };

      stageManager.loadStage(testStage);

      // Player at 150 (not reached trigger 200)
      stageManager.update(100, 150);
      expect(spawnActionMock).not.toHaveBeenCalled();

      // Player at 220 (crosses trigger 200) with camera at 120
      stageManager.update(120, 220);
      expect(spawnActionMock).toHaveBeenCalledTimes(1);
      expect(spawnActionMock).toHaveBeenCalledWith(engine, 120);
    });
  });

  describe('2. Clean Off-Screen Entity Despawning (despawnOffscreenEntities)', () => {
    it('should despawn minions falling behind the camera (x < cameraX - 180)', () => {
      const cameraX = 300;
      // Behind camera: 300 - 180 = 120, so x = 100 is behind
      const minionBehind = new SoldierEnemy('minion_behind', 'SOLDIER_RIFLE', { x: 100, y: 230 });
      // Visible or near: x = 200 is ahead of cameraX - 180 (120)
      const minionAhead = new SoldierEnemy('minion_ahead', 'SOLDIER_RIFLE', { x: 200, y: 230 });

      engine.addEntity(minionBehind);
      engine.addEntity(minionAhead);
      engine.tick();

      expect(minionBehind.isAlive).toBe(true);
      expect(minionAhead.isAlive).toBe(true);

      // Execute despawn check
      stageManager.despawnOffscreenEntities(cameraX);

      expect(minionBehind.isAlive).toBe(false);
      expect(minionAhead.isAlive).toBe(true);

      // Next engine tick purges dead entity
      engine.tick();
      expect(engine.getEntity('minion_behind')).toBeUndefined();
      expect(engine.getEntity('minion_ahead')).toBeDefined();
    });

    it('should despawn minions that drop below the stage floor (y > 320)', () => {
      const minionFallen = new SoldierEnemy('minion_fallen', 'SOLDIER_KNIFE', { x: 400, y: 340 });
      const minionOnStage = new SoldierEnemy('minion_on_stage', 'SOLDIER_KNIFE', { x: 400, y: 230 });

      engine.addEntity(minionFallen);
      engine.addEntity(minionOnStage);
      engine.tick();

      stageManager.despawnOffscreenEntities(100);

      expect(minionFallen.isAlive).toBe(false);
      expect(minionOnStage.isAlive).toBe(true);

      engine.tick();
      expect(engine.getEntity('minion_fallen')).toBeUndefined();
      expect(engine.getEntity('minion_on_stage')).toBeDefined();
    });

    it('should NEVER despawn player, boss, or hostage POW entities', () => {
      const cameraX = 500; // Despawn threshold = 320

      // Create dummy player entity
      const playerEntity = {
        id: 'player',
        type: 'PLAYER',
        position: { x: 50, y: 230 }, // Behind cameraX - 180
        velocity: { x: 0, y: 0 },
        bounds: createAABB(50, 230, 24, 40),
        isAlive: true,
        update: vi.fn(),
      };

      const boss = new TetsuyukiBoss('boss_tetsuyuki', { x: 100, y: 50 }); // Behind camera
      const pow = new PowEntity('pow_1', { x: 80, y: 230 }); // Behind camera

      engine.addEntity(playerEntity);
      engine.addEntity(boss);
      engine.addEntity(pow);
      engine.tick();

      stageManager.despawnOffscreenEntities(cameraX);

      expect(playerEntity.isAlive).toBe(true);
      expect(boss.isAlive).toBe(true);
      expect(pow.isAlive).toBe(true);
    });
  });

  describe('3. SoldierEnemy Smooth Ingress Behavior', () => {
    it('should spawn in INGRESS state with vx = -110 px/s when placed off-screen right', () => {
      const cameraX = 200;
      // Off-screen right: x = cameraX + 520 = 720 (well beyond cameraX + 460 = 660)
      const soldier = new SoldierEnemy('soldier_in', 'SOLDIER_RIFLE', { x: 720, y: 230 }, { cameraX });

      expect(soldier.state).toBe('INGRESS');
      expect(soldier.facing).toBe(-1);
      expect(soldier.velocity.x).toBe(-110);
      expect(soldier.isIngress).toBe(true);
    });

    it('should move inward at 110 px/s until reaching visible margin (x <= cameraX + 460) then transition to PATROL', () => {
      const cameraX = 100;
      const margin = cameraX + 460; // 560

      // Add ground platform
      engine.addPlatform({ id: 'ground', type: 'SOLID', bounds: createAABB(0, 230, 1000, 40) });

      const rifleman = new SoldierEnemy('rifle_ingress', 'SOLDIER_RIFLE', { x: 580, y: 192 }, { cameraX });
      engine.addEntity(rifleman);
      engine.tick();

      expect(rifleman.state).toBe('INGRESS');
      expect(rifleman.velocity.x).toBe(-110);

      // Advance ticks until crossing x <= 560
      // 580 - 560 = 20px. At 110px/s, takes ~0.18s (~11 ticks)
      for (let i = 0; i < 15; i++) {
        rifleman.update(1 / 60, engine);
      }

      expect(rifleman.position.x).toBeLessThanOrEqual(margin);
      expect(rifleman.state).toBe('PATROL');
      expect(rifleman.isIngress).toBe(false);
    });

    it('should transition Knife Charger from INGRESS to IDLE upon crossing visible boundary', () => {
      const cameraX = 0;
      const charger = new SoldierEnemy('charger_ingress', 'SOLDIER_KNIFE', { x: 480, y: 192 }, { cameraX });
      expect(charger.state).toBe('INGRESS');

      // 480 - 460 = 20px, ~12 ticks
      for (let i = 0; i < 15; i++) {
        charger.update(1 / 60);
      }

      expect(charger.position.x).toBeLessThanOrEqual(460);
      expect(charger.state).toBe('IDLE');
    });

    it('should transition Shield Trooper from INGRESS to GUARD_ADVANCE upon crossing visible boundary', () => {
      const cameraX = 0;
      const shield = new SoldierEnemy('shield_ingress', 'SOLDIER_SHIELD', { x: 490, y: 192 }, { cameraX });
      expect(shield.state).toBe('INGRESS');

      for (let i = 0; i < 20; i++) {
        shield.update(1 / 60);
      }

      expect(shield.position.x).toBeLessThanOrEqual(460);
      expect(shield.state).toBe('GUARD_ADVANCE');
    });

    it('should NOT enter ingress when spawned directly in-bounds (e.g. x <= cameraX + 460)', () => {
      const cameraX = 100;
      // In-bounds: x = 300 <= 100 + 460 (560)
      const soldier = new SoldierEnemy('soldier_in_bounds', 'SOLDIER_RIFLE', { x: 300, y: 230 }, { cameraX });

      expect(soldier.state).toBe('PATROL');
      expect(soldier.isIngress).toBe(false);
    });
  });

  describe('4. Full Game Wave Spawners & Out-of-Bounds Guarantee', () => {
    it('should spawn all wave enemies strictly out-of-bounds with echelon staggering', () => {
      const game = new FullMetalSlugGame();
      const stage = game.stageManager.getCurrentStage();
      expect(stage).toBeDefined();

      const triggers = stage!.triggers;

      // Test Wave 1
      const wave1 = triggers.find((t) => t.id === 'trigger_wave_1');
      expect(wave1).toBeDefined();

      const waveEngine = new GameEngine();
      const testCamX = 100;
      wave1!.spawnAction(waveEngine, testCamX);
      waveEngine.tick();

      const wave1Enemies = waveEngine.getAllEntities().filter((e) => e.type.startsWith('SOLDIER_'));
      expect(wave1Enemies.length).toBe(2);

      // Out-of-bounds guarantee: All enemies must be placed at x >= cameraX + 520 (> viewMax)
      const viewMax = testCamX + 480; // 580
      for (const enemy of wave1Enemies) {
        expect(enemy.position.x).toBeGreaterThan(viewMax);
        // After 1 frame of ingress running at -110 px/s, position moved by ~1.83px
        expect(enemy.position.x).toBeGreaterThanOrEqual(testCamX + 520 - 5);
      }

      // Echelon staggering: enemies must have distinct staggered positions (+40px)
      const positions = wave1Enemies.map((e) => e.position.x).sort((a, b) => a - b);
      expect(positions[1] - positions[0]).toBe(40);
    });

    it('should verify Wave 2 and Wave 3 spawn enemies strictly outside visible viewport', () => {
      const game = new FullMetalSlugGame();
      const stage = game.stageManager.getCurrentStage()!;

      const wave2 = stage.triggers.find((t) => t.id === 'trigger_wave_2')!;
      const wave3 = stage.triggers.find((t) => t.id === 'trigger_wave_3')!;

      const testCamX = 250;
      const viewMax = testCamX + 480; // 730

      // Test Wave 2
      const eng2 = new GameEngine();
      wave2.spawnAction(eng2, testCamX);
      eng2.tick();
      const wave2Enemies = eng2.getAllEntities().filter((e) => e.type.startsWith('SOLDIER_'));
      expect(wave2Enemies.length).toBe(3);
      for (const enemy of wave2Enemies) {
        expect(enemy.position.x).toBeGreaterThan(viewMax);
      }

      // Test Wave 3
      const eng3 = new GameEngine();
      wave3.spawnAction(eng3, testCamX);
      eng3.tick();
      const wave3Enemies = eng3.getAllEntities().filter((e) => e.type.startsWith('SOLDIER_'));
      expect(wave3Enemies.length).toBe(3);
      for (const enemy of wave3Enemies) {
        expect(enemy.position.x).toBeGreaterThan(viewMax);
      }
    });
  });
});
