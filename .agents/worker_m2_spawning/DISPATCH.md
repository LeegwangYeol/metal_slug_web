## 2026-09-03T08:32:45Z

You are Worker 2 (Spawning & Stage Specialist) for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative context:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Explorer 2 Handoff Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/handoff.md
- Project Scope: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_spawning

Exclusive Write Ownership:
- `src/main.ts`
- `src/core/entities/enemies/SoldierEnemy.ts`
- `src/core/entities/pow/PowEntity.ts`
(Do NOT modify `KeyboardController.ts` or `TetsuyukiBoss.ts`.)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 2 (M2: Spawning Logic Overhaul):
1. Fix Enemy Spawning Y-Coordinate & Physics Collision:
   - `SoldierEnemy` has `height = 38`. Main ground top is at $Y = 230$.
   - When spawning soldiers, set top-left $Y = 192$ ($230 - 38$) so feet start at $Y = 230$ and ground collision snapping succeeds, preventing enemies from plummeting into the abyss and despawning at $Y > 320$.
2. Rewrite POW Placement:
   - Pre-place POWs statically at stage load time in `src/main.ts` at fixed, logical stage coordinates ahead of the player (e.g. $X = 320, Y = 175$, $X = 850, Y = 175$, $X = 1450, Y = 165$), tied to stage structures.
   - Completely remove the runtime trigger spawning of POWs on top of the player (e.g. at $X = 180$ where player activates it, or popping inside visible frustum).
3. Fix Enemy Ingress AI:
   - Ensure all enemies spawn strictly out-of-bounds ($X \ge \text{cameraX} + 480 + 40$).
   - In `src/core/entities/enemies/SoldierEnemy.ts`, fix the ingress AI state transition so soldiers smoothly advance forward into the visible viewport instead of freezing ($v_x = 0$) or retreating back off-screen.
4. Boss Trigger in `src/main.ts`:
   - In `trigger_end_boss` (around line 755), set `customHp: 400`.
5. Mid-Boss Tank Reinforcements:
   - Ensure soldier reinforcements enter smoothly from off-screen right ($X \ge 1220$) rather than dropping directly on the hull.
6. Run verification:
   - Run tests: `npm test`
   - Run typecheck and build: `npm run build`
7. Deliverable:
   - Write comprehensive handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_spawning/handoff.md` with:
     - Summary of changes made
     - Exact line diffs
     - Build and test command outputs
   - Send completion message to parent with path to handoff.
