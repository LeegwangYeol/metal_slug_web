# BRIEFING — 2026-09-08T02:26:00Z

## Mission
Investigate failing tests in tests/unit/pow_system.test.ts and related POW / hostage rescue drop integration, ally rescue triggers, and unit suite health. Formulate an exact fix strategy for Worker.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: explorer, investigator, synthesizer
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Write metadata and reports only in /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3/
- Send all results/handoff back to parent via send_message

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T02:26:00Z

## Investigation State
- **Explored paths**:
  - `tests/unit/pow_system.test.ts`
  - `tests/unit/allies_system.test.ts`
  - `tests/unit/diverse_weapons_items.test.ts`
  - `src/core/entities/pow/PowEntity.ts`
  - `src/core/weapons/WeaponTypes.ts`
  - `src/core/entities/allies/AllyNPC.ts`, `AllyManager.ts`, `AllyTypes.ts`
  - `src/core/weapons/RocketLauncherWeapon.ts`, `ShotgunWeapon.ts`, `LaserGunWeapon.ts`, `WeaponManager.ts`
  - `src/core/entities/items/ItemPickup.ts`
  - `src/core/engine/GameEngine.ts`
  - `src/core/player/PlayerController.ts`, `PlayerKinematics.ts`
- **Key findings**:
  1. `pow_system.test.ts` line 80 fails intermittently (~16-30% rate) because appending 5 expansion items to `POW_LOOT_TABLE` increased total weight from 100 to 153, lowering GRENADE_CRATE probability from 20% to 13.07% (mean 130.7, std dev 10.66), causing `samples[GRENADE_CRATE]` to dip below 120.
  2. `allies_system.test.ts` line 77 fails because spawning at (150, 200) places ally within 5px of target offset (155), causing immediate transition to `IDLE` after salute instead of staying in `FOLLOW`.
  3. `allies_system.test.ts` line 114 fails (-333.67 vs -350.0) because gravity is applied in the same frame as jump initiation.
  4. `allies_system.test.ts` lines 130, 155, 197 and `diverse_weapons_items.test.ts` line 241 fail because `engine.addEntity()` places new entities in `entitiesToAdd`, which are invisible to `engine.getAllEntities()` until `engine.tick()` runs.
  5. `diverse_weapons_items.test.ts` line 269 fails (5.5 vs 8.0) because rocket blast distance was calculated to bounding box center (Y=85, 15px away) instead of foot anchor position (Y=100, 0px away).
  6. `diverse_weapons_items.test.ts` line 343 fails because ItemPickup takes ~49 frames to fall from Y=100 (with initial -120 px/s upward pop) to platform at Y=200; test loop was only 40 frames.
  7. `npx tsc --noEmit` fails with TS6133 due to unused imports (`WeaponType`, `ItemPickupEntity`) in `tests/unit/diverse_weapons_items.test.ts`.
  8. `PrisonerEntity` alias and `spawnsAlly` rescue trigger are needed in `PowEntity.ts` for complete integration.
- **Unexplored areas**: None. Complete root-cause diagnosis completed.

## Key Decisions Made
- Fully diagnosed all 8 failing test cases + 1 flaky test case + 2 TypeScript compilation errors.
- Formulated concrete, line-by-line fix recommendations for Worker M2.

## Artifact Index
- DISPATCH.md — Dispatch log
- BRIEFING.md — Persistent working memory
- progress.md — Liveness heartbeat
- handoff.md — Complete investigation & blueprint report
