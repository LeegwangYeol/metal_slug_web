# DISPATCH — challenger_m2_fov_2

## Identity
- TypeName: teamwork_preview_challenger
- Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_2
- Parent Conversation ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Required Reading
Before starting, you MUST read:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/handoff.md

## Objective
Adversarially challenge and stress-test the Wave Spawner, Viewport Culling, Backdrop Tiling, and Dynamic Lighting at $1200 \times 675$:
1. Write and execute an adversarial test harness (e.g. in `tests/unit/ChallengerM2_FOV_SpawningBackdrop.test.ts` or run existing M2 tests).
2. Stress test:
   - Off-screen Spawner Invariant: Under 1,000 randomized camera positions and orientations, assert that every spawned enemy in `spawnRingSurround` has a distance $\ge 800\text{px}$ from camera center, and distance from any viewport boundary strictly $> 0$ (never on-screen at spawn).
   - Backdrop Tiling Seams: Test toroidal wrapping across arbitrary camera translations $(camX, camY) \in [-100000, 100000]$. Verify zero empty vertical/horizontal bands.
   - Dynamic Lighting Buffer Integrity: Verify darkness canvas resolution is exactly $1200 \times 675$ and that vignette gradient radius $[250, 725]\text{px}$ spans all corners of the visible screen.
3. Run `npm test` and verify all tests pass 100% green.
4. Formulate gate verdict: **APPROVE** or **REQUEST_CHANGES**.

## Deliverables
Write your reports to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_2/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/challenger_m2_fov_2/handoff.md
Send a completion message back to parent with your verdict and handoff link.
