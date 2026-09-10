# Milestone 1 Handoff Report: Restart State Engine & Lifecycle Architecture

**Agent**: `worker_m1_1` (Role: Implementation & Testing Worker)  
**Date**: 2026-09-10T15:43:00Z  
**Target Milestone**: Milestone 1 (Restart State Engine & Lifecycle Architecture)  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_1`

---

## 1. Observation

### 1.1 Direct Pre-Implementation Observations
- In `src/main.ts`, `GrimHarvestGame` previously had NO `restart()` method, NO `destroy()` method, and lacked event wiring for the Game Over prompt `"PRESS [SPACE] OR CLICK TO RESURRECT"` rendered by `GothicHUD.ts` (line 928).
- In `src/main.ts` lines 214–219, `tickFrame()` iterated `while (this.accumulator >= GrimHarvestGame.FIXED_TIMESTEP)` without an upper bound `maxSubSteps`, permitting main-thread freezing and infinite freeze death spirals if delta spikes occurred.
- In `src/core/entities/Player.ts`, there was no `reset()` method; player velocity, dead status (`isAlive`), position, and passives-mutated `stats` persisted indefinitely across sessions.
- In `src/core/HordeManager.ts`, `clear()` called `despawn()`, which invoked `this.totalKilled++`, corrupting kill statistics on game restart. In addition, `totalSpawned` and `totalKilled` counters were never reset to 0.
- In `src/core/SpatialHashGrid.ts`, `clear()` filled `cellHeads` and `entityNext` with -1, but left coordinate caches `entityX` and `entityY` populated with stale values.
- In `src/core/systems/LootManager.ts`, `clear()` popped items into `pool`, but `nextId` was monotonically growing and velocities / attraction flags were never sanitized.
- In `src/core/weapons/WeaponManager.ts`, `clear()` did not purge weapon-specific pools (`BoneSpear.projectilePool`, `ArcaneScythe.activeSlashes`, `SoulOrbiters.skulls`, `AbyssalLightning.activeBolts`, `CursedAura.activeRings`), did not reset `simulationTime` or `hitCooldownBuffer`, and left the player unarmed.
- In `src/ui/UpgradeModal.ts`, `close()` detached listeners but left card bounds, hovered selection, and level intact.

### 1.2 Verbatim Command Outputs
- `npx vitest run tests/unit/restart.spec.ts`:
```
 ✓ tests/unit/restart.spec.ts (20 tests) 122ms
 Test Files  1 passed (1)
      Tests  20 passed (20)
```
- `npm test`:
```
 Test Files  19 passed (19)
      Tests  230 passed (230)
```
- `npx tsc --noEmit`:
```
Exited with code 0. Zero TypeScript diagnostic errors.
```

---

## 2. Logic Chain

1. **Subsystem Reset vs Re-instantiation**:
   - Re-instantiating `GrimHarvestGame` or subsystems would orphan external references (`weaponManager.player`, `upgradeSystem.player`), leak event listeners, and lose progression callbacks.
   - Implementing in-place `reset()` methods on `Player`, `HordeManager`, `SpatialHashGrid`, `LootManager`, `WeaponManager`, `UpgradeSystem`, and `UpgradeModal` guarantees O(N) zero-allocation restoration to factory pristine state while preserving object identity and callbacks.

2. **Loop Epoch & Accumulator Clamp**:
   - Adding `public static readonly MAX_SUB_STEPS = 5;` and loop epoch tokens (`this.loopEpoch++`) ensures:
     a) When `restart()` is invoked, any in-flight RAF callback from a prior loop generation is immediately invalidated.
     b) When real-world delta spikes occur (e.g. background tab switching), `tickFrame` runs at most 5 substeps and zeroes `this.accumulator = 0`, mathematically preventing CPU death spirals and tab freezes.

3. **Death Debounce & Resurrection Input Binding**:
   - `canResurrect()` requires `(!this.player.isAlive || this.isVictory) && !this.upgradeModal.getIsOpen() && this.deathTimer >= 0.5`.
   - The 0.5s debounce buffer guarantees that input spamming during the moment of lethal damage does not instantly dismiss the Game Over plaque.
   - Event listeners for `window.keydown` (Space) and `canvas.click`, along with checking `keyboard.getSnapshot()` during `step()`, allow seamless resurrection across keyboard, mouse, and touch inputs.

4. **Kill Counter & Pool Integrity**:
   - `HordeManager.reset()` loops across all 2,048 entities, resets their velocities, HP, and flags to pristine values, restores `freeIndices[i] = i` and `indexInActive[i] = -1`, sets `totalSpawned = 0`, `totalKilled = 0`, and clears `spatialGrid`.
   - This ensures `totalKilled` is never incremented during restart and exactly 2,048 pooled slots are ready for immediate spawn.

---

## 3. Caveats

- **No Caveats on Implementation**: All 8 dispatch requirements were implemented genuinely and verified with zero regressions across the entire test suite.
- **Audio State**: Grim Harvest currently does not execute native HTML5 WebAudio tracks during headless test runs; if audio is expanded in subsequent milestones, `SoundEngine.stopAll()` should be hooked into `restart()`.

---

## 4. Conclusion

Milestone 1 (Restart State Engine & Lifecycle Architecture) is 100% complete:
1. `src/core/entities/Player.ts`: `reset(startX = 0, startY = 0, customStats)` restores kinematics, 100 HP, baseline stats, and Level 1 / 0 XP progression.
2. `src/core/HordeManager.ts`: `reset()` purges all 2,048 entities, zeroes counters (`totalSpawned = 0, totalKilled = 0`), and clears the spatial grid.
3. `src/core/SpatialHashGrid.ts`: `clear()` resets `cellHeads`, `entityNext`, `entityX`, and `entityY` to 0 / -1.
4. `src/core/systems/LootManager.ts`: `reset()` recycles items, sets `nextId = 1`, and sanitizes velocities and attraction state.
5. `src/core/weapons/WeaponManager.ts`: `reset(starterWeaponId = 'scythe', starterRank = 1)` purges sub-weapon pools, active slashes, projectiles, resets timers/buffers, and equips Rank 1 Arcane Scythe.
6. `src/core/systems/UpgradeSystem.ts` & `src/ui/UpgradeModal.ts`: `UpgradeSystem.reset()` supports re-adding starter weapons; `UpgradeModal.reset()` closes modal, clears cards, and detaches listeners.
7. `src/main.ts`: Added `MAX_SUB_STEPS = 5`, accumulator clamp guard, `canResurrect()` with 0.5s debounce, Space/click resurrection handlers, and `restart()` orchestrating the complete lifecycle.
8. `tests/unit/restart.spec.ts`: 20 unit tests covering all 8 verification areas pass 100% green.

---

## 5. Verification Method

### 5.1 Commands to Verify
```bash
# 1. Run the dedicated restart test suite
npx vitest run tests/unit/restart.spec.ts

# 2. Run the entire unit test suite (assert 19 files, 230 tests passed)
npm test

# 3. Verify 100% TypeScript type safety
npx tsc --noEmit
```

### 5.2 Files to Inspect
- `src/core/entities/Player.ts`: `public reset(...)` (lines 94–125)
- `src/core/HordeManager.ts`: `public reset()` (lines 467–487)
- `src/core/SpatialHashGrid.ts`: `public clear()` (lines 74–79)
- `src/core/systems/LootManager.ts`: `public reset()` (lines 277–290)
- `src/core/weapons/WeaponManager.ts`: `public reset(...)` (lines 220–250)
- `src/core/systems/UpgradeSystem.ts`: `public reset(...)` (lines 324–332)
- `src/ui/UpgradeModal.ts`: `public reset()` (lines 78–86)
- `src/main.ts`: `MAX_SUB_STEPS`, `start()`, `stop()`, `canResurrect()`, `restart()`, `step()` (lines 35, 226–396)
- `tests/unit/restart.spec.ts`: 20 test specifications across 8 suites

### 5.3 Invalidation Conditions
- Any occurrence of `totalKilled` increasing upon restart.
- Any residual active enemies or loot gems surviving into the restarted session.
- Any unbounded while-loop execution in `start()` when `accumulator` spikes.
- Any TypeScript compilation errors or Vitest test failures.
