## 2026-09-11T02:40:28Z
You are Explorer 3 for Milestone 2 (Agent 11): Camera Unit Test Specification Explorer.
Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3
Project root: /Users/user/teamwork_projects/metal_slug_web

Read the following documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera/SCOPE.md

Mission:
Investigate camera testing requirements and design unit test specification:
1. Inspect existing camera tests (e.g. `tests/unit/Camera.test.ts` or related files).
2. Design a comprehensive unit test suite specification for `tests/unit/camera_tracking.spec.ts`:
   - Test 1: In steady state with stationary player, player renders exactly centered at $(W/2, H/2)$ on viewport.
   - Test 2: Exponential damping ($k = 8.0$) smoothly closes camera distance over multiple frames without instant snapping or overshoot.
   - Test 3: Sudden direction reversal (e.g. moving right at +200px/s then immediately left at -200px/s) smoothly transitions without jarring snapping.
   - Test 4: Velocity lookahead smoothly scales with velocity and is strictly clamped to $\le 40\text{px}$.
   - Test 5: World boundary limits (e.g. map limits $-2000$ to $+2000$) clamp camera smoothly without out-of-bounds viewport exposure.
   - Test 6: Screen shake trauma decays smoothly to 0 without permanent camera drift.
3. Write test specifications to `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3/handoff.md`.
4. Send a message to orchestrator when finished.
