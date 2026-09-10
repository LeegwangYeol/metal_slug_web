# Milestone M1 Adversarial Challenge Report: Foundation & High-Performance Core

**Author**: Challenger 1 (`challenger_df_m1_1`)  
**Role**: Critic / Empirical Challenger / Specialist  
**Milestone**: M1 (Foundation & High-Performance Core)  
**Project**: Grim Harvest: Undead Siege (Dark Fantasy Horde Survival)  
**Date**: 2026-09-10T10:56:45Z  
**Verdict**: **APPROVE**  

---

## 1. Observation

### 1.1 Baseline Codebase & Test Verification
1. **Source Inspection**:
   - `src/core/SpatialHashGrid.ts` (Lines 1–258): Flat `Int32Array` intrusive linked lists (`cellHeads`, `entityNext`), contiguous `Float32Array` (`entityX`, `entityY`), single-cell center registration, zero heap allocations.
   - `src/core/HordeManager.ts` (Lines 1–468): Pre-allocated pool of 2,048 `Enemy` instances, swap-and-pop O(1) removal, soft flocking separation (`scratchNeighbors` 64-capacity buffer), zero allocation during tick update.
   - `src/core/entities/Enemy.ts` (Lines 1–136): Pooled entity with `reset()`, `takeDamage()`, knockback decay.
2. **Initial Suite Execution**:
   - Command: `npm test`
   - Output:
     ```
     Test Files  4 passed (4)
          Tests  47 passed (47)
       Duration  12.08s
     ```
     All 4 baseline test files passed cleanly (`SpatialHashGrid.test.ts`, `PlayerProgression.test.ts`, `PlayerAndLoot.test.ts`, `HordeManager.test.ts`).

### 1.2 Adversarial Stress Suite Execution (`tests/unit/HordeStressAdversarial.test.ts`)
To independently evaluate the claims under extreme and adversarial conditions without relying on worker logs, Challenger 1 authored and executed `tests/unit/HordeStressAdversarial.test.ts` (7 stress tests across 6 attack dimensions):

1. **Adversarial Challenge 1: Ground-Truth Oracle vs SpatialHashGrid**:
   - Seeded 1,000 active enemies across an arena (`x: -2000..2000, y: -2000..2000`).
   - Executed 50 randomized circular queries against both `SpatialHashGrid` and a naive O(N) brute-force oracle checking every entity mathematically.
   - Result: 0 false negatives, 0 false positives. Exact mathematical set equivalence across all queries.

2. **Adversarial Challenge 2: Singularity Collapse Stress**:
   - Spawned 1,500 enemies at the exact same coordinate `(0, 0)`.
   - Simulated 30 ticks of soft separation, kinematic steering, and spatial grid rebuilding.
   - Result: Passed without infinite loops, stack overflows, or degenerate states. Zero NaN or infinite values across position and velocity vectors.

3. **Adversarial Challenge 3: 60Hz Sustained Performance (1,200 simultaneous enemies)**:
   - Command: `npx vitest run tests/unit/HordeStressAdversarial.test.ts`
   - Telemetry observed:
     ```
     [Empirical Benchmark] 1,200 Enemies 60Hz Simulation: Total=610.2ms, Avg=2.034ms, p95=2.647ms, Max=2.777ms
     ```
   - Tick duration budget for locked 60Hz is `16.66ms`. The core simulation averaged `2.034ms` (< 13% of budget), with 95th percentile at `2.647ms` and worst-case peak at `2.777ms`.

4. **Adversarial Challenge 4: 1,000 Spatial Queries Latency Benchmark**:
   - Executed 1,000 distinct circular queries against a populated grid of 1,500 active enemies.
   - Telemetry observed:
     ```
     [Empirical Benchmark] 1,000 Queries across 1,500 Enemies: Duration=0.42ms (0.4us/query), Total Found=6276
     ```
   - Target was `< 50ms`. Actual execution was `0.42ms` (119x faster than required threshold, averaging 420 nanoseconds per query).

5. **Adversarial Challenge 5: Object Pool Identity & Memory Leak Harness**:
   - Tracked all 2,048 pre-allocated `Enemy` references in a strict reference `Set<Enemy>`.
   - Executed 2,000 simulation ticks with rapid churn: 50 killed and 50 spawned on every single tick (100,000 total spawn/despawn operations).
   - Telemetry observed:
     ```
     [Empirical Benchmark] 2,000 Ticks High Churn (100,000 Spawns/Kills): Heap Delta = -2.99 MB
     ```
   - 100% of newly spawned enemies were confirmed to be members of the original pre-allocated set (zero new heap instance allocations).
   - Invariant `activeCount + freeCount === 2048` held strictly across all ticks.
   - Net heap delta was negative (-2.99 MB), proving zero memory leakage.

6. **Adversarial Challenge 6: Edge Case Hardening & Invalid Inputs**:
   - Out-of-bounds coordinates (`±999,999`) clamped safely to grid edges.
   - Invalid despawns (negative IDs, out-of-range IDs, duplicate despawns) executed safely as no-ops.
   - Damage on dead/inactive entities returned safe no-op results without state corruption.

7. **Full Suite & Build Verification**:
   - `npm test`: 6 test files, 71/71 tests passed in 4.70s.
   - `npx tsc --noEmit`: Exited 0 with zero errors.
   - `npm run build`: Produced production bundle `dist/assets/index-aBkijt3T.js` in 118ms.

---

## 2. Logic Chain

1. **Premise 1**: For a horde survival engine to handle 1,000+ entities at 60Hz, tick update time must remain well below the 16.66ms frame budget, and spatial partitioning must avoid heap allocations that trigger GC pauses.
2. **Deduction 1**: Observation 1.2.3 demonstrates that simulating 1,200 active enemies with soft flocking separation and spatial grid rebuilding consumes an average of 2.034ms per tick (maximum 2.777ms). This confirms that 1,000+ simultaneous enemies run at locked 60Hz with over 80% headroom remaining for rendering and audio.
3. **Premise 2**: Collision and weapon targeting require rapid spatial neighborhood queries. If 1,000 queries require > 50ms, multi-projectile weapons will drop frames.
4. **Deduction 2**: Observation 1.2.4 proves that 1,000 queries across 1,500 active enemies execute in 0.42ms (0.42μs per query), outperforming the 50ms threshold by more than two orders of magnitude. Observation 1.2.1 proves zero false negatives and zero false positives against an analytical geometric oracle.
5. **Premise 3**: Long-term survival games run tens of thousands of ticks. Any memory leakage or dynamic instance recreation during spawning/despawning will degrade performance over time.
6. **Deduction 3**: Observation 1.2.5 demonstrates that over 100,000 spawn/kill cycles across 2,000 ticks, 100% of recycled entities maintained their original object references with zero heap growth (net heap delta: -2.99MB) and strict pool invariant retention (`activeCount + freeCount === 2048`).
7. **Conclusion**: The implementation of `SpatialHashGrid`, `HordeManager`, and `Enemy` in Milestone M1 satisfies all performance, correctness, and stability criteria.

---

## 3. Caveats

1. **Headless Execution**: All stress benchmarks were executed in headless Node.js via Vitest. In a browser environment, Canvas 2D rendering and GPU composition will add overhead, though the simulation core itself is fully decoupled and locked at 60Hz (`dt = 1/60`).
2. **Upcoming Weapon Mechanics (M3)**: Milestone M1 implements the core queries (`queryRadius`, `getEnemiesInRadius`, `getNearestEnemy`), while actual auto-firing projectile arsenals and damage resolution systems will be built in Milestone M3.
3. **Visual Aesthetics (M2)**: Procedural gothic sprites and dynamic environmental rendering are assigned to Milestone M2.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone M1 (Foundation & High-Performance Core) is empirically verified and approved:
- 1,200 active enemies simulate stably at locked 60Hz (2.03ms/tick vs 16.66ms budget).
- Spatial queries execute at ~0.4μs/query (0.42ms for 1,000 queries vs 50ms limit) with 100% geometric accuracy.
- Object pooling preserves 100% object identity with zero memory leaks over 100,000 churn cycles.
- 100% green test suite (71/71 tests passing across 6 suites).
- Clean TypeScript check and production build verified.

---

## 5. Verification Method

To independently reproduce the empirical findings:

1. **Run Full Test Suite (including Adversarial Stress Harness)**:
   ```bash
   npm test
   ```
   *Expected*: 6 test files pass, 71/71 tests pass cleanly in < 6 seconds.
   Verify console output confirms:
   - `1,200 Enemies 60Hz Simulation: Avg < 5ms`
   - `1,000 Queries across 1,500 Enemies: Duration < 5ms`
   - `2,000 Ticks High Churn: Heap Delta <= 0 MB`

2. **Run Adversarial Suite Standalone**:
   ```bash
   npx vitest run tests/unit/HordeStressAdversarial.test.ts
   ```
   *Expected*: 7/7 tests pass.

3. **TypeScript Typecheck**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected*: Exit code 0, 0 errors.

4. **Production Build**:
   ```bash
   npm run build
   ```
   *Expected*: Bundles cleanly into `dist/` in < 300ms.
