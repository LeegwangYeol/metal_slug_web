## 2026-09-03T08:25:24Z
You are Explorer 2 for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative original request and collaboration guide:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2

Your Task:
Investigate the Spawning Logic for Enemies and POWs.
Inspect:
1. `src/main.ts`, `src/core/engine/StageManager.ts`, `src/core/entities/pow/PowEntity.ts`, `src/core/entities/enemy/` (e.g. `RebelSoldier.ts`, etc.).
2. Identify all sources of random timer-based spawns, interval loops, or arbitrary triggers that pop POWs or enemies directly inside the visible viewport.
3. Analyze camera tracking and viewport coordinates. How are world coordinates mapped to screen coordinates?
4. Determine how to cleanly place POWs at fixed stage coordinates ahead of the player or trigger them cleanly.
5. Determine how to ensure enemies spawn exclusively out-of-bounds (e.g. cameraX + viewportWidth + margin) and smoothly walk/run into the viewport.
6. Provide a detailed, concrete plan to rewrite the spawning logic, eliminating arbitrary popping and random timer spawns.

Deliverable:
Write a comprehensive handoff report to:
`/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_2/handoff.md`
Send a message to parent when done with a concise summary and path to your handoff.
