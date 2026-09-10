## 2026-09-10T01:34:30Z

<USER_REQUEST>
You are worker_m2_remediation.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_remediation
Your parent conversation ID is: dc4b76ec-2c8d-41af-8152-fb6d5ed83654

MANDATORY READING:
1. /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
2. /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
3. /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
4. /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_overhaul_2/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- tests/e2e/ultimate_and_crisis_expansion.spec.ts
- src/core/entities/obstacles/DestructibleObstacle.ts
- src/core/entities/enemies/MidBossVehicle.ts

TASKS & DELIVERABLES:
1. In `tests/e2e/ultimate_and_crisis_expansion.spec.ts` line 355:
   Update legacy expectation from `expect(midBossStatus.boundsMaxX).toBe(1200);` to `expect(midBossStatus.boundsMaxX).toBe(1820);` to match the newly expanded 1100px mid-boss arena (720..1820).
2. In `src/core/entities/obstacles/DestructibleObstacle.ts`:
   In `dealAreaDamage(engine: GameEngine)`, query `engine.getEntities()` so that explosive barrels also damage nearby `DestructibleObstacle` entities within blastRadius (54px), enabling authentic chain reactions while preserving anti-recursion protection (`if (other === this || !other.isAlive) return;`).
3. In `src/core/entities/enemies/MidBossVehicle.ts`:
   In Phase 3 ramming attack, ensure turnaround position is clamped to the expanded arena bounds (maxX: 1820 - width).
4. Run verification commands:
   - `npx tsc --noEmit` -> Must pass with 0 errors.
   - `npm run build` -> Must succeed cleanly.
   - `npm test` -> Must pass 100% green.
   - `npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts` -> Must pass 100% green.
5. Document all changes and verification outputs in `handoff.md` and send completion message to parent.
</USER_REQUEST>
