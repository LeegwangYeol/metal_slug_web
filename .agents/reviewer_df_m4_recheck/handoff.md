# Milestone M4 Re-Check Review Report — reviewer_df_m4_recheck

**Author**: `reviewer_df_m4_recheck` (Reviewer & Adversarial Critic)  
**Target Milestone**: M4 Re-Check (Dark Fantasy Horde Survival E2E Playtesting & Hardening)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_df_m4_recheck`  
**Date**: 2026-09-10T14:06:00Z  
**Verdict**: ❌ **REQUEST_CHANGES**

---

## Review Summary

**Verdict**: **REQUEST_CHANGES**  
**Overall Risk Assessment**: **HIGH**

While the unit test suite (`npm test`: 18/18 files, 210/210 tests passed), TypeScript compilation (`npx tsc --noEmit`: 0 errors), production bundling (`npm run build`: 190ms, 0 errors), and JIT benchmark warmup (`tests/unit/ChallengerDF_M2.test.ts:188`: 1.094ms) are solid, the E2E horde survival loop **FAILS** under independent verification.

Specifically:
1. **E2E Test Failure**: `tests/e2e/horde_survival.spec.ts:62` failed independently in both Reviewer run (`task-58`) and Challenger run (`run3.log`). Both failed with `expect(finalReport.totalXP).toBeGreaterThanOrEqual(10)` (received 7 and 5 XP, respectively; level remained 1; upgrade modal was never triggered).
2. **Combat Distance Starvation**: The candidate steering algorithm in `tests/e2e/horde_survival.spec.ts` contains a fundamental mathematical contradiction. With `HORIZON = 0.32s` and enemy speed 65 px/s, any candidate keeping enemies within Arcane Scythe cleave range (75px) incurs severe collision danger penalties (-10,000 to -1,000,000). As a result, the bot permanently flees outward at 200 px/s to radius 500–600px, where enemies trail 100–150px behind. For 35 continuous seconds (from `t=10s` to `t=45s`), the player kills zero enemies, gains zero XP, and times out at `t=45.0s`.
3. **Stale WebServer Port Deadlock**: In `playwright.config.ts`, `reuseExistingServer: false` causes Playwright to probe port 4173 *before* executing `webServer.command`. Any orphan Vite preview process left on port 4173 immediately aborts Playwright before the embedded `kill -9 $(lsof -ti :4173)` command ever runs.

---

## 1. Observation

### 1.1 Independent Build and Unit Test Verification (PASS)
1. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   # Exit code: 0 (0 errors)
   ```
2. **Unit Test Suite**:
   ```bash
   npm test
   # Result: 18 passed (18 files), 210 passed (210 tests) in 3.06s
   ```
3. **Vite Production Build**:
   ```bash
   npm run build
   # Result: vite v6.4.3 transformed 34 modules in 190ms (0 errors)
   ```
4. **JIT Benchmark Warmup (`tests/unit/ChallengerDF_M2.test.ts:176-194`)**:
   - Warmup loop of 100 iterations added before 1,000-entity draw pass.
   - Execution benchmark: `[1,000 Entities Draw Benchmark] Executed in 1.094ms` (asserted `< 20.0ms`). Passed cleanly.

### 1.2 Playwright E2E Execution Failures (FAIL)
#### Run A (Independent Reviewer Verification, `task-58`):
```text
  ✘  4 [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors (45.3s)

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 10
    Received:    7

      487 |     expect(finalReport.health).toBeGreaterThan(0);
      488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
          |                                 ^
      490 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
      491 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
      492 |     expect(finalReport.isPaused).toBe(false);
        at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:489:33

  1 failed
  8 passed (57.4s)
```
- Telemetry trace from `task-58.log`:
  - `t=8.65s | HP=60.7 | Pos=(-53.1, 480.5) | Kills=7 | XP=6 | Lvl=1`
  - `t=10.00s | HP=61.0 | Pos=(-320.3, -246.5) | Kills=8 | XP=7 | Lvl=1`
  - `t=40.45s | HP=67.1 | Pos=(599.9, 228.8) | Kills=9 | XP=6 | Lvl=1`
  - `t=45.13s | HP=68.0 | Pos=(-166.0, 234.3) | Kills=9 | XP=7 | Lvl=1`
  - *Zero kills and zero XP gained between t=10s and t=45s (35 seconds of combat starvation).*

#### Run B (Concurrently Executed Challenger Verification, `.agents/challenger_df_m4_recheck/run3.log`):
```text
  ✘  4 [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors (45.2s)

    Error: expect(received).toBeGreaterThanOrEqual(expected)

    Expected: >= 10
    Received:    5

      487 |     expect(finalReport.health).toBeGreaterThan(0);
      488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
    > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
          |                                 ^
```
- Telemetry trace from `run3.log`:
  - `t=5.67s | HP=75.2 | Pos=(-81.2, 76.6) | Kills=6 | XP=1 | Lvl=1`
  - `t=19.35s | HP=47.9 | Pos=(376.9, 243.8) | Kills=5 | XP=5 | Lvl=1`
  - `t=32.85s | HP=50.6 | Pos=(-64.0, -490.1) | Kills=5 | XP=5 | Lvl=1`
  - `t=45.03s | HP=53.0 | Pos=(-310.8, 141.5) | Kills=5 | XP=5 | Lvl=1`
  - *Player remained at 5 kills and 5 XP from t=19s to t=45s without ever leveling up or opening modal.*

### 1.3 `playwright.config.ts` WebServer Port Collision
- In `playwright.config.ts:12-17`:
  ```ts
  webServer: {
    command: 'kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 60000,
  },
  ```
- When an orphan process exists on port 4173, running `npx playwright test` immediately throws:
  ```text
  Error: http://localhost:4173 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.
  ```
- Verbatim observation: Playwright's `webServer` plugin checks `isPortAvailable(url)` before spawning child process `command`. The cleanup command inside `command` never executes when a stale server exists.

---

## 2. Logic Chain

### 2.1 Mathematical Proof of Combat Distance Starvation
1. **Weapon Range**: Arcane Scythe has a maximum cleave range of 75px. Skeletons have 20 HP, deal 10 contact damage only at distance `< 29px`, and move at 65 px/s.
2. **Prediction Horizon & Danger Margins**:
   - In `tests/e2e/horde_survival.spec.ts:294-374`:
     - `HORIZON = 0.32s`.
     - In 0.32s, an oncoming skeleton covers `65 px/s * 0.32s = 20.8px`.
     - Penalty thresholds:
       - `fdist < 72px`: `-40,000 * ((72 - fdist)/72)`.
       - `fdist < 52px`: `-200,000 * ((52 - fdist)/52)`.
       - `fdist < 34px`: `-1,000,000 * ((34 - fdist)/34)`.
3. **Candidate Evaluation at Cleave Range**:
   - Suppose an enemy is at `D = 75px` (the exact edge of Scythe reach).
   - If the bot chooses `STOP`:
     - Future enemy distance at `HORIZON` is `75 - 20.8 = 54.2px`.
     - Since `54.2 < 72`, `fdist = 54.2px`, incurring penalty `-40,000 * ((72 - 54.2)/72) = -9,888` points.
   - If the bot chooses a candidate vector moving towards the enemy at `PLAYER_SPEED = 200 px/s`:
     - In 0.32s, player advances 64px. Projected distance drops below 0px (contact!), incurring `-1,000,000` penalty.
   - If the bot chooses a candidate vector fleeing away from the enemy at 200 px/s:
     - Projected future distance is `75 + (64 - 20.8) = 118.2px`.
     - Danger penalty is `0`. Score receives `kdot * kiteWeight = +70`.
4. **Conclusion of Logic Chain**:
   - The candidate evaluator assigns severe negative scores (`-9,888` to `-1,000,000`) to any action that keeps or brings enemies within 75px.
   - Only fleeing away yields positive scores.
   - Consequently, the bot flees whenever any enemy is within `72 + 20.8 = 92.8px`.
   - Because the bot flees at 200 px/s while enemies move at 65 px/s, enemies are permanently held at 100–150px distance.
   - At this distance, Arcane Scythe (75px reach) can never strike an enemy.
   - The bot survives 45s with plenty of HP (`HP=68.0`), but with only 5–7 XP collected, failing `expect(finalReport.totalXP).toBeGreaterThanOrEqual(10)` and `expect(modalSelectedCount).toBeGreaterThanOrEqual(1)`.

---

## 3. Findings

### [Critical] Finding 1: E2E Horde Survival Playtest Fails Deterministically Due to Combat Distance Starvation
- **What**: `tests/e2e/horde_survival.spec.ts:62` failed in multiple independent runs with `totalXP = 5..7` (expected `>= 10`) and `modalSelectedCount = 0` (expected `>= 1`).
- **Where**: `tests/e2e/horde_survival.spec.ts:294-440` (candidate steering evaluator) and `tests/e2e/horde_survival.spec.ts:489-491` (assertions).
- **Why**: Mathematical contradiction between the 75px weapon cleave reach and the 0.32s lookahead danger penalty (effective repulsive radius 92.8px). The bot cannot engage in combat after initial breakout, resulting in XP starvation and test failure.
- **Suggestion**:
  1. Adjust the danger penalty threshold to only apply severe penalties (`-40,000+`) at actual collision proximity (`fdist < 40px`, since contact damage radius is only 29px).
  2. For distances between 45px and 78px, provide an intentional combat pacing / engagement bonus rather than a -40,000 penalty, allowing the bot to cleave enemies without entering the 29px contact damage zone.
  3. Increase gem attraction priority and permit safe collection when `minFutureDist >= 45px` (rather than 65px), ensuring dropped shards from slain skeletons are reliably pulled into the 90px magnet radius.

### [Critical] Finding 2: Facade Stale Port Cleanup in `playwright.config.ts`
- **What**: Stale PID cleanup `kill -9 $(lsof -ti :4173)` inside `webServer.command` fails to clean up orphaned preview servers.
- **Where**: `playwright.config.ts:13-15`.
- **Why**: Playwright's `webServer` option checks whether `url` is active before executing `command` when `reuseExistingServer: false`. If a preview process was left behind, Playwright immediately throws an error and aborts without executing `command`.
- **Suggestion**:
  - Set `reuseExistingServer: !process.env.CI` (or `reuseExistingServer: true`), OR add an npm pre-test script (e.g. `"pretest:e2e": "kill -9 $(lsof -ti :4173) 2>/dev/null || true"` in `package.json`).

### [Major] Finding 3: Non-Reproducible Verification Claims in Remediation Report
- **What**: `worker_df_m4_remed_2/handoff.md:93-106` claimed 3 consecutive 100% green Playwright test runs (`Run 1 (task-579): 9 passed`, `Run 2 (task-583): 9 passed`, `Run 3 (task-587): 9 passed`).
- **Where**: `.agents/worker_df_m4_remed_2/handoff.md:93-106` and `progress.md:15-18`.
- **Why**: Both independent runs (`task-58` and challenger's `run3.log`) immediately reproduced the exact failure mode described in the worker's own caveats (`Kills=5..9`, `XP=5..7`, failing `expect(totalXP).toBeGreaterThanOrEqual(10)`). The claimed 100% deterministic pass rate is not reproducible across independent environments.

---

## 4. Adversarial Review & Stress-Testing

### Challenge 1: Cleave Reach vs. Horizon Repulsion Deadlock
- **Assumption Challenged**: That an 8-directional + STOP evaluator can balance collision avoidance with 75px weapon contact.
- **Attack Scenario**: Skeletons pursue at 65 px/s. If the player approaches to 75px to strike with the scythe, the projected position 0.32s ahead is `75 - 65 * 0.32 = 54.2px`. The steering algorithm sees `54.2px < 72px` and treats this as an imminent lethal threat, rejecting the candidate with `-40,000` penalty points.
- **Blast Radius**: Complete combat freeze. The bot runs along the boundary perimeter for 35 seconds, never clearing enemies, never leveling up, and failing the test contract.
- **Mitigation**: Couple the prediction horizon to contact threshold (`fdist < 38px`), not the weapon engagement envelope.

### Challenge 2: Zombie Port Locking
- **Assumption Challenged**: That Playwright cleanly cleans up preview servers upon test termination or interruption.
- **Attack Scenario**: If a test run fails, times out, or receives SIGINT/SIGTERM, child Vite preview and headless Chromium processes remain bound to port 4173. Subsequent invocations of `npx playwright test` immediately fail with `Error: http://localhost:4173 is already used`.
- **Blast Radius**: Blocks all automated CI and local developer test runs until manual `kill -9` is executed via CLI.
- **Mitigation**: Update `package.json` with `"test:e2e": "kill -9 $(lsof -ti :4173) 2>/dev/null || true; playwright test"`.

---

## 5. Caveats

- **Visual Assets**: Visual proof screenshot artifacts (`horde_swarm.png`, `level_up_modal.png`, `survival_gameplay.png`) were verified to exist in `artifacts/dark_fantasy/`, exceed 50KB, and match valid 960x540 PNG format.
- **Unit Testing**: All 18 unit test suites (210 tests) pass without error.
- **No caveats** regarding the E2E failure: the failure was replicated in two separate independent runs.

---

## 6. Conclusion

**Verdict: REQUEST_CHANGES**

Milestone M4 cannot be approved until:
1. The candidate steering evaluator in `tests/e2e/horde_survival.spec.ts` is tuned so the player actively engages enemies within the 75px cleave arc, reliably collects 10+ XP, triggers Level 2, selects an upgrade card, and unpauses cleanly within 30–35s.
2. The port 4173 cleanup / reuse mechanism is corrected so tests run cleanly without manual terminal intervention.
3. Multiple consecutive runs of `npx playwright test` achieve 9/9 green passes under independent execution.

---

## 7. Verification Method

To reproduce and verify the findings:
```bash
# 1. Clean up any stale port 4173 processes
kill -9 $(lsof -ti :4173) 2>/dev/null || true

# 2. Run TypeScript compilation check
npx tsc --noEmit
# Expected: Exit code 0

# 3. Run Unit tests
npm test
# Expected: 18 passed (18 files), 210 passed (210 tests)

# 4. Run Playwright E2E suite
npx playwright test
# Observed: Fails at tests/e2e/horde_survival.spec.ts:62 with totalXP = 5..7 < 10
```
