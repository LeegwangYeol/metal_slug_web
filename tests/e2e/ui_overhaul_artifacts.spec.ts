import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: UI/UX & Level Design Overhaul Visual Verification Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/ui_overhaul');

  test.beforeAll(async () => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  /**
   * Helper: navigates to root, waits for game engine bootstrap,
   * enforces 960x540 presentation, and stops RAF loop for deterministic control.
   */
  async function setupDeterministicGame(page: any) {
    await page.goto('/');
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => {
      const w = window as any;
      return (
        w.__GAME__ &&
        w.__GAME__.engine &&
        w.__GAME__.player &&
        w.__GAME__.renderer &&
        w.__GAME__.stageManager
      );
    });

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
      const game = (window as any).__GAME__;
      if (game && typeof game.stop === 'function') {
        game.stop();
      }
    });
  }

  test('Test 1: Capture artifacts/ui_overhaul/screen_terrain.png (16:9 panoramic widescreen view, multi-tier platforms, destructible obstacles, coastal parallax, and arcade HUD)', async ({
    page,
  }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      // Position camera at x = 0 to encompass Zone 1 & Zone 2 platforms (0..960px)
      game.camera.x = 0;
      game.camera.y = 0;

      // Equip player with Heavy Machine Gun & configure heroic position atop suspension bridge
      game.player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
      game.player.position.x = 460;
      game.player.position.y = 140; // On bridge_1 (y: 140)
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.player.isCrouching = false;
      game.player.score = 25800;
      game.player.lives = 3;
      game.player.weaponManager.setGrenadeCount(10);
      if (game.player.ultimateManager) {
        game.player.ultimateManager.stock = 1;
      }

      // Ensure static obstacles and POWs are initialized in engine
      game.initStaticObstacles();
      game.initStaticPows();

      // Clear any spawned minion overlap from initial wave for clean scenic framing
      const minions = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      minions.forEach((m: any) => engine.removeEntity(m.id));

      // Trigger wave 1 and position a patrolling soldier near watchtower (x = 650)
      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) {
        wave1.spawnAction(engine, 0);
      }
      const soldier = engine.getAllEntities().find((e: any) => e.type && e.type.startsWith('SOLDIER') && e.isAlive);
      if (soldier) {
        soldier.position.x = 650;
        soldier.position.y = 192;
        soldier.facing = -1;
        soldier.state = 'PATROL';
      }

      // Dismiss tutorial placard for this landscape capture to present unobstructed 16:9 terrain
      game.showTutorial = false;
      game.tutorialAlpha = 0;

      // Advance 5 deterministic frames to settle physics & animations
      for (let i = 0; i < 5; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'screen_terrain.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 1] screen_terrain.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(10240); // > 10KB
  });

  test('Test 2: Capture artifacts/ui_overhaul/respawn_tutorial.png (on-screen tutorial placard with keybindings grid and tactical parachute respawn)', async ({
    page,
  }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;

      // Position camera at x = 0
      game.camera.x = 0;
      game.camera.y = 0;

      // Activate the on-screen tutorial placard (cardX: 250..710, cardY: 36..211)
      game.showTutorial = true;
      game.tutorialAlpha = 1.0;
      game.tutorialTimer = 999999; // Keep pinned open

      // Place player in tactical parachute respawn descent alongside the tutorial card
      // Parachute canopy at y ~ 24, player at y = 80, clear of card on the left side
      game.player.startParachuteRespawn(140, 80);
      game.player.facing = 1;
      game.player.parachuteSwayAngle = 0.14;
      game.player.score = 16400;

      // Advance 3 deterministic frames
      for (let i = 0; i < 3; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'respawn_tutorial.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 2] respawn_tutorial.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(10240); // > 10KB
  });

  test('Test 3 (Supplementary): Capture artifacts/ui_overhaul/continue_countdown.png (arcade Continue countdown screen with giant digits, coin prompt, and distressed chibi Marco)', async ({
    page,
  }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;

      // Position camera
      game.camera.x = 0;
      game.camera.y = 0;

      // Dismiss tutorial placard so Continue overlay is fully in focus
      game.showTutorial = false;
      game.tutorialAlpha = 0;

      // Trigger classic arcade 10-second Continue Countdown state
      game.player.startContinueCountdown();
      game.player.continueTimer = 9.0; // Prominent giant digit '9'
      game.player.lives = 0;

      // Render continue countdown screen
      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'continue_countdown.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 3] continue_countdown.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(10240); // > 10KB
  });

  test('Test 4: Validate all screenshot artifacts (existence, file size > 10KB, and valid PNG magic bytes + 960x540 dimensions)', async () => {
    const requiredArtifacts = [
      'screen_terrain.png',
      'respawn_tutorial.png',
      'continue_countdown.png',
    ];

    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const filename of requiredArtifacts) {
      const filePath = path.join(ARTIFACT_DIR, filename);
      expect(fs.existsSync(filePath), `Missing screenshot artifact: ${filename}`).toBe(true);

      const stats = fs.statSync(filePath);
      expect(
        stats.size,
        `Screenshot ${filename} size (${stats.size} bytes) must be greater than 10KB (10240 bytes)`
      ).toBeGreaterThan(10240);

      // Binary verification: PNG signature & IHDR chunk resolution
      const buffer = fs.readFileSync(filePath);
      expect(buffer.length).toBeGreaterThanOrEqual(24);

      const headerMagic = buffer.subarray(0, 8);
      expect(headerMagic.equals(PNG_SIGNATURE), `${filename} must start with valid PNG magic bytes`).toBe(true);

      const ihdrChunk = buffer.subarray(12, 16).toString('ascii');
      expect(ihdrChunk, `${filename} must contain IHDR chunk header`).toBe('IHDR');

      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `${filename} width must match 960`).toBe(960);
      expect(height, `${filename} height must match 540`).toBe(540);

      console.log(`[Verified] ${filename}: ${stats.size} bytes, ${width}x${height} PNG`);
    }
  });
});
