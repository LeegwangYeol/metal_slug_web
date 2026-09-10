## 2026-09-10T15:33:26Z

You are worker_m1_1 (role: Implementation & Testing Worker).
Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md before starting any work. Do not skip this.
Also read:
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m1_3/handoff.md

Your exclusive write ownership:
- src/core/entities/Player.ts
- src/core/HordeManager.ts
- src/core/SpatialHashGrid.ts
- src/core/systems/LootManager.ts
- src/core/weapons/WeaponManager.ts
- src/core/systems/UpgradeSystem.ts
- src/ui/UpgradeModal.ts
- src/main.ts
- tests/unit/restart.spec.ts

Implementation Requirements:
1. `src/core/entities/Player.ts`:
   - Implement `public reset(startX: number = 0, startY: number = 0): void`
   - Resets position, velocity, bounds, isAlive = true, facingAngle, facingDirection, invulnerabilityTimer = 0.
   - Resets stats to initial baseline (maxHealth 100, currentHealth 100, moveSpeed 200, armor 0, etc.).
   - Calls `this.progression.reset()` to reset level to 1, currentXP = 0, totalXP = 0 (preserving registered level-up listeners).

2. `src/core/HordeManager.ts`:
   - Implement `public reset(): void`
   - Cleanly purges the 2,048 pooled entities back to factory pristine condition without inflating `totalKilled`.
   - Resets `this.totalSpawned = 0` and `this.totalKilled = 0`.
   - Clears `spatialGrid`.

3. `src/core/SpatialHashGrid.ts`:
   - In `clear()`, ensure coordinate hygiene by zeroing `entityX` and `entityY` or clearing cell heads.

4. `src/core/systems/LootManager.ts`:
   - Implement `public reset(): void`
   - Recycles all active items to pool, sets `isAlive = false`, resets `this.nextId = 1`, sanitizes velocities/attraction flags, asserts 1,500 pooled gems.

5. `src/core/weapons/WeaponManager.ts`:
   - Implement `public reset(starterWeaponId: string = 'scythe', starterRank: number = 1): void`
   - Clears sub-weapon pools, active slashes/projectiles, resets `simulationTime = 0`, resets hitCooldownBuffer, clears weapons map, re-equips starter Rank 1 Arcane Scythe.

6. `src/core/systems/UpgradeSystem.ts` & `src/ui/UpgradeModal.ts`:
   - In `UpgradeSystem.ts`, update `reset(starterWeaponId = 'weapon_scythe', starterRank = 1)` to re-add starter weapon rank 1.
   - In `UpgradeModal.ts`, implement `public reset(): void` to close modal, clear cards, reset hovered/selected index, and detach listeners.

7. `src/main.ts` (`GrimHarvestGame`):
   - Add `public static readonly MAX_SUB_STEPS = 5;`
   - In RAF frame tick (`start()`): clamp accumulator loop with `MAX_SUB_STEPS` and zero backlogged accumulator if step count exceeds limit to prevent infinite freeze death spiral.
   - Implement `public restart(): void` coordinating subsystem resets, resetting clocks/accumulators, re-spawning initial perimeter swarm.
   - Implement `public canResurrect(): boolean` with death cooldown/debounce buffer (`deathTimer >= 0.5`).
   - Wire Spacebar keydown and canvas click event listeners to call `restart()` when `canResurrect()` is true. Also check keyboard snapshot in `step()` when dead.

8. `tests/unit/restart.spec.ts`:
   - Implement comprehensive Vitest unit test suite covering:
     - Clock & accumulator reset
     - Player entity reset (100 HP, Level 1, position (0,0))
     - WeaponManager reset (Rank 1 Arcane Scythe)
     - UpgradeSystem & UpgradeModal reset
     - WaveDirector & initial swarm reset (35 enemies, 0 kills)
     - LootManager reset
     - Camera shake reset
     - Resurrection input trigger via jump/space

Verification:
- Run `npx vitest run tests/unit/restart.spec.ts`
- Run `npm test` to verify zero regressions across all test suites
- Run `npx tsc --noEmit` to verify 100% type safety

Document all changes, commands run, and test outputs in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_1/handoff.md`.
Update `progress.md` with your progress.
When finished, send a message to orchestrator with your results.
