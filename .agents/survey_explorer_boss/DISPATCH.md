## 2026-09-03T16:18:53Z
You are a teamwork_preview_explorer assigned to survey the Boss and Crisis Event architecture for the Metal Slug Web Massive Expansion.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss
You MUST read:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md

Your tasks:
1. Thoroughly investigate existing boss entities, state machines, stage progression, camera/platform bounds, and hazard systems in the codebase (check src/core/, src/main.ts, etc.).
2. Map out how to implement:
   - Epic boss encounters with multiple phases (e.g. Iron Nokana or multi-phase stage boss), distinct attack patterns, telegraphed attacks, and rage states.
   - Dynamic "Crisis Situations" during boss fights (e.g. screen-filling attacks, environmental artillery hazards, or collapsing terrain altering active platform/camera bounds) triggered at specific HP thresholds (e.g. 75%, 50%, 25%).
   - Automated unit tests asserting that specific HP thresholds trigger environment-altering crisis events (spawning hazards, altering bounds).
3. Identify exact files that need to be created or modified, data structures, event flow, and integration points.
4. Write your detailed findings and technical recommendations to /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_boss/analysis.md and produce a complete handoff.md in your working directory.
5. Send a concise completion message back to the parent orchestrator when done.
