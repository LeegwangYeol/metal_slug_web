## 2026-09-03T08:41:53Z

You are Worker 4 (Test & Verification Specialist) for the Metal Slug Web Critical Gameplay Bugs Overhaul.

Read the authoritative context:
- ORIGINAL_REQUEST.md: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Project Scope: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md
- Worker 1 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_controls/handoff.md
- Worker 2 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_spawning/handoff.md
- Worker 3 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_boss/handoff.md
- Explorer 3 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_3/handoff.md

Your Working Directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_tests

Exclusive Ownership:
- Test files in `tests/` (unit tests and e2e tests)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Implement Milestone 4 (M4: Comprehensive E2E & Unit Test Verification Suite):
1. Update existing unit test files that had obsolete expectations of 1500 HP:
   - `tests/unit/enemy_boss_statemachine.test.ts`: update to expect `maxHealth = 400`, Phase 2 at `260` HP, Phase 3 at `120` HP.
   - `tests/unit/challenger_boss_and_stability.test.ts`: update to expect `400` HP, `260` HP, `120` HP.
2. Create dedicated Boss Rebalance Unit Test (`tests/unit/boss_rebalance.test.ts`):
   - Explicitly assert `boss.maxHealth <= 500` (specifically 400 HP).
   - Assert dynamic phase thresholds: Phase 1 -> 2 at 65% (260 HP), Phase 2 -> 3 at 30% (120 HP).
   - Assert burst damage clamping prevents instant multi-phase skipping.
3. Create dedicated Spawning Contract Unit Test (`tests/unit/spawning_contract.test.ts`):
   - Assert enemy wave spawn points spawn out-of-bounds ($X \ge \text{cameraX} + 480$).
   - Assert POWs in `StageData.pows` are placed statically at fixed stage coordinates ahead of player and no runtime timer popping occurs.
   - Assert enemy spawning Y aligns feet with ground ($Y = 192$, feet at $230$) ensuring ground contact is preserved.
4. Implement/Update Playwright E2E Tests (`tests/e2e/gameplay_controls.spec.ts`):
   - Real browser simulation (no fake mocks or trivialized shortcuts):
   - **Jump Test**: Navigate to game, simulate pressing `Space` key (`page.keyboard.press('Space')` or keydown/keyup), sample player sprite's Y coordinate, and mathematically assert $Y_{\text{peak}} < Y_{\text{start}}$ ($\Delta Y < 0$, player moves upward on screen). Also verify landing back down.
   - **Movement Test**: Simulate pressing `ArrowRight` and `ArrowLeft`, assert $X$ coordinate changes ($X_{\text{right}} > X_{\text{start}}$, $X_{\text{left}} < X_{\text{right}}$).
5. Run full verification suite:
   - Run typecheck and production build: `npm run build`
   - Run all Vitest unit tests: `npx vitest run`
   - Run all Playwright E2E tests: `npx playwright test`
   Ensure 100% green on all tests!
6. Deliverable:
   - Write comprehensive handoff report to `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_tests/handoff.md` with:
     - Summary of tests added/updated
     - Full outputs of `npm run build`, `npx vitest run`, and `npx playwright test`
   - Send completion message to parent with path to handoff.
