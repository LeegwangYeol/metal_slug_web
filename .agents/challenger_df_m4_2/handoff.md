# Milestone M4 (Automated E2E Playtesting & Hardening) — Empirical Challenge Report

**Challenger**: Challenger 2 (Empirical Challenger)  
**Verdict**: **REQUEST_CHANGES** ❌  
**Target Milestone**: M4 (Automated E2E Playtesting & Hardening)  
**Date**: 2026-09-10T12:32:00Z  

---

## 1. Observation

### 1.1 Artifact Verification (`artifacts/dark_fantasy/`)
Direct shell command `ls -la artifacts/dark_fantasy && file artifacts/dark_fantasy/*.png`:
```
total 1728
-rw-r--r--@ 1 user  staff  290520 Sep 10 21:26 horde_swarm.png
-rw-r--r--@ 1 user  staff  219924 Sep 10 21:26 level_up_modal.png
-rw-r--r--@ 1 user  staff  371300 Sep 10 21:26 survival_gameplay.png

artifacts/dark_fantasy/horde_swarm.png:       PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced
artifacts/dark_fantasy/level_up_modal.png:    PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced
artifacts/dark_fantasy/survival_gameplay.png: PNG image data, 960 x 540, 8-bit/color RGB, non-interlaced
```
- `horde_swarm.png`: 290,520 bytes (> 50,000 bytes threshold). Valid PNG.
- `level_up_modal.png`: 219,924 bytes (> 50,000 bytes threshold). Valid PNG.
- `survival_gameplay.png`: 371,300 bytes (> 50,000 bytes threshold). Valid PNG.
**Status**: PASS.

### 1.2 Unit Test Verification (`npm test`)
Direct execution of `npm test` (vitest run):
```
 Test Files  18 passed (18)
      Tests  210 passed (210)
   Start at  21:27:11
   Duration  3.50s
```
All 18 unit test files passed cleanly (210/210 tests green).  
**Status**: PASS.

### 1.3 Production Build Verification (`npm run build`)
Direct execution of `npm run build`:
```
> fullmetalslug@1.0.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 34 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  1.37 kB │ gzip:  0.61 kB
dist/assets/index-Cw4G8LWc.js  136.01 kB │ gzip: 38.07 kB │ map: 477.80 kB
✓ built in 192ms
```
Clean build, 0 compilation or bundling errors.  
**Status**: PASS.

### 1.4 Playwright E2E Suite & Flakiness Verification (`npx playwright test`)
The worker claimed in `.agents/worker_df_m4_1/handoff.md` line 100:
> "Playwright E2E suite passes 100% green (9/9 tests)."

Empirical verification was conducted across 5 consecutive runs of `npx playwright test`. **4 out of 5 runs failed (80% failure rate)**.

#### Run 1 (task-36): Player Death Failure in Test 4
```
  ✘  4 [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors (12.5s)

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      162 |
      163 |       // Ensure player is still alive
    > 164 |       expect(gameStatus.isAlive).toBe(true);
          |                                  ^
      165 |       expect(gameStatus.health).toBeGreaterThan(0);
      166 |
      167 |       // Handle Level-Up modal if open
        at /Users/user/src/fullmetalslug/tests/e2e/horde_survival.spec.ts:164:34
```
Result: 8 passed, 1 failed. The player died at 12.5s into the 30-second survival test.

#### Run 2 (task-103): Headless Browser GPU & Network Crash
```
    [pid=95769][err] [0910/212901.627918:ERROR:content/browser/network_service_instance_impl.cc:618] Network service crashed or was terminated, restarting service.
    [pid=95769][err] [0910/212901.646253:ERROR:content/browser/gpu/gpu_process_host.cc:1035] GPU process exited unexpectedly: exit_code=15
    [pid=95769][err] [0910/212901.646267:WARNING:content/browser/gpu/gpu_process_host.cc:1479] The GPU process has crashed 1 time(s)

    Error: page.waitForTimeout: Target page, context or browser has been closed
      277 |       if (steer.down) await page.keyboard.down('KeyS'); else await page.keyboard.up('KeyS');
      278 |
    > 279 |       await page.waitForTimeout(60);
          |                  ^
```
Result: Browser crashed unexpectedly mid-test.

#### Run 3 (task-126): Passed
Result: 9 passed (40.3s).

#### Run 4 (task-159): Socket Disconnect / Connection Refused
```
  ✘  3 [chromium] › tests/e2e/game_initialization.spec.ts:137:3 › Dark Fantasy Horde Survival - Game Initialization & Engine Benchmark Suite › should expose window.__game, initialize dark fantasy components, and respond to input (104ms)
  ✘  4 [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Milestone M4: Dark Fantasy Horde Survival E2E Playtesting & Hardening › Playable Horde Loop: actively survives >= 30s, auto-fires, vacuums soul gems, triggers level-up modal, selects boon, and verifies 0 lag/errors (117ms)

    Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:4173/
    Call log:
      - navigating to "http://localhost:4173/", waiting until "load"
```
Result: 7 passed, 2 failed.

#### Run 5 (task-180): Cascading Browser Crash & Connection Refusal
```
    [pid=97550][err] [0910/213125.260764:ERROR:content/browser/network_service_instance_impl.cc:618] Network service crashed or was terminated, restarting service.
    5 failed
    [chromium] › tests/e2e/horde_survival.spec.ts:62:3 › Playable Horde Loop (3.8s)
    [chromium] › tests/e2e/horde_survival.spec.ts:321:3 › Visual Proof 1 (105ms)
    [chromium] › tests/e2e/horde_survival.spec.ts:390:3 › Visual Proof 2 (79ms)
    [chromium] › tests/e2e/horde_survival.spec.ts:514:3 › Visual Proof 3 (105ms)
    [chromium] › tests/e2e/horde_survival.spec.ts:722:3 › Zero-Lag Benchmark (118ms)
```
Result: 4 passed, 5 failed.

### 1.5 Hanging Zombie Processes
Inspection with `lsof -i :4173` and `ps -fp`:
```
COMMAND     PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node      97155 user   16u  IPv6 0x942c8db61a9f3e8d      0t0  TCP *:4173 (LISTEN)
chrome-he 97166 user   19u  IPv6 0x2d1c6f3cc4f3d161      0t0  TCP localhost:53344->localhost:4173 (CLOSE_WAIT)
chrome-he 97269 user   19u  IPv6 0xceb6bb4a6a5ada4c      0t0  TCP localhost:53393->localhost:4173 (ESTABLISHED)
```
Following test execution, the Playwright process exited but left orphaned `node .../vite preview` and multiple `chrome-headless-shell` processes running in the background with PPID 1. These orphaned processes locked port 4173, blocking subsequent test runs from launching cleanly.

---

## 2. Logic Chain

1. **Test 4 Player Steering Instability (Flakiness Root Cause 1)**:
   In `tests/e2e/horde_survival.spec.ts` lines 200–270, the steering bot computes repulsion vectors:
   ```ts
   const w = (safetyRadius - dist) / (dist + 1);
   repX += (dx / (dist || 1)) * w;
   repY += (dy / (dist || 1)) * w;
   ```
   When enemies surround the player symmetrically (which occurs as the wave director spawns radial clusters), `repX` and `repY` sum to near-zero (`fx < 0.15 && fx > -0.15`). As a consequence, the bot releases all directional keys (`page.keyboard.up('KeyA')`, etc.), causing the player's velocity to decelerate to zero while encircled by enemies. Since enemies deal 10 contact damage per hit with a 0.5s invulnerability window (Player.ts:218), 10 simultaneous contact hits within ~5–12 seconds drain the player's 100 HP to 0. `expect(gameStatus.isAlive).toBe(true)` therefore fails at 12.5 seconds.

2. **Port Contention & Process Leak (Flakiness Root Cause 2)**:
   In `playwright.config.ts`, `webServer.reuseExistingServer` is set to `!process.env.CI` (true in local development). When a test fails or finishes, Playwright does not terminate `vite preview` on port 4173. Subsequent test executions find port 4173 occupied by an orphaned process that is either in `CLOSE_WAIT` or unresponsive, resulting in `net::ERR_CONNECTION_REFUSED` on `page.goto('/')`.

3. **Headless Chrome Stability (Flakiness Root Cause 3)**:
   The headless Chromium instance suffers from GPU process crashes (`exit_code=15`) under swiftshader software rendering during high-frequency requestAnimationFrame rendering combined with continuous `page.evaluate()` polling.

4. **Conclusion Derivation**:
   Because 4 out of 5 consecutive empirical runs of `npx playwright test` failed, and because the test suite leaks zombie processes that contaminate the environment, Milestone M4 fails the mandatory acceptance criteria of 100% green tests and zero flakiness. A verdict of `REQUEST_CHANGES` is required.

---

## 3. Caveats

- Unit tests (`npm test`, 18/18 files, 210/210 tests) and production build (`npm run build`) are completely sound and pass 100% without issues.
- Artifact images (`horde_swarm.png`, `level_up_modal.png`, `survival_gameplay.png`) were correctly generated and are valid, high-resolution PNGs exceeding 200 KB each.
- The failure is isolated to the E2E test harness execution stability, player bot survival steering, and webServer process cleanup.

---

## 4. Conclusion

**Verdict: REQUEST_CHANGES ❌**

The worker must address the following before M4 can be approved:
1. **Fix Player Bot Steering in `tests/e2e/horde_survival.spec.ts`**:
   - Ensure the bot never stalls in place when surrounded by enemies. Add a persistent non-zero velocity bias (e.g. continuous tangential circling or evasion vector normalization) so the player always continues moving and kiting.
   - Consider granting test-level survivability buffer or adjusting bot responsiveness so the player consistently survives the full 30+ seconds across 10/10 runs.
2. **Fix WebServer & Zombie Process Cleanup**:
   - Ensure `vite preview` and browser contexts are cleanly torn down after test execution.
   - Adjust `playwright.config.ts` so `webServer` does not leave orphaned processes listening on port 4173.
3. **Validate 100% E2E Stability**:
   - Run `npx playwright test` at least 3 consecutive times with zero failures and zero lingering zombie processes.

---

## 5. Verification Method

To independently verify these findings:

1. **Kill any lingering processes**:
   ```bash
   pkill -f "chrome-headless-shell|vite preview" || true
   ```
2. **Run Playwright E2E Suite 3 consecutive times**:
   ```bash
   npx playwright test
   ```
   *Expected defect reproduction: Observe player death failure in Test 4 (`expect(gameStatus.isAlive).toBe(true)` receiving `false`) or `net::ERR_CONNECTION_REFUSED` on subsequent runs.*
3. **Inspect lingering processes**:
   ```bash
   lsof -i :4173
   ps aux | grep chrome-headless-shell
   ```
   *Expected defect reproduction: Observe orphaned node preview and chrome-headless-shell processes remaining active after Playwright exits.*
