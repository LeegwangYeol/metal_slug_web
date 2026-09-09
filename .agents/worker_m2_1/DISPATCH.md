## 2026-09-08T02:26:38Z
You are a Worker subagent (teamwork_preview_worker) for Milestone M2 (Autonomous Ally NPCs & Diverse Items/Weapons).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Explorer 1 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/handoff.md
- Explorer 2 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_2/handoff.md
- Explorer 3 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3/handoff.md

FILE OWNERSHIP:
You have exclusive write ownership of:
- src/core/entities/allies/AllyNPC.ts
- src/core/weapons/RocketLauncherWeapon.ts
- src/core/entities/items/ItemPickup.ts
- src/core/entities/pow/PowEntity.ts
- src/core/entities/pow/PrisonerEntity.ts
- tests/unit/allies_system.test.ts
- tests/unit/diverse_weapons_items.test.ts
- tests/unit/pow_system.test.ts

TASK & IMPLEMENTATION STEPS:
Carefully follow the detailed, line-by-line recommendations from the 3 explorer reports:
1. In `src/core/entities/allies/AllyNPC.ts`:
   - In `findBestTarget`: Include pending entities from `(engine as any).entitiesToAdd` so un-ticked entities in unit tests are visible to ally vision.
   - In `update` / `integrateKinematics`: Apply jump impulse cleanly without leaking airborne gravity on the impulse initiation tick.
2. In `src/core/weapons/RocketLauncherWeapon.ts`:
   - In `steerTowardsNearestEnemy`: Include pending entities from `(engine as any).entitiesToAdd`.
   - In `detonate`: Calculate distance to `entity.position ?? BoundingBox.getCenter(entity.bounds)` to fix the 15px foot-offset.
3. In `src/core/entities/items/ItemPickup.ts`:
   - Set constructor `initialVelocity: Vector2D = vec2(0, 0)`.
4. In `src/core/entities/pow/PowEntity.ts`:
   - Add optional `spawnsAlly?: boolean` constructor parameter and event trigger on rescue.
   - Re-export `export { PowEntity as PrisonerEntity };`
5. Create `src/core/entities/pow/PrisonerEntity.ts`:
   - Export `PrisonerEntity` from `./PowEntity`.
6. In `tests/unit/allies_system.test.ts`:
   - Update line 69 spawn position to `vec2(100, 200)` so that follow locomotion is tested cleanly.
7. In `tests/unit/diverse_weapons_items.test.ts`:
   - Remove unused imports `WeaponType` and `ItemPickupEntity` to eliminate TypeScript errors.
   - In line 339, update fall frame loop to 60 frames.
8. In `tests/unit/pow_system.test.ts`:
   - Adjust lines 78-81 thresholds to match the 153-weight expanded loot table.

VERIFICATION COMMANDS:
Run these commands and include full output in your report:
1. `npx tsc --noEmit` (must succeed with 0 errors)
2. `npx vitest run tests/unit/allies_system.test.ts` (all 10 pass)
3. `npx vitest run tests/unit/diverse_weapons_items.test.ts` (all 12 pass)
4. `npx vitest run tests/unit/pow_system.test.ts` (all 3 pass)
5. `npx vitest run tests/unit/` (all 28 test suites, 339+ tests pass)

REPORTING:
Write your complete handoff report to:
`/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_1/handoff.md`
following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
Then call send_message to notify parent.
