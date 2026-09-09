## 2026-09-08T04:42:06Z

You are a Reviewer subagent (teamwork_preview_reviewer) for Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Worker M3 Handoff: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1/handoff.md

REVIEW FOCUS:
Review the code changes made in `src/core/player/UltimateManager.ts`, `src/core/player/PlayerController.ts`, `src/input/KeyboardController.ts`, and `tests/unit/ultimate_move_system.test.ts`:
1. Check that the 4-phase cinematic pipeline functions properly (Freeze 0.5s -> Strike Pass 0.6s -> Detonation 0.4s -> Recovery 0.3s).
2. Check on-screen minion elimination (clears 100% of standard enemies in active camera viewport) and 120 burst damage to bosses.
3. Check that KeyU is mapped cleanly and KeyX is untouched (jump).
4. Run verification commands:
   `npx tsc -b`
   `npx vitest run tests/unit/ultimate_move_system.test.ts`
5. Provide an explicit verdict: APPROVE or REQUEST_CHANGES.
6. Write your report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1/handoff.md`
   and call send_message to parent.
