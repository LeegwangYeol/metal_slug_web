## 2026-09-08T02:53:15Z

You are a Worker subagent (teamwork_preview_worker) for Milestone M2 Iteration 2.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_2
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Reviewer 1 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m2_1/handoff.md
- Explorer Round 2 Reports:
  - /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_r2_1/handoff.md
  - /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_r2_2/handoff.md
  - /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_r2_3/handoff.md

FILE OWNERSHIP:
You have exclusive write ownership of:
- src/core/entities/allies/AllyNPC.ts
- src/core/weapons/RocketLauncherWeapon.ts
- tests/unit/m2_ally_rocket_empirical_challenge.test.ts

TASK & IMPLEMENTATION STEPS:
Apply the 3 surgical code fixes:
1. In `src/core/entities/allies/AllyNPC.ts`:
   - Line 56: Support pending player fallback in `(engine as any).entitiesToAdd`:
     ```typescript
     let player = engine.getEntity('player') as any;
     if (!player && Array.isArray((engine as any).entitiesToAdd)) {
       player = (engine as any).entitiesToAdd.find(
         (e: GameEntity) => e.id === 'player' || e.type === 'PLAYER'
       );
     }
     ```
   - Lines 266-272: Prioritize `MID_BOSS_VEHICLE` / `MID_BOSS` check before checking `BOSS`:
     ```typescript
     let priorityWeight = 10;
     if (typeStr === 'MID_BOSS_VEHICLE' || typeStr.includes('MID_BOSS')) {
       priorityWeight = 50;
     } else if (typeStr.includes('BOSS') || typeStr === 'TETSUYUKI_BOSS') {
       priorityWeight = 100;
     }
     ```
2. In `src/core/weapons/RocketLauncherWeapon.ts`:
   - Line 39: Replace `if (this.lifeTime <= 0)` with `if (this.lifeTime <= 1e-4) { this.detonate(engine); return; }`
3. In `tests/unit/m2_ally_rocket_empirical_challenge.test.ts`:
   - Update line 74 apex expectation to accommodate discrete 60Hz Euler integration ($Y_{\text{apex}} \approx 134.7\text{ px}$).
   - In lines 153-155, verify/tighten boss priority assertion: `expect(best?.id).toBe('test_boss')`.
4. Run verification commands:
   - `npx tsc --noEmit`
   - `npx vitest run tests/unit/allies_system.test.ts tests/unit/diverse_weapons_items.test.ts tests/unit/pow_system.test.ts tests/unit/m2_challenger_stress.test.ts tests/unit/m2_ally_rocket_empirical_challenge.test.ts`
5. Write your complete handoff report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_2/handoff.md`
   and call send_message to parent.
