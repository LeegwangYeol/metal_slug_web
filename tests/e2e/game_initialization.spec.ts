import { test, expect } from '@playwright/test';

test.describe('Full Metal Slug - Game Initialization & Engine Benchmark Suite', () => {
  test('should boot headless browser, mount game container, and render canvas with zero fatal console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    // Attach listeners for uncaught console errors and runtime exceptions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // 1. Navigate to root against Vite preview server (http://localhost:4173)
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // 2. Verify #game-container exists and is visible in DOM
    const container = page.locator('#game-container');
    await expect(container).toBeVisible();

    // 3. Verify Canvas element exists with correct virtual dimensions (480x270)
    const canvas = container.locator('canvas#game-canvas');
    await expect(canvas).toBeVisible();

    const canvasDimensions = await canvas.evaluate((el: HTMLCanvasElement) => ({
      width: el.width,
      height: el.height,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
    }));

    expect(canvasDimensions.width).toBe(480);
    expect(canvasDimensions.height).toBe(270);
    expect(canvasDimensions.clientWidth).toBeGreaterThan(0);
    expect(canvasDimensions.clientHeight).toBeGreaterThan(0);

    // 4. Verify 2D Rendering Context is available
    const has2DContext = await canvas.evaluate((el: HTMLCanvasElement) => {
      const ctx = el.getContext('2d');
      return ctx !== null;
    });
    expect(has2DContext).toBe(true);

    // 5. Assert zero uncaught console errors or runtime exceptions
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('should maintain 60 FPS animation loop stably over 300 frames without crashing', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');

    // Benchmark 300 animation frames in browser context
    const benchmarkResult = await page.evaluate(async () => {
      return new Promise<{
        totalFrames: number;
        avgFps: number;
        minFps: number;
        maxFrameTimeMs: number;
        droppedFrames: number;
      }>((resolve) => {
        const TARGET_FRAMES = 300;
        let frameCount = 0;
        let lastTime = performance.now();
        const startTime = lastTime;
        let maxFrameTimeMs = 0;
        let minFps = 1000;
        let droppedFrames = 0;

        function onFrame(now: number) {
          frameCount++;
          const deltaMs = now - lastTime;
          lastTime = now;

          if (deltaMs > maxFrameTimeMs) {
            maxFrameTimeMs = deltaMs;
          }

          const currentFps = deltaMs > 0 ? 1000 / deltaMs : 60;
          if (currentFps < minFps && frameCount > 5) {
            minFps = currentFps;
          }

          // Frame drop threshold: frame time > 33.33ms (< 30 FPS dip)
          if (deltaMs > 33.33) {
            droppedFrames++;
          }

          if (frameCount >= TARGET_FRAMES) {
            const totalElapsedSec = (now - startTime) / 1000;
            const avgFps = totalFramesCalculated(frameCount, totalElapsedSec);
            resolve({
              totalFrames: frameCount,
              avgFps,
              minFps,
              maxFrameTimeMs,
              droppedFrames,
            });
            return;
          }

          requestAnimationFrame(onFrame);
        }

        function totalFramesCalculated(frames: number, seconds: number): number {
          return seconds > 0 ? frames / seconds : 60;
        }

        requestAnimationFrame(onFrame);
      });
    });

    // Verify benchmark metrics
    expect(benchmarkResult.totalFrames).toBe(300);
    // Average FPS should be close to 60 (with headroom for CI environments: >= 50 FPS)
    expect(benchmarkResult.avgFps).toBeGreaterThanOrEqual(50.0);
    // Dropped frames (< 30 FPS dips) should be minimal (< 15 out of 300 frames)
    expect(benchmarkResult.droppedFrames).toBeLessThan(15);
    // No uncaught exceptions during 300 frames
    expect(pageErrors).toHaveLength(0);
  });

  test('should expose __GAME__, __ENGINE__, __AUDIO_CTX__ and respond to player input and stage progression', async ({
    page,
  }) => {
    await page.goto('/');

    const gameDiagnostics = await page.evaluate(async () => {
      const w = window as any;
      const game = w.__GAME__;
      const engine = w.__ENGINE__;
      const audioCtx = w.__AUDIO_CTX__;

      if (!game || !engine) {
        return { error: 'Game or Engine not exposed on window' };
      }

      // Check player initial position and weapon
      const player = game.player;
      const initialPos = { x: player.position.x, y: player.position.y };
      const initialWeapon = player.weaponManager.getActiveWeapon();
      const initialLives = player.lives;
      const initialScore = player.score;

      // Simulate keyboard input Right movement
      game.keyboard.setAction('right', true);
      // Run 30 simulation ticks
      for (let i = 0; i < 30; i++) {
        game.step(1 / 60);
      }
      game.keyboard.setAction('right', false);

      const movedX = player.position.x;

      // Simulate firing handgun
      game.keyboard.setAction('fire', true);
      game.step(1 / 60);
      game.keyboard.setAction('fire', false);
      game.step(1 / 60);

      const entities = engine.getAllEntities();
      const hasBullet = entities.some((e: any) => e.type === 'PROJECTILE');
      const platformCount = engine.getPlatforms().length;

      return {
        hasGame: !!game,
        hasEngine: !!engine,
        hasAudioCtx: !!audioCtx,
        initialPos,
        movedX,
        initialWeapon,
        initialLives,
        initialScore,
        hasBullet,
        platformCount,
      };
    });

    expect(gameDiagnostics.hasGame).toBe(true);
    expect(gameDiagnostics.hasEngine).toBe(true);
    expect(gameDiagnostics.hasAudioCtx).toBe(true);
    expect(gameDiagnostics.initialPos).toBeDefined();
    if (gameDiagnostics.initialPos && gameDiagnostics.movedX !== undefined) {
      expect(gameDiagnostics.movedX).toBeGreaterThan(gameDiagnostics.initialPos.x);
    }
    expect(gameDiagnostics.initialWeapon).toBe('PISTOL');
    expect(gameDiagnostics.initialLives).toBe(3);
    expect(gameDiagnostics.platformCount).toBeGreaterThan(5);
    expect(gameDiagnostics.hasBullet).toBe(true);
  });
});
