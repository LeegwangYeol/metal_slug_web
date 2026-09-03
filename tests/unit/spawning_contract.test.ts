import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { FullMetalSlugGame } from '../../src/main';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';

describe('Milestone M4: Spawning Contract & Coordinate Invariant Suite', () => {
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

  describe('1. Out-of-Bounds Enemy Wave Spawning Contract (X >= cameraX + 480)', () => {
    it('all wave enemy spawn points must be strictly outside the visible camera viewport (X >= cameraX + 480)', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;
      const testCameraPositions = [0, 100, 300, 720, 1200, 1600];

      for (const cameraX of testCameraPositions) {
        for (const trigger of triggers) {
          const testEngine = new GameEngine();
          testEngine.start();
          trigger.spawnAction(testEngine, cameraX);

          // 1. Initial spawn coordinate before physics tick
          const initialEnemies = (testEngine as any).entitiesToAdd.filter((e: any) => e instanceof SoldierEnemy);
          for (const enemy of initialEnemies) {
            expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);
            expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 520);
          }

          // 2. Out-of-bounds contract preserved after physics integration
          testEngine.tick(1 / 60);
          const enemiesAfterTick = testEngine.getAllEntities().filter((e) => e instanceof SoldierEnemy);
          for (const enemy of enemiesAfterTick) {
            expect(enemy.position.x).toBeGreaterThanOrEqual(cameraX + 480);
          }
        }
      }
    });

    it('wave spawned enemies must possess INGRESS state with forward facing towards viewport', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;
      const testEngine = new GameEngine();
      testEngine.start();

      const wave1 = triggers.find((t: any) => t.id === 'trigger_wave_1');
      expect(wave1).toBeDefined();
      wave1.spawnAction(testEngine, 0);
      testEngine.tick(1 / 60);

      const enemies = testEngine.getAllEntities().filter((e) => e instanceof SoldierEnemy) as SoldierEnemy[];
      expect(enemies.length).toBeGreaterThanOrEqual(2);

      for (const enemy of enemies) {
        expect(enemy.state).toBe('INGRESS');
        expect(enemy.isIngress).toBe(true);
        expect(enemy.facing).toBe(-1); // Facing left toward active stage area
        expect(enemy.velocity.x).toBeLessThan(0); // Moving left into viewport
      }
    });
  });

  describe('2. Static POW Hostage Pre-Placement & Zero Runtime Popping', () => {
    it('POWs must be statically placed ahead of player spawn at stage initialization time', () => {
      const game = new FullMetalSlugGame();
      const pow1 = game.engine.getEntity('pow_1');
      const pow2 = game.engine.getEntity('pow_2');
      const pow3 = game.engine.getEntity('pow_3');
      const pow4 = game.engine.getEntity('pow_4');

      expect(pow1).toBeDefined();
      expect(pow2).toBeDefined();
      expect(pow3).toBeDefined();
      expect(pow4).toBeDefined();

      // Verify all 4 POWs are ahead of player starting spawn (x = 80)
      expect(pow1!.position.x).toBe(320);
      expect(pow2!.position.x).toBe(850);
      expect(pow3!.position.x).toBe(1450);
      expect(pow4!.position.x).toBe(1710);

      expect(pow1!.position.x).toBeGreaterThan(game.player.position.x);
      expect(pow2!.position.x).toBeGreaterThan(pow1!.position.x);
      expect(pow3!.position.x).toBeGreaterThan(pow2!.position.x);
      expect(pow4!.position.x).toBeGreaterThan(pow3!.position.x);
    });

    it('no stage triggers dynamically spawn POW entities at runtime (eliminating pop-ins)', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;

      for (const trigger of triggers) {
        const testEngine = new GameEngine();
        testEngine.start();
        trigger.spawnAction(testEngine, trigger.triggerX);
        testEngine.tick(1 / 60);

        const powsInTrigger = testEngine.getAllEntities().filter((e: any) => e.type === 'POW');
        expect(powsInTrigger.length).toBe(0);
      }
    });

    it('no spontaneous random timer-based entity popping occurs in engine over 600 idle frames', () => {
      const game = new FullMetalSlugGame();
      const initialEntityCount = game.engine.getAllEntities().length;

      // Simulate 10 seconds of idle game time without player moving to triggers
      for (let i = 0; i < 600; i++) {
        game.step(1 / 60);
      }

      const finalEntityCount = game.engine.getAllEntities().length;
      expect(finalEntityCount).toBe(initialEntityCount);
    });
  });

  describe('3. Enemy Spawning Y Alignment & Ground Contact Preservation', () => {
    it('enemy spawning Y must be 192 so feet (192 + height 38 = 230) align with ground top surface at 230', () => {
      const game = new FullMetalSlugGame();
      const triggers = (game as any).buildStage1Data().triggers;
      const testEngine = new GameEngine();
      testEngine.start();

      for (const trigger of triggers) {
        trigger.spawnAction(testEngine, 0);
      }
      testEngine.tick(1 / 60);

      const soldiers = testEngine.getAllEntities().filter((e) => e instanceof SoldierEnemy) as SoldierEnemy[];
      expect(soldiers.length).toBeGreaterThan(0);

      for (const soldier of soldiers) {
        expect(soldier.position.y).toBe(192);
        expect(soldier.height).toBe(38);
        const footY = soldier.position.y + soldier.height;
        expect(footY).toBe(230); // Exactly matches ground top surface
      }
    });

    it('ground snapping preserves soldier on terrain across 60 frames without falling into abyss', () => {
      const game = new FullMetalSlugGame();
      // Move player to wave 1 trigger
      game.player.position.x = 180;
      game.step(1 / 60);

      const rifleman = game.engine.getEntity('rebel_rifle_1') as SoldierEnemy;
      expect(rifleman).toBeDefined();
      expect(rifleman.position.y).toBe(192);

      // Advance physics simulation by 60 frames (1 second)
      for (let i = 0; i < 60; i++) {
        game.step(1 / 60);
      }

      // Soldier must remain alive and stable on ground (Y <= 195), never dropping into abyss (Y > 320)
      expect(rifleman.isAlive).toBe(true);
      expect(rifleman.position.y).toBeLessThanOrEqual(195);
      expect(rifleman.position.y).toBeGreaterThanOrEqual(189);
    });
  });
});
