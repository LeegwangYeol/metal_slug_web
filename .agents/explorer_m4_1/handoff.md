# Handoff Report: Playwright E2E Integration & Visual Proof Architecture (Milestone M4)

**Agent**: `teamwork_preview_explorer` (`explorer_m4_1`)  
**Target Milestone**: M4 (Playwright E2E Integration & Visual Proof Screenshots)  
**Date**: 2026-09-08  

---

## 1. Observation

### 1.1 Playwright Configuration & Web Server Architecture
- **File**: `playwright.config.ts` (lines 1–23)
  ```ts
  export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    workers: 1,

    webServer: {
      command: 'npm run preview',
      port: 4173,
      reuseExistingServer: !process.env.CI,
    },
    use: {
      baseURL: 'http://localhost:4173',
      trace: 'off',
    },
    projects: [
      {
        name: 'chromium',
        use: { ...devices['Desktop Chrome'] },
      },
    ],
  });
  ```
  - **Single Worker (`workers: 1`)**: Prevents race conditions, port conflicts, and CPU throttling across parallel browser sessions.
  - **Web Server Command**: Runs `npm run preview` on port `4173`. In `package.json`:
    - `"preview": "vite preview"`
    - `"build": "tsc -b && vite build"`
    - In `vite.config.ts`: `preview.port = 4173`, `build.outDir = 'dist'`.
  - **Critical Dependency**: `vite preview` serves the compiled bundle in `dist/`. Therefore, `npm run build` must have been run prior to testing; otherwise `vite preview` fails to find `dist/`.

### 1.2 Browser Bootstrap & Game Engine Exposure on Window
- **File**: `src/main.ts` (lines 967–988, 991–999)
  ```ts
  function bootstrap(): FullMetalSlugGame | null {
    if (typeof document === 'undefined') return null;
    const container = document.getElementById('game-container');
    if (!container) return null;

    const game = new FullMetalSlugGame(container, { spawnMode: 'diverse' });

    if (typeof window !== 'undefined') {
      (window as any).__GAME__ = game;
      (window as any).__ENGINE__ = game.engine;
      (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
      (window as any).__CORPSE_MANAGER__ = game.corpseManager;
    }

    game.start();
    return game;
  }
  ```
- **File**: `src/main.ts` (lines 52–64, 189–235, 238–297)
  - `game.engine`: `GameEngine` instance containing all registered entities (`entities: Map<string, GameEntity>`), platform geometry, collision system, and spatial hash grid.
  - `game.player`: `PlayerController` containing physics position (`vec2(80, 230)`), health, weapon manager, and `ultimateManager: UltimateManager`.
  - `game.camera`: `Camera` with viewport `480x270`.
  - `game.stageManager`: `StageManager` managing camera bounds and wave triggers.
  - `game.start()`: Initiates 60Hz fixed-timestep accumulator loop via `requestAnimationFrame`.
  - `game.stop()`: Cancels the `requestAnimationFrame` loop and pauses the engine.
  - `game.step(dt = 1/60)`: Discretely steps simulation logic (inputs, player kinematics, physics tick, camera, explosions) by exactly `dt`.
  - `game.render()`: Manually renders the complete frame (parallax, terrain, entities, hazards, ultimate cinematic FX, HUD) to canvas.

### 1.3 Canvas Interaction & Keyboard Event Dispatching
- **File**: `src/input/KeyboardController.ts` (lines 68–100, 102–112, 246–320)
  - Keyboard mappings include:
    ```ts
    KeyU: 'ultimate'
    ```
  - Keyboard listener attachment:
    ```ts
    if (typeof window !== 'undefined') {
      this.attach(window);
    }
    ```
  - When Playwright focuses the canvas element (`await page.focus('canvas#game-canvas')`) and dispatches key events (`await page.keyboard.press('KeyU')` or `await page.keyboard.down('KeyU')` / `await page.keyboard.up('KeyU')`), `KeyboardController.handleKeyDown` intercepts the event, maps `e.code === 'KeyU'` to action `'ultimate'`, and sets:
    ```ts
    this.ultimate = true;
    this.ultimateJustPressed = true;
    ```
  - In `KeyboardController.getSnapshot()`, `ultimatePressed` is latched:
    ```ts
    const ultimatePressed = this.ultimateJustPressed || (this.ultimate && !this.prevUltimate);
    this.ultimateJustPressed = false;
    ```
  - Programmatic fallback: Tests can also trigger actions programmatically via:
    ```ts
    game.keyboard.setAction('ultimate', true);
    ```

### 1.4 Ultimate Move State Machine & Execution Engine
- **File**: `src/core/player/UltimateManager.ts` (lines 52–81, 121–187, 197–218, 248–297, 300–423)
  - Phases: `IDLE` -> `FREEZE` (0.5s) -> `STRIKE_PASS` (0.6s) -> `DETONATION` (0.4s) -> `RECOVERY` (0.3s) -> `IDLE`.
  - Trigger API: `player.triggerUltimateMove(engine)` or `ultimateManager.trigger(engine)`.
  - Consumes 1 stock (initialized with stock = 1).
  - Cinematic FX:
    - `FREEZE`: Pulsing golden screen flash (`rgba(255, 220, 100, 0.2)`), simulation frozen, air-raid siren SFX.
    - `STRIKE_PASS`: Heavy tactical bomber flies from `camX - 100` to `camX + 680` at `y = 45` dropping bombs, bomber flyover roar SFX.
    - `DETONATION`: Bright screen flash, 18px camera shake, expanding concentric shockwave rings (`radius: progress * 280`), cataclysmic blast SFX.
    - `RECOVERY`: Dissipating screen flash, screen unfreezes.
  - Combat Resolution during Detonation:
    - Eliminates 100% of standard infantry minions (`SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`, etc.) within viewport (`AABB(camX, 0, 480, 270)`).
    - Culls all hostile projectiles (`ENEMY_BULLET`, `ENEMY_GRENADE`, `CANNON_SHELL`, `ARTILLERY_SHELL`, `HOMING_MISSILE`).
    - Deals 120 HP burst damage to bosses (`IronNokanaBoss`, `TetsuyukiBoss`, `MidBossVehicle`).
    - Zero Friendly Fire: Player, `AllyNPC`, `AllyKiBlast`, and `PowEntity` are completely immune.
    - Frustum Preservation: Off-screen minions outside the active viewport bounding box remain undamaged and alive.

### 1.5 Existing E2E Test Suite Analysis
Existing E2E tests in `tests/e2e/`:
1. `game_initialization.spec.ts` (3 tests):
   - Boots preview server, checks `#game-container`, checks canvas 480x270, asserts 0 console errors.
   - Measures 300 animation frames in browser context (>= 50 FPS).
   - Verifies `window.__GAME__`, `window.__ENGINE__`, `window.__AUDIO_CTX__`.
   - Execution status: **3/3 PASSED (19.7s)**.
2. `gameplay_controls.spec.ts` (5 tests):
   - Verifies Space / KeyK jumps with real browser keyboard events (`page.keyboard.press`).
   - Verifies Arrow and WASD horizontal movement (`page.keyboard.down` / `waitForTimeout` / `page.keyboard.up`).
   - Verifies combined air mobility (jumping while moving right).
   - Execution status: **5/5 PASSED (26.8s)**.
3. `visual_verification.spec.ts` (6 tests):
   - Uses `setupDeterministicGame(page)`: navigates to `/`, waits for `canvas#game-canvas` and `window.__GAME__`, sets canvas style width 960px x 540px, calls `game.stop()` to pause the rAF loop.
   - Sets player position, aims diagonally, steps frames with `game.step(1/60)`, calls `game.render()`.
   - Takes screenshots via `page.screenshot({ path })` into `artifacts/screenshots/`.
   - Execution status: **6/6 PASSED (15.4s)**.
4. `death_animations_screenshots.spec.ts` (3 tests):
   - Uses `setupDeterministicGame(page)`.
   - Spawns corpses with `game.corpseManager.spawnCorpse(...)`, advances simulation frames, calls `game.render()`.
   - Takes screenshots via `canvas.screenshot({ path })` into `artifacts/death_animations/`.
   - Execution status: **3/3 PASSED (13.0s)**.

### 1.6 Current Build and Vitest Status
- `npm run build` (`tsc -b && vite build`): **0 TypeScript errors, clean bundle generated in 4.67s**.
- `npm test` (`vitest run`): **34 test files passed (34/34), 453 tests passed (453/453) in 27.78s**.

---

## 2. Logic Chain

1. **Web Server Lifecycle**:
   - `playwright.config.ts` delegates server lifecycle to `npm run preview` on port 4173 with `reuseExistingServer: !process.env.CI`.
   - Because `vite preview` relies on `./dist/`, running `npm run build` is a mandatory prerequisite step whenever source files change.
   - Single worker (`workers: 1`) ensures serialized execution, eliminating port binding race conditions.

2. **Game Ready Detection**:
   - Upon `await page.goto('/')`, the page loads `index.html` which executes `bootstrap()`.
   - Bootstrap attaches `window.__GAME__`, `window.__ENGINE__`, etc., and appends `canvas#game-canvas`.
   - The robust, canonical readiness check established across all existing suites is:
     ```ts
     await page.goto('/');
     await page.waitForSelector('canvas#game-canvas');
     await page.waitForFunction(() => {
       const w = window as any;
       return w.__GAME__ && w.__GAME__.engine && w.__GAME__.player;
     });
     ```
   - This guarantees that both the DOM element and the engine globals are fully hydrated before test actions occur.

3. **Input Interaction vs Deterministic Control**:
   - The repository demonstrates two distinct, complementary test patterns:
     - **Pattern A (Real-Time End-to-End Control)**: Used in `gameplay_controls.spec.ts`. Focuses the canvas (`await page.focus('canvas#game-canvas')`), issues genuine browser keyboard events (`page.keyboard.press('KeyU')`), and observes simulation responses via `page.waitForFunction(...)`.
     - **Pattern B (Deterministic Frame-Stepped Visual Proof)**: Used in `visual_verification.spec.ts` and `death_animations_screenshots.spec.ts`. Stops the rAF loop via `game.stop()`, injects entities or inputs, steps the exact number of frames via `for (let i = 0; i < N; i++) game.step(1/60);`, forces a draw pass with `game.render()`, and captures a pixel-perfect screenshot.
   - For Milestone M4:
     - Acceptance requirement 1 (E2E Ultimate Move test): Use **Pattern A** to verify that pressing `KeyU` in the browser triggers the move, destroys active on-screen minions, inflicts 120 HP to the boss, and preserves off-screen minions.
     - Acceptance requirement 2 & Visual Proof (Artifact screenshots): Use **Pattern B** to freeze the exact cinematic frames (`FREEZE`, `STRIKE_PASS`, `DETONATION`, `BOSS_CRISIS`, `ALLY_SUPPORT`) with 100% frame-perfect reproducibility.

4. **Eliminating Flakiness**:
   - Flakiness in web game E2E tests stems from four root causes:
     - *Issue 1: Asynchronous asset loading / DOM delay.* Solved by `waitForFunction` polling `window.__GAME__`.
     - *Issue 2: Browser window focus loss.* Solved by `await page.focus('canvas#game-canvas')`.
     - *Issue 3: Variable frame rate (rAF jitter) during screenshot capture.* Solved by pausing the loop (`game.stop()`), advancing via `game.step(1/60)`, and calling `game.render()`.
     - *Issue 4: Fixed sleep timeouts (`waitForTimeout`).* Solved by replacing arbitrary sleeps with state-based predicates (`waitForFunction` checking `ultimateManager.phase`).

---

## 3. Caveats

1. **Pre-Build Requirement**: If `dist/` is not updated after code edits, Playwright will test stale production bundle code because `webServer.command` is `npm run preview`. A clean build (`npm run build`) must always precede Playwright test runs.
2. **Viewport Dimension Consistency**: The internal game canvas virtual resolution is 480x270. Existing visual screenshot tests set the canvas CSS style to `width: 960px; height: 540px` and use `viewport: { width: 960, height: 540 }` with `deviceScaleFactor: 1`. The new M4 screenshot tests must adhere to this exact dimension standard so screenshot artifacts have high fidelity (>20KB) and match existing artifacts in visual scale.
3. **Audio Context Mocking in Headless Mode**: In headless Chromium, Web Audio API requires user interaction to resume from `suspended` state. `SoundEngine.ts` handles this gracefully with null-safe and suspended checks, so tests do not crash.

---

## 4. Conclusion

The testing architecture and game hooks in `metal_slug_web` are exceptionally clean, decoupled, and well-instrumented:
1. `window.__GAME__` directly exposes the player controller, engine, camera, and input controller.
2. `KeyboardController` already has `KeyU` mapped to `'ultimate'`, with edge-detection snapshot latches and `setAction('ultimate', true)` support.
3. `UltimateManager` is fully integrated into `PlayerController`, with complete 4-phase cinematic timing, viewport-bounded 100% minion elimination, 120 HP boss damage, projectile culling, and zero friendly fire.
4. All existing tests (34 unit suites / 453 tests, 4 E2E suites / 17 tests) pass 100% green.

### Recommended Blueprint for Milestone M4 Worker Agent

Create `tests/e2e/ultimate_and_crisis_expansion.spec.ts` with two distinct test suites:

#### Suite 1: Genuine Browser E2E Acceptance Verification (Real Keyboard & Live rAF)
1. **Test 1.1: Live Keyboard `KeyU` Screen Wipe & Boss Damage**:
   - Setup: Start game, wait for `__GAME__`.
   - Setup entities:
     - 4 in-screen infantry soldiers (`SOLDIER_RIFLE`, `SOLDIER_KNIFE`, `SOLDIER_GRENADE`, `SOLDIER_SHIELD`) at X = 200–380.
     - 1 Iron Nokana boss at X = 320 with HP = 400.
     - 2 off-screen soldiers at X = 600 (outside viewport).
     - 1 Ally NPC (`AllyNPC`) at X = 120.
     - 1 POW hostage (`PowEntity`) at X = 160.
   - Dispatch input: `await page.focus('canvas#game-canvas');` then `await page.keyboard.press('KeyU');`.
   - Assert: Player enters `FREEZE` phase, stock decrements from 1 to 0.
   - Wait for completion: `await page.waitForFunction(() => (window as any).__GAME__.player.ultimateManager.phase === 'IDLE', { timeout: 6000 });`.
   - Assertions:
     - 100% of on-screen soldiers are dead (`isAlive === false`, `health === 0`).
     - Boss received 120 HP damage (HP clamped at 300 with Phase 2 transition, or 280).
     - Off-screen soldiers at X = 600 remain alive (`isAlive === true`).
     - Friendly units (Player, Ally NPC, POW) remain completely undamaged (`zero friendly fire`).
2. **Test 1.2: Autonomous Ally Combat Verification**:
   - Spawn `AllyNPC` at X = 150 and enemy soldier at X = 300.
   - Without dispatching any player attack keys, run simulation ticks.
   - Assert: Ally acquires target, emits `AllyKiBlast`, and damages/eliminates enemy independently.
3. **Test 1.3: Boss Crisis Event Gating Verification**:
   - Lower boss HP below 75% checkpoint (300 HP).
   - Assert: `CrisisEventManager` triggers artillery hazards (`ArtilleryShellHazard`), warning reticles, and platform collapse / bounds contraction.

#### Suite 2: Visual Proof Screenshots (Deterministic Frame Stepping)
Save 5 high-fidelity screenshots in `artifacts/expansion/`:
1. `screenshot_01_ultimate_freeze_siren.png`:
   - Freeze frame during `UltimatePhase.FREEZE` (golden screen tint, player in tactical stance, active enemies frozen in place).
2. `screenshot_02_ultimate_strike_bomber.png`:
   - Strike pass frame during `UltimatePhase.STRIKE_PASS` (~frame 18, showing tactical bomber sprite flying overhead with falling bombs).
3. `screenshot_03_ultimate_detonation_shockwave.png`:
   - Detonation frame during `UltimatePhase.DETONATION` (concentric expanding shockwave rings, bright flash, vaporized enemy effects).
4. `screenshot_04_iron_nokana_crisis_artillery.png`:
   - Boss crisis scene showing `IronNokanaBoss` in rage mode, artillery targeting reticles on the ground, and falling debris hazards.
5. `screenshot_05_ally_ichimonji_combat.png`:
   - Ally support scene showing `AllyNPC` (Hyakutaro Ichimonji) firing ki blasts, with new weapon crates (`Shotgun`, `LaserGun`, `RocketLauncher`) visible on the ground.

---

## 5. Verification Method

To independently verify the findings in this report:

1. **Verify TypeScript compilation**:
   ```bash
   npm run build
   ```
   *Expected*: Exits with code 0, 0 errors, output written to `dist/`.

2. **Verify all Vitest unit tests**:
   ```bash
   npx vitest run
   ```
   *Expected*: All 34 test files pass (453 tests).

3. **Verify existing Playwright E2E suites**:
   ```bash
   npx playwright test tests/e2e/game_initialization.spec.ts
   npx playwright test tests/e2e/gameplay_controls.spec.ts
   npx playwright test tests/e2e/visual_verification.spec.ts
   npx playwright test tests/e2e/death_animations_screenshots.spec.ts
   ```
   *Expected*: All 17 tests pass 100% across the 4 suites.

4. **Verify KeyU Mapping in Source**:
   - Inspect `src/input/KeyboardController.ts` line 95: `KeyU: 'ultimate'`.
   - Inspect `src/core/player/PlayerController.ts` line 257: `if (input.ultimatePressed) { this.triggerUltimateMove(engine); }`.

5. **Invalidation Conditions**:
   - If `npm run build` fails, the E2E preview server will fail.
   - If canvas element ID changes from `game-canvas`, Playwright selectors will fail.
   - If `window.__GAME__` exposure is removed from `src/main.ts`, E2E test harness cannot query engine state.
