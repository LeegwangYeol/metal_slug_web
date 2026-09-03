# Dispatch History

## 2026-09-03T06:14:26Z

You are the Project Orchestrator for the Metal Slug Web Gameplay & Visual Overhaul project.

Workspace Root: /Users/user/src/fullmetalslug (also symlinked as ~/teamwork_projects/metal_slug_web)
Your Working Directory: /Users/user/src/fullmetalslug/.agents/orchestrator
Original User Request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md (and /Users/user/src/fullmetalslug/.agents/ORIGINAL_REQUEST.md)
Collaboration Guide: /Users/user/src/fullmetalslug/COLLABORATION.md

The user has explicitly approved the overhaul plan ("승인"). Your mission is to coordinate the swarm to execute the overhaul:

## Key Requirements to Fulfill
1. R1. Physics and Enemy Spawning:
   - Fix physics logic (collision, gravity, movement) to follow natural Newtonian principles and feel consistent and authentic.
   - Fix enemy spawning logic: Minions must NOT pop into view within the active camera viewport. Spawners must position minions out-of-bounds (e.g. camera.maxX + 40px or camera.minX - 40px) so they enter smoothly with running/patrol animations. Add off-screen despawning.
2. R2. Graphics and Aiming Overhaul:
   - Upgrade character, enemy, and POW sprites from primitive flat "Atari" style to high-resolution, detailed Neo Geo pixel art in ProceduralSpriteFactory.ts.
   - Implement clear visual aiming indicators (dynamic weapon crosshairs/reticles along the player's aim vector).
   - Implement distinct character upper-body animations matching the 5 aim angles (FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN).
3. R3. Visual Design Verification via Screenshots:
   - Implement a Playwright headless browser test suite (e.g. tests/e2e/visual_verification.spec.ts) capturing screenshots into artifacts/screenshots/:
     - screenshot_01_idle_crosshair.png (player standing with aiming crosshair)
     - screenshot_02_aim_up_forward.png (diagonal aim posture and crosshair)
     - screenshot_03_jump_arc.png (natural jump arc)
     - screenshot_04_enemy_smooth_spawn.png (rebel soldier walking in from off-screen margin)
     - screenshot_05_combat_upgraded_sprites.png (combat with upgraded high-res sprites)
   - Perform AI visual critique and document findings in artifacts/VISUAL_EVALUATION.md.
4. Acceptance Criteria & 100% Green Tests:
   - Fix any failing/flaky tests (such as the timing threshold in tests/unit/adversarial_challenge.test.ts for SpatialGrid saturation).
   - Ensure all Vitest unit tests and Playwright E2E tests pass 100% green.

## Coordination & Swarm Process
- Create your BRIEFING.md, PROJECT.md, and progress.md in your working directory.
- Dispatch tasks to specialist workers (Physics/Spawning, High-Res Sprites, Crosshair/Animations, Visual E2E Tests, Reviewer/Challenger).
- Frequently update progress.md as work proceeds.
- When all deliverables and acceptance criteria are verified, report completion back to the Sentinel.
