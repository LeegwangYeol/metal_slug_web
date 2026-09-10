import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Polish Milestone: Death Animations Visual Screenshot Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/death_animations');

  test.beforeAll(async () => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  async function setupDeterministicGame(page: any) {
    await page.goto('/');
    await page.waitForSelector('#game-canvas');
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player && w.__GAME__.corpseManager;
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

  test('Artifact 1: Standard falling ground collapse (death_standard.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 80;
      game.player.position.y = 230;
      game.camera.x = 0;

      // Spawn standard death corpses across stages
      game.corpseManager.spawnCorpse({
        id: 'corpse_standard_stage3',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: { x: 220, y: 192 },
        velocity: { x: 0, y: 0 },
        facing: -1,
        deathType: 'standard',
      });

      game.corpseManager.spawnCorpse({
        id: 'corpse_standard_stage2',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: { x: 300, y: 192 },
        velocity: { x: 0, y: 0 },
        facing: 1,
        deathType: 'standard',
      });

      // Advance stage3 to back slam / collapsed
      for (let i = 0; i < 25; i++) {
        game.step(1 / 60);
      }

      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'death_standard.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 1] death_standard.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  test('Artifact 2: Explosion blowback ballistic air tumble and detached helmet (death_explosion_blowback.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 80;
      game.player.position.y = 230;
      game.camera.x = 0;

      // Spawn explosion blowback corpse launched upward
      game.corpseManager.spawnCorpse({
        id: 'corpse_exp_air',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: { x: 240, y: 180 },
        velocity: { x: 0, y: 0 },
        facing: -1,
        deathType: 'explosion',
        origin: { x: 200, y: 220 }, // blast from left sends soldier right
      });

      // Advance ~12 frames into ballistic arc so soldier & helmet are mid-air tumbling
      for (let i = 0; i < 12; i++) {
        game.step(1 / 60);
      }

      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'death_explosion_blowback.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 2] death_explosion_blowback.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });

  test('Artifact 3: Flamethrower burning charcoal silhouette with glowing embers (death_burning.png)', async ({ page }) => {
    await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__GAME__;
      game.player.position.x = 80;
      game.player.position.y = 230;
      game.camera.x = 0;

      // Spawn burning corpse transitioning to charcoal with glowing embers
      game.corpseManager.spawnCorpse({
        id: 'corpse_burning_charcoal',
        type: 'SOLDIER_RIFLE',
        role: 'RIFLE',
        position: { x: 240, y: 192 },
        velocity: { x: 0, y: 0 },
        facing: -1,
        deathType: 'fire',
      });

      // Advance ~45 frames (0.75s) into charcoal stage with glowing embers
      for (let i = 0; i < 45; i++) {
        game.step(1 / 60);
      }

      game.render();
    });

    const canvas = page.locator('#game-canvas');
    const outPath = path.join(ARTIFACT_DIR, 'death_burning.png');
    await canvas.screenshot({ path: outPath });

    expect(fs.existsSync(outPath)).toBe(true);
    const stats = fs.statSync(outPath);
    console.log(`[Artifact 3] death_burning.png captured: ${stats.size} bytes`);
    expect(stats.size).toBeGreaterThan(5000);
  });
});
