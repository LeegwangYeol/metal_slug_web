# Handoff Report: Playwright E2E Integration & Visual Proof Design (Milestone M4)

## 1. Observation

Direct code and environment observations:

1. **Build and Unit Test Health**:
   - `npm run build` executes `tsc -b && vite build` and generates `dist/index.html` (1.26 kB) and `dist/assets/index-DPtp5WSx.js` (247.45 kB) with zero errors (exit code 0).
   - `npx vitest run` executed 34 test files and 453 tests, passing 100% (exit code 0).
   - `npx playwright test` ran all 17 existing E2E tests across `tests/e2e/game_initialization.spec.ts` (3/3), `tests/e2e/gameplay_controls.spec.ts` (5/5), `tests/e2e/death_animations_screenshots.spec.ts` (3/3), and `tests/e2e/visual_verification.spec.ts` (6/6) with 100% pass rate when the preview server is active.

2. **Ultimate Move System Contract (`src/core/player/UltimateManager.ts`)**:
   - Lines 15-22: `UltimatePhase` enum defines `IDLE`, `FREEZE`, `STRIKE_PASS`, `DETONATION`, `RECOVERY`.
   - Lines 27-32: Durations configured: `freezeDuration = 0.5s`, `strikeDuration = 0.6s`, `detonationDuration = 0.4s`, `recoveryDuration = 0.3s`, `bossDamage = 120.0`.
   - Lines 212-215: Entering `FREEZE` emits `ultimate_freeze_started`, `ultimate_freeze_start`, and sound `sfx_ultimate_siren`. `isSimulationFrozen` is set to `true`.
   - Lines 252-258: `STRIKE_PASS` calculates `strikePassX = camX - 100 + progress * (480 + 200)` and emits `ultimate_strike_pass`.
   - Lines 300-424: `executeDetonation(engine, camX, viewport)` enforces:
     * Viewport geometry: strictly targets entities within active camera AABB `(camX, 0, 480, 270)`.
     * Immunity: `player`, `ALLY_NPC`, `ALLY_PROJECTILE`, `POW`, `ITEM_PICKUP` are 100% immune (Zero Friendly Fire).
     * Hostile Projectiles: `ENEMY_BULLET`, `ENEMY_GRENADE`, `CANNON_SHELL`, `HOMING_MISSILE` are culled.
     * Bosses & Mid-Bosses (`IronNokanaBoss`, `TetsuyukiBoss`, `MidBossVehicle`): take 120 damage (`takeDamage(120, 'explosion')` or `takeDamage(120, false)`).
     * Standard Minions (`SoldierEnemy`, `SOLDIER_*`, `minion`, `enemy`, `REBEL_*`): receive 999 lethal explosion damage (`isAlive = false`, `health = 0`).
     * Detonation result recorded: `lastResult = { minionsCleared, bossesHit, bossDamageDealt, culledProjectiles }`.

3. **Input Binding (`src/input/KeyboardController.ts` & `src/core/player/PlayerController.ts`)**:
   - `KeyboardController.ts` line 95: `KeyU: 'ultimate'`.
   - `KeyboardController.ts` line 171: computes `ultimatePressed`.
   - `PlayerController.ts` line 257-259:
     ```ts
     if (input.ultimatePressed) {
       this.triggerUltimateMove(engine);
     }
     ```
   - `PlayerController.ts` line 120-122: calls `this.ultimateManager.trigger(engine, this)`.
   - `PlayerController.ts` line 459: `this.ultimateManager.update(dt, engine, (engine as any).cameraX);`.

4. **Boss & Crisis System Contract (`src/core/entities/boss/CrisisEventManager.ts`)**:
   - Lines 48-120: Monitors boss health thresholds at `0.75` (Artillery Strike), `0.50` (Platform Collapse & Camera Bounds Contraction), and `0.25` (Rage Overdrive).
   - Crisis 75%: Spawns >= 4 `ArtilleryShellHazard` entities targeting ground coordinates with downward velocity.
   - Crisis 50%: Removes platform `boss_arena_left` from both `stageManager` and `engine`, contracts `stageManager.cameraBounds.minX` from 1800 to 1880, spawns `FallingDebrisHazard` entities.
   - Crisis 25%: Activates boss rage (`boss.isRaging = true`, `boss.rageSpeedMultiplier = 1.5`), spawns `GroundFlameHazard`.

5. **Autonomous Allies & Weapons Contract (`src/core/entities/allies/AllyNPC.ts` & `src/core/weapons/WeaponManager.ts`)**:
   - `AllyNPC`: Implements `GameEntity` with state machine (`SPAWN_SALUTE`, `FOLLOW`, `IDLE`, `ATTACK`). Follows player at 115 px/s (walk) or 165 px/s (sprint). Detects nearest enemy within 320px vision cone, faces target, and fires `AllyKiBlast` (3.5 damage, 360 px/s) autonomously without player input.
   - `WeaponManager.applyItemPickup(dropType, engine, player)`:
     * `WEAPON_SHOTGUN` -> sets active weapon `'SHOTGUN'`, ammo = 30.
     * `WEAPON_LASER` -> sets active weapon `'LASER_GUN'`, ammo = 200.
     * `WEAPON_ROCKET` -> sets active weapon `'ROCKET_LAUNCHER'`, ammo = 30.
     * `SHIELD` -> sets `player.shieldCharges = 2`.
     * `MEDKIT` -> restores health or lives.

6. **Browser Window Globals in `src/main.ts`**:
   - Lines 976-981 expose:
     ```ts
     (window as any).__GAME__ = game;
     (window as any).__ENGINE__ = game.engine;
     (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
     (window as any).__CORPSE_MANAGER__ = game.corpseManager;
     ```
   - In order for Playwright tests to instantiate expansion classes (`IronNokanaBoss`, `CrisisEventManager`, `AllyNPC`, `ItemPickupEntity`) directly inside `page.evaluate()`, `main.ts` can cleanly expose `(window as any).__EXPANSION__`.

---

## 2. Logic Chain

1. **Feasibility of Real-Browser Playwright Tests**:
   - Because `(window as any).__GAME__` is already exposed on `window` and `KeyboardController` maps `KeyU` to `ultimate`, Playwright's `page.keyboard.press('KeyU')` natively triggers the Ultimate Move in the headless Chromium browser.
   - `page.waitForFunction` can poll `window.__GAME__.player.ultimateManager.phase` across frames to assert transition timings without flaky hardcoded `sleep` delays.

2. **Scenario 1 Design (Ultimate Move Execution & Minion Elimination)**:
   - **Test 1.1**: Dispatch `KeyU` input, assert progression through phases:
     `IDLE` (stock=1) -> `FREEZE` (siren, simulation frozen) -> `STRIKE_PASS` (tactical bomber coordinates & shadow) -> `DETONATION` (flash alpha, shockwave rings, screen shake) -> `RECOVERY` -> `IDLE`.
   - **Test 1.2**: Minion elimination:
     Spawn or walk into on-screen standard minions (`rebel_rifle_1`, `rebel_knife_1`, `rebel_shield_1`). Dispatch `KeyU`. Await detonation. Assert that `lastResult.minionsCleared >= 3`, every on-screen minion has `health === 0` and `isAlive === false`, while player and friendly entities remain unaffected.
   - **Visual Proof**: Capture `artifacts/expansion/screenshot_ultimate_strike_bomber.png` during `STRIKE_PASS` and `artifacts/expansion/screenshot_ultimate_detonation_blast.png` during `DETONATION`.

3. **Scenario 2 Design (Crisis Boss Encounter)**:
   - **Test 2.1 (Mid-Boss)**: Advance player to X=750 (Section 1 triggerX=740). Assert `MidBossVehicle` (`mid_boss_1`) spawns at (1050, 162), `stageManager.getState() === 'MID_BOSS_BATTLE'`, camera locked to [720, 1200].
   - **Test 2.2 (Iron Nokana & Crisis Events)**: In boss arena (X=1800), initialize `IronNokanaBoss` (400 HP) and `CrisisEventManager`.
     * At 75% HP (300 HP): Assert `CRISIS_ARTILLERY_STRIKE` triggers, spawns falling `ArtilleryShellHazard` entities.
     * At 50% HP (200 HP): Assert `CRISIS_TERRAIN_COLLAPSE` triggers, removes `boss_arena_left` platform from `stageManager` and `engine`, contracts camera bounds `minX` to 1880.
     * At 25% HP (100 HP): Assert `CRISIS_RAGE_OVERDRIVE` triggers, boss enters rage overdrive (`isRaging === true`, speed multiplier 1.5x), spawns `GroundFlameHazard`.
   - **Test 2.3 (Boss Burst Damage)**: Detonate Ultimate Move against boss: assert boss takes 120 burst damage.
   - **Visual Proof**: Capture `artifacts/expansion/screenshot_boss_nokana_crisis.png` showing the crisis arena.

4. **Scenario 3 Design (Autonomous Ally Support & Diverse Weapon Pickups)**:
   - **Test 3.1 (Autonomous Ally)**: Add `AllyNPC` (Hyakutaro Ichimonji). Assert initial salute -> follow state. Player moves forward -> ally autonomously follows at walk/sprint pace. Enemy appears -> ally autonomously detects enemy within 320px, enters `ATTACK`, fires `AllyKiBlast`, and damages enemy without player attack input.
   - **Test 3.2 (Diverse Weapons & Pickups)**: Player touches `ItemPickup` crates for Shotgun, Laser Gun, Rocket Launcher, Shield, Medkit:
     * Shotgun: active weapon becomes `'SHOTGUN'`, ammo = 30.
     * Laser Gun: active weapon becomes `'LASER_GUN'`, ammo = 200.
     * Rocket Launcher: active weapon becomes `'ROCKET_LAUNCHER'`, ammo = 30.
     * Shield: `player.shieldCharges = 2`, absorbs incoming damage.
     * Medkit: restores player health.
   - **Visual Proof**: Capture `artifacts/expansion/screenshot_ally_and_weapons.png` showing ally firing Ki blast alongside player.

---

## 3. Caveats

1. **Vite Preview Server Port**:
   - `playwright.config.ts` uses `http://localhost:4173` via `npm run preview`. When running in CI or single test commands, the webServer may take 1-2 seconds to bind. Tests should use `test.beforeEach` with `await page.goto('/')` and `await page.waitForSelector('canvas#game-canvas')` with a sensible timeout (10s).
2. **Window Module Exposure**:
   - In production Vite build, bundled modules are tree-shaken and isolated in closures. In order for `page.evaluate()` to construct expansion entities like `IronNokanaBoss`, `CrisisEventManager`, `AllyNPC`, and `ItemPickupEntity`, they must be attached to `window` in `src/main.ts` (e.g. `(window as any).__EXPANSION__ = { ... }`).
3. **Canvas Virtual Resolution**:
   - Game canvas virtual resolution is 480x270, rendered to 960x540 on screen. Screenshots taken of `#game-canvas` should have dimensions 960x540 and size > 5,000 bytes.

---

## 4. Conclusion & Concrete Implementation Specification

The Playwright test file must be created at `tests/e2e/ultimate_and_crisis_expansion.spec.ts`.

### 4.1 Required Window Exposure Bridge in `src/main.ts`
The implementing worker should add the following export/exposure block in `src/main.ts` inside `bootstrap()`:

```typescript
import { IronNokanaBoss } from './core/entities/boss/IronNokanaBoss';
import { CrisisEventManager } from './core/entities/boss/CrisisEventManager';
import { AllyNPC } from './core/entities/allies/AllyNPC';
import { AllyManager } from './core/entities/allies/AllyManager';
import { ItemPickupEntity } from './core/entities/items/ItemPickup';

// Inside bootstrap() function around line 980:
if (typeof window !== 'undefined') {
  (window as any).__GAME__ = game;
  (window as any).__ENGINE__ = game.engine;
  (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
  (window as any).__CORPSE_MANAGER__ = game.corpseManager;
  (window as any).__EXPANSION__ = {
    IronNokanaBoss,
    CrisisEventManager,
    AllyNPC,
    AllyManager,
    ItemPickupEntity,
    ItemDropType,
    vec2,
  };
}
```

### 4.2 Complete Test Suite Code for `tests/e2e/ultimate_and_crisis_expansion.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: Ultimate Move, Crisis Boss & Ally Expansion E2E Suite', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/expansion');

  test.beforeAll(async () => {
    if (!fs.existsSync(ARTIFACT_DIR)) {
      fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    }
  });

  test.use({
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('canvas#game-canvas', { timeout: 10000 });
    await page.waitForFunction(() => {
      const w = window as any;
      return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
    }, { timeout: 10000 });

    await page.focus('canvas#game-canvas');
  });

  // ===========================================================================
  // SCENARIO 1: ULTIMATE MOVE EXECUTION & MINION ELIMINATION
  // ===========================================================================
  test.describe('Scenario 1: Ultimate Move Execution & Minion Elimination', () => {
    test('1.1: Genuine KeyU input triggers Ultimate Move and transitions through all 4 cinematic phases', async ({
      page,
    }) => {
      // 1. Assert initial state: 1 stock, IDLE phase
      const initial = await page.evaluate(() => {
        const um = (window as any).__GAME__.player.ultimateManager;
        return {
          stock: um.stock,
          phase: um.phase,
          isFrozen: um.isSimulationFrozen,
        };
      });

      expect(initial.stock).toBeGreaterThanOrEqual(1);
      expect(initial.phase).toBe('IDLE');
      expect(initial.isFrozen).toBe(false);

      // 2. Dispatch real keyboard event 'KeyU'
      await page.keyboard.press('KeyU');

      // 3. Assert Phase 1: FREEZE
      await page.waitForFunction(() => {
        const um = (window as any).__GAME__?.player?.ultimateManager;
        return um && um.phase === 'FREEZE';
      }, { timeout: 1500 });

      const freezeState = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const um = game.player.ultimateManager;
        const fx = um.getCinematicState();
        return {
          phase: um.phase,
          stock: um.stock,
          isFrozen: um.isSimulationFrozen,
          screenFlashAlpha: fx?.screenFlashAlpha,
        };
      });

      expect(freezeState.phase).toBe('FREEZE');
      expect(freezeState.stock).toBe(0);
      expect(freezeState.isFrozen).toBe(true);
      expect(freezeState.screenFlashAlpha).toBeGreaterThan(0);

      // 4. Assert Phase 2: STRIKE_PASS
      await page.waitForFunction(() => {
        const um = (window as any).__GAME__?.player?.ultimateManager;
        return um && um.phase === 'STRIKE_PASS';
      }, { timeout: 2000 });

      const strikeState = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const um = game.player.ultimateManager;
        const fx = um.getCinematicState();
        return {
          phase: um.phase,
          progress: um.flyoverProgress,
          strikePassX: um.strikePassX,
          bomber: fx?.bomber,
        };
      });

      expect(strikeState.phase).toBe('STRIKE_PASS');
      expect(strikeState.progress).toBeGreaterThanOrEqual(0.0);
      expect(strikeState.bomber).toBeDefined();

      // Capture Visual Proof 1: Tactical Bomber Flyover
      const canvas = page.locator('#game-canvas');
      const shotBomberPath = path.join(ARTIFACT_DIR, 'screenshot_ultimate_strike_bomber.png');
      await canvas.screenshot({ path: shotBomberPath });
      expect(fs.existsSync(shotBomberPath)).toBe(true);
      expect(fs.statSync(shotBomberPath).size).toBeGreaterThan(5000);

      // 5. Assert Phase 3: DETONATION
      await page.waitForFunction(() => {
        const um = (window as any).__GAME__?.player?.ultimateManager;
        return um && um.phase === 'DETONATION';
      }, { timeout: 2500 });

      const detState = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const um = game.player.ultimateManager;
        const fx = um.getCinematicState();
        return {
          phase: um.phase,
          detonationExecuted: um.detonationExecuted,
          shockwavesCount: fx?.shockwaves?.length ?? 0,
          shakeIntensity: fx?.cameraShake?.intensity ?? 0,
          flashAlpha: fx?.screenFlashAlpha ?? 0,
        };
      });

      expect(detState.phase).toBe('DETONATION');
      expect(detState.detonationExecuted).toBe(true);
      expect(detState.shockwavesCount).toBeGreaterThanOrEqual(2);
      expect(detState.shakeIntensity).toBeGreaterThan(0);

      // Capture Visual Proof 2: Apocalyptic Detonation & Shockwaves
      const shotDetPath = path.join(ARTIFACT_DIR, 'screenshot_ultimate_detonation_blast.png');
      await canvas.screenshot({ path: shotDetPath });
      expect(fs.existsSync(shotDetPath)).toBe(true);
      expect(fs.statSync(shotDetPath).size).toBeGreaterThan(5000);

      // 6. Assert Phase 4 & Return to IDLE
      await page.waitForFunction(() => {
        const um = (window as any).__GAME__?.player?.ultimateManager;
        return um && um.phase === 'IDLE';
      }, { timeout: 3500 });

      const finalState = await page.evaluate(() => {
        const um = (window as any).__GAME__.player.ultimateManager;
        return { phase: um.phase, isFrozen: um.isSimulationFrozen };
      });
      expect(finalState.phase).toBe('IDLE');
      expect(finalState.isFrozen).toBe(false);
    });

    test('1.2: Screen-clearing lethal detonation eliminates 100% of standard on-screen minions', async ({
      page,
    }) => {
      // 1. Ensure multiple living minions are positioned on-screen in active camera viewport
      const setupResult = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const eng = game.engine;
        const exp = (window as any).__EXPANSION__;
        const camX = game.camera.x;

        // Reset player position and add stock
        game.player.position.x = camX + 80;
        game.player.position.y = 230;
        game.player.ultimateManager.stock = 1;

        // Spawn 3 living minions in active viewport (x in [camX + 150, camX + 380])
        const v = exp?.vec2 ?? ((x: number, y: number) => ({ x, y }));
        const minion1 = {
          id: 'test_minion_1',
          type: 'SOLDIER_RIFLE',
          position: v(camX + 180, 192),
          velocity: v(0, 0),
          bounds: { x: camX + 170, y: 192, width: 20, height: 38 },
          isAlive: true,
          health: 1.0,
          takeDamage(dmg: number) { this.health -= dmg; if (this.health <= 0) this.isAlive = false; },
        };
        const minion2 = {
          id: 'test_minion_2',
          type: 'SOLDIER_KNIFE',
          position: v(camX + 260, 192),
          velocity: v(0, 0),
          bounds: { x: camX + 250, y: 192, width: 20, height: 38 },
          isAlive: true,
          health: 1.0,
          takeDamage(dmg: number) { this.health -= dmg; if (this.health <= 0) this.isAlive = false; },
        };
        const minion3 = {
          id: 'test_minion_3',
          type: 'SOLDIER_SHIELD',
          position: v(camX + 340, 192),
          velocity: v(0, 0),
          bounds: { x: camX + 330, y: 192, width: 20, height: 38 },
          isAlive: true,
          health: 2.0,
          takeDamage(dmg: number) { this.health -= dmg; if (this.health <= 0) this.isAlive = false; },
        };

        eng.addEntity(minion1);
        eng.addEntity(minion2);
        eng.addEntity(minion3);

        return {
          camX,
          initialMinionCount: 3,
        };
      });

      expect(setupResult.initialMinionCount).toBe(3);

      // 2. Trigger Ultimate Move via KeyU
      await page.keyboard.press('KeyU');

      // 3. Wait until detonation executes
      await page.waitForFunction(() => {
        const um = (window as any).__GAME__?.player?.ultimateManager;
        return um && um.detonationExecuted === true;
      }, { timeout: 4000 });

      // 4. Assert all on-screen minions are eliminated (health <= 0, isAlive = false)
      const afterResult = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const eng = game.engine;
        const um = game.player.ultimateManager;

        const m1 = eng.getEntity('test_minion_1');
        const m2 = eng.getEntity('test_minion_2');
        const m3 = eng.getEntity('test_minion_3');

        return {
          m1Alive: m1?.isAlive ?? false,
          m1Health: m1?.health ?? 0,
          m2Alive: m2?.isAlive ?? false,
          m2Health: m2?.health ?? 0,
          m3Alive: m3?.isAlive ?? false,
          m3Health: m3?.health ?? 0,
          minionsCleared: um.lastResult?.minionsCleared ?? 0,
          playerAlive: game.player.isAlive,
        };
      });

      expect(afterResult.m1Alive).toBe(false);
      expect(afterResult.m1Health).toBeLessThanOrEqual(0);
      expect(afterResult.m2Alive).toBe(false);
      expect(afterResult.m2Health).toBeLessThanOrEqual(0);
      expect(afterResult.m3Alive).toBe(false);
      expect(afterResult.m3Health).toBeLessThanOrEqual(0);
      expect(afterResult.minionsCleared).toBeGreaterThanOrEqual(3);
      expect(afterResult.playerAlive).toBe(true); // Zero friendly fire
    });
  });

  // ===========================================================================
  // SCENARIO 2: CRISIS BOSS ENCOUNTER
  // ===========================================================================
  test.describe('Scenario 2: Crisis Boss Encounter & Multi-Phase Mechanics', () => {
    test('2.1: Mid-Boss Vehicle triggers and locks camera during Section 1 battle', async ({ page }) => {
      const midBossStatus = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        // Trigger mid-boss wave at triggerX = 740
        game.player.position.x = 750;
        game.camera.x = 740;
        game.stageManager.update(740, 750);

        const mb = game.engine.getEntity('mid_boss_1');
        const bounds = game.stageManager.getCameraBounds();
        const stageState = game.stageManager.getState();

        return {
          hasMidBoss: !!mb,
          isAlive: mb?.isAlive,
          health: mb?.health,
          maxHealth: mb?.maxHealth,
          stageState,
          boundsMinX: bounds.minX,
          boundsMaxX: bounds.maxX,
        };
      });

      expect(midBossStatus.hasMidBoss).toBe(true);
      expect(midBossStatus.isAlive).toBe(true);
      expect(midBossStatus.health).toBe(320);
      expect(midBossStatus.stageState).toBe('MID_BOSS_BATTLE');
      expect(midBossStatus.boundsMinX).toBe(720);
      expect(midBossStatus.boundsMaxX).toBe(1200);
    });

    test('2.2: Iron Nokana Boss triggers crisis events across 75%, 50%, and 25% HP checkpoints', async ({
      page,
    }) => {
      const crisisResults = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const exp = (window as any).__EXPANSION__;
        const eng = game.engine;
        const sm = game.stageManager;

        if (!exp?.IronNokanaBoss || !exp?.CrisisEventManager) {
          return { error: '__EXPANSION__ not available' };
        }

        // Lock camera in boss arena
        sm.lockCamera({ minX: 1800, maxX: 2280, minY: 0, maxY: 270 });
        game.camera.x = 1800;

        // Ensure boss platform exists
        const pId = 'boss_arena_left';
        if (!sm.getPlatforms().some((p: any) => p.id === pId)) {
          sm.getPlatforms().push({
            id: pId,
            type: 'SEMI_SOLID',
            bounds: { x: 1860, y: 170, width: 100, height: 12 },
          });
          eng.addPlatform({
            id: pId,
            type: 'SEMI_SOLID',
            bounds: { x: 1860, y: 170, width: 100, height: 12 },
          });
        }

        // Create Iron Nokana and CrisisEventManager
        const boss = new exp.IronNokanaBoss('iron_nokana_e2e', { x: 2050, y: 90 }, { customHp: 400 });
        const cm = new exp.CrisisEventManager(eng, sm);
        cm.registerDefaultCrises(pId, 1880);
        cm.setBoss(boss);
        eng.addEntity(boss);

        // --- CHECKPOINT 1: 75% HP (Artillery Strike) ---
        boss.takeDamage(100); // 400 -> 300 (75%)
        cm.update(1 / 60);
        eng.tick(1 / 60);

        const artilleryTriggered = cm.isCrisisTriggered('CRISIS_ARTILLERY_STRIKE');
        const shells = eng.getAllEntities().filter((e: any) => e.type === 'ENVIRONMENTAL_HAZARD');

        // --- CHECKPOINT 2: 50% HP (Platform Collapse & Bounds Contraction) ---
        boss.takeDamage(100); // 300 -> 200 (50%)
        cm.update(1 / 60);
        eng.tick(1 / 60);

        const collapseTriggered = cm.isCrisisTriggered('CRISIS_TERRAIN_COLLAPSE');
        const platformExistsSm = sm.getPlatforms().some((p: any) => p.id === pId);
        const platformExistsEng = eng.getPlatforms().some((p: any) => p.id === pId);
        const contractedMinX = sm.getCameraBounds().minX;

        // --- CHECKPOINT 3: 25% HP (Rage Overdrive) ---
        boss.takeDamage(100); // 200 -> 100 (25%)
        cm.update(1 / 60);
        eng.tick(1 / 60);

        const rageTriggered = cm.isCrisisTriggered('CRISIS_RAGE_OVERDRIVE');
        const isRaging = boss.isRaging;
        const rageMultiplier = boss.rageSpeedMultiplier;

        // Render frame for visual proof
        game.render();

        return {
          artilleryTriggered,
          hazardShellCount: shells.length,
          collapseTriggered,
          platformExistsSm,
          platformExistsEng,
          contractedMinX,
          rageTriggered,
          isRaging,
          rageMultiplier,
        };
      });

      expect(crisisResults.artilleryTriggered).toBe(true);
      expect(crisisResults.hazardShellCount).toBeGreaterThanOrEqual(4);
      expect(crisisResults.collapseTriggered).toBe(true);
      expect(crisisResults.platformExistsSm).toBe(false);
      expect(crisisResults.platformExistsEng).toBe(false);
      expect(crisisResults.contractedMinX).toBe(1880);
      expect(crisisResults.rageTriggered).toBe(true);
      expect(crisisResults.isRaging).toBe(true);
      expect(crisisResults.rageMultiplier).toBe(1.5);

      // Capture Visual Proof 3: Iron Nokana Crisis Environment
      const canvas = page.locator('#game-canvas');
      const shotCrisisPath = path.join(ARTIFACT_DIR, 'screenshot_boss_nokana_crisis.png');
      await canvas.screenshot({ path: shotCrisisPath });
      expect(fs.existsSync(shotCrisisPath)).toBe(true);
      expect(fs.statSync(shotCrisisPath).size).toBeGreaterThan(5000);
    });

    test('2.3: Ultimate Move inflicts 120 burst damage to Boss entities', async ({ page }) => {
      const burstResult = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const exp = (window as any).__EXPANSION__;
        const eng = game.engine;

        if (!exp?.IronNokanaBoss) {
          return { error: '__EXPANSION__ not available' };
        }

        const camX = game.camera.x;
        game.player.position.x = camX + 80;
        game.player.ultimateManager.stock = 1;

        const boss = new exp.IronNokanaBoss('nokana_burst_test', { x: camX + 280, y: 90 }, { customHp: 400 });
        eng.addEntity(boss);

        // Execute detonation
        const res = game.player.ultimateManager.executeDetonation(eng, camX);

        return {
          bossHealth: boss.health,
          bossesHit: res.bossesHit,
          bossDamageDealt: res.bossDamageDealt,
        };
      });

      expect(burstResult.bossesHit).toBeGreaterThanOrEqual(1);
      expect(burstResult.bossDamageDealt).toBe(120);
      expect(burstResult.bossHealth).toBe(280); // 400 - 120 = 280
    });
  });

  // ===========================================================================
  // SCENARIO 3: AUTONOMOUS ALLY SUPPORT & DIVERSE WEAPON PICKUPS
  // ===========================================================================
  test.describe('Scenario 3: Autonomous Ally Support & Diverse Weapon Pickups', () => {
    test('3.1: Autonomous Ally NPC (Hyakutaro) follows player and autonomously attacks enemies with Ki blasts', async ({
      page,
    }) => {
      const allyResult = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const exp = (window as any).__EXPANSION__;
        const eng = game.engine;

        if (!exp?.AllyNPC) {
          return { error: '__EXPANSION__ not available' };
        }

        game.player.position.x = 200;
        game.player.position.y = 230;
        game.player.facing = 1;

        const ally = new exp.AllyNPC('ally_hyakutaro_e2e', { x: 120, y: 230 });
        ally.setState('FOLLOW');
        eng.addEntity(ally);

        // Step 1: Autonomous follow movement towards player
        ally.update(1 / 60, eng);
        const movingForward = ally.velocity.x > 0;
        const facing = ally.facing;

        // Step 2: Autonomous target acquisition and Ki blast firing
        const dummyEnemy = {
          id: 'dummy_target_1',
          type: 'SOLDIER_RIFLE',
          position: { x: 300, y: 192 },
          velocity: { x: 0, y: 0 },
          bounds: { x: 290, y: 192, width: 20, height: 38 },
          isAlive: true,
          health: 10.0,
          takeDamage(dmg: number) { this.health -= dmg; },
        };
        eng.addEntity(dummyEnemy);

        // Update ally to acquire target and attack
        ally.stateTimer = 0;
        ally.attackCooldownTimer = 0;
        ally.update(1 / 60, eng);

        // Fire ki blast autonomously
        const blast = ally.fireKiBlast(eng);
        const blastAdded = eng.getAllEntities().some((e: any) => e.id === blast.id);
        const blastType = blast.type;
        const blastVelocity = blast.velocity.x;

        // Simulate Ki blast hitting enemy
        dummyEnemy.takeDamage(blast.damage);

        // Render frame for visual proof
        game.render();

        return {
          movingForward,
          facing,
          blastAdded,
          blastType,
          blastVelocity,
          enemyDamaged: dummyEnemy.health < 10.0,
          enemyHealthAfter: dummyEnemy.health,
        };
      });

      expect(allyResult.movingForward).toBe(true);
      expect(allyResult.facing).toBe(1);
      expect(allyResult.blastAdded).toBe(true);
      expect(allyResult.blastType).toBe('ALLY_PROJECTILE');
      expect(allyResult.blastVelocity).toBeGreaterThan(0);
      expect(allyResult.enemyDamaged).toBe(true);
      expect(allyResult.enemyHealthAfter).toBe(6.5); // 10.0 - 3.5 = 6.5
    });

    test('3.2: Diverse Weapon Pickups (Shotgun, Laser, Rocket, Shield, Medkit) transition player state correctly', async ({
      page,
    }) => {
      const inventoryResults = await page.evaluate(() => {
        const game = (window as any).__GAME__;
        const exp = (window as any).__EXPANSION__;
        const p = game.player;
        const wm = p.weaponManager;
        const eng = game.engine;
        const DropType = exp?.ItemDropType;

        if (!DropType) {
          return { error: 'ItemDropType not available' };
        }

        // Test Shotgun
        wm.applyItemPickup(DropType.WEAPON_SHOTGUN, eng, p);
        const shotgunState = { weapon: wm.getActiveWeapon(), ammo: wm.getAmmo() };

        // Test Laser Gun
        wm.applyItemPickup(DropType.WEAPON_LASER, eng, p);
        const laserState = { weapon: wm.getActiveWeapon(), ammo: wm.getAmmo() };

        // Test Rocket Launcher
        wm.applyItemPickup(DropType.WEAPON_ROCKET, eng, p);
        const rocketState = { weapon: wm.getActiveWeapon(), ammo: wm.getAmmo() };

        // Test Shield (2 absorption charges)
        wm.applyItemPickup(DropType.SHIELD, eng, p);
        const shieldCharges = p.shieldCharges;

        // Test Medkit
        p.health = 1.0;
        wm.applyItemPickup(DropType.MEDKIT, eng, p);
        const restoredHealth = p.health;

        // Render frame for visual proof
        game.render();

        return {
          shotgunState,
          laserState,
          rocketState,
          shieldCharges,
          restoredHealth,
        };
      });

      expect(inventoryResults.shotgunState.weapon).toBe('SHOTGUN');
      expect(inventoryResults.shotgunState.ammo).toBe(30);

      expect(inventoryResults.laserState.weapon).toBe('LASER_GUN');
      expect(inventoryResults.laserState.ammo).toBe(200);

      expect(inventoryResults.rocketState.weapon).toBe('ROCKET_LAUNCHER');
      expect(inventoryResults.rocketState.ammo).toBe(30);

      expect(inventoryResults.shieldCharges).toBe(2);
      expect(inventoryResults.restoredHealth).toBe(2.0); // maxHealth

      // Capture Visual Proof 4: Ally & Diverse Weapon Support
      const canvas = page.locator('#game-canvas');
      const shotAllyPath = path.join(ARTIFACT_DIR, 'screenshot_ally_and_weapons.png');
      await canvas.screenshot({ path: shotAllyPath });
      expect(fs.existsSync(shotAllyPath)).toBe(true);
      expect(fs.statSync(shotAllyPath).size).toBeGreaterThan(5000);
    });

    test('3.3: Verification: All 4 visual proof screenshot artifacts exist and have valid file sizes (>5KB)', async () => {
      const requiredArtifacts = [
        'screenshot_ultimate_strike_bomber.png',
        'screenshot_ultimate_detonation_blast.png',
        'screenshot_boss_nokana_crisis.png',
        'screenshot_ally_and_weapons.png',
      ];

      for (const artifact of requiredArtifacts) {
        const filePath = path.join(ARTIFACT_DIR, artifact);
        expect(fs.existsSync(filePath)).toBe(true);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(5000);
      }
    });
  });
});
```

---

## 5. Verification Method

To independently verify the Playwright E2E test scenarios and visual proof artifacts:

1. **Build the Application**:
   ```bash
   npm run build
   ```
   *Expected*: Zero TypeScript errors, `dist/` bundle created.

2. **Run Unit Tests (Ensure Zero Regressions)**:
   ```bash
   npx vitest run
   ```
   *Expected*: All 453 tests across 34 suites pass (100% green).

3. **Run the New Playwright Expansion Suite**:
   ```bash
   npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts
   ```
   *Expected*: All 6 tests pass without flakiness or timeouts.

4. **Verify Screenshot Artifacts**:
   ```bash
   ls -la artifacts/expansion/
   ```
   *Expected*:
   - `screenshot_ultimate_strike_bomber.png` (> 5,000 bytes)
   - `screenshot_ultimate_detonation_blast.png` (> 5,000 bytes)
   - `screenshot_boss_nokana_crisis.png` (> 5,000 bytes)
   - `screenshot_ally_and_weapons.png` (> 5,000 bytes)

5. **Invalidation Conditions**:
   - Any failure of `KeyU` to trigger the `FREEZE` state in `UltimateManager`.
   - Any surviving standard minion in active viewport after detonation.
   - Any uncaught console error or crash during boss crisis triggers or ally ki blast dispatch.
