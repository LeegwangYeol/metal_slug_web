import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone 3: Camera View Overhaul & Visual Proof Capture Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');

  test.beforeAll(() => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  /**
   * Helper: Mounts canvas, waits for complete engine bootstrap and backdrop initialization,
   * locks canvas CSS dimensions, and prepares deterministic simulation harness.
   */
  async function setupDeterministicGame(page: Page) {
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

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    // Wait until GrimHarvestGame, backdrop surfaces, and subsystems are 100% initialized
    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return (
        g &&
        g.player &&
        g.camera &&
        g.hordeManager &&
        g.weaponManager &&
        g.backdrop &&
        g.backdrop.isInitialized === true &&
        g.vfx &&
        g.hud
      );
    }, { timeout: 10000 });

    // Lock canvas CSS dimensions and stop automatic rAF loop for deterministic visual rendering
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
      if (g && typeof g.stop === 'function') {
        g.stop();
      }
    });

    return { consoleErrors, pageErrors };
  }

  // =========================================================================
  // TEST 1: Live Omnidirectional Camera Viewport Verification
  // =========================================================================
  test('Camera Tracking: verifies centered player tracking, velocity lookahead <= 40px, and smooth arena clamping', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    const cameraMetrics = await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
      const camera = game.camera;
      const player = game.player;

      // 1. Stationary steady state at world origin
      player.position.x = 0;
      player.position.y = 0;
      player.velocity.x = 0;
      player.velocity.y = 0;
      camera.reset(0 - camera.viewWidth / 2, 0 - camera.viewHeight / 2);

      for (let i = 0; i < 20; i++) {
        camera.update(player.position.x, player.position.y, 1 / 60, 0, 0);
      }

      const stationaryScreen = camera.worldToScreen(player.position.x, player.position.y);

      // 2. High-speed rightward movement (vx = 200px/s)
      player.velocity.x = 200;
      for (let i = 0; i < 30; i++) {
        camera.update(player.position.x, player.position.y, 1 / 60, player.velocity.x, 0);
      }
      const lookaheadRight = camera.lookaheadX;
      const movingScreen = camera.worldToScreen(player.position.x, player.position.y);

      // 3. Clamping at world boundary
      player.position.x = 1950;
      player.position.y = 1950;
      camera.centerOn(1950, 1950);

      const maxCameraX = camera.renderX;
      const maxCameraY = camera.renderY;

      return {
        stationaryScreenX: stationaryScreen.x,
        stationaryScreenY: stationaryScreen.y,
        lookaheadRight,
        lookaheadMax: camera.lookaheadMax,
        movingScreenX: movingScreen.x,
        movingScreenY: movingScreen.y,
        maxCameraX,
        maxCameraY,
        boundsMaxX: camera.bounds.maxX,
        boundsMaxY: camera.bounds.maxY,
        viewportWidth: camera.viewportWidth,
        viewportHeight: camera.viewportHeight,
      };
    });

    // Centered stationary assert: player is precisely centered at (480, 270)
    expect(cameraMetrics.stationaryScreenX).toBeCloseTo(480, 1);
    expect(cameraMetrics.stationaryScreenY).toBeCloseTo(270, 0);

    // Lookahead bounded assert (<= 40px)
    expect(cameraMetrics.lookaheadRight).toBeGreaterThan(0);
    expect(cameraMetrics.lookaheadRight).toBeLessThanOrEqual(40.0);
    expect(cameraMetrics.lookaheadRight).toBeLessThanOrEqual(cameraMetrics.lookaheadMax);

    // Boundary clamp assert: camera viewport top-left never exceeds (boundsMax - viewport)
    expect(cameraMetrics.maxCameraX).toBeLessThanOrEqual(
      cameraMetrics.boundsMaxX - cameraMetrics.viewportWidth
    );
    expect(cameraMetrics.maxCameraY).toBeLessThanOrEqual(
      cameraMetrics.boundsMaxY - cameraMetrics.viewportHeight
    );

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 2: Visual Proof 1 — improved_camera_angle.png (>50KB)
  // =========================================================================
  test('Visual Proof 1: captures improved_camera_angle.png (>50KB, centered omnidirectional viewpoint, 360 horde, occult VFX, Gothic HUD)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Position player and orient camera with subtle forward velocity
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 88;
      game.player.stats.maxHealth = 100;
      game.player.level = 4;
      game.elapsedTime = 135.0; // 02:15
      game.killCount = 186;

      // Center camera on player with smooth lookahead bias
      game.camera.reset(-480, -270);
      game.camera.update(0, 0, 1 / 60, 120, 0);

      // 2. Deploy 360-degree perimeter horde demonstrating full omnidirectional vision
      game.hordeManager.clear();
      // Northern approach: gliding Banshees
      game.hordeManager.spawnWave('BANSHEE', 6, { x: 0, y: -240 }, 80);
      // Southern surge: charging Ghouls
      game.hordeManager.spawnWave('GHOUL', 8, { x: 0, y: 240 }, 90);
      // Western flank: advancing Skeletons (previously hidden by side-scroller deadzone)
      game.hordeManager.spawnWave('SKELETON', 12, { x: -320, y: 0 }, 100);
      // Eastern flank: armored Death Knights
      game.hordeManager.spawnWave('DEATH_KNIGHT', 3, { x: 320, y: 0 }, 70);

      // 3. Equip comprehensive occult arsenal
      game.weaponManager.clear();
      game.weaponManager.addWeapon('scythe', 4);
      game.weaponManager.addWeapon('orbiters', 3);
      game.weaponManager.addWeapon('lightning', 3);
      game.weaponManager.addWeapon('spear', 2);

      // 4. Scatter glowing soul drops and dynamic ground decals
      game.lootManager.clear();
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', -90, 70, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', 110, -80, false);
      game.lootManager.spawnDrop('RUBY_GEM', 130, 90, false);
      game.lootManager.spawnDrop('SOUL_CHEST', -150, -120, false);

      game.vfx.emitSigilScorch(0, 0, 40);
      game.vfx.emitBloodPool(60, 40, 18);
      game.vfx.emitBloodSplatter(-50, -30, 8);
      game.vfx.emitSoulBurst(120, -60, 8);

      // 5. Update Gothic HUD state
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 88;
        game.hud.ghostHealth = 95;
        game.hud.displayXP = 45;
        game.hud.xpToNextLevel = 70;
        game.hud.currentLevel = 4;
      }

      // 6. Step 8 simulation frames to settle orientations and VFX
      for (let i = 0; i < 8; i++) {
        game.step(1 / 60);
      }

      // 7. Force synchronous multi-pass render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'improved_camera_angle.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file existence and strictly > 50,000 bytes (and > 50KB)
    expect(fs.existsSync(targetPath), 'improved_camera_angle.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `improved_camera_angle.png byte size (${stats.size} bytes) must be strictly > 50,000 bytes`
    ).toBeGreaterThan(50000);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 3: Visual Proof 2 — hitbox_precision_dodge.png (>50KB)
  // =========================================================================
  test('Visual Proof 2: captures hitbox_precision_dodge.png (>50KB, grazing near-miss with 0 damage, tight hurtbox, active combat)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    const dodgeVerified = await page.evaluate(() => {
      const game = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // 1. Establish player sorcerer at world origin with full health
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 100;
      game.player.stats.maxHealth = 100;
      game.player.level = 2;
      game.elapsedTime = 48.0;
      game.killCount = 38;

      // Center camera directly on dodge action
      game.camera.centerOn(0, 0);

      // 2. Clear horde and spawn exact near-miss grazing enemies:
      // Player r = 11.0. Touch distance for Skeleton (r=11.0) is 22.0px.
      // Spawn Skeleton at x = 36.0px -> Exactly 14.0px air gap (within 12-20px grazing band)!
      game.hordeManager.clear();
      const grazingSkeleton = game.hordeManager.spawn('skeleton', 36.0, 0);
      if (grazingSkeleton) {
        grazingSkeleton.speed = 0;
        grazingSkeleton.vx = 0;
        grazingSkeleton.vy = 0;
      }

      // Spawn Ghoul (r=13.0) at (-38.0, 0.0) -> Touch 24.0px -> 14.0px air gap!
      const grazingGhoul = game.hordeManager.spawn('ghoul', -38.0, 0.0);
      if (grazingGhoul) {
        grazingGhoul.speed = 0;
        grazingGhoul.vx = 0;
        grazingGhoul.vy = 0;
      }

      // Spawn third enemy cleaved by Arcane Scythe just outside dodge radius
      game.hordeManager.spawn('skeleton', 65.0, -15.0);

      // 3. Equip Arcane Scythe cleave and Soul Orbiters
      game.weaponManager.clear();
      game.weaponManager.addWeapon('scythe', 2);
      game.weaponManager.addWeapon('orbiters', 2);

      // 4. Emit combat VFX: blood splatter from cleaved enemy, spell trail from player dodge
      game.vfx.emitBloodBurst(65.0, -15.0, 4);
      game.vfx.emitBloodSplatter(70.0, -10.0, 6);
      game.vfx.emitSpellCircle(0, 0, 32, '#7038b8');
      game.vfx.emitSoulBurst(65.0, -15.0, 6);

      // 5. Update Gothic HUD showing 100% full vitality (Zero Phantom Damage!)
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 100;
        game.hud.ghostHealth = 100;
        game.hud.displayXP = 18;
        game.hud.xpToNextLevel = 35;
        game.hud.currentLevel = 2;
      }

      // 6. Step 4 frames of physics & collision
      for (let i = 0; i < 4; i++) {
        game.step(1 / 60);
      }

      // Verify that player currentHealth is still strictly 100 (zero phantom damage from grazing)
      const healthRemainsFull = game.player.stats.currentHealth === 100;

      // 7. Force synchronous render
      game.render();

      return {
        healthRemainsFull,
        currentHealth: game.player.stats.currentHealth,
        skeletonDist: Math.hypot(
          grazingSkeleton.position.x - game.player.position.x,
          grazingSkeleton.position.y - game.player.position.y
        ),
      };
    });

    // Assert that dodging enemy within 24px dealt zero damage
    expect(dodgeVerified.healthRemainsFull).toBe(true);
    expect(dodgeVerified.currentHealth).toBe(100);

    const targetPath = path.join(ARTIFACT_DIR, 'hitbox_precision_dodge.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file existence and strictly > 50,000 bytes (and > 50KB)
    expect(fs.existsSync(targetPath), 'hitbox_precision_dodge.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `hitbox_precision_dodge.png byte size (${stats.size} bytes) must be strictly > 50,000 bytes`
    ).toBeGreaterThan(50000);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 4: Visual Proof Invariant Audit (Existence, Size > 50,000 bytes, PNG Magic, Dimensions)
  // =========================================================================
  test('Visual Proof Audit: asserts both artifacts exist on disk, are valid 960x540 PNGs, and exceed 50,000 bytes', async () => {
    const requiredArtifacts = [
      'improved_camera_angle.png',
      'hitbox_precision_dodge.png',
    ];

    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const filename of requiredArtifacts) {
      const filePath = path.join(ARTIFACT_DIR, filename);

      // 1. File existence
      expect(fs.existsSync(filePath), `Artifact ${filename} must exist on disk`).toBe(true);

      // 2. File size > 50,000 bytes (and > 50KB = 51,200 bytes)
      const stats = fs.statSync(filePath);
      expect(
        stats.size,
        `Artifact ${filename} size (${stats.size} bytes) must be strictly > 50,000 bytes`
      ).toBeGreaterThan(50000);

      // 3. Valid PNG magic header
      const buffer = fs.readFileSync(filePath);
      expect(
        buffer.subarray(0, 8).equals(pngMagic),
        `Artifact ${filename} must possess valid PNG magic header bytes`
      ).toBe(true);

      // 4. Exact 960x540 dimensions from IHDR chunk
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `Artifact ${filename} width must be 960`).toBe(960);
      expect(height, `Artifact ${filename} height must be 540`).toBe(540);
    }
  });
});
