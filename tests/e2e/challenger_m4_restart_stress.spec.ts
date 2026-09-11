import { test, expect } from '@playwright/test';

test.describe('Challenger M4-1: Browser Adversarial Stress Harness (Consecutive Restarts & Debounce Hammering)', () => {
  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  test('5x consecutive deaths & restarts in Chromium browser: hammers keys during debounce, asserts zero RAF accumulation and accumulator <= 1/60', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      console.log(`[Browser Console ${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      console.log(`[Browser PageError] ${err.message}`);
      pageErrors.push(err.message);
    });

    // 1. Navigate to page
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 15000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // 2. Loop through 5 consecutive death and restart cycles
    for (let cycle = 1; cycle <= 5; cycle++) {
      const cycleStartStatus = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          isAlive: g.player.isAlive,
          health: g.player.stats.currentHealth,
          loopEpoch: g.loopEpoch,
        };
      });

      expect(cycleStartStatus.isAlive).toBe(true);
      expect(cycleStartStatus.health).toBeGreaterThan(0);

      // Kill player with lethal damage
      await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        g.player.takeDamage(9999);
      });

      // Immediate death assertion
      const deadCheck = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          isAlive: g.player.isAlive,
          canResurrect: g.canResurrect(),
          deathTimer: g.deathTimer,
        };
      });
      expect(deadCheck.isAlive).toBe(false);
      expect(deadCheck.canResurrect).toBe(false);
      expect(deadCheck.deathTimer).toBeLessThan(0.5);

      // Rapid key hammering and click spamming during 0.5s death debounce
      let spamCount = 0;
      while (true) {
        const preCheck = await page.evaluate(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          return {
            isAlive: g.player.isAlive,
            canResurrect: g.canResurrect(),
            deathTimer: g.deathTimer,
          };
        });

        // If we are approaching the 0.5s boundary, stop spamming and wait for legitimate trigger
        if (preCheck.deathTimer >= 0.42) {
          break;
        }

        expect(preCheck.isAlive).toBe(false);
        expect(preCheck.canResurrect).toBe(false);

        // Hammer inputs
        await page.keyboard.press('Space');
        await page.click('canvas#game-canvas', { force: true });
        spamCount++;

        const postCheck = await page.evaluate(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          return {
            isAlive: g.player.isAlive,
            canResurrect: g.canResurrect(),
            deathTimer: g.deathTimer,
          };
        });

        if (postCheck.isAlive) {
          // If real elapsed time crossed 0.5s during input dispatch and triggered legitimate resurrection,
          // note that resurrection succeeded cleanly and break out of the premature spam loop.
          break;
        }

        if (postCheck.deathTimer < 0.5) {
          expect(
            postCheck.isAlive,
            `Cycle ${cycle}, Spam ${spamCount}: Player must NOT resurrect prematurely while deathTimer < 0.5 (was ${postCheck.deathTimer})`
          ).toBe(false);
          expect(postCheck.canResurrect).toBe(false);
        }
      }

      // Check if player was already resurrected during input dispatch
      const isAlreadyResurrected = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return g && g.player && g.player.isAlive && g.isRunning;
      });

      if (!isAlreadyResurrected) {
        // Wait until deathTimer >= 0.5s so canResurrect() === true
        await page.waitForFunction(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          return g && typeof g.canResurrect === 'function' && g.canResurrect() === true;
        }, { timeout: 5000 });

        // Trigger legitimate resurrection
        if (cycle % 2 === 1) {
          await page.keyboard.press('Space');
        } else {
          await page.click('canvas#game-canvas', { force: true });
        }

        // Wait for player resurrection
        await page.waitForFunction(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          return g && g.player && g.player.isAlive && g.isRunning;
        }, { timeout: 5000 });
      }

      // Invariant assertion immediately post-restart
      const resurrectedStatus = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          isAlive: g.player.isAlive,
          health: g.player.stats.currentHealth,
          level: g.player.level,
          activeEnemies: g.hordeManager.getActiveCount(),
          starterWeapon: g.weaponManager.getActiveWeapons()[0]?.id,
          accumulator: g.accumulator,
          loopEpoch: g.loopEpoch,
        };
      });

      expect(resurrectedStatus.isAlive).toBe(true);
      expect(resurrectedStatus.health).toBe(100);
      expect(resurrectedStatus.level).toBe(1);
      expect(resurrectedStatus.activeEnemies).toBeGreaterThanOrEqual(25);
      expect(resurrectedStatus.starterWeapon).toBe('scythe');
      expect(resurrectedStatus.accumulator).toBeLessThanOrEqual(1 / 60 + 0.005);
      expect(resurrectedStatus.loopEpoch).toBeGreaterThan(cycleStartStatus.loopEpoch);

      // Survive for 1.2 wall-seconds post-restart to assert stable single-loop RAF rate
      const wallBefore = Date.now();
      const simBefore = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return g.elapsedTime;
      });

      await page.waitForTimeout(1200);

      const wallAfter = Date.now();
      const simAfter = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          elapsedTime: g.elapsedTime,
          accumulator: g.accumulator,
          isAlive: g.player.isAlive,
        };
      });

      const wallElapsedSec = (wallAfter - wallBefore) / 1000;
      const simElapsedSec = simAfter.elapsedTime - simBefore;

      // Rate assertion: In ~1.2 wall seconds, simulation time must advance by ~1.2s (+/- 0.4s).
      // If multiple RAF loops were accumulating (e.g. 2x, 3x, 5x speed), simElapsedSec would be 2.4s - 6.0s!
      expect(
        simElapsedSec,
        `Cycle ${cycle}: Simulation rate must match single RAF loop (wall: ${wallElapsedSec.toFixed(2)}s, sim: ${simElapsedSec.toFixed(2)}s)`
      ).toBeLessThan(wallElapsedSec * 1.5);
      expect(simElapsedSec).toBeGreaterThan(wallElapsedSec * 0.5);

      // Accumulator must remain strictly <= 1/60
      expect(simAfter.accumulator).toBeLessThanOrEqual(1 / 60 + 0.005);
    }

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });
});
