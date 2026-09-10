# BRIEFING — 2026-09-10T15:42:00Z

## Mission
Implement clean game restart state engine & lifecycle architecture across Player, HordeManager, SpatialHashGrid, LootManager, WeaponManager, UpgradeSystem, UpgradeModal, and GrimHarvestGame, and verify with tests/unit/restart.spec.ts.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_1
- Original parent: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Milestone: Milestone 1 (Restart State Engine & Lifecycle Architecture)

## 🔒 Key Constraints
- Exclusive write ownership:
  - src/core/entities/Player.ts
  - src/core/HordeManager.ts
  - src/core/SpatialHashGrid.ts
  - src/core/systems/LootManager.ts
  - src/core/weapons/WeaponManager.ts
  - src/core/systems/UpgradeSystem.ts
  - src/ui/UpgradeModal.ts
  - src/main.ts
  - tests/unit/restart.spec.ts
- Genuine implementations only: no fake tests, dummy facades, or hardcoded strings
- Zero regressions across existing test suite
- 100% type safety via `npx tsc --noEmit`

## Current Parent
- Conversation ID: 16d4f03a-b906-4dcd-a7c3-e24f1752216b
- Updated: 2026-09-10T15:33:26Z

## Task Summary
- **What to build**: Comprehensive restart lifecycle and subsystem resets across Player, HordeManager, SpatialHashGrid, LootManager, WeaponManager, UpgradeSystem, UpgradeModal, and GrimHarvestGame main engine, preventing infinite loop/freeze and state leaks. Comprehensive Vitest suite in `tests/unit/restart.spec.ts`.
- **Success criteria**: All 8 implementation requirements implemented, `npx vitest run tests/unit/restart.spec.ts` passes (20/20), `npm test` passes 100% with zero regressions (230/230), `npx tsc --noEmit` clean.
- **Interface contracts**: PROJECT.md & COLLABORATION.md & explorer reports
- **Code layout**: src/core/, src/ui/, src/main.ts, tests/unit/

## Change Tracker
- **Files modified**:
  - `src/core/entities/Player.ts`: Added `public reset(startX, startY, customStats)`
  - `src/core/HordeManager.ts`: Added `public reset()` for O(N) factory pristine restoration without inflating totalKilled
  - `src/core/SpatialHashGrid.ts`: Enhanced `clear()` to zero Float32Array coordinate caches (`entityX`, `entityY`)
  - `src/core/systems/LootManager.ts`: Added `public reset()` restoring 1,500 items and resetting nextId to 1
  - `src/core/weapons/WeaponManager.ts`: Added `public reset()` purging sub-weapon pools, projectiles, slashes, timers, and re-equipping starter weapon
  - `src/core/systems/UpgradeSystem.ts`: Updated `reset()` to support starter weapon re-addition
  - `src/ui/UpgradeModal.ts`: Added `public reset()` to detach listeners and clear selection state
  - `src/main.ts`: Added `MAX_SUB_STEPS = 5`, accumulator clamp guard, `restart()`, `canResurrect()`, and resurrection event listeners
  - `tests/unit/restart.spec.ts`: Created comprehensive 20-test Vitest test suite
- **Build status**: 100% PASS (230 tests passed, 0 failed, 19 files)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 230/230 tests passing across 19 suites
- **Lint status**: `npx tsc --noEmit` clean (0 errors)
- **Tests added/modified**: `tests/unit/restart.spec.ts` (20 new tests)

## Loaded Skills
- None

## Key Decisions Made
- In-place reset methods across subsystems instead of re-instantiation to preserve references, event listeners, and memory pools.
- Clamping RAF accumulator with MAX_SUB_STEPS = 5 and zeroing accumulator debt on step saturation to mathematically guarantee zero infinite loops or browser freeze.
- Debouncing resurrection trigger with deathTimer >= 0.5s.

## Artifact Index
- DISPATCH.md — Assignment instructions
- BRIEFING.md — Situational awareness
- progress.md — Liveness heartbeat
- handoff.md — Milestone 1 completion report
