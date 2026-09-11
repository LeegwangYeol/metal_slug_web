## 2026-09-11T02:44:47Z

You are Worker 2 (Agent 12) for Milestone 2: Camera Overhaul & Cinematic Viewport Engine.
Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2
Project root: /Users/user/teamwork_projects/metal_slug_web

Read the following documents before starting:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera/SCOPE.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Implementation Tasks:
1. `src/render/Camera.ts`:
   - Eliminate legacy side-scroller deadzones (35%-44% width, 30%-70% height) and any forwardLock ratchet behavior.
   - Implement true centered top-down tracking:
     In steady-state, target camera positions the player at exact screen center $(viewportWidth / 2, viewportHeight / 2)$.
   - Implement smooth exponential damping with $k = 8.0$:
     `currentX += (idealX - currentX) * (1 - Math.exp(-8.0 * dt))`
     `currentY += (idealY - currentY) * (1 - Math.exp(-8.0 * dt))`
   - Implement subtle velocity lookahead bounded by $\le 40\text{px}$:
     Extend `update(targetX, targetY, dt, vx: number = 0, vy: number = 0)`.
     Scale lookahead with player velocity smoothly, clamp magnitude to $\le 40\text{px}$, and damp lookahead offset with $k = 5.0$ to ensure zero snapping on direction reversal or sudden stop.
   - Decouple screen shake: shake trauma decays smoothly, added only to `renderX = x + shakeX`, `renderY = y + shakeY`.
   - Maintain map boundary clamping (e.g. $-2000$ to $+2000$ or configured stage bounds) without hard-snapping.
2. `src/main.ts`:
   - Pass player velocity in camera update:
     `this.camera.update(this.player.position.x, this.player.position.y, dt, this.player.velocity.x, this.player.velocity.y)`.
3. `src/render/GothicBackdrop.ts`:
   - Align parallax layers with centered camera:
     - In `renderForegroundMist`, remove flickering conditions (`if (Math.abs(startY) > 4)`) and ensure smooth continuous 2D modular wrapping.
     - Ensure vertical gradient transitions smoothly without sharp seams when moving in world coordinates.
4. Unit Tests in `tests/unit/camera_tracking.spec.ts`:
   - Implement all 6 comprehensive test suites designed in `explorer_m2_3/handoff.md`:
     - Test 1: Steady-state player centering at $(W/2, H/2)$.
     - Test 2: Exponential damping ($k = 8.0$) smooth non-overshooting convergence.
     - Test 3: Sudden 180-degree velocity reversal smoothly transitions without jarring jumps.
     - Test 4: Velocity lookahead strictly bounded by $\le 40\text{px}$.
     - Test 5: World boundary limits clamp camera smoothly without out-of-bounds void exposure.
     - Test 6: Screen shake trauma decays smoothly to 0 without permanent camera drift.
5. Verification commands:
   - Run `npx tsc --noEmit`
   - Run `npm test`
   Ensure 100% green tests across all test files.
6. Write your completion report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2/handoff.md`.
7. Send a message to orchestrator when finished.
