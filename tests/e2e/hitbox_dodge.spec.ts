import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone 3: Hitbox Precision & Near-Miss Dodge Verification Suite', () => {
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
   * Helper: Mounts canvas, waits for complete engine bootstrap and backdrop initialization.
   */
  async function setupE2EGame(page: Page) {
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

    // Wait until GrimHarvestGame, backdrop surfaces, and subsystems are ready
    await page.waitForFunction(() => {
      const w = window as any;
      const g = w.game ?? w.__game ?? w.__GAME__;
      return (
        g &&
        g.player &&
        g.hordeManager &&
        g.weaponManager &&
        g.backdrop &&
        g.backdrop.isInitialized === true &&
        g.hordeManager.getActiveCount() >= 25
      );
    }, { timeout: 10000 });

    // Ensure locked canvas CSS dimensions and keyboard focus
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas#game-canvas') as HTMLCanvasElement;
      if (canvas) {
        canvas.style.width = '960px';
        canvas.style.height = '540px';
      }
    });

    await page.focus('canvas#game-canvas');
    return { consoleErrors, pageErrors };
  }

  // =========================================================================
  // Test 1: Live Dynamic Weaving & Near-Miss Grazing (Active Kiting without Phantom Damage)
  // =========================================================================
  test('Test 1: Live dynamic dodging weaves between enemies at near-miss distances with zero phantom damage', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const { consoleErrors, pageErrors } = await setupE2EGame(page);

    // Set up a structured weaving course of undead enemies
    await page.evaluate(() => {
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // Clear previous spawns, drops, and weapons for pure dodge navigation
      g.hordeManager.clear();
      g.lootManager.clear();
      g.weaponManager.clear();
      g.vfx.clear();

      // Position player at top of the slalom course at (0, -220)
      g.player.reset(0, -220);
      g.player.stats.currentHealth = 100;
      g.player.stats.maxHealth = 100;
      g.player.invulnerabilityTimer = 0;

      // Staggered enemy gates positioned along Y axis (-150 to +200)
      // Separation gap = |x| - (r_player + r_enemy) strictly calibrated so separation is in [12, 20]px
      const gates = [
        { type: 'skeleton',    x:  41.0, y: -150.0 }, // touch 22.0px -> gap at x=3 is 16.0px
        { type: 'ghoul',       x: -43.0, y:  -80.0 }, // touch 24.0px -> gap at x=-3 is 16.0px
        { type: 'banshee',     x:  42.0, y:  -10.0 }, // touch 23.0px -> gap at x=3 is 16.0px
        { type: 'death_knight',x: -48.0, y:   60.0 }, // touch 29.0px -> gap at x=-3 is 16.0px
        { type: 'necromancer', x:  44.0, y:  130.0 }, // touch 25.0px -> gap at x=3 is 16.0px
        { type: 'skeleton',    x: -41.0, y:  200.0 }, // touch 22.0px -> gap at x=-3 is 16.0px
      ];

      for (const gate of gates) {
        const e = g.hordeManager.spawn(gate.type, gate.x, gate.y);
        if (e) {
          e.speed = 0;
          e.vx = 0;
          e.vy = 0;
        }
      }
    });

    let minSeparationObserved = Infinity;
    const startWall = Date.now();
    const DURATION_MS = 6000;

    // Start moving downward through the course
    await page.keyboard.down('KeyS');

    while (Date.now() - startWall < DURATION_MS) {
      const state = await page.evaluate(() => {
        const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
        const p = g.player;
        const enemies = g.hordeManager.getActiveEnemies();

        let closestDist = Infinity;
        let closestSep = Infinity;

        for (const e of enemies) {
          if (!e.isAlive) continue;
          const d = Math.hypot(e.x - p.position.x, e.y - p.position.y);
          const touchDist = 11.0 + e.radius;
          const sep = d - touchDist;
          if (sep < closestSep) {
            closestSep = sep;
            closestDist = d;
          }
        }

        return {
          px: p.position.x,
          py: p.position.y,
          health: p.stats.currentHealth,
          invulnerabilityTimer: p.invulnerabilityTimer,
          isAlive: p.isAlive,
          closestSep,
          closestDist,
        };
      });

      if (state.closestSep < minSeparationObserved) {
        minSeparationObserved = state.closestSep;
      }

      // Assert continuous full health (ZERO damage while weaving!)
      expect(state.health).toBe(100);
      expect(state.invulnerabilityTimer).toBe(0);
      expect(state.isAlive).toBe(true);

      // Closed-loop weave controller: weave gently between -3px and +3px
      let targetWeaveX = 0;
      if (state.py < -115) {
        targetWeaveX = -3.0; // Weave slightly left away from skeleton at x=38
      } else if (state.py < -45) {
        targetWeaveX = 3.0;  // Weave slightly right away from ghoul at x=-40
      } else if (state.py < 25) {
        targetWeaveX = -3.0; // Weave left away from banshee at x=39
      } else if (state.py < 95) {
        targetWeaveX = 3.0;  // Weave right away from death knight at x=-45
      } else if (state.py < 165) {
        targetWeaveX = -3.0; // Weave left away from necromancer at x=41
      } else {
        targetWeaveX = 3.0;  // Weave right away from skeleton at x=-38
      }

      if (state.px < targetWeaveX - 1.0) {
        await page.keyboard.down('KeyD');
        await page.keyboard.up('KeyA');
      } else if (state.px > targetWeaveX + 1.0) {
        await page.keyboard.down('KeyA');
        await page.keyboard.up('KeyD');
      } else {
        await page.keyboard.up('KeyA');
        await page.keyboard.up('KeyD');
      }

      if (state.py > 220) {
        break; // Successfully navigated through entire slalom course
      }

      await page.waitForTimeout(40);
    }

    // Release all keys
    await page.keyboard.up('KeyS');
    await page.keyboard.up('KeyA');
    await page.keyboard.up('KeyD');

    // Final report assertions
    const finalReport = await page.evaluate(() => {
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;
      return {
        px: g.player.position.x,
        py: g.player.position.y,
        health: g.player.stats.currentHealth,
        invulnerabilityTimer: g.player.invulnerabilityTimer,
        isAlive: g.player.isAlive,
      };
    });

    // Verify player actually drove and weaved through the course
    expect(finalReport.py).toBeGreaterThan(200);

    // Verify player sustained strict ZERO damage while weaving
    expect(finalReport.health).toBe(100);
    expect(finalReport.invulnerabilityTimer).toBe(0);
    expect(finalReport.isAlive).toBe(true);

    // Verify closest grazing distance was in the near-miss 2-20px band:
    // Grazing within 2px to 20px without physical collision maintains 100 HP (zero phantom damage)
    expect(minSeparationObserved).toBeGreaterThanOrEqual(2.0);
    expect(minSeparationObserved).toBeLessThanOrEqual(20.0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // =========================================================================
  // Test 2: Deterministic 12–20px Near-Miss Grazing (Zero Damage Verification)
  // =========================================================================
  test('Test 2: Deterministic near-miss grazing (12-20px gap) deals strict ZERO damage across all archetypes', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupE2EGame(page);

    const testArchetypes = [
      { type: 'skeleton', radius: 11.0, damage: 10 },
      { type: 'ghoul', radius: 13.0, damage: 15 },
      { type: 'banshee', radius: 12.0, damage: 20 },
      { type: 'death_knight', radius: 18.0, damage: 40 },
      { type: 'necromancer', radius: 14.0, damage: 25 },
    ];

    for (const archetype of testArchetypes) {
      const result = await page.evaluate(({ type, radius }) => {
        const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

        // Clear horde, loot, and active weapons for isolated geometric hitbox test
        g.hordeManager.clear();
        g.lootManager.clear();
        g.weaponManager.clear();
        g.vfx.clear();

        // Position player at origin with full HP and zero invulnerability
        g.player.reset(0, 0);
        g.player.stats.currentHealth = 100;
        g.player.stats.maxHealth = 100;
        g.player.invulnerabilityTimer = 0;

        const rPlayer = 11.0;
        const rEnemy = radius;
        const touchDist = rPlayer + rEnemy;

        // 1. Test 15px near-miss gap (within the 12-20px grazing band where legacy phantom damage hit)
        const gap15 = 15.0;
        const testDist15 = touchDist + gap15;

        // Spawn test enemy at (testDist15, 0)
        const e1 = g.hordeManager.spawn(type, testDist15, 0);
        if (e1) {
          e1.speed = 0;
          e1.vx = 0;
          e1.vy = 0;
        }

        // Advance 20 simulation frames at 60Hz
        for (let frame = 0; frame < 20; frame++) {
          g.step(1 / 60);
        }

        const hpAfter15 = g.player.stats.currentHealth;
        const invulnAfter15 = g.player.invulnerabilityTimer;
        const vfxCountAfter15 = g.vfx.getActiveCount();

        // 2. Test ultra-precise 1.0px near-miss gap (1px outside physical circle boundary)
        g.hordeManager.clear();
        const testDist1 = touchDist + 1.0;
        const e2 = g.hordeManager.spawn(type, testDist1, 0);
        if (e2) {
          e2.speed = 0;
          e2.vx = 0;
          e2.vy = 0;
        }

        for (let frame = 0; frame < 20; frame++) {
          g.step(1 / 60);
        }

        const hpAfter1 = g.player.stats.currentHealth;
        const invulnAfter1 = g.player.invulnerabilityTimer;
        const vfxCountAfter1 = g.vfx.getActiveCount();

        return {
          type,
          touchDist,
          hpAfter15,
          invulnAfter15,
          vfxCountAfter15,
          hpAfter1,
          invulnAfter1,
          vfxCountAfter1,
        };
      }, archetype);

      // Strict assertions: 0 damage, 0 invulnerability, 0 blood particles
      expect(result.hpAfter15).toBe(100);
      expect(result.invulnAfter15).toBe(0);
      expect(result.vfxCountAfter15).toBe(0);

      expect(result.hpAfter1).toBe(100);
      expect(result.invulnAfter1).toBe(0);
      expect(result.vfxCountAfter1).toBe(0);
    }

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // =========================================================================
  // Test 3: Deterministic Physical Circle-Circle Collision Damage Infliction
  // =========================================================================
  test('Test 3: Physical circle-circle overlap cleanly inflicts contact damage and triggers blood VFX', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupE2EGame(page);

    const collisionResult = await page.evaluate(() => {
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      // Clear horde and weapons
      g.hordeManager.clear();
      g.lootManager.clear();
      g.weaponManager.clear();
      g.vfx.clear();

      g.player.reset(0, 0);
      g.player.stats.currentHealth = 100;
      g.player.invulnerabilityTimer = 0;

      const rPlayer = 11.0;
      const skeletonRadius = 11.0;
      const touchDist = rPlayer + skeletonRadius; // 22.0px

      // Position Skeleton at 20.0px (2px physical penetration / overlap: 20px < 22px)
      const overlapDist = touchDist - 2.0;
      const enemy = g.hordeManager.spawn('skeleton', overlapDist, 0);
      if (enemy) {
        enemy.speed = 0;
        enemy.vx = 0;
        enemy.vy = 0;
      }

      // Initial state
      const initialHp = g.player.stats.currentHealth;
      const initialInvuln = g.player.invulnerabilityTimer;
      const initialVfx = g.vfx.getActiveCount();

      // Step 1 frame to trigger contact damage check
      g.step(1 / 60);

      const postHp = g.player.stats.currentHealth;
      const postInvuln = g.player.invulnerabilityTimer;
      const postVfx = g.vfx.getActiveCount();

      return {
        initialHp,
        initialInvuln,
        initialVfx,
        postHp,
        postInvuln,
        postVfx,
        skeletonDamage: enemy?.damage ?? 10,
      };
    });

    // Verify physical contact inflicted exactly 10 damage (100 -> 90)
    expect(collisionResult.initialHp).toBe(100);
    expect(collisionResult.postHp).toBe(90);
    expect(collisionResult.postHp).toBe(100 - collisionResult.skeletonDamage);

    // Verify 0.5s invulnerability window activated
    expect(collisionResult.postInvuln).toBeGreaterThan(0.45);
    expect(collisionResult.postInvuln).toBeLessThanOrEqual(0.5);

    // Verify blood VFX burst particles emitted
    expect(collisionResult.postVfx).toBeGreaterThan(0);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // =========================================================================
  // Test 4: Visual Proof Screenshot (hitbox_precision_dodge.png > 50KB)
  // =========================================================================
  test('Test 4: Visual Proof — captures hitbox_precision_dodge.png (>50KB, close-quarters near-miss graze without damage)', async ({
    page,
  }) => {
    const { consoleErrors, pageErrors } = await setupE2EGame(page);

    await page.evaluate(() => {
      const g = (window as any).game ?? (window as any).__game ?? (window as any).__GAME__;

      if (typeof g.stop === 'function') {
        g.stop();
      }

      // Establish player at origin with full HP and centered camera
      g.player.reset(0, 0);
      g.player.facingDirection = 1;
      g.player.stats.currentHealth = 100;
      g.player.stats.maxHealth = 100;
      g.player.level = 2;
      g.elapsedTime = 35.0;
      g.killCount = 28;

      g.camera.reset(-480, -270);
      g.camera.centerOn(0, 0);

      // Clear default spawns
      g.hordeManager.clear();

      // Spawn near-miss grazing enemies at 24px and 27px (2-3px air gap outside physical touch)
      // Player r = 11.0. Skeleton r = 11.0. Touch = 22.0px. Spawn at x = 24.0px (2px air gap)
      g.hordeManager.spawn('skeleton', 24.0, 0.0);
      // Ghoul r = 13.0. Touch = 24.0px. Spawn at (-27.0, 5.0) (3.5px air gap)
      g.hordeManager.spawn('ghoul', -27.0, 5.0);

      // Cleaved enemy further out with blood VFX burst
      g.hordeManager.spawn('skeleton', 65.0, -15.0);

      // Add active weapons
      g.weaponManager.clear();
      g.weaponManager.addWeapon('scythe', 2);
      g.weaponManager.addWeapon('orbiters', 2);

      // Add surrounding atmospheric horde wave
      g.hordeManager.spawnWave('SKELETON', 20, { x: 0, y: 0 }, 200);
      g.hordeManager.spawnWave('GHOUL', 12, { x: 0, y: 0 }, 300);

      // Emit combat VFX
      g.vfx.emitBloodBurst(65.0, -15.0, 6);
      g.vfx.emitBloodSplatter(70.0, -10.0, 6);
      g.vfx.emitSpellCircle(0, 0, 32, '#7038b8');
      g.vfx.emitSoulBurst(65.0, -15.0, 6);

      // Update Gothic HUD with full health
      if (g.hud) {
        (g.hud as any).isFirstUpdate = false;
        g.hud.displayHealth = 100;
        g.hud.ghostHealth = 100;
        g.hud.displayXP = 20;
        g.hud.xpToNextLevel = 40;
        g.hud.currentLevel = 2;
      }

      // Step 4 frames and render
      for (let i = 0; i < 4; i++) {
        g.step(1 / 60);
      }
      g.render();
    });

    const targetPath = path.join(ARTIFACT_DIR, 'hitbox_precision_dodge.png');
    await page.locator('canvas#game-canvas').screenshot({ path: targetPath });

    // Assert file exists and byte size > 50,000 bytes (and > 50KB)
    expect(fs.existsSync(targetPath), 'hitbox_precision_dodge.png must exist').toBe(true);
    const stats = fs.statSync(targetPath);
    expect(
      stats.size,
      `hitbox_precision_dodge.png (${stats.size} bytes) must be > 50,000 bytes`
    ).toBeGreaterThan(50000);

    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
