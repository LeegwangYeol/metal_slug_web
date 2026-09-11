import { test, expect } from '@playwright/test';

test.describe('Challenger M4 Adversarial Stress: Modal Churn, Input Fuzzing & Invariant Suite', () => {
  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  test('Adversarial Stress 1: Rapid Modal Opening/Closing Under Heavy Swarm Load (50+ Active Enemies)', async ({
    page,
  }) => {
    test.setTimeout(90000);

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

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return (
        g &&
        g.player &&
        g.hordeManager &&
        g.upgradeModal &&
        g.upgradeSystem &&
        g.weaponManager &&
        g.isRunning
      );
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // Make player invulnerable during swarm stress test to isolate modal/swarm mechanics from premature death
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.player.stats.maxHealth = 99999;
      g.player.stats.currentHealth = 99999;

      // Spawn massive horde: 80+ enemies across all 4 standard archetypes
      g.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 350);
      g.hordeManager.spawnWave('GHOUL', 25, { x: 0, y: 0 }, 400);
      g.hordeManager.spawnWave('BANSHEE', 20, { x: 0, y: 0 }, 450);
      g.hordeManager.spawnWave('DEATH_KNIGHT', 10, { x: 0, y: 0 }, 500);
    });

    // Verify horde load: must have at least 50 active enemies
    const initialHordeCount = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g.hordeManager.getActiveCount();
    });
    console.log(`[Adversarial Stress 1] Initial active enemy horde count: ${initialHordeCount}`);
    expect(initialHordeCount).toBeGreaterThanOrEqual(50);

    // Perform 30 rapid modal open/close cycles under active 50+ enemy swarm
    const CHURN_CYCLES = 30;
    for (let i = 0; i < CHURN_CYCLES; i++) {
      // Trigger level-up modal
      await page.evaluate((cycle) => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        g.handlePlayerLevelUp(cycle + 2);
      }, i);

      // Verify modal is open and simulation is paused
      const modalStateOpen = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          isOpen: g.upgradeModal.getIsOpen(),
          isPaused: g.isPaused,
          activeEnemies: g.hordeManager.getActiveCount(),
        };
      });

      expect(modalStateOpen.isOpen).toBe(true);
      expect(modalStateOpen.isPaused).toBe(true);
      expect(modalStateOpen.activeEnemies).toBeGreaterThanOrEqual(50);

      // Interleave different closing mechanisms:
      // 1. Key 1, 2, 3
      // 2. Arrow navigation then Space/Enter
      const mode = i % 5;
      if (mode === 0) {
        await page.keyboard.press('Digit1');
      } else if (mode === 1) {
        await page.keyboard.press('Digit2');
      } else if (mode === 2) {
        await page.keyboard.press('Digit3');
      } else if (mode === 3) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(20);
        await page.keyboard.press('Enter');
      } else {
        await page.keyboard.press('ArrowLeft');
        await page.waitForTimeout(20);
        await page.keyboard.press('Space');
      }

      // Wait a short moment for modal close and simulation resumption
      await page.waitForTimeout(40);

      // Verify modal closed and simulation unpaused
      const modalStateClosed = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          isOpen: g.upgradeModal.getIsOpen(),
          isPaused: g.isPaused,
          accumulator: g.accumulator,
          playerX: g.player.position.x,
          playerY: g.player.position.y,
        };
      });

      expect(modalStateClosed.isOpen).toBe(false);
      expect(modalStateClosed.isPaused).toBe(false);
      expect(Number.isFinite(modalStateClosed.playerX)).toBe(true);
      expect(Number.isFinite(modalStateClosed.playerY)).toBe(true);
      expect(modalStateClosed.accumulator).toBeLessThanOrEqual(0.1); // No accumulator explosion

      // Periodically verify enemy integrity
      if (i % 6 === 0) {
        const enemyCheck = await page.evaluate(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          const enemies = g.hordeManager.getActiveEnemies();
          let allValid = true;
          for (const e of enemies) {
            if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.health)) {
              allValid = false;
              break;
            }
          }
          return { count: enemies.length, allValid };
        });

        expect(enemyCheck.count).toBeGreaterThanOrEqual(50);
        expect(enemyCheck.allValid).toBe(true);
      }
    }

    // Assert zero console errors and zero unhandled exceptions
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
    console.log(`[Adversarial Stress 1] PASSED: 30 modal churn cycles under 50+ enemies with 0 console errors.`);
  });

  test('Adversarial Stress 2: Keyboard Navigation Fuzzing During Active Survival Loop', async ({
    page,
  }) => {
    test.setTimeout(90000);

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

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.isRunning;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // Spawn 60+ enemies for intense survival environment
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 400);
      g.hordeManager.spawnWave('GHOUL', 20, { x: 0, y: 0 }, 450);
      g.hordeManager.spawnWave('BANSHEE', 15, { x: 0, y: 0 }, 500);
    });

    const FUZZ_KEYS = [
      'Digit1',
      'Digit2',
      'Digit3',
      'Digit4',
      'Escape',
      'Space',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'Enter',
    ];

    const FUZZ_DURATION_MS = 15000;
    const fuzzStart = Date.now();
    let fuzzCount = 0;
    let levelUpInjected = 0;

    while (Date.now() - fuzzStart < FUZZ_DURATION_MS) {
      // Pick 1 to 3 random keys
      const numKeys = 1 + Math.floor(Math.random() * 3);
      for (let k = 0; k < numKeys; k++) {
        const key = FUZZ_KEYS[Math.floor(Math.random() * FUZZ_KEYS.length)];
        // Randomly press or tap
        await page.keyboard.press(key);
        fuzzCount++;
      }

      // Every ~2.5 seconds, inject a level-up so modal appears while fuzzing is active
      const elapsed = Date.now() - fuzzStart;
      if (Math.floor(elapsed / 2500) > levelUpInjected) {
        levelUpInjected = Math.floor(elapsed / 2500);
        await page.evaluate(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          g.handlePlayerLevelUp(g.player.level + 1);
        });
      }

      // Check for opened modal and ensure fuzzing handles it or selection clears it
      const modalOpen = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return g.upgradeModal?.getIsOpen?.() ?? false;
      });

      if (modalOpen) {
        // Feed selection key to dismiss
        const selectKey = ['Digit1', 'Digit2', 'Digit3'][Math.floor(Math.random() * 3)];
        await page.keyboard.press(selectKey);
      }

      await page.waitForTimeout(40);
    }

    // Release all movement keys
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('ArrowUp');
    await page.keyboard.up('ArrowDown');
    await page.keyboard.up('ArrowLeft');
    await page.keyboard.up('ArrowRight');

    const finalState = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        elapsedTime: g.elapsedTime,
        accumulator: g.accumulator,
        isPaused: g.isPaused,
        modalOpen: g.upgradeModal.getIsOpen(),
        playerAlive: g.player.isAlive,
        playerX: g.player.position.x,
        playerY: g.player.position.y,
        playerHealth: g.player.stats.currentHealth,
        activeEnemies: g.hordeManager.getActiveCount(),
      };
    });

    console.log(`[Adversarial Stress 2] Fuzzing complete: ${fuzzCount} keys fuzzed over ${FUZZ_DURATION_MS / 1000}s`);
    console.log(`[Adversarial Stress 2] Final state:`, finalState);

    expect(finalState.modalOpen).toBe(false);
    expect(Number.isFinite(finalState.playerX)).toBe(true);
    expect(Number.isFinite(finalState.playerY)).toBe(true);
    expect(finalState.accumulator).toBeLessThanOrEqual(0.1);
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  test('Adversarial Stress 3: Boundary & Out-of-Bounds Card Input Invariants', async ({
    page,
  }) => {
    test.setTimeout(45000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return g && g.upgradeModal && g.upgradeSystem;
    }, { timeout: 10000 });

    // Open modal with only 3 cards
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.handlePlayerLevelUp(2);
    });

    // 1. Press Digit4 (index 3), which does not exist for 3 cards
    // Modal must NOT close, and must NOT throw an error
    await page.keyboard.press('Digit4');
    await page.waitForTimeout(50);

    let modalStillOpen = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g.upgradeModal.getIsOpen();
    });
    expect(modalStillOpen).toBe(true);

    // 2. Press Escape: modal should not crash or corrupt
    await page.keyboard.press('Escape');
    await page.waitForTimeout(50);

    modalStillOpen = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g.upgradeModal.getIsOpen();
    });
    expect(modalStillOpen).toBe(true);

    // 3. Arrow left wrap-around: from 0 to 2
    await page.keyboard.press('ArrowLeft');
    const selectedIdxAfterLeft = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g.upgradeModal.selectedIndex;
    });
    expect(selectedIdxAfterLeft).toBe(2);

    // 4. Space bar confirms selection
    await page.keyboard.press('Space');
    await page.waitForTimeout(50);

    const modalClosedAfterSpace = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g.upgradeModal.getIsOpen();
    });
    expect(modalClosedAfterSpace).toBe(false);

    // 5. Multi-queue pending level-ups: queue 5 level-ups rapidly
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.handlePlayerLevelUp(3);
      g.handlePlayerLevelUp(4);
      g.handlePlayerLevelUp(5);
      g.handlePlayerLevelUp(6);
      g.handlePlayerLevelUp(7);
    });

    // Consume all 5 level-ups via Digit1
    for (let i = 0; i < 5; i++) {
      await page.waitForFunction(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return g.upgradeModal.getIsOpen() === true;
      }, { timeout: 5000 });

      await page.keyboard.press('Digit1');
      await page.waitForTimeout(50);
    }

    // Verify all 5 were consumed and modal is closed
    const finalQueueState = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        isOpen: g.upgradeModal.getIsOpen(),
        isPaused: g.isPaused,
        pendingLevelUps: (g as any).pendingLevelUps,
      };
    });

    expect(finalQueueState.isOpen).toBe(false);
    expect(finalQueueState.isPaused).toBe(false);
    expect(finalQueueState.pendingLevelUps).toBe(0);

    // Assert zero console errors and zero unhandled page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
    console.log('[Adversarial Stress 3] PASSED: All boundary & multi-queue invariant assertions passed.');
  });
});
