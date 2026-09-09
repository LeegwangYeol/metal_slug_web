# BRIEFING — 2026-09-08T02:31:30Z

## Mission
Implement and polish Milestone M2: Autonomous Ally NPCs & Diverse Items/Weapons, fixing targeting, jumping kinematics, rocket launcher blast radius, item pickup initial velocity, PowEntity ally spawning/PrisonerEntity alias, and unit test alignments to ensure 100% test pass rate with zero regressions.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)

## 🔒 Key Constraints
- Exclusive file ownership:
  - src/core/entities/allies/AllyNPC.ts
  - src/core/weapons/RocketLauncherWeapon.ts
  - src/core/entities/items/ItemPickup.ts
  - src/core/entities/pow/PowEntity.ts
  - src/core/entities/pow/PrisonerEntity.ts
  - tests/unit/allies_system.test.ts
  - tests/unit/diverse_weapons_items.test.ts
  - tests/unit/pow_system.test.ts
- Genuine implementations only (DO NOT cheat, mock results, or fabricate outputs)
- Run all required verification commands and include full outputs
- Write handoff.md following 5-component protocol
- Communicate via send_message to parent (05969896-3516-4d88-a516-8ffeaafab39c)

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T02:31:30Z

## Task Summary
- **What to build**: Fix AllyNPC pending entity visibility and jump kinematics; fix RocketLauncherWeapon pending entity steering and explosion distance calculation; set ItemPickup default initialVelocity to (0,0); add spawnsAlly and PrisonerEntity alias to PowEntity; create PrisonerEntity.ts re-export; adjust unit tests in allies_system.test.ts, diverse_weapons_items.test.ts, and pow_system.test.ts.
- **Success criteria**: npx tsc passes with 0 errors; all targeted unit tests pass; all 28 test suites in tests/unit/ pass (339/339 tests).
- **Interface contracts**: PROJECT.md / COLLABORATION.md
- **Code layout**: src/core/entities/allies/, src/core/weapons/, src/core/entities/items/, src/core/entities/pow/, tests/unit/

## Change Tracker
- **Files modified**:
  - `src/core/entities/allies/AllyNPC.ts`: Added `justJumped` flag to prevent gravity leak on takeoff; included pending `entitiesToAdd` in `findBestTarget`.
  - `src/core/weapons/RocketLauncherWeapon.ts`: Included pending `entitiesToAdd` in `steerTowardsNearestEnemy`; used `entity.position ?? BoundingBox.getCenter(entity.bounds)` in `detonate`.
  - `src/core/entities/items/ItemPickup.ts`: Added optional `initialVelocity: Vector2D = vec2(0, 0)` to constructor.
  - `src/core/entities/pow/PowEntity.ts`: Added `spawnsAlly` constructor parameter and event emission; added `export { PowEntity as PrisonerEntity }`.
  - `src/core/entities/pow/PrisonerEntity.ts`: Created re-exporting `PowEntity`.
  - `tests/unit/allies_system.test.ts`: Updated line 69 spawn position to `vec2(100, 200)` for follow locomotion test.
  - `tests/unit/diverse_weapons_items.test.ts`: Removed unused imports `WeaponType` and `ItemPickupEntity`; updated gravity fall loop to 60 frames.
  - `tests/unit/pow_system.test.ts`: Calibrated sample thresholds to 153-weight table.
- **Build status**: PASS (`npx tsc --noEmit` clean, 0 errors)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 28/28 test files passed, 339/339 tests passed (100% green)
- **Lint status**: 0 errors
- **Tests added/modified**: `allies_system.test.ts`, `diverse_weapons_items.test.ts`, `pow_system.test.ts`

## Loaded Skills
- None

## Key Decisions Made
- Cleanly applied Explorer 1, 2, and 3 recommendations. All changes strictly respect file ownership and architectural invariants.

## Artifact Index
- DISPATCH.md — Assignment instructions
- BRIEFING.md — Persistent working state
- progress.md — Heartbeat progress
- handoff.md — 5-component handoff report
