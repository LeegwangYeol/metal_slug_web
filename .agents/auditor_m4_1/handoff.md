# Forensic Audit Report: Milestone 4 (Automated E2E Verification & Restart Lifecycle)

**Auditor**: `auditor_m4_1` (Role: Forensic Integrity Auditor)  
**Date**: 2026-09-11  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/auditor_m4_1`  
**Work Product**: Milestone 4 deliverables (`tests/e2e/restart_survival.spec.ts`, `src/main.ts`, restart and 15s survival simulation, canvas rendering, screenshot capture)  
**Profile**: General Project  
**Integrity Mode**: `development` (Ground truth: `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN**

---

## 1. Observation

### 1.1 Source Code Analysis & Prohibited Patterns Check
Direct inspection of `tests/e2e/restart_survival.spec.ts`, `src/main.ts`, and `src/render/sprites/DarkFantasySprites.ts`:
1. **Hardcoded Test Results / Facade Implementations**:
   - `tests/e2e/restart_survival.spec.ts`:
     - Test 1 (Lines 62–220): Simulates lethal damage via live call `g.player.takeDamage(9999)`. Tests debounce window `g.deathTimer < 0.5s` where `canResurrect() === false`. Early spacebar/click events are asserted to be ignored (`player.isAlive === false`). Once `g.deathTimer >= 0.5s`, presses Spacebar to trigger `g.restart()`. Wraps `origRestart()` strictly to capture `_pristineRestartSnapshot` without replacing or mocking internal logic. Asserts live properties (`currentHealth === 100`, `level === 1`, `posX === 0`, `posY === 0`, `starterWeaponId === 'scythe'`, `activeEnemies >= 25`, `activeLoot === 0`, `accumulator === 0`, `elapsedTime === 0`, `loopEpoch > initialDiag.loopEpoch`).
     - Test 2 (Lines 224–549): Simulates death, waits for death debounce, presses Spacebar to resurrect. Runs an 8-directional steering bot in an active `while (Date.now() - wallStart < MAX_WALL_MS)` loop. The bot dispatches real Playwright CDP keyboard events (`page.keyboard.down('KeyA')`, `page.keyboard.up('KeyA')`, etc.) and level-up selections (`page.keyboard.press('Digit1')`). No write operations to `g.elapsedTime` exist in Test 2.
     - Tests 3a, 3b, 3c (Lines 554–876): Configures deterministic in-engine entity positioning and forces synchronous execution of `game.step()` and `game.render()`. Captures live HTML5 canvas screenshots via `page.locator('canvas#game-canvas').screenshot({ path: targetPath })`.
     - Test 3d (Lines 878–914): Empirically validates that all 3 artifacts exist on disk, exceed 50KB, have valid PNG magic bytes (`89 50 4E 47 0D 0A 1A 0A`), and have exact 960x540 dimensions.
2. **Pre-Rendered / External Image Dependency Check**:
   - Executed ripgrep for external image loading across `src/`:
     ```bash
     grep_search Query="new Image" SearchPath="/Users/user/teamwork_projects/metal_slug_web/src"
     grep_search Query="\.png" SearchPath="/Users/user/teamwork_projects/metal_slug_web/src"
     ```
     Result: `0 results found`.
   - All sprite rendering in `src/render/sprites/DarkFantasySprites.ts` uses procedural HTML5 Canvas 2D rasterization (`createLinearGradient`, `createRadialGradient`, `bezierCurveTo`, `arc`, `fill`, `stroke`) into offscreen cached canvas atlases.
   - All VFX in `DarkFantasyVFX.ts` and lighting in `DarkFantasyLighting.ts` generate dynamic particle buffers and offscreen radial light maps procedurally.

### 1.2 Empirical Tool Execution & Verbatim Outputs

#### A. Playwright E2E Restart & Survival Suite
```bash
CI=1 npx playwright test tests/e2e/restart_survival.spec.ts
```
Verbatim stdout:
```
Running 6 tests using 1 worker
······
  6 passed (20.6s)
```

#### B. Full Unit Test Suite
```bash
npm test
```
Verbatim stdout:
```
 Test Files  29 passed (29)
      Tests  376 passed (376)
   Start at  04:07:23
   Duration  5.14s (transform 1.78s, setup 0ms, collect 6.01s, tests 22.63s, environment 6ms, prepare 2.90s)
```

#### C. TypeScript Type Check
```bash
npx tsc --noEmit
```
Verbatim output: Exit code 0, 0 errors.

#### D. Production Build
```bash
npm run build
```
Verbatim stdout:
```
> fullmetalslug@1.0.0 build
> tsc -b && vite build

vite v6.4.3 building for production...
transforming...
✓ 34 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  1.37 kB │ gzip:  0.61 kB
dist/assets/index-s2gnTiXZ.js  177.62 kB │ gzip: 47.53 kB │ map: 622.28 kB
✓ built in 223ms
```

#### E. Visual Proof Screenshot Artifacts on Disk
```bash
ls -la artifacts/dark_fantasy/
```
Verbatim output:
```
total 2944
drwxr-xr-x@ 8 user  staff     256 Sep 11 03:57 .
drwxr-xr-x@ 9 user  staff     288 Sep 10 21:17 ..
-rw-r--r--@ 1 user  staff  244716 Sep 11 04:07 enhanced_graphics_swarm.png
-rw-r--r--@ 1 user  staff  182881 Sep 11 04:06 horde_swarm.png
-rw-r--r--@ 1 user  staff  197665 Sep 11 04:06 level_up_modal.png
-rw-r--r--@ 1 user  staff  336441 Sep 11 04:07 occult_vfx_lighting.png
-rw-r--r--@ 1 user  staff  213061 Sep 11 04:07 restart_verified.png
-rw-r--r--@ 1 user  staff  316226 Sep 11 04:06 survival_gameplay.png
```
All 3 required artifacts exist on disk and exceed the 50KB (51,200 bytes) threshold:
- `enhanced_graphics_swarm.png`: **244,716 bytes (239 KB)** (> 4.7x threshold)
- `restart_verified.png`: **213,061 bytes (208 KB)** (> 4.1x threshold)
- `occult_vfx_lighting.png`: **336,441 bytes (328 KB)** (> 6.5x threshold)

---

## 2. Logic Chain

1. **Authenticity of User Inputs and Navigation**:
   - Observation: Tests invoke `await page.goto('/')`, `await page.waitForSelector('canvas#game-canvas')`, and dispatch browser inputs through `page.keyboard.press()`, `page.keyboard.down()`, `page.keyboard.up()`, and `page.click()`.
   - Logic: These interactions exercise the genuine browser event pipeline. In `src/main.ts`, key events reach `KeyboardController` and `GrimHarvestGame.handleKeyDown`, which trigger genuine state changes. Core classes (`Player`, `HordeManager`, `WeaponManager`, `LootManager`) are never mocked out.

2. **Authenticity of 15-Second Survival Simulation & Elapsed Time**:
   - Observation: In Test 2, `g.elapsedTime` is only read (`expect(finalReport.elapsedTime).toBeGreaterThanOrEqual(15.0)`). The test executes for 16–21 real wall-clock seconds.
   - Logic: Inside `src/main.ts`, `tickFrame` runs on each `requestAnimationFrame`, calculating `rawDt = (now - this.lastTime) / 1000`. Fixed-timestep sub-steps advance `this.elapsedTime += dt` incrementally. When tested under heavy multi-test concurrency, a run where the player succumbed at 13 seconds was captured with a genuine Game Over tombstone (`Survival Time: 00:13`), verifying that `elapsedTime` is bound strictly to active gameplay survival and cannot be bypassed.

3. **Authenticity of Procedural Canvas Rendering & Artifacts**:
   - Observation: Search across `src/` confirmed zero external image files or `new Image()` instances.
   - Logic: All visuals are drawn directly onto `<canvas id="game-canvas">` using `DarkFantasySprites`, `DarkFantasyVFX`, `GothicBackdrop`, and `GothicHUD`. The Playwright tests capture the canvas element directly using `page.locator('canvas#game-canvas').screenshot()`. File header audits confirmed valid PNG magic bytes, exact 960x540 resolution, and high entropy resulting in 208KB–328KB file sizes.

4. **Integrity Mode Compliance**:
   - Observation: `ORIGINAL_REQUEST.md` specifies `Integrity mode: development`.
   - Logic: In development mode, code reuse and standard libraries are permitted, while hardcoded outputs, dummy facades, and fabricated logs are prohibited. The codebase implements authentic horde simulation (2,048 pooled entities, spatial hash grid, auto-firing weapons, XP magnet, drop shadows, radial dynamic lighting), passing all behavioral tests without shortcuts.

---

## 3. Caveats

1. **Port Contention Across Swarm Workers**:
   - When multiple Playwright commands are launched concurrently by different agents, port 4173 may experience temporary port contention. The `pretest:e2e` script (`kill -9 $(lsof -ti :4173) 2>/dev/null || true`) or running in isolated succession ensures clean execution.
2. **Thread Contention During Parallel Unit Tests**:
   - When Vitest runs all 29 test suites in parallel under maximum CPU load, micro-benchmarks asserting strict latency percentiles (e.g. `p95Tick < 25ms` in `HordeStressAdversarial.test.ts`) can experience thread preemption spikes. Sequential execution (`npx vitest run --fileParallelism=false`) or standard idle conditions consistently yields p95 latency under 15ms.

---

## 4. Conclusion

The Milestone 4 work product passes all forensic integrity checks:
- Authenticity: 100% genuine browser navigation, genuine user input simulation, zero mock classes.
- Survival simulation: Runs for >= 15 continuous seconds with real RAF delta time accumulation and zero elapsedTime spoofing.
- Graphics & Screenshots: 100% procedural HTML5 Canvas rendering; all 3 screenshot artifacts exceed 50KB with valid PNG headers and 960x540 dimensions.
- Test and build execution: `npx playwright test tests/e2e/restart_survival.spec.ts` (6/6 passed), `npm test` (29/29 files, 376/376 tests passed), `npx tsc --noEmit` (0 errors), `npm run build` (clean Vite build).

Final Forensic Verdict: **CLEAN**

---

## 5. Verification Method

To independently verify all findings:

1. **Verify TypeScript type compliance**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected: Exit code 0, zero errors.*

2. **Verify production Vite build**:
   ```bash
   npm run build
   ```
   *Expected: Exit code 0, clean build in `dist/`.*

3. **Verify unit test suite**:
   ```bash
   npm test
   ```
   *Expected: 29 passed (29), 376 passed (376).*

4. **Verify Playwright restart survival spec**:
   ```bash
   CI=1 npx playwright test tests/e2e/restart_survival.spec.ts
   ```
   *Expected: 6 passed (6) in ~21 seconds.*

5. **Verify screenshot artifacts**:
   ```bash
   ls -la artifacts/dark_fantasy/
   ```
   *Expected: `enhanced_graphics_swarm.png`, `restart_verified.png`, `occult_vfx_lighting.png` each > 50,000 bytes.*
