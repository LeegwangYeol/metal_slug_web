# Dispatch: Worker M6 (Visual Screenshot Capture & AI Design Evaluation)

## Mission
Execute the Playwright visual verification suite to capture all 5 required gameplay screenshots into `artifacts/screenshots/`, visually critique each frame, and author the comprehensive AI visual evaluation report in `artifacts/VISUAL_EVALUATION.md`.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m6

## Exclusive File Ownership
- `artifacts/screenshots/` (screenshots output)
- `artifacts/VISUAL_EVALUATION.md` (formal design critique document)

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_3/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/worker_m4/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/worker_m5/handoff.md`

## Instructions
1. Run the Playwright visual verification test suite:
   ```bash
   npx playwright test tests/e2e/visual_verification.spec.ts
   ```
   Ensure all 5 screenshots are successfully captured and saved into `artifacts/screenshots/`:
   - `screenshot_01_idle_crosshair.png`: Player standing idle with visible aiming crosshair/reticle.
   - `screenshot_02_aim_up_forward.png`: Player aiming diagonally upward (UP_FORWARD, 45°) with directional sprite posture and angled crosshair.
   - `screenshot_03_jump_arc.png`: Frame showing natural parabolic jump arc at apex.
   - `screenshot_04_enemy_smooth_spawn.png`: Frame showing rebel soldier walking in smoothly across the right screen margin without popping.
   - `screenshot_05_combat_upgraded_sprites.png`: Combat scene featuring upgraded Neo Geo high-res sprites, muzzle flash, projectiles, and brass casings.
2. Inspect the captured screenshot files (dimensions, file size, visual content).
3. Author a thorough, professional, multi-section AI Visual Design Evaluation report in `artifacts/VISUAL_EVALUATION.md`:
   - Executive Summary
   - Evaluation Methodology & Viewport Specifications (960x540, 2x virtual resolution)
   - Detailed Frame-by-Frame Visual Analysis:
     - Frame 1: Crosshair clarity, weapon HUD, idle pose.
     - Frame 2: Directional aiming posture, diagonal reticle projection.
     - Frame 3: Newtonian parabolic flight curve, apex hangtime, ground geometry.
     - Frame 4: Smooth enemy entrance across screen margin, zero pop-in proof.
     - Frame 5: High-res 16-color Neo Geo sprites, combat particles, retro arcade authenticity.
   - Scoring Rubric (5 Dimensions, scored out of 10 or 100 with weighted composite).
   - Comparative Analysis: Baseline flat Atari blocks vs Overhauled Neo Geo pixel art.
   - Acceptance Criteria Verification Checklist (confirming R1, R2, R3 full satisfaction).
4. Run `npm test` and `npm run test:e2e` to confirm 100% green test status across both Vitest and Playwright.
5. Deliver `handoff.md` in your working directory with build & test output and links to all artifacts.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-03T06:49:54Z

You are worker_m6.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m6
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m6/DISPATCH.md

You MUST read /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md before starting work.

Exclusive File Ownership:
- artifacts/screenshots/
- artifacts/VISUAL_EVALUATION.md

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
1. Run the Playwright visual verification suite:
   npx playwright test tests/e2e/visual_verification.spec.ts
   Verify that all 5 required screenshots are generated and saved in artifacts/screenshots/:
   - screenshot_01_idle_crosshair.png (player standing with visible aiming crosshair)
   - screenshot_02_aim_up_forward.png (player aiming diagonally upward with directional sprite posture)
   - screenshot_03_jump_arc.png (parabolic jump arc trajectory at apex)
   - screenshot_04_enemy_smooth_spawn.png (rebel soldier walking in smoothly from off-screen margin)
   - screenshot_05_combat_upgraded_sprites.png (combat scene with upgraded Neo Geo high-res sprites)
2. Visually critique and evaluate each captured frame.
3. Author the formal AI Visual Design Evaluation report in artifacts/VISUAL_EVALUATION.md covering:
   - Executive Summary
   - Viewport and Capture Methodology (960x540, 2x scale)
   - Detailed Frame-by-Frame Visual Analysis (crosshairs, aiming postures, Newtonian physics, smooth ingress without popping, high-res 16-color sprites)
   - Scoring Rubric across 5 core dimensions with weighted evaluation
   - Comparison: Baseline flat "Atari" blocks vs Overhauled Neo Geo arcade pixel art
   - Verification checklist against user acceptance criteria (R1, R2, R3).
4. Run npm test and npm run test:e2e to verify 100% green tests across Vitest and Playwright.
5. Deliver handoff.md in your working directory with test outputs and artifact links. Send a message to orchestrator when done.

