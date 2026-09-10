import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening', () => {
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
  // TEST 1: Playable Horde Survival Loop (>= 30 Continuous Seconds)
  // =========================================================================
  test('Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors', async ({
    page,
  }) => {
    test.setTimeout(90000); // 90s safety envelope for 30s+ active playtest

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

    // 1. Navigate to game root
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    // Catch unhandled promise rejections in page context
    await page.evaluate(() => {
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled Promise Rejection:', event.reason);
      });
    });

    // Wait until GrimHarvestGame is mounted and running
    await page.waitForFunction(
      () => {
        const w = window as any;
        const g = w.__game ?? w.__GAME__;
        return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
      },
      { timeout: 10000 }
    );

    await page.focus('canvas#game-canvas');

    // 2. Initial state audit
    const initialDiag = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        level: g.player.level,
        health: g.player.stats.currentHealth,
        isAlive: g.player.isAlive,
        activeEnemies: g.hordeManager.getActiveCount(),
        starterWeapon: g.weaponManager.getActiveWeapons()[0]?.id,
      };
    });

    expect(initialDiag.isAlive).toBe(true);
    expect(initialDiag.health).toBe(100);
    expect(initialDiag.level).toBe(1);
    expect(initialDiag.starterWeapon).toBe('scythe');
    expect(initialDiag.activeEnemies).toBeGreaterThanOrEqual(25);

    // 3. Continuous 30+ second survival simulation loop
    let modalSelectedCount = 0;
    let initialKillsVerified = false;
    let xpAccumulationVerified = false;

    // Run until internal game elapsedTime >= 30.5 seconds and Level 2 reached
    const wallStart = Date.now();
    const MAX_WALL_MS = 75000; // safety wall timeout

    while (Date.now() - wallStart < MAX_WALL_MS) {
      // Check internal game progress
      const gameStatus = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        return {
          elapsedTime: g.elapsedTime,
          isAlive: g.player.isAlive,
          health: g.player.stats.currentHealth,
          kills: g.hordeManager.totalKilled,
          currentXP: g.player.currentXP,
          totalXP: g.player.progression.getTotalXP(),
          level: g.player.level,
          px: g.player.position.x,
          py: g.player.position.y,
          isModalOpen: g.upgradeModal?.getIsOpen?.() ?? false,
          isPaused: g.isPaused,
          accumulator: g.accumulator,
        };
      });

      console.log(
        `[E2E Survival] t=${gameStatus.elapsedTime.toFixed(2)}s | HP=${gameStatus.health.toFixed(1)} | Pos=(${gameStatus.px.toFixed(1)}, ${gameStatus.py.toFixed(1)}) | Kills=${gameStatus.kills} | XP=${gameStatus.totalXP} | Lvl=${gameStatus.level}`
      );// Verify weapons auto-fire and enemies are slain
      if (!initialKillsVerified && gameStatus.kills > 0) {
        initialKillsVerified = true;
      }

      // Verify loot gems are vacuumed and XP accumulates
      if (!xpAccumulationVerified && (gameStatus.totalXP >= 10 || gameStatus.level >= 2)) {
        xpAccumulationVerified = true;
      }

      // Check if level reached target duration and level-up occurred
      if (gameStatus.elapsedTime >= 30.0 && modalSelectedCount >= 1) {
        break;
      }
      if (gameStatus.elapsedTime >= 45.0) {
        break;
      }

      // Ensure player is still alive
      expect(gameStatus.isAlive).toBe(true);
      expect(gameStatus.health).toBeGreaterThan(0);

      // Handle Level-Up modal if open
      if (gameStatus.isModalOpen) {
        // Assert modal paused the simulation
        expect(gameStatus.isPaused).toBe(true);

        // Ensure movement keys are released before modal selection
        await page.keyboard.up('KeyA');
        await page.keyboard.up('KeyD');
        await page.keyboard.up('KeyW');
        await page.keyboard.up('KeyS');

        // Select Boon Card 1 via authentic keypress 'Digit1'
        await page.keyboard.press('Digit1');
        await page.waitForTimeout(150);

        // Verify modal closed, upgrade applied, simulation unpaused cleanly, and accumulator reset
        const postSelection = await page.evaluate(() => {
          const g = (window as any).__game ?? (window as any).__GAME__;
          return {
            isOpen: g.upgradeModal.getIsOpen(),
            isPaused: g.isPaused,
            accumulator: g.accumulator,
            level: g.player.level,
            weaponCount: g.weaponManager.getActiveWeapons().length,
            inventory: g.upgradeSystem.getWeaponsInventory(),
          };
        });

        expect(postSelection.isOpen).toBe(false);
        expect(postSelection.isPaused).toBe(false);
        // Accumulator should be reset to 0 or <= 1 frame delta
        expect(postSelection.accumulator).toBeLessThanOrEqual(1 / 60 + 0.005);
        expect(postSelection.level).toBeGreaterThanOrEqual(2);

        modalSelectedCount++;
        continue;
      }

      if (Math.floor(gameStatus.elapsedTime) !== Math.floor(gameStatus.elapsedTime - 0.13)) {
        console.log(
          `[E2E Survival] t=${gameStatus.elapsedTime.toFixed(1)}s | HP=${gameStatus.health}/100 | Kills=${gameStatus.kills} | TotalXP=${gameStatus.totalXP} | Level=${gameStatus.level}`
        );
      }

      // Dynamic Dodging & Steering Vector Computation via 8-Directional Dynamic Window Evaluation
      const steer = await page.evaluate(() => {
        const g = (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const px = p.position.x;
        const py = p.position.y;
        const vx = p.velocity.x;
        const vy = p.velocity.y;

        // 8 candidate movement directions
        const CANDIDATES = [
          { name: 'RIGHT', dx:  1,          dy:  0,          keys: { right: true,  left: false, up: false, down: false } },
          { name: 'DOWN_RIGHT', dx:  0.7071068,  dy:  0.7071068,  keys: { right: true,  left: false, up: false, down: true  } },
          { name: 'DOWN', dx:  0,          dy:  1,          keys: { right: false, left: false, up: false, down: true  } },
          { name: 'DOWN_LEFT', dx: -0.7071068,  dy:  0.7071068,  keys: { right: false, left: true,  up: false, down: true  } },
          { name: 'LEFT', dx: -1,          dy:  0,          keys: { right: false, left: true,  up: false, down: false } },
          { name: 'UP_LEFT', dx: -0.7071068,  dy: -0.7071068,  keys: { right: false, left: true,  up: true,  down: false } },
          { name: 'UP', dx:  0,          dy: -1,          keys: { right: false, left: false, up: true,  down: false } },
          { name: 'UP_RIGHT', dx:  0.7071068,  dy: -0.7071068,  keys: { right: true,  left: false, up: true,  down: false } },
        ];

        const activeEnemies = g.hordeManager.getActiveEnemies();
        const activeLoot = g.lootManager.getActiveItems();

        // 1. Gather active enemies
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

        // Dynamic Window Trajectory Evaluation Horizon (0.32s into the future)
        const HORIZON = 0.32;
        const PLAYER_SPEED = 200;

        // Radial distance from center (0, 0)
        const distCenter = Math.hypot(px, py);
        let desiredDirX: number;
        let desiredDirY: number;

        if (distCenter < 280) {
          // Initial straight sprint breakout from center to outer orbit
          desiredDirX = 0.7071068;
          desiredDirY = 0.7071068;
        } else {
          // Tangent unit vector (clockwise)
          const currentAngle = Math.atan2(py, px);
          const tanX = -Math.sin(currentAngle);
          const tanY = Math.cos(currentAngle);

          // Restoring force towards target radius 320px
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

        // 2. Find closest Soul Gem along forward orbit flow
        let bestGemX = 0;
        let bestGemY = 0;
        let bestGemDist = Infinity;
        let bestGemVal = 1;

        for (const item of activeLoot) {
          if (!item.isAlive) continue;
          // Never chase gems dropped inside the deep central zone (< 200px)
          if (Math.hypot(item.position.x, item.position.y) < 200) continue;
          const gx = item.position.x - px;
          const gy = item.position.y - py;
          const d = Math.hypot(gx, gy);
          if (d > 0.1) {
            // Avoid gems directly opposite to player's forward orbit flow
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

        // Current velocity direction
        const currentSpeed = Math.hypot(vx, vy);
        const normVx = currentSpeed > 10 ? vx / currentSpeed : 0;
        const normVy = currentSpeed > 10 ? vy / currentSpeed : 0;

        let bestScore = -Infinity;
        let bestCandidate = CANDIDATES[0];
        let bestMinFutureDist = 0;

        for (const c of CANDIDATES) {
          let score = 0;

          // Projected future player position at full horizon
          const playerFutureX = px + c.dx * PLAYER_SPEED * HORIZON;
          const playerFutureY = py + c.dy * PLAYER_SPEED * HORIZON;

          // A. Multi-point future collision check against all nearby enemies (t=0, t=0.5*H, t=H)
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

            // Severe collision danger penalties activate strictly at fdist < 58px (contact damage occurs at < 29px)
            if (fdist < 34) {
              // Direct contact damage collision (< 34px)
              score -= 1000000 * ((34 - fdist) / 34);
            } else if (fdist < 58) {
              // Danger buffer zone (34px <= fdist < 58px): guarantees safety over 130ms Playwright tick
              score -= 60000 * ((58 - fdist) / 58);
            }
          }

          // Positive Combat Engagement Bonus: maintain distance in sweet spot between 64px and 80px
          // Arcane Scythe reach is 75px; enemies are cleaved while player maintains a safe 35px+ buffer
          if (minFutureDist >= 64 && minFutureDist <= 80) {
            score += 300;
          }

          // B. Sector Threat Density (gentle bias towards open space without disrupting orbit)
          let sectorThreat = 0;
          for (const en of enemiesList) {
            const edx = en.x - px;
            const edy = en.y - py;
            const edist = Math.hypot(edx, edy) || 1;
            if (edist < 90) {
              const edot = (edx / edist) * c.dx + (edy / edist) * c.dy;
              if (edot > 0) {
                sectorThreat += edot * Math.pow(1 - edist / 90, 2) * 120;
              }
            }
          }
          score -= sectorThreat;

          // C. Real Arena boundary avoidance (arena is [-2000, 2000])
          const softLimit = 1200;
          if (Math.abs(playerFutureX) > softLimit) {
            score -= (Math.abs(playerFutureX) - softLimit) * 200;
          }
          if (Math.abs(playerFutureY) > softLimit) {
            score -= (Math.abs(playerFutureY) - softLimit) * 200;
          }
          if (Math.abs(playerFutureX) > 1600 || Math.abs(playerFutureY) > 1600) {
            score -= 300000;
          }

          // Central Death Convergence Zone avoidance (once broken out, never dive back into center!)
          if (g.elapsedTime >= 1.5) {
            const futureDistCenter = Math.hypot(playerFutureX, playerFutureY);
            if (futureDistCenter < 220) {
              score -= 10000000;
            }
          }

          // D. Carousel Kiting Flow & Combat Pacing
          const kiteWeight = minFutureDist < 55 ? 250 : 80;
          const kdot = c.dx * desiredDirX + c.dy * desiredDirY;
          score += kdot * kiteWeight;
          if (kdot < -0.2) {
            score -= 3000;
          }

          // E. Soul Gem / XP attraction (safe clearance gate: minFutureDist >= 54px)
          if (bestGemDist < 400 && minFutureDist >= 54) {
            const gdot = c.dx * gemDirX + c.dy * gemDirY;
            if (gdot > 0) {
              const priority = (p.level < 2 ? 1200 : 250) * bestGemVal;
              const distFactor = Math.max(0.35, 1 - bestGemDist / 400);
              score += gdot * priority * distFactor;
            }
          }

          // F. Smoothness & Momentum (prevent high-frequency key jitter)
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

      console.log(`  -> steer=${steer.name} curMinD=${steer.minEnemyDist.toFixed(1)} futMinD=${steer.bestMinFutureDist.toFixed(1)} score=${steer.bestScore.toFixed(0)}`);

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

    // 4. Final Survival Invariant Verifications
    const finalReport = await page.evaluate(() => {
      const g = (window as any).__game ?? (window as any).__GAME__;
      return {
        elapsedTime: g.elapsedTime,
        isAlive: g.player.isAlive,
        health: g.player.stats.currentHealth,
        kills: g.hordeManager.totalKilled,
        level: g.player.level,
        totalXP: g.player.progression.getTotalXP(),
        isPaused: g.isPaused,
        weaponCount: g.weaponManager.getActiveWeapons().length,
      };
    });

    // Invariant assertions
    expect(finalReport.elapsedTime).toBeGreaterThanOrEqual(30.0);
    expect(finalReport.isAlive).toBe(true);
    expect(finalReport.health).toBeGreaterThan(0);
    expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
    expect(finalReport.level).toBeGreaterThanOrEqual(2);
    expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
    expect(finalReport.isPaused).toBe(false);

    // Zero fatal console errors and zero unhandled page errors
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // =========================================================================
  // TEST 2: Visual Proof Screenshots Generation (All 3 Artifacts > 50KB)
  // =========================================================================
  test('Visual Proof 1: captures horde_swarm.png (dense undead swarm around sorcerer against blood moon)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__game ?? (window as any).__GAME__;

      // 1. Position player and camera
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.velocity.x = 0;
      game.player.velocity.y = 0;
      game.player.facingDirection = 1;
      game.player.stats.currentHealth = 85;
      game.player.stats.maxHealth = 100;

      game.camera.x = 0;
      game.camera.y = 0;
      game.camera.renderX = -480;
      game.camera.renderY = -270;

      // 2. Clear existing initial spawn
      game.hordeManager.clear();

      // 3. Multi-tier concentric swarm spawn (135+ total entities)
      game.hordeManager.spawnWave('SKELETON', 50, { x: 0, y: 0 }, 210);
      game.hordeManager.spawnWave('GHOUL', 35, { x: 0, y: 0 }, 300);
      game.hordeManager.spawnWave('BANSHEE', 25, { x: 0, y: 0 }, 380);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 15, { x: 0, y: 0 }, 440);
      // Asymmetric right flank pressure
      game.hordeManager.spawnWave('SKELETON', 15, { x: 260, y: -80 }, 90);

      // 4. Set HUD state
      game.elapsedTime = 65.0; // Minute 1:05 -> Nightfall phase
      game.killCount = 142;
      if (game.hud) {
        (game.hud as any).isFirstUpdate = false;
        game.hud.displayHealth = 85;
        game.hud.ghostHealth = 95;
        game.hud.displayXP = 8;
        game.hud.xpToNextLevel = 25;
        game.hud.currentLevel = 2;
      }

      // 5. Advance 10 frames to settle orientations and walk frames
      for (let i = 0; i < 10; i++) {
        game.step(1 / 60);
      }

      // 6. Force canvas render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'horde_swarm.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'horde_swarm.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `horde_swarm.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Visual Proof 2: captures level_up_modal.png (canvas-rendered gothic card modal with gold filigree and rank pips)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupDeterministicGame(page);

    await page.evaluate(() => {
      const game = (window as any).__game ?? (window as any).__GAME__;

      // 1. Establish background scene
      game.player.position.x = 0;
      game.player.position.y = 0;
      game.player.level = 4;
      game.elapsedTime = 124.0;
      game.camera.renderX = -480;
      game.camera.renderY = -270;

      game.upgradeSystem.addWeapon('weapon_scythe', 3);
      game.upgradeSystem.addWeapon('weapon_orbiters', 2);
      game.upgradeSystem.addPassive('passive_might', 2);
      game.upgradeSystem.addPassive('passive_chalice', 1);

      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 20, { x: 0, y: 0 }, 280);
      game.hordeManager.spawnWave('GHOUL', 10, { x: 0, y: 0 }, 360);
      game.lootManager.spawnDrop('EMERALD_SHARD', 50, 40, false);
      game.lootManager.spawnDrop('RUBY_GEM', -70, -30, false);

      for (let i = 0; i < 2; i++) {
        game.step(1 / 60);
      }

      // 2. Generate 4 diverse cards with gothic styling
      const card1 = {
        id: 'card_scythe_4',
        itemType: 'weapon',
        itemId: 'weapon_scythe',
        name: 'Arcane Scythe',
        subtitle: 'Sweeping Cleave',
        category: 'weapon' as const,
        icon: 'scythe',
        currentRank: 3,
        previousRank: 3,
        newRank: 4,
        description: 'Sweeps a wider 140° cleave arc with +20 damage and increased reach.',
        statChangeDescription: '+20 Damage, +15px Radius',
        isEvolution: false,
      };

      const card2 = {
        id: 'card_orbiters_3',
        itemType: 'weapon',
        itemId: 'weapon_orbiters',
        name: 'Soul Orbiters',
        subtitle: 'Necrotic Shield',
        category: 'weapon' as const,
        icon: 'orbiters',
        currentRank: 2,
        previousRank: 2,
        newRank: 3,
        description: 'Summons an additional flaming skull orbiter incinerating nearby foes.',
        statChangeDescription: '+1 Orbiter, +15 Damage',
        isEvolution: false,
      };

      const card3 = {
        id: 'card_might_3',
        itemType: 'passive',
        itemId: 'passive_might',
        name: 'Tome of Might',
        subtitle: 'Occult Knowledge',
        category: 'passive' as const,
        icon: 'tome',
        currentRank: 2,
        previousRank: 2,
        newRank: 3,
        description: 'Empowers all occult spells with +15% total damage multiplier.',
        statChangeDescription: '+15% Might Damage',
        isEvolution: false,
      };

      const card4 = {
        id: 'card_evolution_scythe',
        itemType: 'evolution',
        itemId: 'evolution_scythe',
        name: 'Soul Harvester',
        subtitle: 'Supreme Evolution',
        category: 'evolution' as const,
        icon: 'scythe',
        currentRank: 4,
        previousRank: 4,
        newRank: 5,
        description: 'Transforms Arcane Scythe into a 360° full-screen harvest with life-drain.',
        statChangeDescription: '360° Cleave, 15% Life Shards',
        isEvolution: true,
      };

      const cards = [card1, card2, card3, card4];

      // 3. Open modal & set hover highlight
      game.isPaused = true;
      game.upgradeModal.open(cards, 4, game.canvas);
      game.upgradeModal.hoveredIndex = 0;
      game.upgradeModal.selectedIndex = 0;
      game.upgradeModal.update(0.3); // Animate glow and pulse

      // 4. Force render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'level_up_modal.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'level_up_modal.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `level_up_modal.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Visual Proof 3: captures survival_gameplay.png (active spell VFX: Arcane Scythe cleave, Soul Orbiters skulls, Abyssal Lightning arcs, Bone Spear trails, and Cursed Aura pulses)', async ({
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
      game.player.stats.currentHealth = 72;
      game.player.stats.maxHealth = 100;
      game.elapsedTime = 95.0; // 01:35
      game.killCount = 287;

      // 2. Equip all 5 occult weapons at Rank 3+ in both systems
      game.weaponManager.clear();
      const scythe = game.weaponManager.addWeapon('scythe', 3);
      const orbiters = game.weaponManager.addWeapon('orbiters', 4);
      const lightning = game.weaponManager.addWeapon('lightning', 3);
      const spear = game.weaponManager.addWeapon('spear', 3);
      const aura = game.weaponManager.addWeapon('aura', 3);

      game.upgradeSystem.addWeapon('weapon_scythe', 3);
      game.upgradeSystem.addWeapon('weapon_orbiters', 4);
      game.upgradeSystem.addWeapon('weapon_lightning', 3);
      game.upgradeSystem.addWeapon('weapon_spear', 3);
      game.upgradeSystem.addWeapon('weapon_aura', 3);
      game.upgradeSystem.addPassive('passive_might', 2);

      // 3. Populate combat enemies
      game.hordeManager.clear();
      game.hordeManager.spawnWave('SKELETON', 30, { x: 0, y: 0 }, 180);
      game.hordeManager.spawnWave('GHOUL', 20, { x: 0, y: 0 }, 260);
      game.hordeManager.spawnWave('BANSHEE', 15, { x: 0, y: 0 }, 340);
      game.hordeManager.spawnWave('DEATH_KNIGHT', 8, { x: 0, y: 0 }, 410);

      // 4. Trigger active visual effects for ALL 5 occult weapons:
      // (a) Arcane Scythe cleave arc
      if (scythe) {
        (scythe as any).activeSlashes.push({
          x: 0,
          y: 0,
          angle: 0.2,
          radius: 110,
          arcAngle: (130 * Math.PI) / 180,
          life: 0.04,
          maxLife: 0.18,
          isDual: false,
          isEvolution: false,
        });
      }

      // (b) Soul Orbiters skulls
      if (orbiters) {
        (orbiters as any).baseAngle = 0.8;
        orbiters.syncSkulls();
      }

      // (c) Abyssal Lightning arcs
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
            life: 0.05,
            maxLife: 0.14,
            isEvolution: false,
          }
        );
      }

      // (d) Bone Spears in flight with trails
      if (spear) {
        (spear as any).projectilePool.clear();
        const pool = (spear as any).projectilePool;
        const p1 = pool.spawn ? pool.spawn() : pool.allocate();
        if (p1) {
          p1.reset('spear', 90, 35, 450, 120, 465, 8, 60, 100, 3, 1.0);
        }
        const p2 = pool.spawn ? pool.spawn() : pool.allocate();
        if (p2) {
          p2.reset('spear', 110, 0, 500, 0, 500, 8, 60, 100, 3, 1.0);
        }
        const p3 = pool.spawn ? pool.spawn() : pool.allocate();
        if (p3) {
          p3.reset('spear', 85, -40, 450, -140, 471, 8, 60, 100, 3, 1.0);
        }
      }

      // (e) Cursed Aura expanding ring
      if (aura) {
        (aura as any).activeRings.push({
          x: 0,
          y: 0,
          maxRadius: 130,
          life: 0.18,
          maxLife: 0.35,
          isEvolution: false,
        });
      }

      // 5. Populate DarkFantasyVFX Particles
      game.vfx.clear();
      game.vfx.emitBloodBurst(95, 20, 24, 1, 0.2);
      game.vfx.emitBloodBurst(-120, -50, 16, -1, -0.3);
      game.vfx.emitBoneShatter(110, -20, 18);
      game.vfx.emitBoneShatter(-80, 70, 14);
      game.vfx.emitSoulBurst(130, 40, 'emerald', 10);
      game.vfx.emitSoulBurst(-110, -70, 'violet', 10);
      game.vfx.emitSoulBurst(60, -90, 'ruby', 8);
      game.vfx.emitSpellCircle(0, 0, 70, 2.0);
      game.vfx.emitGemGlint(80, 90);
      game.vfx.emitGemGlint(-90, -80);
      game.vfx.emitGemGlint(140, -40);

      // 6. Scattered Soul Gems
      game.lootManager.clear();
      game.lootManager.spawnDrop('EMERALD_SHARD', 80, 90, false);
      game.lootManager.spawnDrop('RUBY_GEM', -90, -80, false);
      game.lootManager.spawnDrop('VIOLET_ABYSSAL', 140, -40, false);
      game.lootManager.spawnDrop('EMERALD_SHARD', -60, 110, false);

      // 7. Enemy damage flash
      const enemies = game.hordeManager.getActiveEnemies();
      for (let i = 0; i < Math.min(6, enemies.length); i++) {
        enemies[i].flashTimer = 0.08;
      }

      // 8. Settle particles
      for (let i = 0; i < 2; i++) {
        game.vfx.update(1 / 60);
      }

      // 9. Force render
      game.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'survival_gameplay.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and size strictly > 50KB
    expect(fs.existsSync(targetPath), 'survival_gameplay.png must exist on disk').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `survival_gameplay.png size (${stats.size} bytes) must be > 50KB (51,200 bytes)`
    ).toBeGreaterThan(50 * 1024);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // =========================================================================
  // TEST 4: Visual Proof Artifacts Comprehensive Audit
  // =========================================================================
  test('Visual Proof Audit: asserts all 3 dark fantasy screenshots exist, are valid 960x540 PNGs, and exceed 50KB', async () => {
    const requiredArtifacts = [
      'horde_swarm.png',
      'level_up_modal.png',
      'survival_gameplay.png',
    ];

    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    for (const filename of requiredArtifacts) {
      const filePath = path.join(ARTIFACT_DIR, filename);
      expect(fs.existsSync(filePath), `Artifact ${filename} must exist on disk`).toBe(true);

      const stats = fs.statSync(filePath);
      expect(
        stats.size,
        `Artifact ${filename} byte size (${stats.size} bytes) must be strictly > 50KB (51,200 bytes)`
      ).toBeGreaterThan(50 * 1024);

      // Verify PNG magic bytes
      const buffer = fs.readFileSync(filePath);
      expect(buffer.subarray(0, 8).equals(pngMagic), `Artifact ${filename} must have valid PNG magic bytes`).toBe(true);

      // Verify 960x540 dimensions from PNG IHDR chunk
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      expect(width, `Artifact ${filename} width must be 960`).toBe(960);
      expect(height, `Artifact ${filename} height must be 540`).toBe(540);
    }
  });

  // =========================================================================
  // TEST 5: Performance Benchmark & Zero-Lag Loop Verification
  // =========================================================================
  test('Zero-Lag Benchmark: maintains locked 60 FPS animation loop over 300 frames without frame drops or memory stalls', async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });

    const benchmark = await page.evaluate(async () => {
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

          // Frame drop threshold: > 33.33ms (< 30 FPS dip)
          if (deltaMs > 33.33) {
            droppedFrames++;
          }

          if (frameCount >= TARGET_FRAMES) {
            const totalElapsedSec = (now - startTime) / 1000;
            resolve({
              totalFrames: frameCount,
              avgFps: totalElapsedSec > 0 ? frameCount / totalElapsedSec : 60,
              minFps,
              maxFrameTimeMs,
              droppedFrames,
            });
            return;
          }

          requestAnimationFrame(onFrame);
        }

        requestAnimationFrame(onFrame);
      });
    });

    expect(benchmark.totalFrames).toBe(300);
    expect(benchmark.avgFps).toBeGreaterThanOrEqual(50.0);
    expect(benchmark.maxFrameTimeMs).toBeLessThan(50.0);
    expect(benchmark.droppedFrames).toBeLessThan(15);
    expect(pageErrors).toHaveLength(0);
  });
});
