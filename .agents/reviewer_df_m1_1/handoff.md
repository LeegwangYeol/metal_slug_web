# Milestone M1 Review Report: Foundation & High-Performance Core

**Reviewer**: Reviewer 1 (`reviewer_df_m1_1`)  
**Role**: Reviewer & Adversarial Critic  
**Milestone**: M1 (Foundation & High-Performance Core)  
**Target Project**: Grim Harvest: Undead Siege (Dark Fantasy Horde Survival)  
**Target Directory**: `/Users/user/teamwork_projects/metal_slug_web`  
**Verdict**: **APPROVE**  
**Date**: 2026-09-10T10:57:00Z  

---

## 1. Observation

### 1.1 Legacy Codebase Purge Verification
- Direct directory inspections (`find_by_name`, `list_dir`) and recursive regex grep (`grep_search`) confirmed complete removal of all legacy "cute" arcade and "metal slug" platformer assets and implementations:
  - `src/core/cute/` (8 files purged: `ArenaPurificationManager.ts`, `BubbleManager.ts`, `BubbleTrapEntity.ts`, `CuteArenaCoordinator.ts`, `CuteEnemyManager.ts`, `CuteGameTypes.ts`, `PetCompanion.ts`, `SweetPerkManager.ts`).
  - Legacy entities in `src/core/entities/` (`allies/*`, `boss/*`, `enemies/*`, `items/*`, `obstacles/*`, `pow/*` purged).
  - Legacy platformer physics in `src/core/physics/` (`Platform.ts`, `SpatialGrid.ts` purged).
  - Legacy controllers in `src/core/player/` (`PlayerController.ts`, `PlayerTypes.ts`, `UltimateManager.ts` purged).
  - Legacy stage, weapons, renderers, and UI overlays (`StageManager.ts`, `WeaponManager.ts`, `CanvasRenderer.ts`, `ParallaxBackground.ts`, `HUDOverlay.ts` purged).
  - 48 legacy test files in `tests/unit/*.test.ts` purged.
  - Full codebase grep search confirmed **0** occurrences of legacy arcade keywords (`\bcute\b`, `\b(slug|metal)\b`) across `src/core/` and `tests/unit/`.

### 1.2 Core Architectural Components Inspected
1. **`src/core/SpatialHashGrid.ts`**:
   - Flat typed array intrusive linked-list buckets: `cellHeads: Int32Array` (size = `cols * rows`), `entityNext: Int32Array` (size = `maxEntities`), and `Float32Array` coordinate caches (`entityX`, `entityY`).
   - Single-cell insertion based on entity center with boundary clamping (`Math.max(worldMin, Math.min(worldMax, coord))`).
   - Radius query `queryRadius(x, y, radius, outIds)` writes into caller-provided buffer with capacity bounds checks and zero runtime heap allocations.
2. **`src/core/entities/Enemy.ts` and `src/core/entities/EnemyTypes.ts`**:
   - 4 dark fantasy undead archetypes implemented: Skeletons (HP 25, Speed 65, Radius 12, Emerald Gem, 1 XP), Ghouls (HP 45, Speed 110, Radius 14, Emerald Gem, 2 XP), Banshees (HP 80, Speed 75, Radius 16, Ruby Gem, 5 XP), and Death Knights (HP 350, Speed 40, Radius 22, Violet Gem, 20 XP).
   - Zero-allocation entity reuse via `reset()` and mass-scaled knockback physics in `takeDamage()`.
3. **`src/core/HordeManager.ts`**:
   - Pre-allocated 2048-entity pool instantiated at boot.
   - O(1) swap-and-pop entity allocation and recycling using `freeIndices: Int32Array`, `activeIndices: Int32Array`, and `indexInActive: Int32Array`.
   - Soft separation repulsion steering using pre-allocated `scratchNeighbors: Int32Array(64)` preventing singularity collapse.
   - Strict pool invariant `activeCount + freeCount === maxCapacity` maintained across sustained churn.
4. **Player Kinematics & Systems (`Player.ts`, `PlayerStats.ts`, `PlayerProgression.ts`, `LootManager.ts`)**:
   - Top-down 360-degree omnidirectional movement with vector normalization (eliminating diagonal $\sqrt{2}$ speed bias), linear acceleration (1800 px/s²), and linear deceleration friction (2400 px/s²).
   - Core 11-stat model with a strict 50% max CDR ceiling clamp (`Math.min(0.50, Math.max(0.0, effective))`).
   - Exponential XP progression formula $\lfloor \text{base} \times \text{level}^{1.5} \rfloor$ supporting single and multi-level bursts with zero XP loss.
   - Pre-allocated 1500-item `LootManager` with 900 px/s² magnetic acceleration and Eldritch vacuum pull.

### 1.3 Execution Commands & Results
1. **Strict Typecheck**:
   - Command: `npx tsc --noEmit`
   - Output: Exited with code 0 (zero errors, clean TypeScript compilation across `src` and `tests`).
2. **Unit Test Suite**:
   - Command: `npm test`
   - Output: 6 test files passed, 71/71 tests passed (duration 4.57s):
     - `tests/unit/SpatialHashGrid.test.ts` (9/9 passed)
     - `tests/unit/PlayerProgression.test.ts` (16/16 passed)
     - `tests/unit/PlayerAndLoot.test.ts` (9/9 passed)
     - `tests/unit/ChallengerM1_2.test.ts` (17/17 passed)
     - `tests/unit/HordeStressAdversarial.test.ts` (7/7 passed)
     - `tests/unit/HordeManager.test.ts` (13/13 passed)
   - Telemetry from benchmarks:
     - 1,200 active enemies 60Hz simulation: Average tick = 1.857ms (well below 8.0ms budget and 16.6ms frame limit).
     - 1,000 spatial queries across 1,500 enemies: 0.29ms total (~0.3 μs per query).
     - Sustained high-churn simulation (100,000 spawns/kills over 2,000 ticks): 100% object identity reuse, 0 memory leaks (heap delta -3.34 MB).
3. **Production Build**:
   - Command: `npm run build`
   - Output: `tsc -b && vite build` built production bundle `dist/assets/index-aBkijt3T.js` (43.14 kB, gzip: 12.86 kB) in 147ms without errors.

---

## 2. Logic Chain

### 2.1 Absence of Integrity Violations
- **Source Inspection**: Examined source files for hardcoded test expectations, facade mocks, or shortcut routines. All core algorithms (intrusive linked-list traversal, spatial indexing, vector normalization, linear friction approach, and exponential XP calculation) implement genuine operational logic.
- **Independent Verification**: Build and test executions were carried out directly in the shell environment without artificial bypasses.

### 2.2 Correctness & Performance of Spatial Partitioning (`SpatialHashGrid.ts`)
1. **Observation**: Spatial grid uses flat `Int32Array` buffers with single-cell center insertion.
2. **Analysis**:
   - Because each entity belongs to exactly one bucket corresponding to its center coordinates, radius queries visiting adjacent cells never encounter duplicate entity IDs. This eliminates any need for costly deduplication sets or auxiliary boolean bitsets.
   - `queryRadius` accounts for physical body radius by testing distance against `searchRadius = radius + maxEntityRadius`, ensuring zero missed contacts.
   - The brute-force oracle test in `HordeStressAdversarial.test.ts` proved zero false negatives across 50 randomized query rings.

### 2.3 Pool Invariant & High-Density Scalability (`HordeManager.ts`)
1. **Observation**: Swarm simulation demands 1,000+ active entities at 60Hz without GC hitches.
2. **Analysis**:
   - The `HordeManager` pool pre-allocates 2048 `Enemy` instances.
   - Swap-and-pop maintains a dense active array `activeIndices[0 .. activeCount-1]`. Despawning moves the tail entity to the vacated slot in $O(1)$, updating `indexInActive` synchronously.
   - Soft separation evaluates overlapping entities and applies repulsive forces dampened by mass, avoiding clump singularity while maintaining sub-2ms average tick times for 1,200 simultaneous entities.
   - Stress testing verified 100% reference identity preservation across 100,000 spawns and despawns.

---

## 3. Caveats

1. **Procedural Sprites & Gothic Renderer (Milestone M2)**:
   - Visual assets in `src/main.ts` currently use clean canvas primitive shapes (color-coded circles, auras, and line indicators) representing the dark fantasy entities. Full procedural pixel-art sprites, detailed dark gothic graveyard environments, and spell VFX are assigned to Milestone M2 (`src/render/`).
2. **Occult Weapon Arsenal & Level-Up Modal (Milestone M3)**:
   - Auto-firing weapons (Arcane Scythe, Soul Orbiters, Abyssal Lightning, Bone Spear, Cursed Aura) and the interactive level-up upgrade card system are scheduled for Milestone M3. The foundation (player stats, origin vectors, and progression math) is fully operational.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone M1 (Foundation & High-Performance Core) satisfies all functional, architectural, performance, and integrity requirements:
- All legacy cute and platformer files have been completely eliminated.
- High-density zero-allocation spatial hash grid (`SpatialHashGrid.ts`) operates at < 0.3 μs per query.
- 2048-capacity horde simulation core (`HordeManager.ts`) executes at ~1.86ms/tick under 1,200 active enemies with zero memory leaks.
- Top-down player kinematics, 11-stat system with 50% max CDR ceiling, exponential soul level XP curve, and 1500-item loot magnetism system are fully verified.
- Strict typecheck (`npx tsc --noEmit`), unit test suite (71/71 tests green), and production build (`npm run build`) pass cleanly.

---

## 5. Verification Method

To independently reproduce and verify this review:

1. **Strict TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: Exit code 0, zero warnings, zero errors.

2. **Full Unit & Adversarial Test Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: 6 test files pass, 71/71 tests pass green in < 10s.

3. **Production Build Compilation**:
   ```bash
   npm run build
   ```
   *Expected Result*: `tsc -b && vite build` completes in < 500ms, outputting production bundle in `dist/`.

4. **Legacy Keyword Cleanliness Check**:
   ```bash
   git grep -iE '\bcute\b' src/core/ tests/unit/
   git grep -iE '\b(slug|metal)\b' src/core/ tests/unit/
   ```
   *Expected Result*: No matching results found.
