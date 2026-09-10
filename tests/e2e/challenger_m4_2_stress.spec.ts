import { test, expect } from '@playwright/test';

test.describe('Challenger M4-2: Adversarial Kinematic Safety & Weapon/XP Accumulation Leak Verification', () => {
  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  test('Adversarial Challenge 1: Multi-Trial Post-Restart Kinematic Safety & 15s Survival Guarantee', async ({
    page,
  }) => {
    test.setTimeout(120000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // Trigger lethal damage then restart to enter post-restart state
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.player.takeDamage(9999);
    });

    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && typeof g.canResurrect === 'function' && g.canResurrect() === true;
    }, { timeout: 5000 });

    await page.keyboard.press('Space');

    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && g.player && g.player.isAlive && g.isRunning;
    }, { timeout: 5000 });

    const wallStart = Date.now();
    const MAX_WALL_MS = 80000;

    let minObservedHealth = 100;
    let maxObservedAccumulator = 0;
    let minEnemyDistanceObserved = Infinity;
    const healthHistory: number[] = [];

    while (Date.now() - wallStart < MAX_WALL_MS) {
      const status = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const enemies = g.hordeManager.getActiveEnemies();
        let closest = Infinity;
        for (const e of enemies) {
          if (!e.isAlive) continue;
          const d = Math.hypot(e.x - p.position.x, e.y - p.position.y);
          if (d < closest) closest = d;
        }

        return {
          elapsedTime: g.elapsedTime,
          isAlive: p.isAlive,
          health: p.stats.currentHealth,
          kills: g.hordeManager.totalKilled || g.killCount || 0,
          currentXP: p.currentXP,
          level: p.level,
          closestEnemyDist: closest,
          accumulator: g.accumulator,
          isModalOpen: g.upgradeModal?.getIsOpen?.() ?? false,
          isPaused: g.isPaused,
          activeWeaponSlashes: (g.weaponManager.getWeapon('scythe') as any)?.activeSlashes?.length ?? 0,
          activeEnemiesCount: g.hordeManager.getActiveCount(),
          activeLootCount: g.lootManager.getActiveCount(),
        };
      });

      if (status.health < minObservedHealth) {
        minObservedHealth = status.health;
      }
      if (status.accumulator > maxObservedAccumulator) {
        maxObservedAccumulator = status.accumulator;
      }
      if (status.closestEnemyDist < minEnemyDistanceObserved) {
        minEnemyDistanceObserved = status.closestEnemyDist;
      }
      healthHistory.push(status.health);

      // Target survival >= 15.0 continuous seconds
      if (status.elapsedTime >= 15.0) {
        break;
      }

      // Assert survival integrity
      expect(status.isAlive, 'Player must remain alive during survival window').toBe(true);
      expect(status.health, 'Player health must remain strictly positive (> 0)').toBeGreaterThan(0);

      if (status.isModalOpen) {
        await page.keyboard.press('Digit1');
        await page.waitForTimeout(150);
        continue;
      }

      // Execute 8-directional steering bot
      const steer = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const px = p.position.x;
        const py = p.position.y;

        const CANDIDATES = [
          { name: 'RIGHT', dx: 1, dy: 0, keys: { right: true, left: false, up: false, down: false } },
          { name: 'DOWN_RIGHT', dx: 0.7071068, dy: 0.7071068, keys: { right: true, left: false, up: false, down: true } },
          { name: 'DOWN', dx: 0, dy: 1, keys: { right: false, left: false, up: false, down: true } },
          { name: 'DOWN_LEFT', dx: -0.7071068, dy: 0.7071068, keys: { right: false, left: true, up: false, down: true } },
          { name: 'LEFT', dx: -1, dy: 0, keys: { right: false, left: true, up: false, down: false } },
          { name: 'UP_LEFT', dx: -0.7071068, dy: -0.7071068, keys: { right: false, left: true, up: true, down: false } },
          { name: 'UP', dx: 0, dy: -1, keys: { right: false, left: false, up: true, down: false } },
          { name: 'UP_RIGHT', dx: 0.7071068, dy: -0.7071068, keys: { right: true, left: false, up: true, down: false } },
        ];

        const activeEnemies = g.hordeManager.getActiveEnemies();
        const enemiesList: Array<{ x: number; y: number; speed: number }> = [];

        for (const e of activeEnemies) {
          if (!e.isAlive) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < 400) {
            enemiesList.push({ x: e.x, y: e.y, speed: e.speed || 65 });
          }
        }

        const HORIZON = 0.32;
        const PLAYER_SPEED = 200;
        const distCenter = Math.hypot(px, py);
        let desiredDirX: number, desiredDirY: number;

        if (distCenter < 280) {
          desiredDirX = 0.7071068;
          desiredDirY = 0.7071068;
        } else {
          const currentAngle = Math.atan2(py, px);
          const tanX = -Math.sin(currentAngle);
          const tanY = Math.cos(currentAngle);
          const targetRadius = 320;
          const radErr = Math.max(-1.0, Math.min(1.0, (distCenter - targetRadius) / targetRadius));
          const radX = -px / distCenter;
          const radY = -py / distCenter;
          const blendX = tanX + radX * radErr * 2.5;
          const blendY = tanY + radY * radErr * 2.5;
          const blendLen = Math.hypot(blendX, blendY) || 1;
          desiredDirX = blendX / blendLen;
          desiredDirY = blendY / blendLen;
        }

        let bestScore = -Infinity;
        let bestCandidate = CANDIDATES[0];

        for (const c of CANDIDATES) {
          let score = 0;
          const playerFutureX = px + c.dx * PLAYER_SPEED * HORIZON;
          const playerFutureY = py + c.dy * PLAYER_SPEED * HORIZON;

          let minFutureDist = Infinity;
          for (const en of enemiesList) {
            const toPx = px - en.x;
            const toPy = py - en.y;
            const toLen = Math.hypot(toPx, toPy) || 1;
            const curDist = Math.hypot(px - en.x, py - en.y);

            const midPlayerX = px + c.dx * PLAYER_SPEED * (HORIZON * 0.5);
            const midPlayerY = py + c.dy * PLAYER_SPEED * (HORIZON * 0.5);
            const midEnX = en.x + (toPx / toLen) * en.speed * (HORIZON * 0.5);
            const midEnY = en.y + (toPy / toLen) * en.speed * (HORIZON * 0.5);
            const midDist = Math.hypot(midPlayerX - midEnX, midPlayerY - midEnY);

            const enFutureX = en.x + (toPx / toLen) * en.speed * HORIZON;
            const enFutureY = en.y + (toPy / toLen) * en.speed * HORIZON;
            const endDist = Math.hypot(playerFutureX - enFutureX, playerFutureY - enFutureY);

            const fdist = Math.min(curDist, midDist, endDist);
            if (fdist < minFutureDist) minFutureDist = fdist;

            if (fdist < 34) {
              score -= 1000000 * ((34 - fdist) / 34);
            } else if (fdist < 58) {
              score -= 60000 * ((58 - fdist) / 58);
            }
          }

          if (minFutureDist >= 64 && minFutureDist <= 80) score += 300;

          if (g.elapsedTime >= 1.5) {
            const futureDistCenter = Math.hypot(playerFutureX, playerFutureY);
            if (futureDistCenter < 220) score -= 10000000;
          }

          const kiteWeight = minFutureDist < 55 ? 250 : 80;
          const kdot = c.dx * desiredDirX + c.dy * desiredDirY;
          score += kdot * kiteWeight;
          if (kdot < -0.2) score -= 3000;

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = c;
          }
        }

        return bestCandidate.keys;
      });

      if (steer.left) await page.keyboard.down('KeyA'); else await page.keyboard.up('KeyA');
      if (steer.right) await page.keyboard.down('KeyD'); else await page.keyboard.up('KeyD');
      if (steer.up) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
      if (steer.down) await page.keyboard.down('KeyS'); else await page.keyboard.up('KeyS');

      await page.waitForTimeout(130);
    }

    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyS');

    const finalState = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        elapsedTime: g.elapsedTime,
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        kills: g.hordeManager.totalKilled || g.killCount || 0,
        currentXP: g.player.currentXP,
        level: g.player.level,
        accumulator: g.accumulator,
        isPaused: g.isPaused,
        activeEnemiesCount: g.hordeManager.getActiveCount(),
        activeLootCount: g.lootManager.getActiveCount(),
        scytheActiveSlashes: (g.weaponManager.getWeapon('scythe') as any)?.activeSlashes?.length ?? 0,
      };
    });

    console.log(`[Challenger M4-2 Trial Summary]`);
    console.log(`  Elapsed Time: ${finalState.elapsedTime.toFixed(2)}s`);
    console.log(`  Health: final=${finalState.health}, minObserved=${minObservedHealth}`);
    console.log(`  Kills: ${finalState.kills}`);
    console.log(`  Current XP: ${finalState.currentXP}, Level: ${finalState.level}`);
    console.log(`  Min Enemy Distance: ${minEnemyDistanceObserved.toFixed(1)}px`);
    console.log(`  Max Accumulator: ${maxObservedAccumulator.toFixed(6)}s`);
    console.log(`  Active Enemies: ${finalState.activeEnemiesCount}`);
    console.log(`  Active Loot Items: ${finalState.activeLootCount}`);
    console.log(`  Active Scythe Slashes: ${finalState.scytheActiveSlashes}`);

    // Core Invariant Assertions
    expect(finalState.elapsedTime, 'Must survive >= 15.0 continuous seconds').toBeGreaterThanOrEqual(15.0);
    expect(finalState.isAlive, 'Player must be alive at 15s mark').toBe(true);
    expect(finalState.health, 'Player health must not reach zero (no lethal damage)').toBeGreaterThan(0);
    expect(minObservedHealth, 'Player must not take lethal damage at any point').toBeGreaterThan(0);
    expect(finalState.kills, 'Auto-firing starter weapon must achieve at least 1 kill').toBeGreaterThanOrEqual(1);
    expect(finalState.level > 1 || finalState.currentXP > 0, 'XP or level must advance upon picking up soul shards').toBe(true);
    expect(finalState.accumulator, 'Accumulator must not explode / hang main thread').toBeLessThanOrEqual(1 / 60 + 0.01);
    expect(finalState.scytheActiveSlashes, 'Scythe slashes must be cleaned up properly (no leak)').toBeLessThanOrEqual(5);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Adversarial Challenge 2: Long-Term Loot, Horde, and Slash Buffer Accumulation Leak Audit', async ({
    page,
  }) => {
    test.setTimeout(60000);

    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.lootManager && g.weaponManager;
    }, { timeout: 10000 });

    // Headless simulation for 300 steps (5 simulation seconds) to check pool recycling
    const leakAudit = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;

      // Reset to clean state
      g.restart();

      const hordeInitialCapacity = g.hordeManager.pool.length;
      const lootInitialCapacity = g.lootManager.pool.length;

      // Simulate 600 frames (10 seconds of high combat and drop churn)
      let initialDrops = 0;
      for (let i = 0; i < 20; i++) {
        g.lootManager.spawnDrop('EMERALD_SHARD', 50 + i * 5, 50 + i * 5, false);
      }
      initialDrops = g.lootManager.getActiveCount();

      // Collect all drops by moving player
      g.player.stats.magnetRadius = 1000;
      for (let step = 0; step < 180; step++) {
        g.step(1 / 60);
      }
      const postCollectDrops = g.lootManager.getActiveCount();

      // Verify that collected drops were returned to pool and player gained XP
      const playerXP = g.player.currentXP;

      // Verify weapon slashes lifecycle
      const scythe = g.weaponManager.getWeapon('scythe');
      const slashesPre = (scythe as any).activeSlashes.length;
      for (let step = 0; step < 120; step++) {
        g.step(1 / 60);
      }
      const slashesPost = (scythe as any).activeSlashes.length;

      return {
        hordeInitialCapacity,
        lootInitialCapacity,
        initialDrops,
        postCollectDrops,
        playerXP,
        slashesPre,
        slashesPost,
        hordePoolEndSize: g.hordeManager.pool.length,
        lootPoolEndSize: g.lootManager.pool.length,
      };
    });

    console.log('[Challenger M4-2 Leak Audit]', JSON.stringify(leakAudit, null, 2));

    expect(leakAudit.initialDrops).toBe(20);
    expect(leakAudit.postCollectDrops).toBe(0); // All 20 collected
    expect(leakAudit.playerXP).toBeGreaterThan(0); // XP awarded
    expect(leakAudit.lootPoolEndSize).toBe(leakAudit.lootInitialCapacity); // Zero pool leakage
    expect(leakAudit.slashesPost).toBeLessThanOrEqual(2); // Slashes expire and are cleanly removed
  });
});
