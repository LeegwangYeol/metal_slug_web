## 2026-09-11T02:58:36Z

You are Worker 3 (Agent 20) for Milestone 3: Automated Playwright E2E Suite & Visual Proof.
Your working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3
Project root: /Users/user/teamwork_projects/metal_slug_web

Read the following documents before starting:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_hitbox_camera/SCOPE.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m3_3/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Implementation Tasks:
1. `src/main.ts`:
   - Ensure `(window as any).game = game;` is exposed alongside `__game` and `__GAME__` so test harnesses can inspect state cleanly.
2. Implement `tests/e2e/hitbox_dodge.spec.ts`:
   - An automated Playwright E2E test that drives the player weaving through enemies.
   - Verifies that grazing enemies at near-miss distances (12–20px outside physical touch) deals ZERO damage to player health.
   - Verifies that true physical collision cleanly registers damage and emits blood burst VFX.
3. Implement `tests/e2e/camera_view.spec.ts`:
   - An automated Playwright E2E test verifying that the camera angle is centered and comfortable.
   - Captures high-resolution gameplay visual proof screenshots and saves them to:
     - `artifacts/dark_fantasy/improved_camera_angle.png`
     - `artifacts/dark_fantasy/hitbox_precision_dodge.png`
   - Ensure each generated PNG image is strictly > 50KB.
   - Assert in the test that both files exist and are > 50,000 bytes.
4. Verification commands:
   - Run `npx tsc --noEmit`
   - Run `npm run build`
   - Run `npx playwright test tests/e2e/hitbox_dodge.spec.ts tests/e2e/camera_view.spec.ts`
   - Verify that all Playwright tests pass 100% cleanly.
   - Verify screenshot file sizes in `artifacts/dark_fantasy/`.
5. Write your completion report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3/handoff.md`.
6. Send a message to orchestrator when finished.
