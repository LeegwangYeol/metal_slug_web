# DISPATCH — challenger_m2_fov_1

## Identity
- TypeName: teamwork_preview_challenger
- Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1
- Parent Conversation ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Required Reading
Before starting, you MUST read:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/handoff.md

## Objective
Adversarially challenge and stress-test the widened Camera FOV ($Z = 0.80$, $1200 \times 675$) and coordinate systems:
1. Write and execute an adversarial test harness (e.g. in `tests/unit/ChallengerM2_FOV_Transforms.test.ts` or run existing camera adversarial tests).
2. Stress test:
   - Coordinate round-trip precision: `screenToWorld(worldToScreen(x, y))` across 10,000 random floating point world positions (residual error $< 1e-9$).
   - Bounds clamping at map extents: ensure camera view rectangle $[camX, camX + viewW] \times [camY, camY + viewH]$ never crosses `bounds.minX/maxX` or `bounds.minY/maxY`.
   - Dynamic zoom transitions (if zoom changes or is queried): test numerical stability against zero, negative, NaN zoom factors.
   - Screen shake interaction: verify screen shake offsets do not violate coordinate bijective inverses.
3. Run `npm test` and verify that all test suites pass 100% green.
4. Formulate gate verdict: **APPROVE** or **REQUEST_CHANGES**.

## Deliverables
Write your reports to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1/handoff.md
Send a completion message back to parent with your verdict and handoff link.

## 2026-09-11T07:01:36Z
You are challenger_m2_fov_1, a teamwork_preview_challenger subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/handoff.md

Adversarially challenge and stress-test the widened Camera FOV (Z = 0.80, 1200x675) and coordinate systems:
1. Write and execute an adversarial test harness (e.g. in tests/unit/ChallengerM2_FOV_Transforms.test.ts or run existing camera adversarial tests).
2. Stress test:
   - Coordinate round-trip precision: screenToWorld(worldToScreen(x, y)) across 10,000 random floating point world positions (residual error < 1e-9).
   - Bounds clamping at map extents: ensure camera view rectangle [camX, camX + viewW] x [camY, camY + viewH] never crosses bounds.minX/maxX or bounds.minY/maxY.
   - Dynamic zoom transitions (if zoom changes or is queried): test numerical stability against zero, negative, NaN zoom factors.
   - Screen shake interaction: verify screen shake offsets do not violate coordinate bijective inverses.
3. Run `npm test` and verify that all test suites pass 100% green.
4. Formulate gate verdict: APPROVE or REQUEST_CHANGES.

Write your reports to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_1/handoff.md

Report completion to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5) with your verdict and handoff link.
