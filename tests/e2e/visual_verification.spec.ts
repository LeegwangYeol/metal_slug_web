import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Full Metal Slug - R3 Visual Verification & Screenshot Suite', () => {
  const SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts/screenshots');

  test.beforeAll(async () => {
    // Ensure output directory artifacts/screenshots/ exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  /**
   * Helper to navigate to root, wait for game bootstrap,
   * configure 960x540 canvas presentation, and pause RAF loop for deterministic step control.
   */
  async function setupDeterministicGame(page: any) {
    await page.goto('/');
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
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

  test('Scene 1: player standing with visible aiming crosshair (screenshot_01_idle_crosshair.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 120;
      game.player.position.y = 230;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.player.isCrouching = false;
      game.camera.x = 0;

      // Clear all inputs and settle
      game.keyboard.setAction('left', false);
      game.keyboard.setAction('right', false);
      game.keyboard.setAction('up', false);
      game.keyboard.setAction('down', false);
      game.keyboard.setAction('jump', false);
      game.keyboard.setAction('fire', false);

      for (let i = 0; i < 15; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const shot1Path = path.join(SCREENSHOT_DIR, 'screenshot_01_idle_crosshair.png');
    await page.screenshot({ path: shot1Path, fullPage: false });
    expect(fs.existsSync(shot1Path)).toBe(true);
    expect(fs.statSync(shot1Path).size).toBeGreaterThan(5000);
  });

  test('Scene 2: player aiming diagonally upward with directional sprite (screenshot_02_aim_up_forward.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 120;
      game.player.position.y = 230;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.player.isCrouching = false;
      game.camera.x = 0;

      // Aim diagonally upward (45°, UP_FORWARD)
      game.keyboard.setAction('left', false);
      game.keyboard.setAction('down', false);
      game.keyboard.setAction('jump', false);
      game.keyboard.setAction('fire', false);
      game.keyboard.setAction('up', true);
      game.keyboard.setAction('right', true);

      for (let i = 0; i < 10; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const shot2Path = path.join(SCREENSHOT_DIR, 'screenshot_02_aim_up_forward.png');
    await page.screenshot({ path: shot2Path, fullPage: false });
    expect(fs.existsSync(shot2Path)).toBe(true);
    expect(fs.statSync(shot2Path).size).toBeGreaterThan(5000);
  });

  test('Scene 3: natural jump arc trajectory frame (screenshot_03_jump_arc.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      // Reset inputs & place player on ground
      game.keyboard.setAction('left', false);
      game.keyboard.setAction('right', false);
      game.keyboard.setAction('up', false);
      game.keyboard.setAction('down', false);
      game.keyboard.setAction('fire', false);

      game.player.position.x = 180;
      game.player.position.y = 230;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.camera.x = 0;

      // Trigger Jump impulse
      game.keyboard.setAction('jump', true);
      game.step(1 / 60);
      game.keyboard.setAction('jump', false);

      // Advance 14 frames into jump trajectory (~apex: vy near 0, elevated y)
      for (let i = 0; i < 14; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const shot3Path = path.join(SCREENSHOT_DIR, 'screenshot_03_jump_arc.png');
    await page.screenshot({ path: shot3Path, fullPage: false });
    expect(fs.existsSync(shot3Path)).toBe(true);
    expect(fs.statSync(shot3Path).size).toBeGreaterThan(5000);
  });

  test('Scene 4: rebel soldier walking in from off-screen margin (screenshot_04_enemy_smooth_spawn.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      // Settle player on ground
      game.player.position.x = 140;
      game.player.position.y = 230;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.camera.x = 0;

      // Clear existing soldiers for clean framing
      const existing = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      existing.forEach((e: any) => engine.removeEntity(e.id));

      // Trigger wave 1
      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) {
        wave1.spawnAction(engine, 0);
      }
      game.step(1 / 60);

      // Position entering across camera.maxX (480px) right boundary margin
      const soldier = engine.getAllEntities().find((e: any) => e.type && e.type.startsWith('SOLDIER'));
      if (soldier) {
        soldier.position.x = 445;
        soldier.facing = -1;
        soldier.velocity.x = -110;
        soldier.state = 'INGRESS';
      }

      for (let i = 0; i < 5; i++) {
        game.step(1 / 60);
      }
      game.render();
    });

    const shot4Path = path.join(SCREENSHOT_DIR, 'screenshot_04_enemy_smooth_spawn.png');
    await page.screenshot({ path: shot4Path, fullPage: false });
    expect(fs.existsSync(shot4Path)).toBe(true);
    expect(fs.statSync(shot4Path).size).toBeGreaterThan(5000);
  });

  test('Scene 5: combat scene with upgraded high-res sprites (screenshot_05_combat_upgraded_sprites.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const engine = game.engine;

      // Equip Heavy Machine Gun
      game.player.weaponManager.acquireWeapon('HEAVY_MACHINE_GUN', 200, engine);
      game.player.position.x = 160;
      game.player.position.y = 230;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facing = 1;
      game.player.isGrounded = true;
      game.camera.x = 0;

      // Clear existing soldiers
      const existing = engine.getAllEntities().filter((e: any) => e.type && e.type.startsWith('SOLDIER'));
      existing.forEach((e: any) => engine.removeEntity(e.id));

      // Trigger wave 1
      const stage = game.stageManager.getCurrentStage();
      const wave1 = stage?.triggers.find((t: any) => t.id === 'trigger_wave_1');
      if (wave1) {
        wave1.spawnAction(engine, 0);
      }
      game.step(1 / 60);

      let soldier = engine.getAllEntities().find((e: any) => e.type && e.type.startsWith('SOLDIER') && e.isAlive);
      if (soldier) {
        soldier.position.x = 340;
        soldier.facing = -1;
        soldier.state = 'PATROL';
      }

      // Fire weapon to show muzzle flash, active projectiles, and ejecting brass
      game.keyboard.setAction('fire', true);
      for (let i = 0; i < 4; i++) {
        game.step(1 / 60);
      }
      game.keyboard.setAction('fire', false);
      game.render();
    });

    const shot5Path = path.join(SCREENSHOT_DIR, 'screenshot_05_combat_upgraded_sprites.png');
    await page.screenshot({ path: shot5Path, fullPage: false });
    expect(fs.existsSync(shot5Path)).toBe(true);
    expect(fs.statSync(shot5Path).size).toBeGreaterThan(5000);
  });

  test('Verification: all 5 screenshot artifacts exist and have valid file sizes (>5KB)', async () => {
    const requiredScreenshots = [
      'screenshot_01_idle_crosshair.png',
      'screenshot_02_aim_up_forward.png',
      'screenshot_03_jump_arc.png',
      'screenshot_04_enemy_smooth_spawn.png',
      'screenshot_05_combat_upgraded_sprites.png',
    ];

    for (const filename of requiredScreenshots) {
      const filePath = path.join(SCREENSHOT_DIR, filename);
      expect(fs.existsSync(filePath), `Missing screenshot artifact: ${filename}`).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.size, `Screenshot ${filename} is suspiciously small: ${stats.size} bytes`).toBeGreaterThan(5000);
    }
  });
});
