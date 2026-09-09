## 2026-09-08T04:20:26Z

You are an Explorer subagent (teamwork_preview_explorer) for Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

You are READ-ONLY. DO NOT edit or modify source code files.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

YOUR MISSION & FOCUS:
Investigate core mechanics, input wiring, and simulation architecture for the Ultimate Move System:
1. Examine `src/core/player/PlayerController.ts`, `src/core/input/InputHandler.ts`, and see if `src/core/player/UltimateManager.ts` exists or needs to be created.
2. Investigate how input `KeyU` (and cross-referencing `KeyX` / button triggers from COLLABORATION.md) should trigger the ultimate move on `PlayerController`.
3. Map out the 4-phase cinematic pipeline:
   - Phase 1: Freeze Frame & Air-raid Siren sound (~0.5s)
   - Phase 2: Tactical Strike Pass (Heavy Bomber or Metal Slug charge crossing the screen)
   - Phase 3: Screen Detonation shockwave — clears 100% of standard on-screen minions (within active camera viewport) and deals 120 burst damage to bosses/mid-bosses
   - Phase 4: Screen unfreeze & Recovery
4. Investigate viewport entity query logic: how `StageManager.getCamera()` or viewport bounding box coordinates are accessed to find all living enemies currently inside the screen.
5. Provide an exact architectural blueprint and interface contract for the Worker.
6. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1/handoff.md`
   and call send_message to parent.
