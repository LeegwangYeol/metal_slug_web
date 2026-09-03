# Dispatch: Worker M5 (Flake Fix & Playwright Visual Suite)

## Mission
Calibrate the SpatialGrid latency benchmark in `tests/unit/adversarial_challenge.test.ts` to eliminate false CI failures, and implement the Playwright visual verification test suite in `tests/e2e/visual_verification.spec.ts`.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m5

## Exclusive File Ownership
- `tests/unit/adversarial_challenge.test.ts`
- `tests/e2e/visual_verification.spec.ts`

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_3/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_3/survey_report.md`

## Instructions
1. In `tests/unit/adversarial_challenge.test.ts`:
   - Calibrate the Task 4 SpatialGrid saturation benchmark around line 394. Add a warm-up phase (e.g. 50-100 queries) and calibrate the latency assertion to `< 250` or `< 500` microseconds per query to prevent false test failures under heavy load while preserving high-performance verification.
   - Run `npm test` to verify all 13 test files pass 100% green.
2. In `tests/e2e/visual_verification.spec.ts`:
   - Implement the Playwright visual verification test suite according to Explorer 3's specifications:
     - Boot headless Chromium at 960x540 (2x virtual resolution).
     - Target capture of the 5 required screenshots to `artifacts/screenshots/`:
       - `screenshot_01_idle_crosshair.png`
       - `screenshot_02_aim_up_forward.png`
       - `screenshot_03_jump_arc.png`
       - `screenshot_04_enemy_smooth_spawn.png`
       - `screenshot_05_combat_upgraded_sprites.png`
     - Provide programmatic helper mechanisms or test scenarios ensuring these frames are reliably triggerable and captured.
3. Verify the test suite by running `npx vitest run tests/unit/adversarial_challenge.test.ts`.
4. Deliver `handoff.md` in your working directory with build & test output.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-03T06:22:35Z
You are worker_m5.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m5
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m5/DISPATCH.md

Exclusive File Ownership:
- tests/unit/adversarial_challenge.test.ts
- tests/e2e/visual_verification.spec.ts

Your task:
1. In tests/unit/adversarial_challenge.test.ts:
   - Calibrate the SpatialGrid benchmark around line 394: add a JIT warm-up loop (e.g. 50-100 queries) and calibrate the latency assertion to < 500µs (or < 250µs) so that the test reliably passes under CI and system load while continuing to verify high-performance O(1)/O(K) spatial hashing.
   - Run npx vitest run tests/unit/adversarial_challenge.test.ts to verify it passes 100% green.
2. In tests/e2e/visual_verification.spec.ts:
   - Implement the Playwright visual verification test suite:
     - Boot headless Chromium at 960x540 (2x virtual resolution).
     - Set up test cases to capture the 5 required screenshots into artifacts/screenshots/:
       - screenshot_01_idle_crosshair.png (player standing with visible aiming crosshair)
       - screenshot_02_aim_up_forward.png (player aiming diagonally upward with directional sprite)
       - screenshot_03_jump_arc.png (natural jump arc trajectory frame)
       - screenshot_04_enemy_smooth_spawn.png (rebel soldier walking in from off-screen margin)
       - screenshot_05_combat_upgraded_sprites.png (combat scene with upgraded high-res sprites)
     - Ensure the test suite handles Vite preview server connection cleanly.
3. Run npm test to verify unit tests pass.
4. Output your handoff report to /Users/user/src/fullmetalslug/.agents/worker_m5/handoff.md with test outputs. Send a message to orchestrator when done.
