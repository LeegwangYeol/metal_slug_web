import { test, expect } from '@playwright/test';

test.describe('CHALLENGER_CUTE_M3: Adversarial Input Spam & Rapid Input Stress Suite', () => {
  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  test('Adversarial 1: High-Frequency Key Spam (15s continuous, 15-30ms intervals, conflicting inputs)', async ({
    page,
  }) => {
    test.setTimeout(60000);

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

    const SIMULATION_MS = 15500; // >= 15.0 continuous seconds
    const startTime = Date.now();
    let cycleCount = 0;

    while (Date.now() - startTime < SIMULATION_MS) {
      cycleCount++;

      // Auto-resolve perks if modal triggered
      await page.evaluate(() => {
        const game = (window as any).__GAME__;
        if (game?.cuteCoordinator?.perks?.isModalActive) {
          game.cuteCoordinator.choosePerk(Math.floor(Math.random() * 3));
        }
      });

      // Rapid conflicting input burst:
      // Alternate opposing keys, rapid bubble shot bursts, rapid jump taps
      const p = Math.random();
      if (p < 0.25) {
        // Conflicting left + right hold
        await page.keyboard.down('ArrowLeft');
        await page.keyboard.down('ArrowRight');
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(20);
        await page.keyboard.up('ArrowLeft');
        await page.keyboard.up('ArrowRight');
      } else if (p < 0.5) {
        // Rapid bubble spam
        for (let k = 0; k < 3; k++) {
          await page.keyboard.press('KeyJ');
        }
        await page.keyboard.press('Space');
        await page.waitForTimeout(25);
      } else if (p < 0.75) {
        // Multi-directional aim & jump flurry
        await page.keyboard.down('ArrowUp');
        await page.keyboard.down('Space');
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(20);
        await page.keyboard.up('ArrowUp');
        await page.keyboard.up('Space');
        await page.keyboard.press('KeyU'); // ultimate attempt
      } else {
        // Downward drop / crouch & fire
        await page.keyboard.down('ArrowDown');
        await page.keyboard.press('Space');
        await page.keyboard.press('KeyJ');
        await page.waitForTimeout(20);
        await page.keyboard.up('ArrowDown');
      }

      // Check engine state every 15 cycles
      if (cycleCount % 15 === 0) {
        const diag = await page.evaluate(() => {
          const game = (window as any).__GAME__;
          return {
            x: game.player.position.x,
            y: game.player.position.y,
            vx: game.player.velocity?.x ?? 0,
            vy: game.player.velocity?.y ?? 0,
            isAlive: game.player.isAlive,
            lives: game.player.lives,
            bubbleCount: game.cuteCoordinator?.bubbleManager?.bubbles?.length ?? 0,
            enemyCount: game.cuteCoordinator?.enemyManager?.enemies?.length ?? 0,
            shardCount: game.cuteCoordinator?.bubbleManager?.shards?.length ?? 0,
            pickupCount: game.cuteCoordinator?.bubbleManager?.pickups?.length ?? 0,
          };
        });

        expect(Number.isFinite(diag.x)).toBe(true);
        expect(Number.isFinite(diag.y)).toBe(true);
        expect(Number.isFinite(diag.vx)).toBe(true);
        expect(Number.isFinite(diag.vy)).toBe(true);
        expect(pageErrors).toHaveLength(0);
        expect(consoleErrors).toHaveLength(0);
      }
    }

    const totalDuration = Date.now() - startTime;
    expect(totalDuration).toBeGreaterThanOrEqual(15000);
    expect(cycleCount).toBeGreaterThan(200); // verify high-frequency active cycling
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    const finalState = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      return {
        finalX: game.player.position.x,
        finalY: game.player.position.y,
        isAlive: game.player.isAlive,
      };
    });

    expect(Number.isFinite(finalState.finalX)).toBe(true);
    expect(Number.isFinite(finalState.finalY)).toBe(true);
  });

  test('Adversarial 2: Massive Bubble Cascade & Shard Saturation Stress during Active Simulation', async ({
    page,
  }) => {
    test.setTimeout(45000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas');
    await page.waitForFunction(() => (window as any).__GAME__?.cuteCoordinator);

    // Inject massive bubble cascade in active game: 50 trapped bubbles in tight cluster
    const burstReport = await page.evaluate(() => {
      const game = (window as any).__GAME__;
      const bm = game.cuteCoordinator.bubbleManager;

      // Spawn 50 bubbles close together
      const startX = 200;
      const startY = 180;
      for (let i = 0; i < 50; i++) {
        const bx = startX + (i % 10) * 15;
        const by = startY + Math.floor(i / 10) * 15;
        bm.trapEnemy(bx, by, {
          id: `stress_foe_${i}`,
          type: 'MARSHMALLOW_SLIME',
          maxHp: 1,
          remainingHp: 1,
          width: 24,
          height: 20,
          facing: 1,
        });
      }

      // Pop the central bubble to trigger massive cascading chain reaction
      const firstBubble = bm.bubbles[0];
      const popSuccess = bm.popBubble(firstBubble.id);

      // Advance game loop simulation 120 ticks
      for (let t = 0; t < 120; t++) {
        game.update(1 / 60);
      }

      return {
        popSuccess,
        finalBubbles: bm.bubbles.length,
        shardsSpawned: bm.shards.length,
        pickupsSpawned: bm.pickups.length,
        comboAchieved: bm.comboCount,
        feverMeter: bm.feverMeter,
      };
    });

    expect(burstReport.popSuccess).toBe(true);
    expect(burstReport.comboAchieved).toBeGreaterThanOrEqual(5); // verify cascade multiplier
    expect(burstReport.pickupsSpawned).toBeGreaterThan(0);
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);

    // Let the game render another 2 seconds cleanly
    await page.waitForTimeout(2000);
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });
});
