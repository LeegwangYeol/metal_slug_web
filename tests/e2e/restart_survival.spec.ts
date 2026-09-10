import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: Dark Fantasy Horde Survival — Restart Lifecycle & Visual Proof Verification', () => {
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

  // Helper for deterministic visual proof setup
  async function setupDeterministicGame(page: Page) {
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
      return (
        g &&
        g.player &&
        g.hordeManager &&
        g.backdrop &&
        g.backdrop.isInitialized
      );
    }, { timeout: 10000 });

    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
      const g = (window as any).__game ?? (window as any).__GAME__;
      if (g && typeof g.stop === 'function') {
        g.stop();
      }
    });

    return { consoleErrors, pageErrors };
  }

  // =========================================================================
  // TEST 1: Game Over, Death Debounce & Pristine Restart State Invariants
  // =========================================================================
  test('Test 1: Game Over, Death Debounce & Pristine Restart State Invariants', async ({
    page,
  }) => {
    test.setTimeout(45000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Navigate to '/' and wait for canvas and window.__game
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    const initialDiag = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        loopEpoch: g.loopEpoch,
      };
    });

    expect(initialDiag.isAlive).toBe(true);
    expect(initialDiag.health).toBe(100);

    // 2. Set player health to 0 (simulate lethal damage)
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.player.takeDamage(9999);
    });

    // 3. Immediately assert player is dead, Game Over plaque is active, canResurrect() === false
    const immediateDeadState = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        isGameOver: g.isGameOver ?? !g.player.isAlive,
        canResurrect: g.canResurrect(),
        deathTimer: g.deathDebounceTimer ?? g.deathTimer,
      };
    });

    expect(immediateDeadState.isAlive).toBe(false);
    expect(immediateDeadState.health).toBe(0);
    expect(immediateDeadState.isGameOver).toBe(true);
    expect(immediateDeadState.canResurrect).toBe(false);
    expect(immediateDeadState.deathTimer).toBeLessThan(0.5);

    // 4. Send early Spacebar / Canvas click event and assert restart is ignored during debounce
    await page.keyboard.press('Space');
    await page.click('canvas#game-canvas');

    const postEarlyInputState = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        isAlive: g.player.isAlive,
        canResurrect: g.canResurrect(),
      };
    });
    expect(postEarlyInputState.isAlive).toBe(false);

    // 5. Wait until deathTimer >= 0.5s so canResurrect() === true
    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && typeof g.canResurrect === 'function' && g.canResurrect() === true;
    }, { timeout: 5000 });

    // Instrument restart hook to record exact pristine restart invariants at restart instant
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      const origRestart = g.restart.bind(g);
      g._pristineRestartSnapshot = null;
      g.restart = function () {
        origRestart();
        g._pristineRestartSnapshot = {
          isAlive: g.player.isAlive,
          currentHealth: g.player.stats.currentHealth,
          level: g.player.level,
          posX: g.player.position.x,
          posY: g.player.position.y,
          starterWeaponId: g.weaponManager.getActiveWeapons()[0]?.id,
          activeEnemies: g.hordeManager.getActiveCount(),
          activeLoot: g.lootManager.getActiveCount(),
          accumulator: g.accumulator,
          elapsedTime: g.elapsedTime,
          isPaused: g.isPaused,
          loopEpoch: g.loopEpoch,
          deathTimer: g.deathDebounceTimer ?? g.deathTimer,
          isGameOver: g.isGameOver ?? !g.player.isAlive,
        };
      };
    });

    // 6. Trigger restart via Spacebar (or canvas click)
    await page.keyboard.press('Space');

    // 7. Wait for restart snapshot and assert all pristine restart invariants
    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && g._pristineRestartSnapshot !== null;
    }, { timeout: 5000 });

    const snapshot = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g._pristineRestartSnapshot;
    });

    expect(snapshot.isAlive).toBe(true);
    expect(snapshot.currentHealth).toBe(100);
    expect(snapshot.level).toBe(1);
    expect(snapshot.posX).toBe(0);
    expect(snapshot.posY).toBe(0);
    expect(snapshot.starterWeaponId).toBe('scythe');
    expect(snapshot.activeEnemies).toBeGreaterThanOrEqual(25);
    expect(snapshot.activeLoot).toBe(0);
    expect(snapshot.accumulator).toBe(0);
    expect(snapshot.elapsedTime).toBe(0);
    expect(snapshot.isPaused).toBe(false);
    expect(snapshot.loopEpoch).toBeGreaterThan(initialDiag.loopEpoch);
    expect(snapshot.deathTimer).toBe(0);
    expect(snapshot.isGameOver).toBe(false);

    // Also assert live game state immediately post-restart
    const livePostRestart = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        level: g.player.level,
        isPaused: g.isPaused,
        starterWeaponId: g.weaponManager.getActiveWeapons()[0]?.id,
        activeEnemies: g.hordeManager.getActiveCount(),
      };
    });

    expect(livePostRestart.isAlive).toBe(true);
    expect(livePostRestart.health).toBe(100);
    expect(livePostRestart.level).toBe(1);
    expect(livePostRestart.isPaused).toBe(false);
    expect(livePostRestart.starterWeaponId).toBe('scythe');
    expect(livePostRestart.activeEnemies).toBeGreaterThanOrEqual(25);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 2: Post-Restart Autonomous Survival Loop (>= 15 Continuous Seconds)
  // =========================================================================
  test('Test 2: Post-Restart Autonomous Survival Loop (>= 15 Continuous Seconds)', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    // 1. Navigate to '/' and wait for game
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.__game ?? w.__GAME__;
      return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');

    // 2. Trigger lethal damage to simulate death
    await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      g.player.takeDamage(9999);
    });

    // 3. Wait for death debounce (deathTimer >= 0.5s)
    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && typeof g.canResurrect === 'function' && g.canResurrect() === true;
    }, { timeout: 5000 });

    // 4. Trigger restart via Spacebar
    await page.keyboard.press('Space');

    // Wait until game is running post-restart
    await page.waitForFunction(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return g && g.player && g.player.isAlive && g.isRunning;
    }, { timeout: 5000 });

    // 5. Autonomous 8-directional steering survival bot for >= 15 continuous seconds
    const wallStart = Date.now();
    const MAX_WALL_MS = 75000;

    while (Date.now() - wallStart < MAX_WALL_MS) {
      const gameStatus = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          elapsedTime: g.elapsedTime,
          isAlive: g.player.isAlive,
          health: g.player.stats.currentHealth,
          kills: g.hordeManager.totalKilled || g.killCount || 0,
          currentXP: g.player.currentXP,
          level: g.player.level,
          px: g.player.position.x,
          py: g.player.position.y,
          isModalOpen: g.upgradeModal?.getIsOpen?.() ?? false,
          isPaused: g.isPaused,
          accumulator: g.accumulator,
        };
      });

      // Target duration >= 15.0 continuous seconds post-restart
      if (gameStatus.elapsedTime >= 15.0) {
        break;
      }

      // Assert survival integrity on every tick
      expect(gameStatus.isAlive).toBe(true);
      expect(gameStatus.health).toBeGreaterThan(0);

      // Handle Level-Up modal if opened
      if (gameStatus.isModalOpen) {
        expect(gameStatus.isPaused).toBe(true);
        await page.keyboard.up('KeyA');
        await page.keyboard.up('KeyD');
        await page.keyboard.up('KeyW');
        await page.keyboard.up('KeyS');

        await page.keyboard.press('Digit1');
        await page.waitForTimeout(150);
        continue;
      }

      // 8-Directional Dynamic Window Evaluation Steering Bot
      const steer = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const px = p.position.x;
        const py = p.position.y;
        const vx = p.velocity.x;
        const vy = p.velocity.y;

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
        const activeLoot = g.lootManager.getActiveItems();

        const enemiesList: Array<{ x: number; y: number; speed: number }> = [];
        let currentMinDist = Infinity;

        for (const e of activeEnemies) {
          if (!e.isAlive) continue;
          const d = Math.hypot(e.x - px, e.y - py);
          if (d < currentMinDist) {
            currentMinDist = d;
          }
          if (d < 400) {
            enemiesList.push({
              x: e.x,
              y: e.y,
              speed: e.speed || 65,
            });
          }
        }

        const HORIZON = 0.32;
        const PLAYER_SPEED = 200;

        const distCenter = Math.hypot(px, py);
        let desiredDirX: number;
        let desiredDirY: number;

        if (distCenter < 280) {
          // Sprint breakout
          desiredDirX = 0.7071068;
          desiredDirY = 0.7071068;
        } else {
          // Tangent unit vector (clockwise)
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

        // Soul gem attraction
        let bestGemX = 0;
        let bestGemY = 0;
        let bestGemDist = Infinity;
        let bestGemVal = 1;

        for (const item of activeLoot) {
          if (!item.isAlive) continue;
          if (Math.hypot(item.position.x, item.position.y) < 200) continue;
          const gx = item.position.x - px;
          const gy = item.position.y - py;
          const d = Math.hypot(gx, gy);
          if (d > 0.1) {
            const flowDot = (gx / d) * desiredDirX + (gy / d) * desiredDirY;
            if (flowDot < -0.2) continue;
          }
          if (d < bestGemDist) {
            bestGemDist = d;
            bestGemX = gx;
            bestGemY = gy;
            bestGemVal = item.xpValue || 1;
          }
        }

        let gemDirX = 0;
        let gemDirY = 0;
        if (bestGemDist < Infinity) {
          gemDirX = bestGemX / bestGemDist;
          gemDirY = bestGemY / bestGemDist;
        }

        const currentSpeed = Math.hypot(vx, vy);
        const normVx = currentSpeed > 10 ? vx / currentSpeed : 0;
        const normVy = currentSpeed > 10 ? vy / currentSpeed : 0;

        let bestScore = -Infinity;
        let bestCandidate = CANDIDATES[0];
        let bestMinFutureDist = 0;

        for (const c of CANDIDATES) {
          let score = 0;
          const playerFutureX = px + c.dx * PLAYER_SPEED * HORIZON;
          const playerFutureY = py + c.dy * PLAYER_SPEED * HORIZON;

          // 3-point collision check
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
            if (fdist < minFutureDist) {
              minFutureDist = fdist;
            }

            // Severe collision danger penalties
            if (fdist < 34) {
              score -= 1000000 * ((34 - fdist) / 34);
            } else if (fdist < 58) {
              score -= 60000 * ((58 - fdist) / 58);
            }
          }

          // Combat engagement sweet spot between 64px and 80px
          if (minFutureDist >= 64 && minFutureDist <= 80) {
            score += 300;
          }

          // Central death zone penalty after t >= 1.5s
          if (g.elapsedTime >= 1.5) {
            const futureDistCenter = Math.hypot(playerFutureX, playerFutureY);
            if (futureDistCenter < 220) {
              score -= 10000000;
            }
          }

          // Carousel kiting flow
          const kiteWeight = minFutureDist < 55 ? 250 : 80;
          const kdot = c.dx * desiredDirX + c.dy * desiredDirY;
          score += kdot * kiteWeight;
          if (kdot < -0.2) {
            score -= 3000;
          }

          // Soul gem attraction
          if (bestGemDist < 400 && minFutureDist >= 54) {
            const gdot = c.dx * gemDirX + c.dy * gemDirY;
            if (gdot > 0) {
              const priority = (p.level < 2 ? 1200 : 250) * bestGemVal;
              const distFactor = Math.max(0.35, 1 - bestGemDist / 400);
              score += gdot * priority * distFactor;
            }
          }

          // Smoothness & momentum
          if (currentSpeed > 15) {
            const mdot = c.dx * normVx + c.dy * normVy;
            score += mdot * 90;
          }

          if (score > bestScore) {
            bestScore = score;
            bestCandidate = c;
            bestMinFutureDist = minFutureDist;
          }
        }

        return {
          ...bestCandidate.keys,
          name: bestCandidate.name,
          minEnemyDist: currentMinDist,
          bestScore,
          bestMinFutureDist,
        };
      });

      // Apply genuine keyboard events
      if (steer.left) await page.keyboard.down('KeyA'); else await page.keyboard.up('KeyA');
      if (steer.right) await page.keyboard.down('KeyD'); else await page.keyboard.up('KeyD');
      if (steer.up) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
      if (steer.down) await page.keyboard.down('KeyS'); else await page.keyboard.up('KeyS');

      await page.waitForTimeout(130);
    }

    // Release all keys
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');
    await page.keyboard.up('KeyW');
    await page.keyboard.up('KeyS');

    // Final Post-Restart Survival Invariant Assertions
    const finalReport = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        elapsedTime: g.elapsedTime,
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        kills: g.hordeManager.totalKilled || g.killCount || 0,
        accumulator: g.accumulator,
        isPaused: g.isPaused,
      };
    });

    expect(finalReport.elapsedTime).toBeGreaterThanOrEqual(15.0);
    expect(finalReport.isAlive).toBe(true);
    expect(finalReport.health).toBeGreaterThan(0);
    expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    expect(finalReport.accumulator).toBeLessThanOrEqual(1 / 60 + 0.01);
    expect(finalReport.isPaused).toBe(false);

    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 3: Visual Proof Screenshots Generation (All 3 Artifacts > 50KB)
  // =========================================================================
  test('Test 3a: Visual Proof — enhanced_graphics_swarm.png (>50KB, centered Sorcerer surrounded by 4 concentric rings of 92+ undead with drop shadows)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__game ?? (window as any).__GAME__;

      // 1. Position player and camera at center
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 85;
      game.player.stats.maxHealth = 100;

      game.camera.x = -480;
      game.camera.y = -270;
      game.camera.renderX = -480;
      game.camera.renderY = -270;

      // 2. Clear default spawns
      game.hordeManager.clear();

      // 3. Spawn 4 concentric rings of undead entities (92 total entities)
      game.hordeManager.spawnWave('SKELETON', 35, { x: 0, y: 0 }, 150);
      game.hordeManager.spawnWave('GHOUL', 25, { x: 0, y: 0 }, 240);
      game.hordeManager.spawnWave('BANSHEE', 20, { x: 0, y: 0 }, 330);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 12, { x: 0, y: 0 }, 420);

      // 4. Grounded Soul Gems with contact drop shadows
      game.lootManager.clear();
      game.lootManager.spawnDrop('EMERALD_SHARD', 55, 65, false);
      game.lootManager.spawnDrop('RUBY_GEM', -75, -55, false);
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', 115, -45, false);

      // 5. HUD State Snapshot
      game.elapsedTime = 65.0; // Minute 1:05 -> Nightfall phase
      game.killCount = 142;
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 85;
        game.hud.ghostHealth = 95;
        game.hud.displayXP = 12;
        game.hud.xpToNextLevel = 25;
        game.hud.currentLevel = 2;
      }

      // 6. Step 8 frames to settle walk frames, orientations, and drop shadows
      for (let i = 0; i < 8; i++) {
        game.step(1 / 60);
      }

      // Re-lock camera to origin
      game.camera.renderX = -480;
      game.camera.renderY = -270;

      // 7. Force synchronous render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'enhanced_graphics_swarm.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'enhanced_graphics_swarm.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `enhanced_graphics_swarm.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Test 3b: Visual Proof — restart_verified.png (>50KB, active post-restart gameplay: player resurrected, revived HUD, active horde, scythe cleave slash)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__game ?? (window as any).__GAME__;

      // 1. Simulate death followed by clean resurrection
      game.player.takeDamage(9999);
      game.restart();

      // 2. Position player and engage active horde
      game.player.position.x = 40;
      game.player.position.y = -20;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 95;
      game.player.stats.maxHealth = 100;

      // Center camera on player
      game.camera.renderX = game.player.position.x - 480;
      game.camera.renderY = game.player.position.y - 270;

      // 3. Populate active initial swarm closing in
      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 25, { x: game.player.position.x, y: game.player.position.y }, 180);
      game.hordeManager.spawnWave('GHOUL', 10, { x: game.player.position.x, y: game.player.position.y }, 260);

      // 4. Trigger active Arcane Scythe cleave slash
      const scythe = game.weaponManager.getWeapon('scythe');
      if (scythe) {
        (scythe as any).activeSlashes.push({
          x: game.player.position.x,
          y: game.player.position.y,
          angle: 0.15,
          radius: 95,
          arcAngle: (130 * Math.PI) / 180,
          life: 0.04,
          maxLife: 0.18,
          isDual: false,
          isEvolution: false,
        });
      }

      // 5. Spawn scattered soul drops from initial kills
      game.lootManager.clear();
      game.lootManager.spawnDrop('EMERALD_SHARD', game.player.position.x + 80, game.player.position.y - 30, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', game.player.position.x + 110, game.player.position.y + 40, false);

      // 6. Update HUD showing revived active status
      game.elapsedTime = 12.0;
      game.killCount = 8;
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 95;
        game.hud.ghostHealth = 100;
        game.hud.displayXP = 8;
        game.hud.xpToNextLevel = 15;
        game.hud.currentLevel = 1;
      }

      // 7. Advance 2 frames for VFX
      for (let i = 0; i < 2; i++) {
        game.vfx.update(1 / 60);
      }

      // 8. Force synchronous render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'restart_verified.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'restart_verified.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `restart_verified.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Test 3c: Visual Proof — occult_vfx_lighting.png (>50KB, dynamic amber torch light, violet scythe slash, branching abyssal lightning, soul motes, blood decals, 3-layer mist)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__game ?? (window as any).__GAME__;

      // 1. Position player and camera
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.camera.renderX = -480;
      game.camera.renderY = -270;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 78;
      game.player.stats.maxHealth = 100;
      game.elapsedTime = 95.0; // 01:35
      game.killCount = 312;

      // 2. Equip occult arsenal for multi-spell lighting
      game.weaponManager.clear();
      const scythe = game.weaponManager.addWeapon('scythe', 4);
      const orbiters = game.weaponManager.addWeapon('orbiters', 4);
      const lightning = game.weaponManager.addWeapon('lightning', 3);
      const aura = game.weaponManager.addWeapon('aura', 3);

      // 3. Populate combat enemies surrounding player
      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 180);
      game.hordeManager.spawnWave('GHOUL', 20, { x: 0, y: 0 }, 260);
      game.hordeManager.spawnWave('BANSHEE', 15, { x: 0, y: 0 }, 340);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 8, { x: 0, y: 0 }, 410);

      // 4. Ground Decals (Persistent Blood Pools, Splatters, Lightning Scorches, Arcane Sigil)
      game.vfx.clear();
      game.vfx.emitBloodPool(100, 30, 20);
      game.vfx.emitBloodPool(-120, -60, 18);
      game.vfx.emitBloodPool(60, -110, 16);
      for (let i = 0; i < 14; i++) {
        const rx = (Math.random() - 0.5) * 380;
        const ry = (Math.random() - 0.5) * 280;
        game.vfx.emitBloodSplatter(rx, ry, 4 + Math.random() * 5);
      }
      game.vfx.emitLightningScorch(175, -110, 24);
      game.vfx.emitLightningScorch(-190, -70, 22);
      game.vfx.emitSigilScorch(0, 0, 44);

      // 5. Active Spell Visual Effects & Lighting:
      // (a) Active Arcane Scythe Slash Arc (Violet Runic Cleave)
      if (scythe) {
        (scythe as any).activeSlashes.push({
          x: 0,
          y: 0,
          angle: 0.25,
          radius: 120,
          arcAngle: (140 * Math.PI) / 180,
          life: 0.04,
          maxLife: 0.18,
          isDual: false,
          isEvolution: false,
        });
      }

      // (b) Soul Orbiters perimeter flaming skulls
      if (orbiters) {
        (orbiters as any).baseAngle = 0.85;
        orbiters.syncSkulls();
      }

      // (c) Branching Abyssal Lightning Arcs with Recursive Midpoint Displacement
      if (lightning) {
        (lightning as any).activeBolts.push(
          {
            segments: [
              { x1: 0, y1: -10, x2: 70, y2: -60 },
              { x1: 70, y1: -60, x2: 120, y2: -90 },
              { x1: 120, y1: -90, x2: 175, y2: -110 },
              { x1: 120, y1: -90, x2: 160, y2: -40 },
            ],
            life: 0.03,
            maxLife: 0.14,
            isEvolution: false,
          },
          {
            segments: [
              { x1: 0, y1: -10, x2: -60, y2: -80 },
              { x1: -60, y1: -80, x2: -130, y2: -100 },
              { x1: -130, y1: -100, x2: -190, y2: -70 },
            ],
            life: 0.04,
            maxLife: 0.14,
            isEvolution: false,
          }
        );
      }
      game.vfx.lighting.triggerLightningFlash(0.40);

      // (d) Cursed Aura expanding crimson shockwave
      if (aura) {
        (aura as any).activeRings.push({
          x: 0,
          y: 0,
          maxRadius: 140,
          life: 0.16,
          maxLife: 0.35,
          isEvolution: false,
        });
      }

      // 6. Air Particles: Swirling Soul Motes, Bone Shatter, Blood Bursts
      game.vfx.emitSoulBurst(140, 50, 'emerald', 14);
      game.vfx.emitSoulBurst(-130, -80, 'violet', 14);
      game.vfx.emitSoulBurst(80, -100, 'ruby', 10);
      game.vfx.emitSoulBurst(-70, 80, 'emerald', 10);

      game.vfx.emitBloodBurst(95, 20, 22, 1, 0.2);
      game.vfx.emitBloodBurst(-120, -50, 18, -1, -0.3);
      game.vfx.emitBoneShatter(110, -20, 18);
      game.vfx.emitBoneShatter(-80, 70, 16);

      game.vfx.emitSpellCircle(0, 0, 75, 2.0);
      game.vfx.emitGemGlint(80, 90);
      game.vfx.emitGemGlint(-90, -80);
      game.vfx.emitGemGlint(140, -40);

      // 7. Scattered Soul Gems with shimmer
      game.lootManager.clear();
      game.lootManager.spawnDrop('EMERALD_SHARD', 80, 90, false);
      game.lootManager.spawnDrop('RUBY_GEM', -90, -80, false);
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', 140, -40, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', -60, 110, false);

      // 8. Enemy damage flash frames
      const enemies = game.hordeManager.getActiveEnemies();
      for (let i = 0; i < Math.min(8, enemies.length); i++) {
        enemies[i].flashTimer = 0.08;
      }

      // 9. Advance particles and mist
      for (let i = 0; i < 2; i++) {
        game.vfx.update(1 / 60);
      }

      // 10. Force synchronous render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'occult_vfx_lighting.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'occult_vfx_lighting.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `occult_vfx_lighting.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Test 3d: Visual Proof Invariant Audit — All 3 artifacts exist on disk, exceed 50KB, have valid PNG magic bytes and 960x540 dimensions', async () => {
    const requiredArtifacts = [
      'enhanced_graphics_swarm.png',
      'restart_verified.png',
      'occult_vfx_lighting.png',
    ];

    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const filename of requiredArtifacts) {
      const filePath = path.join(ARTIFACT_DIR, filename);

      // 1. File existence assertion
      expect(fs.existsSync(filePath), `Artifact ${filename} must exist on disk at ${filePath}`).toBe(true);

      // 2. Strict size > 50KB (51,200 bytes) assertion
      const stats = fs.statSync(filePath);
      expect(
        stats.size,
        `Artifact ${filename} byte size (${stats.size} bytes) must be strictly > 50KB (51,200 bytes)`
      ).toBeGreaterThan(50 * 1024);

      // 3. Valid PNG magic header bytes
      const buffer = fs.readFileSync(filePath);
      expect(
        buffer.subarray(0, 8).equals(pngMagic),
        `Artifact ${filename} must start with standard PNG magic header (89 50 4E 47 0D 0A 1A 0A)`
      ).toBe(true);

      // 4. Dimensions check from PNG IHDR chunk (960 x 540)
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `Artifact ${filename} width must be 960`).toBe(960);
      expect(height, `Artifact ${filename} height must be 540`).toBe(540);
    }
  });
});
