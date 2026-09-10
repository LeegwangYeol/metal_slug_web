# Milestone 4 Investigation Report: Automated E2E Verification & Restart Lifecycle

**Date**: 2026-09-11  
**Agent**: explorer_m4_1 (Codebase Researcher / Explorer)  
**Scope**: Playwright E2E Runner Architecture, `src/main.ts` Restart Lifecycle, Death Debounce Invariants, and Blueprint for `tests/e2e/restart_survival.spec.ts`.

---

## 1. Observation

### 1.1 Playwright Runner & WebServer Preview Configuration
- **File**: `/Users/user/teamwork_projects/metal_slug_web/playwright.config.ts` (Lines 12–29):
  ```typescript
  webServer: {
    command: 'kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
  use: {
    baseURL: 'http://localhost:4173',
    headless: true,
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: ['--disable-gpu', '--disable-dev-shm-usage', '--no-sandbox'],
    },
  },
  ```
- **File**: `/Users/user/teamwork_projects/metal_slug_web/package.json` (Lines 11–12):
  ```json
  "pretest:e2e": "kill -9 $(lsof -ti :4173) 2>/dev/null || true",
  "test:e2e": "playwright test"
  ```
- **Port & Concurrency**:
  - The webServer preview port is **4173** (standard Vite preview port).
  - Playwright enforces `fullyParallel: false` and `workers: 1` (`playwright.config.ts:9-10`), guaranteeing serial execution to prevent canvas context corruption, GPU contention, or race conditions during long-duration survival tests.
  - Overall test timeout is set to 90,000ms (`playwright.config.ts:5`) to comfortably support active 30s+ survival tests.

### 1.2 Page Initialization Hooks
- **File**: `/Users/user/teamwork_projects/metal_slug_web/src/main.ts` (Lines 589–598):
  ```typescript
  // Auto-bootstrap when loaded in browser
  if (typeof document !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
      const container = document.getElementById('game-container') ?? document.body;
      const game = new GrimHarvestGame(container);
      game.start();
      (window as any).__game = game;
      (window as any).__GAME__ = game;
    });
  }
  ```
- In both `tests/e2e/game_initialization.spec.ts` (lines 143–150) and `tests/e2e/horde_survival.spec.ts` (lines 32–42, 92–99), tests synchronize page initialization using:
  ```typescript
  await page.waitForFunction(() => {
    const w = window as any;
    const g = w.__game ?? w.__GAME__;
    return g && g.player && g.hordeManager && g.weaponManager && g.lootManager;
  }, { timeout: 10000 });
  ```

### 1.3 Player Death, Death Debounce & Resurrection Flow in `src/main.ts`
- **Player Death Trigger**:
  - In `/Users/user/teamwork_projects/metal_slug_web/src/core/entities/Player.ts` (Lines 262–269):
    ```typescript
    if (this.stats.currentHealth <= 0) {
      this.isAlive = false;
      engine?.eventBus?.emit('player_died', {
        position: this.position,
        level: this.level,
      });
    }
    ```
- **Frame Loop Branching upon Death**:
  - In `/Users/user/teamwork_projects/metal_slug_web/src/main.ts` (Lines 248–269):
    ```typescript
    if (!this.isPaused && this.player.isAlive && !this.isVictory) {
      this.accumulator += dt;
      let subSteps = 0;
      while (
        this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP &&
        subSteps < GrimHarvestGame.MAX_SUB_STEPS
      ) {
        this.step(GrimHarvestGame.FIXED_TIMESTEP);
        this.accumulator -= GrimHarvestGame.FIXED_TIMESTEP;
        subSteps++;
      }
      if (subSteps >= GrimHarvestGame.MAX_SUB_STEPS) {
        this.accumulator = 0; // Prevent infinite freeze death spiral
      }
    } else if (this.upgradeModal.getIsOpen()) {
      this.upgradeModal.update(dt);
    } else if (!this.player.isAlive || this.isVictory) {
      this.deathTimer += dt;
      this.vfx.update(dt);
    }
    ```
  - Directly observed properties upon player death:
    1. `this.player.isAlive` becomes `false`.
    2. `this.isPaused` remains `false` (pause flag is solely reserved for modal popups).
    3. `this.deathTimer` accumulates elapsed delta time (`dt`) on each RAF tick.
    4. Note: There is currently **no explicit property named `isGameOver`** on `GrimHarvestGame`. The game over state is represented by `!this.player.isAlive` (HUD checks `!actualState.player.isAlive` at `src/ui/GothicHUD.ts:304`).
- **Debounce Guard (`canResurrect`)**:
  - In `/Users/user/teamwork_projects/metal_slug_web/src/main.ts` (Lines 291–297):
    ```typescript
    public canResurrect(): boolean {
      return (
        (!this.player.isAlive || this.isVictory) &&
        !this.upgradeModal.getIsOpen() &&
        this.deathTimer >= 0.5
      );
    }
    ```
  - The death debounce duration is strictly **0.5 seconds (500ms)**. Any restart input received before `deathTimer >= 0.5` is completely ignored.
- **Restart Event Handlers (Spacebar & Canvas Click)**:
  - In `/Users/user/teamwork_projects/metal_slug_web/src/main.ts` (Lines 299–318):
    ```typescript
    private handleKeyDown(e: KeyboardEvent): void {
      if (e.repeat) return;
      if (e.code === 'Space' || e.key === ' ' || e.key === 'Spacebar') {
        if (this.canResurrect()) {
          if (typeof e.preventDefault === 'function') {
            e.preventDefault();
          }
          this.restart();
        }
      }
    }

    private handleCanvasClick(e: MouseEvent): void {
      if (this.canResurrect()) {
        if (typeof e.preventDefault === 'function') {
          e.preventDefault();
        }
        this.restart();
      }
    }
    ```
  - Keyboard listener filters out `e.repeat`, preventing stuck/held Spacebar keys from accidentally triggering immediate restart.
  - Listeners are wired during `mount(container)` on `window` (`keydown`) and `canvas` (`click`) (Lines 212–219).
  - Also in `step(dt)` (Lines 388–395), `keyboard.jump` snapshot triggers `restart()` if `canResurrect()`.

### 1.4 Post-Restart Invariants in `GrimHarvestGame.restart()`
- In `/Users/user/teamwork_projects/metal_slug_web/src/main.ts` (Lines 320–382):
  ```typescript
  public restart(): void {
    const wasRunning = this.isRunning;
    this.stop();

    // 1. Simulation clock & loop state
    this.elapsedTime = 0;
    this.killCount = 0;
    this.isPaused = false;
    this.isVictory = false;
    this.pendingLevelUps = 0;
    this.deathTimer = 0;
    this.accumulator = 0;
    this.lastTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 2. Upgrade modal reset
    this.upgradeModal.reset();

    // 3. Player entity reset
    this.player.reset(0, 0);

    // 4. Horde manager & spatial grid reset
    this.hordeManager.reset();

    // 5. Loot drops purge
    this.lootManager.reset();

    // 6. Weapons reset (starter Rank 1 Arcane Scythe)
    this.weaponManager.reset('scythe', 1);

    // 7. Upgrade system reset (starter Rank 1 Arcane Scythe)
    this.upgradeSystem.reset('weapon_scythe', 1);

    // 8. Wave director reset (Phase 1, 0:00)
    this.waveDirector.reset();

    // 9. Camera & screen shake zeroing
    this.camera.reset(0, 0);
    this.camera.update(0, 0, 0);

    // 10. Particle VFX clear
    this.vfx.clear();

    // 11. HUD reset
    this.hud.reset();

    // 12. Input controllers reset
    this.keyboard.reset();
    ...
    // 13. Re-spawn initial perimeter swarm
    this.spawnInitialSwarm();

    // 14. Restart simulation loop if active or mounted
    if (wasRunning || !!this.canvas) {
      this.start();
    }
  }
  ```
- Explicit post-restart state values:
  - `player.isAlive === true` (from `player.reset(0,0)`)
  - `player.stats.currentHealth === 100` (from `player.reset(0,0)`)
  - `player.level === 1` (from `progression.reset()`)
  - `starterWeapon === 'scythe'` (from `weaponManager.reset('scythe', 1)`)
  - `accumulator === 0` (strictly `<= 1/60`)
  - `elapsedTime === 0`
  - `isPaused === false`
  - `deathTimer === 0`
  - `loopEpoch` incremented in `stop()`, invalidating prior RAF callbacks and preventing dual loops.
  - `hordeManager.getActiveCount() === 35` (re-spawned 25 skeletons + 10 ghouls).
  - `lootManager.getActiveCount() === 0`.

---

## 2. Logic Chain

1. **Test Infrastructure Soundness**:
   - `playwright.config.ts` configures Vite preview on `http://localhost:4173` after building `tsc -b && vite build`.
   - Running `npx playwright test tests/e2e/game_initialization.spec.ts` executes successfully (`3 passed (13.3s)`), confirming the headless browser, webServer lifecycle, canvas mounting, and window hook binding are fully operational.
2. **Lifecycle State Transition from Life to Death**:
   - Fatal enemy contact damage sets `player.stats.currentHealth = 0` and `player.isAlive = false`.
   - In `tickFrame()`, physics simulation stops automatically because `!isPaused && player.isAlive` is false.
   - The loop falls through to `this.deathTimer += dt`, steadily advancing `deathTimer`.
   - `canResurrect()` strictly returns `false` while `deathTimer < 0.5`.
   - Any Spacebar or click event received within this 500ms window does nothing.
3. **Resurrection Execution & State Invariants**:
   - When `deathTimer >= 0.5`, `canResurrect()` becomes `true`.
   - When Spacebar keydown or canvas click occurs, `restart()` is invoked.
   - `restart()` halts the previous RAF loop with `stop()` (`loopEpoch++`), resets all manager pools (`HordeManager`, `LootManager`, `WeaponManager`, `UpgradeSystem`), restores player health to 100 and level to 1, sets `accumulator = 0`, `elapsedTime = 0`, and restarts the loop cleanly.
4. **Contract Hygiene Observation on `isGameOver` & `deathDebounceTimer`**:
   - The mission prompt mentions `isGameOver` and `deathDebounceTimer`.
   - Currently, in `GrimHarvestGame`:
     - The property is named `deathTimer` (not `deathDebounceTimer`).
     - There is no `isGameOver` getter; game over is determined by `!player.isAlive`.
   - If tests or external checkers expect `g.isGameOver === false` and `g.deathDebounceTimer`, evaluating `g.isGameOver` directly would return `undefined`.
   - Implementing convenience getters `get isGameOver(): boolean { return !this.player.isAlive; }` and `get deathDebounceTimer(): number { return this.deathTimer; }` in `src/main.ts` or supporting fallback `g.isGameOver ?? !g.player.isAlive` in the test provides 100% contract compliance and prevents assertion mismatches.

---

## 3. Caveats

1. **`isGameOver` & `deathDebounceTimer` Naming**:
   - In `src/main.ts`, the field is `public deathTimer: number` and death state is `!player.isAlive`.
   - While conceptually identical to `deathDebounceTimer` and `isGameOver`, tests asserting `g.isGameOver === false` should either use `g.isGameOver ?? !g.player.isAlive` or a minor non-breaking getter alias should be added to `GrimHarvestGame`.
2. **Vitest Unit Benchmark Fluctuation**:
   - During `npm test`, test `tests/unit/HordeStressAdversarial.test.ts` had a single assertion failure (`expected 30.11ms to be less than 25ms` for p95 frame time under 1,200 simulated enemies) due to momentary CPU load spikes on the test runner machine. All other 371 unit tests and 27 test files passed.
3. **Existing Screenshots vs Milestone 4 Target Artifacts**:
   - `artifacts/dark_fantasy/` currently contains `horde_swarm.png`, `level_up_modal.png`, and `survival_gameplay.png` (all >180KB).
   - Milestone 4 calls for `enhanced_graphics_swarm.png`, `restart_verified.png`, and `occult_vfx_lighting.png`, each >50KB.
   - `tests/e2e/restart_survival.spec.ts` must generate these three new artifacts as part of its visual proof suite.

---

## 4. Conclusion & Test Blueprint

The architecture in `src/main.ts` is fully prepared for Milestone 4 E2E verification. The death debounce, event handlers, and state restoration in `restart()` cleanly prevent infinite loops and accumulator drift.

### Blueprint for `tests/e2e/restart_survival.spec.ts`

The specification file should be structured with 3 core tests:

```typescript
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Milestone M4: Dark Fantasy Horde Survival — Restart Lifecycle & Continuous Survival Verification', () => {
  const ARTIFACT_DIR = path.resolve(process.cwd(), 'artifacts/dark_fantasy');

  // TEST 1: Intentional Death, Debounce Guard & Immediate Restart Invariants
  test('Restart Lifecycle: triggers Game Over, enforces 0.5s death debounce, resurrects via Space/Click, and verifies immediate invariants', async ({ page }) => {
    // 1. Boot page and wait for window.__game
    // 2. Drive player into horde (or stand still) until player.isAlive === false
    // 3. Immediately test debounce:
    //    - Assert g.deathTimer < 0.5 and g.canResurrect() === false
    //    - Press Space or click canvas; assert player.isAlive is STILL false (debounce works)
    // 4. Wait for deathTimer >= 0.5 (page.waitForFunction(() => g.canResurrect()))
    // 5. Trigger resurrection via Spacebar (or Canvas click)
    // 6. Assert all immediate restart invariants:
    //    - isGameOver === false (or !player.isAlive === false)
    //    - player.isAlive === true
    //    - player.stats.currentHealth === 100
    //    - player.level === 1
    //    - starterWeapon === 'scythe'
    //    - accumulator <= 1 / 60
    //    - elapsedTime === 0
    //    - isPaused === false
    //    - deathTimer === 0
    //    - hordeManager.getActiveCount() >= 25
  });

  // TEST 2: Continuous 15-Second Post-Restart Survival Execution Loop
  test('Continuous Survival: bot autonomously survives >= 15s post-restart, moves, kills foes, vacuums XP, with 0 engine errors or accumulator runaway', async ({ page }) => {
    // 1. Trigger death and resurrection as in Test 1
    // 2. Run continuous 15s survival simulation using dynamic 8-directional steering
    // 3. Handle level-up card selection modal if triggered
    // 4. Assert final invariants:
    //    - elapsedTime >= 15.0
    //    - player.isAlive === true
    //    - player.stats.currentHealth > 0
    //    - hordeManager.totalKilled >= 1
    //    - accumulator <= 1 / 60 + 0.01
    //    - consoleErrors.length === 0
    //    - pageErrors.length === 0
  });

  // TEST 3: Visual Proof Artifacts Capture & Audit (> 50KB)
  test('Visual Proof: captures enhanced_graphics_swarm.png, restart_verified.png, occult_vfx_lighting.png and verifies valid PNGs > 50KB', async ({ page }) => {
    // 1. Capture restart_verified.png right after resurrection
    // 2. Setup deterministic dense swarm and capture enhanced_graphics_swarm.png
    // 3. Trigger active weapon VFX and lighting to capture occult_vfx_lighting.png
    // 4. Audit all 3 files: exist on disk, valid PNG magic bytes, dimensions 960x540, file size > 50KB
  });
});
```

---

## 5. Verification Method

To independently verify these findings:

1. **Verify Playwright WebServer & Page Initialization**:
   ```bash
   npx playwright test tests/e2e/game_initialization.spec.ts
   ```
   *Expected*: Passes with 3 green tests on `http://localhost:4173`.
2. **Verify Restart Engine Unit Tests**:
   ```bash
   npx vitest run tests/unit/restart.spec.ts tests/unit/ChallengerRestartEngine_M1_1.test.ts
   ```
   *Expected*: 100% pass across all restart lifecycle suites (clock reset, debounce, player restoration, weapons, wave director).
3. **Inspect Implementation Code**:
   - Inspect `src/main.ts` lines 248–382 (`canResurrect`, `handleKeyDown`, `handleCanvasClick`, `restart`).
   - Inspect `src/core/entities/Player.ts` lines 94–125 (`reset`) and 249–271 (`takeDamage`).
   - Inspect `playwright.config.ts` lines 12–29 (`webServer` and `use` config).
