# Dispatch Assignment: Milestone 1 Challenger 1 (Adversarial Physics & Kinematics)

- **Role**: teamwork_preview_challenger
- **Milestone**: Milestone 1 (Dynamic Animations & Motion Engine)
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Mandatory Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/handoff.md`

## Adversarial Mission & Objectives
Empirically stress-test the Milestone 1 kinematic and animation systems:
1. Write and execute an adversarial test harness (e.g. `tests/unit/ChallengerM1_1_Stress.test.ts`) that tests:
   - Extreme inputs: Rapid key-mashing direction reversal (360-degree reversal at 60Hz and 120Hz).
   - Numerical stability: Very small $dt$ ($10^{-5}$), large $dt$ ($0.5$), zero velocity inputs, infinite/NaN resistance.
   - Volume conservation invariant: Assert $S_x \cdot S_y \approx 1.0$ across 10,000 randomized squash/stretch ticks.
   - Stationary baseline invariant: Assert idle player at (100, 150) has strictly zero offset.
2. Run your harness and all unit tests (`npm test`).
3. Output your verdict: **APPROVE** (all adversarial stress-tests pass) or **REQUEST_CHANGES** (vulnerabilities discovered).

Write your report to:
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1/progress.md`
- `/Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1/handoff.md`

Report completion to parent orchestrator.

## 2026-09-11T06:30:38Z
You are challenger_m1_1, a teamwork_preview_challenger subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_anim/handoff.md

Empirically stress-test the Milestone 1 kinematic and animation systems:
1. Write and execute an adversarial test harness (e.g., tests/unit/ChallengerM1_1_Stress.test.ts) testing:
   - Rapid key-mashing direction reversals at 60Hz and 120Hz.
   - Numerical stability across tiny dt (1e-5), large dt (0.5), zero inputs, NaN/Infinity resistance.
   - Volume conservation invariant (Sx * Sy = 1.0) across 10,000 randomized squash/stretch ticks.
   - Stationary baseline invariant (idle player at (100, 150) has strictly zero offset).
2. Run your harness and all unit tests (`npm test`).
3. Output your verdict: APPROVE or REQUEST_CHANGES.

Write your report to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m1_1/handoff.md

Report completion to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5).
