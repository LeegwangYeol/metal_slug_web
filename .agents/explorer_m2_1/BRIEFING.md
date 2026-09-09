# BRIEFING — 2026-09-08T02:26:30Z

## Mission
Investigate failing tests in `tests/unit/allies_system.test.ts` and related source code in `src/core/entities/allies/`, diagnose exact root causes, and formulate an exact line-by-line fix strategy for Worker.

## 🔒 My Identity
- Archetype: Explorer (teamwork_preview_explorer)
- Roles: Read-only investigation, problem analysis, synthesis, structured handoff reporting
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M2 (Autonomous Ally NPCs & Diverse Items/Weapons)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code files
- Only write metadata, reports, and progress files inside /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/
- Produce a 5-component handoff report (Observation, Logic Chain, Caveats, Conclusion, Verification Method) with concrete fix strategy for Worker

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `tests/unit/allies_system.test.ts`
  - `src/core/entities/allies/AllyNPC.ts`
  - `src/core/entities/allies/AllyKiBlast.ts`
  - `src/core/entities/allies/AllyManager.ts`
  - `src/core/entities/allies/AllyTypes.ts`
  - `src/core/engine/GameEngine.ts`
  - `src/core/player/PlayerController.ts`
- **Key findings**:
  1. Test 1 (`SPAWN_SALUTE -> FOLLOW`): Spawn coordinate at `(150, 200)` gives `absDx = 5px <= 12px`, triggering instant transition to `IDLE` upon exiting salute.
  2. Test 3 (Autonomous jump): Jump impulse `-350.0 px/s` is immediately degraded by `gravity * dt` (`+16.33 px/s`) in `integrateKinematics` within the same update tick, giving `-333.67 px/s`.
  3. Tests 4, 5, 7 (Target acquisition & Ki Blast): `engine.addEntity(enemy)` queues enemies in `entitiesToAdd`. `AllyNPC.findBestTarget` only called `engine.getAllEntities()`, missing pending entities, returning `null`, preventing attack charge and projectile emission.
- **Unexplored areas**: None within the allies subsystem scope.

## Key Decisions Made
- Clear root causes identified for all 5 test failures with line-by-line fix recommendations ready for Worker.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/DISPATCH.md` — Dispatch log
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/BRIEFING.md` — Persistent working memory
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/progress.md` — Heartbeat and progress tracking
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/handoff.md` — Final handoff report
