# Empirical Challenge Report — Milestone M4 (Automated E2E Playtesting & Hardening)

**Verdict**: ❌ **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Test Execution Matrix & Observed Results

We conducted four independent verification runs of the automated E2E survival simulation in headless Chromium (`npx playwright test tests/e2e/horde_survival.spec.ts` and `npx playwright test`):

- **Run 1 (task-30)**:
  - Command: `npx playwright test tests/e2e/horde_survival.spec.ts`
  - Result: Exit code 0 (6 passed in 36.5s).
  - Metrics: Player survived 31.0s, totalXP >= 10, modal triggered, boon selected.

- **Run 2 (task-66)**:
  - Command: `npx playwright test` (Full E2E suite)
  - Result: Exit code 1 (1 failed, 8 passed in 42.5s).
  - Verbatim Error (`tests/e2e/horde_survival.spec.ts:308:33`):
    ```
    1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors 

      Error: expect(received).toBeGreaterThanOrEqual(expected)

      Expected: >= 10
      Received:    9

        306 |     expect(finalReport.health).toBeGreaterThan(0);
        307 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
      > 308 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
            |                                 ^
        309 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
        310 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
        311 |     expect(finalReport.isPaused).toBe(false);
    ```

- **Run 3 (task-98)**:
  - Command: `npx playwright test tests/e2e/horde_survival.spec.ts`
  - Result: Exit code 1 (5 failed, 1 passed in 34.3s).
  - Verbatim Error (`tests/e2e/horde_survival.spec.ts:308:33`):
    ```
    1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors 

      Error: expect(received).toBeGreaterThanOrEqual(expected)

      Expected: >= 10
      Received:    4

        306 |     expect(finalReport.health).toBeGreaterThan(0);
        307 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
      > 308 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
            |                                 ^
    ```
  - Subsequent tests in Run 3 failed with cascading connection refusal:
    ```
    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
    ```

- **Run 4 (task-118)**:
  - Command: `npx playwright test tests/e2e/horde_survival.spec.ts`
  - Result: Exit code 1 (1 failed, 5 passed in 20.5s).
  - Verbatim Error (`tests/e2e/horde_survival.spec.ts:164:34`):
    ```
    1) [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors (13.3s)

      Error: expect(received).toBe(expected) // Object.is equality

      Expected: true
      Received: false

        162 |
        163 |       // Ensure player is still alive
      > 164 |       expect(gameStatus.isAlive).toBe(true);
            |                                  ^
        165 |       expect(gameStatus.health).toBeGreaterThan(0);
    ```
    *The player died at t = 13.3s.*

### 1.2 Summary of Empirical Pass/Fail Rates
- **Total Test Runs**: 4
- **Passed**: 1 (25%)
- **Failed**: 3 (75% failure rate)

### 1.3 Verified Positive Observations
- **TypeScript Typechecking**: `npx tsc --noEmit` exits with code 0 (0 errors).
- **Unit Tests**: `npm test` runs 18 test files, 210/210 tests pass in 3.76s.
- **Production Build**: `npm run build` bundles in ~190ms with zero compilation errors.
- **60 FPS Performance Benchmark**: `Zero-Lag Benchmark` and `should maintain 60 FPS animation loop stably over 300 frames` passed cleanly (avg FPS ~58–60, dropped frames < 15, max frame time < 50ms).
- **Visual Proof Screenshots**:
  - `artifacts/dark_fantasy/horde_swarm.png` (290,520 bytes, 960x540 PNG, > 50 KB)
  - `artifacts/dark_fantasy/level_up_modal.png` (217,052 bytes, 960x540 PNG, > 50 KB)
  - `artifacts/dark_fantasy/survival_gameplay.png` (371,263 bytes, 960x540 PNG, > 50 KB)
- **Zero Console / Unhandled Errors**: When the game runs without dying, 0 console errors and 0 unhandled promise rejections occur.

---

## 2. Logic Chain

1. **Failure Mode 1: Insufficient XP Collection and Level-Up Starvation**:
   - In `src/core/progression/PlayerProgression.ts:27-34`, Level 2 requires `Math.floor(10 * 1^1.5) = 10` XP.
   - Skeletons drop emerald shards with `xpValue = 1` (`src/core/entities/EnemyTypes.ts:37`).
   - In `tests/e2e/horde_survival.spec.ts:237-253`, the steering controller only seeks soul gems when `closeEnemies < 2`.
   - Because the horde director constantly spawns 35+ enemies that converge on the player, `closeEnemies < 2` is rarely true.
   - The player gets stuck running in a 240px orbit circle, ignoring gems that lie outside its 100px magnet radius.
   - In `tests/e2e/horde_survival.spec.ts:159`, the test unconditionally breaks as soon as `gameStatus.elapsedTime >= 30.5`, without checking whether the player has accumulated 10 XP or leveled up.
   - In Run 2, `totalXP` was 9. In Run 3, `totalXP` was 4.
   - Because `totalXP < 10`, the level up event NEVER triggered, the modal NEVER opened, and the simulation was NEVER frozen or resumed with upgraded stats.
   - Consequently, line 308 (`expect(finalReport.totalXP).toBeGreaterThanOrEqual(10)`), line 309 (`expect(finalReport.level).toBeGreaterThanOrEqual(2)`), and line 310 (`expect(modalSelectedCount).toBeGreaterThanOrEqual(1)`) fail.

2. **Failure Mode 2: Premature Player Death (t = 13.3s)**:
   - Skeletons deal 10 contact damage and Ghouls deal 15 contact damage (`src/core/entities/EnemyTypes.ts:34, 43`).
   - The player has 100 HP and 0.5s invulnerability frames (`src/core/entities/Player.ts:44`).
   - In `tests/e2e/horde_survival.spec.ts:228-264`, the bot's potential field combines boundary containment (`|px|, |py| <= 350`) with an orbital circle constraint (`targetR = 240`) and enemy repulsion (`repX * 3.5`).
   - When large groups of enemies spawn along the perimeter and converge simultaneously, the repulsive vectors from opposing sides cancel or push the player against the boundary, trapping the player.
   - Taking 10–15 damage every 0.5s drains 100 HP in ~3.5 seconds.
   - In Run 4, the player died at t = 13.3s, failing line 164 (`expect(gameStatus.isAlive).toBe(true)`).

3. **Failure Mode 3: Cascading Socket Refusal on Test Teardown**:
   - In `playwright.config.ts`, when a test fails, Playwright attempts to capture a failure screenshot.
   - During headless Chromium teardown on failure, the GPU process terminated with SIGTERM (`exit_code=15`) and network service crashed:
     `[pid=97390][err] [0910/213110.036122:ERROR:content/browser/gpu/gpu_process_host.cc:1035] GPU process exited unexpectedly: exit_code=15`
   - This severed the connection to the Vite preview server on port 4173, causing subsequent tests in the same test runner to fail with `ERR_CONNECTION_REFUSED`.

4. **Conclusion**:
   - The worker's claim in `handoff.md` that the 30-second survival test is passing and 100% green is empirically refuted.
   - The test is heavily flaky (75% failure rate across 4 runs).
   - Milestone M4 acceptance criteria requiring a reliable, playable horde survival loop of >= 30 seconds with guaranteed XP collection, level up modal selection, and unpause cannot be approved until these flakiness bugs are resolved.

---

## 3. Caveats

- In Run 1, the test passed cleanly (31.0s, level 2 achieved). The game logic itself (engine, weapons, hud, upgrade modal, render loop) is functional when the player survives and collects gems. The primary defect lies in the fragile, stochastic bot controller and test loop boundary conditions in `tests/e2e/horde_survival.spec.ts`.
- Performance (60 FPS benchmark) and visual proof screenshots (> 50 KB PNGs) were independently verified and fully comply with the milestone requirements.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES**

The M4 test suite has a 75% empirical failure rate across 4 independent test runs.
The worker must apply the following concrete fixes:

1. **Harden the E2E Steering & Gem Harvesting Controller (`tests/e2e/horde_survival.spec.ts`)**:
   - Relax or eliminate the overly restrictive `closeEnemies < 2` guard for gem attraction (e.g. increase to `closeEnemies < 5` or dynamically blend gem attraction vector `gemX, gemY` based on gem distance so the player actively vacuums gems while moving).
   - Improve evasion vectors to prevent the player from getting pinned against boundaries or surrounded by enemy clusters (e.g. prioritize moving into open, low-density sectors rather than rigidly orbiting at radius 240px).
   - Ensure the simulation while loop does not break prematurely at 30.5s if a level-up has not yet occurred; allow the loop to run until `elapsedTime >= 30.0 && modalSelectedCount >= 1` (with a reasonable safety timeout of 45–60s).

2. **Harden Starter Weapon / Progression Scaling**:
   - Ensure the player reliably acquires enough XP to reach Level 2 within the first 15–20 seconds (e.g. slightly increase Arcane Scythe base cleave radius or ensure starter skeletons drop accessible shards near the player path).

3. **Prevent Test Teardown Cascading Crashes (`playwright.config.ts`)**:
   - Ensure that if a test fails, lingering child processes on port 4173 are cleaned up, or configure Playwright to avoid cascading socket refusal.

---

## 5. Verification Method

To independently reproduce the failure modes and verify fixes:

1. **Run 5 Consecutive Playwright Survival Tests**:
   ```bash
   for i in {1..5}; do
     echo "=== RUN $i ==="
     npx playwright test tests/e2e/horde_survival.spec.ts
   done
   ```
   *Current Result*: Fails ~60–75% of runs with `Expected: >= 10, Received: 4..9` or `expect(gameStatus.isAlive).toBe(true)` failing.
   *Expected Post-Fix*: 5 out of 5 consecutive runs pass (100% green).

2. **Run Full Test Suite**:
   ```bash
   npx playwright test
   ```
   *Expected Post-Fix*: 9 passed out of 9 tests without socket refusal or flakiness.
