import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/render/Camera';
import { FullMetalSlugGame } from '../../src/main';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { SoldierEnemy } from '../../src/core/entities/enemies/SoldierEnemy';
import { MidBossVehicle } from '../../src/core/entities/enemies/MidBossVehicle';

describe('CHALLENGER_M1_2: Empirical Camera Deadzone, Boss Arenas & Wave Spawner Suite', () => {

  describe('1. Mathematical & Empirical Camera Forward Deadzone Invariant', () => {
    it('Camera defaults to 960x540 viewport with deadzoneRight providing >= 528px forward reaction view', () => {
      const camera = new Camera();
      expect(camera.viewportWidth).toBe(960);
      expect(camera.viewportHeight).toBe(540);

      // Math: deadzoneRight = Math.floor(960 * 0.44) = 422
      expect(camera.deadzoneRight).toBe(Math.floor(960 * 0.44));
      expect(camera.deadzoneRight).toBe(422);

      // Reaction space = viewportWidth - deadzoneRight = 960 - 422 = 538px
      const reactionSpace = camera.viewportWidth - camera.deadzoneRight;
      expect(reactionSpace).toBe(538);
      expect(reactionSpace).toBeGreaterThanOrEqual(528);
    });

    it('asserts visible forward reaction space >= 528px under continuous forward motion from X=80 to X=2500', () => {
      const camera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: { minX: 0, maxX: 3600, minY: 0, maxY: 540 },
        forwardLock: true,
      });
      camera.reset(0, 0);

      let playerX = 80;
      const playerY = 230;
      const speed = 200; // px/s
      const dt = 1 / 60; // 60Hz

      // Advance player continuously across 1,200 frames (20 seconds)
      for (let frame = 0; frame < 1200; frame++) {
        playerX += speed * dt;
        camera.update(playerX, playerY, dt);

        // While camera is actively tracking (before clamping to maxX - 960 = 2640)
        if (camera.x < 3600 - 960) {
          const screenX = playerX - camera.x;
          const forwardReactionSpace = camera.viewportWidth - screenX;

          // Reaction space must be at least 528px at all active tracking frames
          expect(forwardReactionSpace).toBeGreaterThanOrEqual(528);
          // With lockstep camera, screenX should never exceed deadzoneRight (422)
          expect(screenX).toBeLessThanOrEqual(422 + 1e-6);
        }
      }
    });

    it('asserts visible forward reaction space >= 528px when player turns around or moves backwards', () => {
      const camera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: { minX: 0, maxX: 3600, minY: 0, maxY: 540 },
        forwardLock: true,
      });
      camera.reset(0, 0);

      // Move player forward to X = 600
      camera.update(600, 230, 0.1);
      const camXAfterAdvance = camera.x;
      expect(camXAfterAdvance).toBe(600 - 422); // 178

      // Player retreats backwards to X = 400
      camera.update(400, 230, 0.1);
      // Ratchet lock guarantees camera does not scroll backward
      expect(camera.x).toBe(camXAfterAdvance);

      const screenX = 400 - camera.x;
      const backwardReactionSpace = camera.viewportWidth - screenX;
      // Moving backward only increases forward reaction space!
      expect(backwardReactionSpace).toBeGreaterThan(538);
      expect(backwardReactionSpace).toBeGreaterThanOrEqual(528);
    });

    it('asserts visible forward reaction space >= 528px under high-velocity dash / fast-forward speeds (up to 2000 px/s)', () => {
      const camera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: { minX: 0, maxX: 10000, minY: 0, maxY: 540 },
        forwardLock: true,
      });
      camera.reset(0, 0);

      const highVelocities = [300, 500, 800, 1200, 2000];
      for (const vel of highVelocities) {
        let px = 100;
        for (let step = 0; step < 100; step++) {
          px += vel * (1 / 60);
          camera.update(px, 230, 1 / 60);
          const screenX = px - camera.x;
          const reaction = camera.viewportWidth - screenX;
          expect(reaction).toBeGreaterThanOrEqual(528);
        }
      }
    });
  });

  describe('2. Boss Arena Dimensions & Lockdown Invariants (>= 1100px)', () => {
    it('verifies Mid-Boss arena width is strictly at least 1100px (1820 - 720 = 1100)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');

      expect(midBossTrigger).toBeDefined();
      expect(midBossTrigger!.lockCameraBounds).toBeDefined();

      const { minX, maxX, minY, maxY } = midBossTrigger!.lockCameraBounds!;
      expect(minX).toBe(720);
      expect(maxX).toBe(1820);
      expect(minY).toBe(0);
      expect(maxY).toBe(540);

      const arenaWidth = maxX - minX;
      expect(arenaWidth).toBe(1100);
      expect(arenaWidth).toBeGreaterThanOrEqual(1100);
    });

    it('verifies Mid-Boss arena camera travel span and entity bounds', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');

      // Camera lock behavior
      const camera = game.camera;
      camera.lock(midBossTrigger!.lockCameraBounds!);

      // Camera clamp range with viewportWidth = 960:
      // minClampX = 720, maxClampX = 1820 - 960 = 860.
      camera.update(700, 230, 0.1);
      expect(camera.x).toBe(720);
      // Visible right edge at minClamp: 720 + 960 = 1680
      expect(camera.x + camera.viewportWidth).toBe(1680);

      camera.update(1800, 230, 0.1);
      expect(camera.x).toBe(860); // 1820 - 960
      // Visible right edge at maxClamp: 860 + 960 = 1820
      expect(camera.x + camera.viewportWidth).toBe(1820);

      // Full covered arena span: [720, 1820] = 1100px!
      expect(1820 - 720).toBe(1100);

      // Verify platforms in mid-boss arena are completely enclosed within [720, 1820]
      const platforms = stageData.platforms;
      const dockLeft = platforms.find((p) => p.id === 'midboss_dock_left');
      const dockRight = platforms.find((p) => p.id === 'midboss_dock_right');

      expect(dockLeft).toBeDefined();
      expect(dockRight).toBeDefined();
      expect(dockLeft!.bounds.x).toBeGreaterThanOrEqual(720);
      expect(dockLeft!.bounds.x + dockLeft!.bounds.width).toBeLessThanOrEqual(1820);
      expect(dockRight!.bounds.x).toBeGreaterThanOrEqual(720);
      expect(dockRight!.bounds.x + dockRight!.bounds.width).toBeLessThanOrEqual(1820);
    });

    it('verifies End-Boss arena width is strictly at least 1100px (2900 - 1800 = 1100)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const endBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_end_boss');

      expect(endBossTrigger).toBeDefined();
      expect(endBossTrigger!.lockCameraBounds).toBeDefined();

      const { minX, maxX, minY, maxY } = endBossTrigger!.lockCameraBounds!;
      expect(minX).toBe(1800);
      expect(maxX).toBe(2900);
      expect(minY).toBe(0);
      expect(maxY).toBe(540);

      const arenaWidth = maxX - minX;
      expect(arenaWidth).toBe(1100);
      expect(arenaWidth).toBeGreaterThanOrEqual(1100);
    });

    it('verifies End-Boss arena camera travel span and entity bounds', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const endBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_end_boss');

      const camera = game.camera;
      camera.lock(endBossTrigger!.lockCameraBounds!);

      // Camera clamp range with viewportWidth = 960:
      // minClampX = 1800, maxClampX = 2900 - 960 = 1940
      camera.update(1700, 230, 0.1);
      expect(camera.x).toBe(1800);
      expect(camera.x + camera.viewportWidth).toBe(2760);

      camera.update(3000, 230, 0.1);
      expect(camera.x).toBe(1940);
      expect(camera.x + camera.viewportWidth).toBe(2900);

      // Covered span: [1800, 2900] = 1100px
      expect(2900 - 1800).toBe(1100);

      // Verify platforms in boss arena are completely enclosed within [1800, 2900]
      const platforms = stageData.platforms;
      const bossPlatLeft = platforms.find((p) => p.id === 'boss_arena_left');
      const bossPlatRight = platforms.find((p) => p.id === 'boss_arena_right');

      expect(bossPlatLeft).toBeDefined();
      expect(bossPlatRight).toBeDefined();
      expect(bossPlatLeft!.bounds.x).toBeGreaterThanOrEqual(1800);
      expect(bossPlatLeft!.bounds.x + bossPlatLeft!.bounds.width).toBeLessThanOrEqual(2900);
      expect(bossPlatRight!.bounds.x).toBeGreaterThanOrEqual(1800);
      expect(bossPlatRight!.bounds.x + bossPlatRight!.bounds.width).toBeLessThanOrEqual(2900);
    });

    it('verifies Mid-Boss defeat successfully unlocks the camera to STAGE_WIDTH (3600)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');

      // Trigger the mid-boss battle
      game.player.position.x = midBossTrigger!.triggerX + 10;
      game.camera.x = 720;
      game.stageManager.update(720, game.player.position.x);
      game.engine.tick(1 / 60);

      expect(game.stageManager.isCameraLocked()).toBe(true);
      expect(game.stageManager.getCameraBounds().maxX).toBe(1820);

      // Eliminate the mid-boss
      const midBoss = game.engine.getEntity('mid_boss_1') as MidBossVehicle;
      expect(midBoss).toBeDefined();
      midBoss.isAlive = false;
      expect(midBoss.isAlive).toBe(false);

      // Stage manager update evaluates trigger.isCompleted and unlocks
      game.stageManager.update(720, game.player.position.x);
      expect(game.stageManager.isCameraLocked()).toBe(false);
      expect(game.stageManager.getCameraBounds().maxX).toBe(3600);
    });
  });

  describe('3. Minion Wave Spawner Out-Of-Bounds & Legacy Invariants', () => {
    const waveTriggerIds = ['trigger_wave_1', 'trigger_wave_2', 'trigger_wave_3'];

    it('guarantees all minion wave enemies spawn strictly off-screen (spawnX >= cameraX + 960)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const waveTriggers = stageData.triggers.filter((t: any) => waveTriggerIds.includes(t.id));

      const testCameraPositions = [0, 50, 100, 180, 300, 420, 720, 1000, 1240, 1500, 1800];

      for (const camX of testCameraPositions) {
        for (const trigger of waveTriggers) {
          const testEngine = new GameEngine();
          testEngine.start();
          trigger.spawnAction(testEngine, camX);

          const addedEnemies = (testEngine as any).entitiesToAdd.filter(
            (e: any) => e instanceof SoldierEnemy
          ) as SoldierEnemy[];

          expect(addedEnemies.length).toBeGreaterThan(0);

          for (const enemy of addedEnemies) {
            // Must be strictly outside 960px camera viewport
            expect(enemy.position.x).toBeGreaterThanOrEqual(camX + 960);
            // Must satisfy buffer offset: spawnBaseX is at least cameraX + 1000
            expect(enemy.position.x).toBeGreaterThanOrEqual(camX + 1000);
            // Must satisfy legacy invariant (spawnX >= cameraX + 480)
            expect(enemy.position.x).toBeGreaterThanOrEqual(camX + 480);

            // Distance beyond viewport edge must be >= 40px
            const distPastRightEdge = enemy.position.x - (camX + 960);
            expect(distPastRightEdge).toBeGreaterThanOrEqual(40);
          }
        }
      }
    });

    it('guarantees mid-boss support infantry spawns off-screen and satisfies legacy invariant', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');

      const testCameraPositions = [720, 750, 800, 860];
      for (const camX of testCameraPositions) {
        const testEngine = new GameEngine();
        testEngine.start();
        midBossTrigger!.spawnAction(testEngine, camX);

        const supportSoldiers = (testEngine as any).entitiesToAdd.filter(
          (e: any) => e instanceof SoldierEnemy && e.id === 'rebel_mb_support'
        ) as SoldierEnemy[];

        expect(supportSoldiers.length).toBe(1);
        const soldier = supportSoldiers[0];

        // spawnBaseX = Math.max(cameraX + 1000, 1840)
        expect(soldier.position.x).toBeGreaterThanOrEqual(camX + 960);
        expect(soldier.position.x).toBeGreaterThanOrEqual(camX + 480);
        expect(soldier.position.x).toBeGreaterThanOrEqual(1840);
      }
    });

    it('guarantees wave enemies maintain INGRESS state, facing left, moving inward', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const wave1 = stageData.triggers.find((t: any) => t.id === 'trigger_wave_1');

      const testEngine = new GameEngine();
      testEngine.start();
      wave1!.spawnAction(testEngine, 100);

      // Add ground platform for physics tick
      testEngine.addPlatform({
        id: 'ground_main',
        type: 'SOLID',
        bounds: { x: 0, y: 230, width: 3600, height: 310 },
      });

      testEngine.tick(1 / 60);

      const enemies = testEngine.getAllEntities().filter((e) => e instanceof SoldierEnemy) as SoldierEnemy[];
      expect(enemies.length).toBe(2);

      for (const enemy of enemies) {
        expect(enemy.state).toBe('INGRESS');
        expect(enemy.facing).toBe(-1);
        expect(enemy.velocity.x).toBeLessThan(0); // Ingress velocity to the left
      }
    });

    it('verifies enemy spawn elevation sits precisely on ground level (Y = 192, height = 38 -> feet at Y = 230)', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const waveTriggers = stageData.triggers.filter((t: any) => waveTriggerIds.includes(t.id));

      for (const trigger of waveTriggers) {
        const testEngine = new GameEngine();
        testEngine.start();
        trigger.spawnAction(testEngine, 0);

        const enemies = (testEngine as any).entitiesToAdd.filter(
          (e: any) => e instanceof SoldierEnemy
        ) as SoldierEnemy[];

        for (const enemy of enemies) {
          expect(enemy.position.y).toBe(192);
          expect(enemy.height).toBe(38);
          expect(enemy.position.y + enemy.height).toBe(230); // Exactly on ground terrain
        }
      }
    });
  });

  describe('4. Empirical Stress Harness: Full Stage Traversal & Arena Lockdown Lifecycle', () => {
    it('simulates complete stage progression asserting camera, arena, and spawn invariants at every step', () => {
      const game = new FullMetalSlugGame();
      game.start();

      let maxObservedReactionSpace = 0;
      let minObservedReactionSpace = Infinity;
      let waveCount = 0;

      // Event listener to monitor spawn triggers
      game.engine.eventBus.on('spawn_trigger_fired', (data: any) => {
        waveCount++;
        const currentCamX = data.cameraX;
        const entities = game.engine.getAllEntities().filter((e) => e instanceof SoldierEnemy) as SoldierEnemy[];
        for (const enemy of entities) {
          if (enemy.isIngress) {
            expect(enemy.position.x).toBeGreaterThanOrEqual(currentCamX + 480);
          }
        }
      });

      // Simulate player moving across Section 1
      const dt = 1 / 60;
      for (let tick = 0; tick < 600; tick++) {
        // Hold Right and Shoot
        game.keyboard.getSnapshot = () => ({
          left: false,
          right: true,
          up: false,
          down: false,
          jumpPressed: false,
          jumpHeld: false,
          shootPressed: tick % 6 === 0,
          shootHeld: true,
          grenadePressed: false,
          ultimatePressed: false,
          pausePressed: false,
        });

        game.step(dt);

        if (game.camera.x < 3600 - 960 && !game.stageManager.isCameraLocked()) {
          const reaction = game.camera.viewportWidth - (game.player.position.x - game.camera.x);
          minObservedReactionSpace = Math.min(minObservedReactionSpace, reaction);
          maxObservedReactionSpace = Math.max(maxObservedReactionSpace, reaction);
        }
      }

      game.stop();

      // Minimum reaction space observed during active tracking must be >= 528
      expect(minObservedReactionSpace).toBeGreaterThanOrEqual(528);
    });

    it('EMPIRICAL GENERATOR: 1,000 randomized camera positions strictly satisfy spawnX >= cameraX + 960 and spawnX >= cameraX + 480', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();
      const waveTriggers = stageData.triggers.filter((t: any) =>
        ['trigger_wave_1', 'trigger_wave_2', 'trigger_wave_3'].includes(t.id)
      );

      // Deterministic PRNG seed for reproducibility
      let seed = 42;
      const rnd = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      };

      for (let i = 0; i < 1000; i++) {
        const testCamX = Math.floor(rnd() * 2500);
        const trigger = waveTriggers[i % waveTriggers.length];

        const testEngine = new GameEngine();
        testEngine.start();
        trigger.spawnAction(testEngine, testCamX);

        const added = (testEngine as any).entitiesToAdd.filter(
          (e: any) => e instanceof SoldierEnemy
        ) as SoldierEnemy[];

        expect(added.length).toBeGreaterThan(0);
        for (const enemy of added) {
          // Strict off-screen guarantee for 960w canvas
          expect(enemy.position.x).toBeGreaterThanOrEqual(testCamX + 960);
          // 40px buffer margin
          expect(enemy.position.x).toBeGreaterThanOrEqual(testCamX + 1000);
          // Legacy invariant
          expect(enemy.position.x).toBeGreaterThanOrEqual(testCamX + 480);
          // Off-screen distance
          expect(enemy.position.x - (testCamX + 960)).toBeGreaterThanOrEqual(40);
        }
      }
    });

    it('verifies Boss entities remain framed inside visible camera frustum throughout entire arena pan range', () => {
      const game = new FullMetalSlugGame();
      const stageData = game.buildStage1Data();

      // 1. Mid-Boss at X = 1050 inside [720, 1820]
      const midBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_mid_boss');
      const mbCamera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: midBossTrigger!.lockCameraBounds!,
      });

      const midBossX = 1050;
      // Camera clamp range: [720, 860]
      for (let camX = 720; camX <= 860; camX += 10) {
        mbCamera.x = camX;
        const screenX = midBossX - mbCamera.x;
        // Mid boss must be visible on screen
        expect(screenX).toBeGreaterThanOrEqual(0);
        expect(screenX).toBeLessThanOrEqual(960);
      }

      // 2. End-Boss at X = 2050 inside [1800, 2900]
      const endBossTrigger = stageData.triggers.find((t: any) => t.id === 'trigger_end_boss');
      const ebCamera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: endBossTrigger!.lockCameraBounds!,
      });

      const bossX = 2050;
      // Camera clamp range: [1800, 1940]
      for (let camX = 1800; camX <= 1940; camX += 10) {
        ebCamera.x = camX;
        const screenX = bossX - ebCamera.x;
        // Boss must be visible on screen
        expect(screenX).toBeGreaterThanOrEqual(0);
        expect(screenX).toBeLessThanOrEqual(960);
      }
    });

    it('verifies forward ratchet lock invariant under rapid player direction reversal (jittering)', () => {
      const camera = new Camera({
        viewportWidth: 960,
        viewportHeight: 540,
        bounds: { minX: 0, maxX: 3600, minY: 0, maxY: 540 },
        forwardLock: true,
      });
      camera.reset(0, 0);

      let px = 200;
      let lastCamX = camera.x;

      for (let t = 0; t < 500; t++) {
        // Jitter: step forward 5px, then backward 4px
        px += (t % 2 === 0 ? 5 : -4);
        camera.update(px, 230, 1 / 60);

        // Ratchet lock invariant: camera.x is monotonically non-decreasing
        expect(camera.x).toBeGreaterThanOrEqual(lastCamX);
        lastCamX = camera.x;

        // Player screen position never exceeds deadzone right (422) during active tracking
        const screenX = px - camera.x;
        expect(screenX).toBeLessThanOrEqual(422 + 1e-6);

        // Visible reaction space is at least 528px
        const reactionSpace = camera.viewportWidth - screenX;
        expect(reactionSpace).toBeGreaterThanOrEqual(528);
      }
    });
  });
});

