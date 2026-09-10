# Milestone 1 Adversarial Challenge Report: Restart State Engine & Lifecycle Architecture

**Agent**: `challenger_m1_1` (Role: Adversarial Verifier / Challenger)  
**Date**: 2026-09-10T15:49:30Z  
**Verdict**: **APPROVE**  
**Target Milestone**: Milestone 1 (Restart State Engine & Lifecycle Architecture)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1`

---

## 1. Observation

### 1.1 Direct Pre-Challenge & Implementation Observations
- In `src/main.ts` (lines 35, 233–274):
  - `public static readonly MAX_SUB_STEPS = 5;`
  - `tickFrame` clamps incoming time delta: `const dt = Math.max(0, Math.min(rawDt, 0.1));`
  - Accumulator loop enforces `subSteps < GrimHarvestGame.MAX_SUB_STEPS;`
  - If `subSteps >= GrimHarvestGame.MAX_SUB_STEPS`, `this.accumulator = 0;` resets residual debt, preventing CPU freeze spirals.
  - `start()` generates a unique `loopEpoch` (`this.loopEpoch++`), immediately invalidating stale RAF callbacks from previous sessions.
  - `restart()` (lines 319–381) coordinates teardown (`stop()`), clock zeroing (`elapsedTime = 0`, `killCount = 0`, `deathTimer = 0`, `accumulator = 0`), subsystem purges (`upgradeModal.reset()`, `player.reset(0, 0)`, `hordeManager.reset()`, `lootManager.reset()`, `weaponManager.reset('scythe', 1)`, `upgradeSystem.reset('weapon_scythe', 1)`, `waveDirector.reset()`, `camera.reset(0, 0)`, `vfx.clear()`, `hud.reset()`, input reset), and re-deploys the pristine 35-enemy initial wave (`spawnInitialSwarm()`).
  - `canResurrect()` (lines 290–296) requires `(!this.player.isAlive || this.isVictory) && !this.upgradeModal.getIsOpen() && this.deathTimer >= 0.5`.

- In `src/core/progression/PlayerProgression.ts` (lines 56–61, 101–106):
  - `reset()` resets `level = 1`, `currentXP = 0`, `totalXP = 0`, and recalculates `xpToNextLevel`.
  - Critically, `reset()` preserves `this.listeners` registered during game bootstrap, ensuring player level-up events continue to open the upgrade modal in restarted sessions.

- In `src/render/Camera.ts` (lines 76–79, 85–97, 106–120):
  - Viewport dimensions: 960x540.
  - `deadzoneLeft = Math.floor(960 * 0.35) = 336`, `deadzoneTop = Math.floor(540 * 0.30) = 162`.
  - When camera is reset and updated against player origin (0, 0) with `dt = 0`, `Camera.update` snaps camera to `(-336, -162)`, ensuring the player at (0, 0) is positioned inside the deadzone margins with zero trauma offset.

### 1.2 Verbatim Test & Stress Harness Results
- Executed dedicated adversarial challenge suite (`tests/unit/ChallengerRestartEngine_M1_1.test.ts`):
```
 RUN  v3.2.7 /Users/user/src/fullmetalslug

 ✓ tests/unit/ChallengerRestartEngine_M1_1.test.ts (9 tests) 181ms
 Test Files  1 passed (1)
      Tests  9 passed (9)
```

- Executed worker restart test suite (`tests/unit/restart.spec.ts`):
```
 ✓ tests/unit/restart.spec.ts (20 tests) 116ms
 Test Files  1 passed (1)
      Tests  20 passed (20)
```

- Executed complete unit test suite (`npm test`):
```
 Test Files  21 passed (21)
      Tests  247 passed (247)
   Duration  2.15s
```

- Executed TypeScript compiler type-check (`npx tsc --noEmit`):
```
Exited with code 0. Zero diagnostic errors.
```

- Executed production build verification (`npm run build`):
```
vite v6.4.3 building for production...
transforming...
✓ 34 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                  1.37 kB │ gzip:  0.61 kB
dist/assets/index-BjuBYfx0.js  141.01 kB │ gzip: 38.97 kB │ map: 492.45 kB
✓ built in 193ms
```

- Executed Playwright E2E initialization check (`npx playwright test tests/e2e/game_initialization.spec.ts`):
```
  3 passed (8.3s)
```

---

## 2. Logic Chain

1. **50 Consecutive Restarts Under High Churn Stress (Dispatch Requirement 1.1)**:
   - *Observation*: Tested in `ChallengerRestartEngine_M1_1.test.ts` Objective 1 over 50 consecutive iterations. In each iteration:
     - 4 weapons were equipped and ranked up (orbiters, spear, lightning, aura).
     - 4 horde waves were spawned across various quadrants (30 skeletons, 20 ghouls, 15 banshees, 5 death knights).
     - 20 loot drops were spawned across world coordinates.
     - 25 simulation ticks were executed with active movement, dealing damage to the player and enemies.
     - `game.restart()` was invoked.
   - *Logic*:
     - Across all 50 cycles, zero unhandled rejections or crashes occurred.
     - All player and enemy coordinates remained strictly finite and non-NaN (`Number.isNaN === false`, `Number.isFinite === true`).
     - Entity pool invariants held perfectly: active horde was reset to exactly 35 (`totalSpawned = 35`, `totalKilled = 0`, `freePool = 2013`), active loot items were purged to 0, active weapon projectiles purged to 0, and player restored to 100/100 HP at (0, 0).
     - Heap growth across all 50 cycles remained strictly bounded with zero runaway memory leaks (`heapGrowthMB < 35MB`).
     - A stress test firing 15 rapid consecutive restart calls in 0ms was verified to execute without state corruption or duplicate loop proliferation.

2. **Accumulator Spikes & `MAX_SUB_STEPS` Clamping (Dispatch Requirement 1.2)**:
   - *Observation*: Tested in `ChallengerRestartEngine_M1_1.test.ts` Objective 2 with delta spikes ranging from 16.6ms up to 100,000ms (100 seconds).
   - *Logic*:
     - In `main.ts`, `rawDt` is capped at `0.1s`, and the while loop condition enforces `subSteps < GrimHarvestGame.MAX_SUB_STEPS (5)`.
     - When simulated lag spikes of 100 seconds occurred, `stepCalls` was strictly capped at 5 (`MAX_SUB_STEPS`).
     - Main thread execution time was instantaneous (< 5ms), verifying zero thread freeze.
     - Residual accumulator debt was cleared to 0 via `if (subSteps >= GrimHarvestGame.MAX_SUB_STEPS) this.accumulator = 0;`.
     - The subsequent normal frame (16.67ms) executed exactly 1 step without backlog lag or catch-up death spirals.
     - Tested delta progression across 16.6ms (1 step), 33.3ms (2 steps), 50.0ms (3 steps), 66.7ms (4 steps), 83.3ms (5 steps), and >=100ms (clamped to 5 steps).
     - Tested anomalous timestamps: negative delta (backwards clock) resulted in 0 steps, zero delta resulted in 0 steps, all without NaN or crashes.

3. **Multi-Cycle Death & Restart Invariant Preservation (Dispatch Requirement 1.3)**:
   - *Observation*: Tested in `ChallengerRestartEngine_M1_1.test.ts` Objective 3 over the sequence: Pristine Baseline S0 -> Lethal Damage -> Debounce Wait -> Restart 1 -> 100 Simulation Ticks -> Lethal Damage -> Debounce Wait -> Restart 2.
   - *Logic*:
     - Baseline S0 established: Player HP=100/100, Pos=(0,0), Level=1, XP=0, Active Horde=35, Equipped Weapons=1 (Scythe Rank 1), Loot=0, WavePhase=AWAKENING, Camera=(-336, -162).
     - After Restart 1, all invariants matched S0.
     - Advancing 100 ticks mutated the state: player moved right, attacks cleaved enemies, loot spawned and was magnetized, XP accumulated.
     - After taking lethal damage and triggering Restart 2, the post-restart state was asserted against S0 across all subsystems:
       - `player.isAlive === true`, `player.stats.currentHealth === 100`, `player.stats.maxHealth === 100`, `player.level === 1`, `player.currentXP === 0`, `player.position === (0,0)`, `player.velocity === (0,0)`.
       - `hordeManager.getActiveCount() === 35`, `hordeManager.totalKilled === 0`, `hordeManager.totalSpawned === 35`, `hordeManager.getPoolAvailableCount() === 2013`.
       - `lootManager.getActiveCount() === 0`.
       - `weaponManager.getEquippedCount() === 1`, `weaponManager.projectilePool.getActiveCount() === 0`, `weaponManager.hasWeapon('scythe') === true`.
       - `waveDirector.elapsedTime === 0`, `waveDirector.getCurrentPhase().id === AWAKENING`, `waveDirector.getHPMultiplier() === 1.0`.
       - `camera.x === -336`, `camera.y === -162`, `camera.renderX === -336`, `camera.renderY === -162`, `camera.shakeIntensity === 0`.
       - `elapsedTime === 0`, `deathTimer === 0`, `killCount === 0`, `isPaused === false`, `isVictory === false`.
     - 100% exact mathematical and empirical equivalence between S0 and S2 confirmed.

4. **Edge Case & Adversarial Input Robustness**:
   - *Debounce Buffer*: In `canResurrect()`, `deathTimer >= 0.5` strictly prevented resurrection when key inputs (Space/Jump) were spammed during the 0.5s death animation window. Once `deathTimer >= 0.5s`, resurrection succeeded on the next input.
   - *Progression Callback Retention*: `PlayerProgression.reset()` preserved event listeners, allowing XP gained after restart to trigger `handlePlayerLevelUp`, pause simulation (`isPaused = true`), and open `UpgradeModal`.
   - *Victory Condition Reset*: `isVictory = true` was verified to cleanly reset to `false` upon restart.

---

## 3. Caveats

- **No Caveats on Milestone 1 Scope**: All core restart engine requirements, state resets, clamp protections, and invariant preservation were rigorously verified and passed with 100% green tests.
- **Audio Teardown**: Grim Harvest currently does not initialize native HTML5 WebAudio audio nodes in headless Node/Vitest environments. When audio is expanded in subsequent milestones, ensure `SoundEngine.stopAll()` is called in `restart()`.

---

## 4. Conclusion

**Verdict: APPROVE**

The Milestone 1 Restart State Engine & Lifecycle Architecture implemented by `worker_m1_1` is empirically verified, robust under heavy churn, memory-safe, and fully resilient against accumulator spikes and rapid input spam:
1. **50 Consecutive Restarts**: 0 crashes, 0 NaNs, 0 infinite loops, and bounded memory heap across 50 full mutation-restart cycles.
2. **Accumulator Guard**: `MAX_SUB_STEPS = 5` clamp strictly bounds CPU execution to < 5ms under multi-second delta spikes, preventing browser tab freezing.
3. **Exact State Invariants**: Exact starting state (S0) is restored with 100% fidelity after multiple death/restart cycles.
4. **Test Integrity**: All 21 Vitest files (247 tests) pass cleanly (100% green), `npx tsc --noEmit` produces 0 diagnostic errors, and `npm run build` generates a clean production bundle.

Milestone 1 is ready to be locked and passed to Milestone 2.

---

## 5. Verification Method

### 5.1 Commands to Verify
```bash
# 1. Run the dedicated challenger adversarial suite (assert 9 passed)
npx vitest run tests/unit/ChallengerRestartEngine_M1_1.test.ts

# 2. Run the worker restart suite (assert 20 passed)
npx vitest run tests/unit/restart.spec.ts

# 3. Run the full unit test suite (assert 21 test files, 247 tests passed)
npm test

# 4. Verify 100% TypeScript type safety
npx tsc --noEmit

# 5. Verify production build
npm run build
```

### 5.2 Files to Inspect
- `tests/unit/ChallengerRestartEngine_M1_1.test.ts`: 9 empirical challenge specifications covering 50 restarts, accumulator clamps, invariant preservation, and edge cases.
- `src/main.ts`: lines 35, 233–274 (`MAX_SUB_STEPS`, accumulator clamp, loopEpoch), lines 290–296 (`canResurrect`), lines 319–381 (`restart`).
- `src/core/entities/Player.ts`: `reset()` (lines 94–125).
- `src/core/HordeManager.ts`: `reset()` (lines 467–487).
- `src/core/SpatialHashGrid.ts`: `clear()` (lines 74–79).
- `src/core/systems/LootManager.ts`: `reset()` (lines 277–290).
- `src/core/weapons/WeaponManager.ts`: `reset()` (lines 220–250).
- `src/core/systems/UpgradeSystem.ts`: `reset()` (lines 324–332).
- `src/ui/UpgradeModal.ts`: `reset()` (lines 78–86).

### 5.3 Invalidation Conditions
- Any occurrence of `accumulator` remaining non-zero after a `MAX_SUB_STEPS` clamp event.
- Any memory leak where heap growth exceeds 35MB across 50 restart cycles.
- Any NaN or undefined values in entity kinematics following restart.
- Any non-zero kill tally or residual entities present immediately following `game.restart()`.
