import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('R3: Cute Shooter Gameplay Loop & Visual Proof Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/cute_reinvention');

  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  // =========================================================================
  // TEST 1: Continuous 15+ Second Active Gameplay Loop Simulation
  // =========================================================================
  test('Playable Core Loop: actively plays novel cute game loop for >= 15 continuous seconds without JS or engine errors', async ({
    page,
  }) => {
    test.setTimeout(60000); // 60s timeout for safety

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Boot and verify canvas mount
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });
    await page.waitForFunction(
      () => {
        const w = window as any;
        return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
      },
      { timeout: 10000 }
    );

    await page.focus('canvas#game-canvas');

    // 2. Initial state sampling
    const initialDiag = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      return {
        hasGame: !!game,
        initialX: game.player.position.x,
        initialY: game.player.position.y,
        initialScore: game.player.score,
        initialLives: game.player.lives,
      };
    });

    expect(initialDiag.hasGame).toBe(true);
    expect(initialDiag.initialLives).toBeGreaterThanOrEqual(1);

    // 3. Active 16-second human-like playtest loop partitioned into 5 dynamic phases
    const TARGET_SIMULATION_DURATION_MS = 16000;
    const startTime = Date.now();
    let sampleCounter = 0;

    while (Date.now() - startTime < TARGET_SIMULATION_DURATION_MS) {
      const elapsedMs = Date.now() - startTime;
      const phase = elapsedMs / 1000;

      // Handle any active perk selection modal gracefully
      await page.evaluate(() => {
        const game = (window as any).__GAME__;
        if (game?.cuteCoordinator?.perks?.isModalActive) {
          game.cuteCoordinator.choosePerk(0);
        }
      });

      // Dynamic phase-based input actions
      if (phase < 3.0) {
        // Phase 1 (0-3s): Arena entry, navigate right, jump onto initial platform, fire sweet bubbles
        await page.keyboard.down('ArrowRight');
        if (Math.random() < 0.25) await page.keyboard.press('Space');
        if (Math.random() < 0.5) await page.keyboard.press('KeyJ');
        await page.waitForTimeout(120);
        await page.keyboard.up('ArrowRight');
      } else if (phase < 7.0) {
        // Phase 2 (3-7s): Combat & Bubble cascade targeting, alternating left/right
        const moveKey = Math.random() < 0.6 ? 'ArrowRight' : 'ArrowLeft';
        await page.keyboard.down(moveKey);
        await page.keyboard.press('KeyJ'); // shoot bubble
        if (Math.random() < 0.35) await page.keyboard.press('Space'); // hop
        await page.waitForTimeout(140);
        await page.keyboard.up(moveKey);
      } else if (phase < 11.0) {
        // Phase 3 (7-11s): Acrobatic platform navigation & candy pickup
        await page.keyboard.down('ArrowRight');
        await page.keyboard.down('Space');
        await page.waitForTimeout(180);
        await page.keyboard.up('Space');
        await page.keyboard.press('KeyJ');
        await page.keyboard.up('ArrowRight');
        await page.waitForTimeout(100);
      } else if (phase < 13.5) {
        // Phase 4 (11-13.5s): Trigger Sweet Blossom / Rainbow Rush Ultimate
        await page.keyboard.press('KeyU');
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(150);
      } else {
        // Phase 5 (13.5-16s): Post-burst cleanup and flower altar navigation
        await page.keyboard.down('ArrowLeft');
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(120);
        await page.keyboard.up('ArrowLeft');
      }

      // Periodic health check every ~1.5s
      sampleCounter++;
      if (sampleCounter % 10 === 0) {
        const status = await page.evaluate(() => {
          const game = (window as any).__GAME__;
          return {
            x: game.player.position.x,
            y: game.player.position.y,
            isAlive: game.player.isAlive,
            entitiesCount:
              game.engine.getAllEntities().length +
              (game.cuteCoordinator?.enemyManager?.enemies?.length ?? 0) +
              (game.cuteCoordinator?.bubbleManager?.bubbles?.length ?? 0),
          };
        });

        // Assert coordinates are valid real numbers (no NaN or Inf corruption)
        expect(Number.isFinite(status.x)).toBe(true);
        expect(Number.isFinite(status.y)).toBe(true);
        expect(status.entitiesCount).toBeGreaterThanOrEqual(1);

        // Assert zero uncaught runtime errors during active play
        expect(pageErrors).toHaveLength(0);
        expect(consoleErrors).toHaveLength(0);
      }
    }

    const actualDurationMs = Date.now() - startTime;

    // 4. Concluding Invariant Assertions
    expect(actualDurationMs).toBeGreaterThanOrEqual(15000);
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    const finalDiag = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      return {
        finalX: game.player.position.x,
        finalY: game.player.position.y,
        finalScore: game.player.score,
        hasEntities: game.engine.getAllEntities().length > 0,
      };
    });

    expect(Number.isFinite(finalDiag.finalX)).toBe(true);
    expect(finalDiag.hasEntities).toBe(true);
  });

  // =========================================================================
  // TEST 2: Visual Proof Screenshot Capture Pipeline
  // =========================================================================
  test('Visual Proof: capture 4 canonical screenshots to artifacts/cute_reinvention/', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForFunction(() => (window as any).__GAME__?.player);

    const canvas = page.locator('canvas#game-canvas');

    // Enforce 960x540 viewport styling
    await page.evaluate(() => {
      const canvasEl = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvasEl) {
        canvasEl.style.width = '960px';
        canvasEl.style.height = '540px';
      }
      const game = (window as any).__GAME__;
      if (game && typeof game.stop === 'function') {
        game.stop();
      }
      // Dismiss tutorial placard for clean artistic framing
      if (game) {
        game.showTutorial = false;
        game.tutorialAlpha = 0;
      }
    });

    // -----------------------------------------------------------------------
    // Screenshot 1: 01_cute_hero_and_pastel_world.png
    // Chibi hero, pastel meadow, beating heart HUD, wafer platforms
    // -----------------------------------------------------------------------
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 220;
      game.player.position.y = 192;
      game.player.facing = 1;
      game.player.score = 12500;
      game.player.lives = 3;
      game.camera.x = 0;
      game.camera.y = 0;
      game.render?.();
    });
    await page.waitForTimeout(150);
    await canvas.screenshot({
      path: path.join(ARTIFACT_DIR, '01_cute_hero_and_pastel_world.png'),
    });

    // -----------------------------------------------------------------------
    // Screenshot 2: 02_cute_combat_and_candy_projectiles.png
    // Active bubble combat, candy pickups, bouncy marshmallow enemies
    // -----------------------------------------------------------------------
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 280;
      game.player.position.y = 192;
      game.camera.x = 0;

      // Spawn sweet iridescent bubbles
      const bm = game.cuteCoordinator.bubbleManager;
      bm.shootBubble(330, 185, 260, -30);
      bm.shootBubble(370, 160, 220, -50);
      bm.shootBubble(420, 140, 180, -20);

      // Spawn candy and star crystal pickups
      bm.pickups.push(
        { id: 'candy_1', type: 'candy', x: 260, y: 175, vx: 0, vy: 0, value: 50, feverCharge: 0.05, age: 1.0, lifespan: 12.0, isAlive: true },
        { id: 'star_1', type: 'star', x: 310, y: 165, vx: 0, vy: 0, value: 200, feverCharge: 0.12, age: 1.0, lifespan: 12.0, isAlive: true },
        { id: 'heart_1', type: 'heart', x: 350, y: 170, vx: 0, vy: 0, value: 300, feverCharge: 0.08, age: 1.0, lifespan: 12.0, isAlive: true },
        { id: 'candy_2', type: 'candy', x: 390, y: 180, vx: 0, vy: 0, value: 50, feverCharge: 0.05, age: 1.0, lifespan: 12.0, isAlive: true }
      );

      // Spawn cute bouncy enemy facing hero
      const em = game.cuteCoordinator.enemyManager;
      em.spawnEnemy('MARSHMALLOW_SLIME', 480, 192, -1);
      em.spawnEnemy('HONEY_BEE', 440, 130, -1);

      game.render?.();
    });
    await page.waitForTimeout(150);
    await canvas.screenshot({
      path: path.join(ARTIFACT_DIR, '02_cute_combat_and_candy_projectiles.png'),
    });

    // -----------------------------------------------------------------------
    // Screenshot 3: 03_cute_star_blossom_ultimate.png
    // Sweet star blossom / rainbow rush ultimate burst with radial star sparks
    // -----------------------------------------------------------------------
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const bm = game.cuteCoordinator.bubbleManager;

      // Activate Sweet Fever (Rainbow Sugar Rush)
      bm.feverMeter = 1.0;
      bm.activateFever();

      // Trigger Ultimate move
      if (game.player.ultimateManager) {
        game.player.ultimateManager.stock = 1;
        game.player.ultimateManager.trigger(game.engine, game.player);
      }

      // Populate popping bubble radial star shards
      const centerX = 360;
      const centerY = 170;
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const speed = 120 + (i % 3) * 40;
        bm.shards.push({
          x: centerX + Math.cos(angle) * 20,
          y: centerY + Math.sin(angle) * 20,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: i % 2 === 0 ? '#FED330' : '#FF69B4',
          age: 0.1,
          lifespan: 0.6,
          isAlive: true,
        });
      }

      game.render?.();
    });
    await page.waitForTimeout(150);
    await canvas.screenshot({
      path: path.join(ARTIFACT_DIR, '03_cute_star_blossom_ultimate.png'),
    });

    // -----------------------------------------------------------------------
    // Screenshot 4: 04_cute_arena_overview.png
    // Panoramic view with Mochi pet companion, Blossom Altars
    // -----------------------------------------------------------------------
    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.camera.x = 80;
      game.camera.y = 0;

      // Hero positioning
      game.player.position.x = 340;
      game.player.position.y = 192;

      // Mochi the Cloud Bunny pet companion hover position
      if (game.cuteCoordinator.pet) {
        game.cuteCoordinator.pet.x = 390;
        game.cuteCoordinator.pet.y = 150;
        game.cuteCoordinator.pet.state = 'cheer';
      }

      // Blossom Altars progress
      const altars = game.cuteCoordinator.altars.altars;
      if (altars.length >= 3) {
        altars[0].purificationProgress = 0.9;
        altars[1].purificationProgress = 0.6;
        altars[2].purificationProgress = 1.0;
        altars[2].isBloomed = true;
      }

      game.render?.();
    });
    await page.waitForTimeout(150);
    await canvas.screenshot({
      path: path.join(ARTIFACT_DIR, '04_cute_arena_overview.png'),
    });

    // Validate existence of all 4 artifacts and size > 10,000 bytes
    const files = [
      '01_cute_hero_and_pastel_world.png',
      '02_cute_combat_and_candy_projectiles.png',
      '03_cute_star_blossom_ultimate.png',
      '04_cute_arena_overview.png',
    ];

    for (const file of files) {
      const filePath = path.join(ARTIFACT_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(10000);
    }
  });

  // =========================================================================
  // TEST 3: Artifact Binary Integrity & Dimensions Audit
  // =========================================================================
  test('Artifact Audit: validate PNG magic header and 960x540 dimensions', async () => {
    const files = [
      '01_cute_hero_and_pastel_world.png',
      '02_cute_combat_and_candy_projectiles.png',
      '03_cute_star_blossom_ultimate.png',
      '04_cute_arena_overview.png',
    ];

    for (const file of files) {
      const filePath = path.join(ARTIFACT_DIR, file);
      expect(fs.existsSync(filePath)).toBe(true);
      const buffer = fs.readFileSync(filePath);

      // Verify PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50);
      expect(buffer[2]).toBe(0x4e);
      expect(buffer[3]).toBe(0x47);
      expect(buffer[4]).toBe(0x0d);
      expect(buffer[5]).toBe(0x0a);
      expect(buffer[6]).toBe(0x1a);
      expect(buffer[7]).toBe(0x0a);

      // Verify PNG IHDR width & height at bytes 16-23
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width).toBe(960);
      expect(height).toBe(540);
    }
  });
});
