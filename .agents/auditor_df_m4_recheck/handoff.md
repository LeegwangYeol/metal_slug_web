# Milestone M4 Re-Check Forensic Audit Report — auditor_df_m4_recheck

**Auditor**: `auditor_df_m4_recheck` (Forensic Integrity Auditor)  
**Target Milestone**: Milestone M4 Re-Check ("Grim Harvest: Undead Siege" Dark Fantasy Horde Survival E2E Playtesting & Hardening)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_df_m4_recheck`  
**Date**: 2026-09-10T14:07:30Z  
**Verdict**: 🔴 **INTEGRITY VIOLATION**

---

## 1. Observation

### 1.1 Source Code Static Analysis
1. **Target Files Inspected**:
   - `tests/e2e/horde_survival.spec.ts`
   - `playwright.config.ts`
   - `tests/unit/ChallengerDF_M2.test.ts`
   - `src/core/entities/Player.ts`
   - `src/main.ts`
   - `src/input/KeyboardController.ts`
   - `src/ui/UpgradeModal.ts`

2. **Detection of Mocks, Fake Timers, Artificial Health God-Mode, and Facades**:
   - Grep searches across `src/` and `tests/e2e/horde_survival.spec.ts` for `godMode`, `invincib`, `mock`, `fake`, `route`, `intercept` returned **zero** artificial cheat codes or stub facades.
   - `src/core/entities/Player.ts:213-235`: Authentically processes incoming damage (`effectiveDamage = Math.max(1, amount - this.stats.armor)`), reduces `currentHealth`, sets authentic 0.5s invulnerability window (`invulnerabilityTimer = Player.INVULNERABILITY_DURATION`), and triggers `player_died` when `currentHealth <= 0`.
   - `src/input/KeyboardController.ts:124-136` & `src/ui/UpgradeModal.ts:84-104`: Authentically listens to DOM/window keyboard events via `addEventListener('keydown', ...)`.
   - `tests/e2e/horde_survival.spec.ts:186, 455-458`: Dispatches genuine Playwright keyboard events (`page.keyboard.down('KeyA')`, `page.keyboard.up('KeyA')`, `page.keyboard.press('Digit1')`).

3. **Visual Proof Artifacts (`artifacts/dark_fantasy/*.png`)**:
   - `artifacts/dark_fantasy/horde_swarm.png`: 290,520 bytes (> 50KB). Dimensions: 960x540. Confirmed valid PNG with full gothic HUD, blood moon, and concentric swarms.
   - `artifacts/dark_fantasy/level_up_modal.png`: 217,461 bytes (> 50KB). Dimensions: 960x540. Confirmed valid PNG displaying 4 gothic stone cards with gold filigree, rank pips, and key bindings.
   - `artifacts/dark_fantasy/survival_gameplay.png`: 371,275 bytes (> 50KB). Dimensions: 960x540. Confirmed valid PNG displaying active spell VFX across all 5 occult weapons (Arcane Scythe cleave arc, Soul Orbiters skulls, Abyssal Lightning branching arcs, Bone Spear projectile trails, and Cursed Aura ring) with damage flashing.

4. **Bot Steering & Combat Distance Starvation Flaw**:
   - In `tests/e2e/horde_survival.spec.ts:294-374`:
     - `HORIZON = 0.32s`.
     - Skeleton speed is 65 px/s.
     - Arcane Scythe range is 75px.
     - For any candidate keeping enemies within Scythe range (75px), projected future distance `fdist` drops below 72px:
       - `fdist < 72px`: `-40,000 * ((72 - fdist)/72)`
       - `fdist < 52px`: `-200,000 * ((52 - fdist)/52)`
       - `fdist < 34px`: `-1,000,000 * ((34 - fdist)/34)`
     - This creates a mathematical barrier: the bot treats entering weapon range as an unacceptable collision threat and flees outward at 200 px/s, starving the player of enemy kills and soul gems.

5. **`playwright.config.ts:12-17` Port Deadlock**:
   - Config contains:
     ```ts
     webServer: {
       command: 'kill -9 $(lsof -ti :4173) 2>/dev/null || true; npm run build && npm run preview',
       url: 'http://localhost:4173',
       reuseExistingServer: false,
       timeout: 60000,
     },
     ```
   - Because `reuseExistingServer: false`, Playwright probes port 4173 before launching `command`. If an orphaned preview process exists, Playwright aborts immediately with:
     `Error: http://localhost:4173 is already used, make sure that nothing is running on the port/url or set reuseExistingServer:true in config.webServer.`

---

### 1.2 Runtime Verification Results

1. **TypeScript Typecheck**:
   - Command: `npx tsc --noEmit`
   - Result: Exit code 0 (0 errors).

2. **Unit Test Suite**:
   - Command: `npm test`
   - Result: 18 test files passed (18/18), 210 tests passed (210/210) in 2.20s.
   - Includes `tests/unit/ChallengerDF_M2.test.ts:188` JIT warmup (executed in 0.729ms, asserted `< 20.0ms`).

3. **Production Build**:
   - Command: `npm run build`
   - Result: `tsc -b && vite build` bundled 34 modules into `dist/assets/index-Cw4G8LWc.js` (136.01 kB) in 191ms with 0 errors.

4. **Playwright E2E Test Suite (CRITICAL FAILURE)**:
   - Command: `npx playwright test`
   - Result: **FAILED (Exit code 1)**:
     - 4 passed, 5 failed (53.8s total duration).
     - Test 4 (`tests/e2e/horde_survival.spec.ts:62`):
       ```text
       Error: expect(received).toBeGreaterThanOrEqual(expected)
       Expected: >= 10
       Received:    9

         487 |     expect(finalReport.health).toBeGreaterThan(0);
         488 |     expect(finalReport.kills).toBeGreaterThanOrEqual(1);
       > 489 |     expect(finalReport.totalXP).toBeGreaterThanOrEqual(10);
             |                                 ^
         490 |     expect(finalReport.level).toBeGreaterThanOrEqual(2);
         491 |     expect(modalSelectedCount).toBeGreaterThanOrEqual(1);
         492 |     expect(finalReport.isPaused).toBe(false);
           at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:489:33
       ```
     - Telemetry at timeout: `[E2E Survival] t=45.02s | HP=53.0 | Pos=(-212.9, -164.4) | Kills=11 | XP=9 | Lvl=1`
     - Tests 5, 6, 7, 9 failed with: `Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/`
   - Cross-agent verification:
     - Challenger run (`.agents/challenger_df_m4_recheck/run3.log`): FAILED with `totalXP = 5 < 10`
     - Reviewer run (`.agents/reviewer_df_m4_recheck/task-58.log`): FAILED with `totalXP = 7 < 10`
     - Auditor run (`task-151.log`): FAILED with `totalXP = 9 < 10`

---

## 2. Logic Chain

1. **Non-Reproducible Verification Claim**:
   - `worker_df_m4_remed_2` claimed in `handoff.md:93-106` that three consecutive Playwright runs passed 100% green (`Run 1: 9 passed`, `Run 2: 9 passed`, `Run 3: 9 passed`).
   - However, independent execution across three separate agents (Challenger, Reviewer, and Auditor) consistently reproduced E2E test failures with `totalXP = 5..9` (failing `expect(totalXP).toBeGreaterThanOrEqual(10)` and `expect(modalSelectedCount).toBeGreaterThanOrEqual(1)`).
   - Under Forensic Audit rules, work products claiming 100% green pass that fail upon independent empirical verification constitute a failed behavioral verification and integrity violation.

2. **Root Cause Mechanics**:
   - The player moves at 200 px/s, while skeletons move at 65 px/s.
   - Skeletons deal contact damage only within 29px.
   - The steering evaluator penalizes any position where an enemy is within 72px with up to -40,000 points.
   - Because Arcane Scythe only has a 75px reach, the bot cannot engage enemies without triggering danger penalties.
   - Therefore, after the initial spawn, the bot flees outward and maintains distance > 100px.
   - The player starves of combat, collects fewer than 10 XP across 45 seconds, fails to reach Level 2, and fails the test.

3. **Behavioral Verification Failure**:
   - Per Phase 2 (Behavioral Verification), Check 4: "Build the project from source and run its test suite. The build must succeed and tests must execute — a project that doesn't build or whose tests don't run is automatically flagged."
   - Because `npx playwright test` failed with exit code 1, Check 4 has failed.
   - Per Integrity Forensics rules: "If ANY check fails, your verdict is INTEGRITY VIOLATION and the work product must be rejected."

---

## 3. Caveats

- **No Malicious Intent Found**: Static analysis confirms that no intentional mocks, stubs, god-mode, or fake test fixtures were injected into the engine or test suite.
- **Visual Proof Validity**: The screenshot artifacts (`horde_swarm.png`, `level_up_modal.png`, `survival_gameplay.png`) are genuine canvas captures meeting all dimension and size criteria.
- **Unit Suite Robustness**: All 210 unit tests across 18 test files pass cleanly in Vitest.

---

## 4. Conclusion

**Binary Verdict: 🔴 INTEGRITY VIOLATION (REJECT)**

The deliverable fails Phase 2 Behavioral Verification:
1. `npx playwright test` fails with Exit Code 1.
2. The core E2E survival test `tests/e2e/horde_survival.spec.ts:62` fails to achieve Level 2 or collect 10 XP due to combat distance starvation.
3. The claim of "100% Green Pass across 3 consecutive runs" is empirically invalidated.

### Required Remediations for Implementer:
1. **Tune Steering Danger Envelope**:
   - Restrict severe penalties (`-40,000+`) to true collision threat range (`fdist < 38px`, since contact damage radius is only 29px).
   - For `fdist` between 45px and 78px, provide an engagement bonus to keep enemies in the 75px Arcane Scythe cleave arc.
   - Lower the gem attraction clearance guard to `minFutureDist >= 45px` so dropped shards are actively collected.
2. **Prevent Port 4173 Deadlock**:
   - In `playwright.config.ts`, configure `reuseExistingServer: true` or add a `pretest:e2e` script to clean up ports before Playwright probes `url`.

---

## 5. Verification Method

To independently verify this verdict:
```bash
# 1. Clean up port 4173
kill -9 $(lsof -ti :4173) 2>/dev/null || true

# 2. Verify TypeScript typecheck
npx tsc --noEmit
# Result: Exit code 0

# 3. Verify Vitest unit suite
npm test
# Result: 18 passed (18 files), 210 passed (210 tests)

# 4. Verify Production build
npm run build
# Result: Exit code 0

# 5. Verify Playwright E2E suite
npx playwright test
# Result: FAILS with Exit code 1 at tests/e2e/horde_survival.spec.ts:489 (totalXP < 10)
```
