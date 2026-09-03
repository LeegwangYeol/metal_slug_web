# DISPATCH — Explorer Polish 1

## Mission
Investigate the existing enemy spawning architecture and define the implementation plan for Diverse Enemy Spawning (R1).

## Scope & Instructions
1. Read `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md` and `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`.
2. Inspect the current codebase around enemy spawning:
   - `src/core/engine/StageData.ts`
   - `src/core/engine/StageManager.ts`
   - `src/core/entities/enemies/SoldierEnemy.ts`
   - `src/core/entities/enemies/EnemyTypes.ts`
   - `src/main.ts` and related files.
3. Analyze current enemy spawn triggers, coordinates, and entry mechanisms.
4. Detail exactly how to implement:
   - Parachute drops: spawn high above (Y < 50), descending canopy, sinusoidal swaying ($X_{offset} = A \sin(\omega t)$), constant/terminal descent speed ($v_y \approx 40-60\text{ px/s}$), touchdown at ground line ($Y = 230$), parachute detachment and drift/fade, transition to active combat AI.
   - Trench / structural ambushes: leap-out arc ($v_x \neq 0, v_y < 0$ with gravity arc onto ground), trigger points near trenches/sandbags/structures.
5. Provide file paths, function signatures, data structures, and architectural recommendations.
6. Write your comprehensive report to `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/handoff.md`.

## 2026-09-04T00:14:17+09:00
You are Explorer Polish 1.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/
Workspace root: /Users/user/teamwork_projects/metal_slug_web

MANDATORY: Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md and /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/DISPATCH.md before starting work. Do NOT skip this.

Your mission:
Investigate the existing enemy spawning architecture and define the technical implementation plan for Diverse Enemy Spawning (R1):
- Parachute airborne drops (spawn Y < 50, descent velocity 40-60 px/s, sinusoidal swaying, ground touchdown at Y=230, parachute canopy detachment, combat AI transition).
- Trench / structure ambushes (designated trigger points, leap-out arc vx != 0, vy < 0 with gravity landing).

Inspect:
- src/core/engine/StageData.ts
- src/core/engine/StageManager.ts
- src/core/entities/enemies/SoldierEnemy.ts
- src/core/entities/enemies/EnemyTypes.ts
- src/main.ts and any related files.

Produce your detailed analysis and handoff report in:
/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_1/handoff.md

Remember to maintain progress.md in your working directory with 'Last visited: [timestamp]'.
When complete, notify the orchestrator via send_message with your handoff summary and report path.
