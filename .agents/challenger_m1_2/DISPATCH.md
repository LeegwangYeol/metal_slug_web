# Dispatch Assignment: Milestone 1 Challenger 2 (Adversarial Horde Render & State Sync)

- **Role**: teamwork_preview_challenger
- **Milestone**: Milestone 1 (Dynamic Animations & Motion Engine)
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Mandatory Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/handoff.md`

## Adversarial Mission & Objectives
Empirically stress-test the Milestone 1 horde animation and render loop:
1. Write and execute an adversarial test harness (e.g. `tests/unit/ChallengerM1_2_HordeStress.test.ts`) that tests:
   - High-density active horde: 1,500 active enemies undergoing simultaneous walk bobs, spectral floating, damage flinch, and hit flashing. Assert zero crashes, zero memory leaks, and frame execution time $< 5.0\text{ms}$.
   - State desynchronization: Rapid pooling reset and reuse of `Enemy` instances; verify `behaviorTimer`, `walkPhase`, `hoverPhase`, and `flinchRot` cleanly reset without carrying ghost animation states into newly spawned entities.
   - Atlas integrity: Confirm that atlas caching remains strictly 120 canvases with zero runtime re-rasterization or offscreen canvas creation.
2. Run your harness and all unit tests (`npm test`).
3. Output your verdict: **APPROVE** or **REQUEST_CHANGES** with concrete evidence.

Write your report to:
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2/progress.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2/handoff.md`

Report completion to parent orchestrator.

## 2026-09-11T06:30:38Z
You are challenger_m1_2, a teamwork_preview_challenger subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/handoff.md

Empirically stress-test the Milestone 1 horde animation and render loop:
1. Write and execute an adversarial test harness (e.g., tests/unit/ChallengerM1_2_HordeStress.test.ts) testing:
   - High-density active horde: 1,500 active enemies undergoing simultaneous walk bobs, spectral floating, damage flinch, and hit flashing. Assert zero crashes, zero memory leaks, and frame execution time < 5.0ms.
   - State desynchronization: Rapid pooling reset and reuse of Enemy instances; verify behaviorTimer, walkPhase, hoverPhase, and flinchRot cleanly reset without carrying ghost animation states.
   - Atlas integrity: Confirm atlas caching remains strictly 120 canvases with zero runtime re-rasterization.
2. Run your harness and all unit tests (`npm test`).
3. Output your verdict: APPROVE or REQUEST_CHANGES.

Write your report to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_2/handoff.md

Report completion to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5).

