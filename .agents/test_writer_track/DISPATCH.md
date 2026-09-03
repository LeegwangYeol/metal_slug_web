## 2026-09-03T03:19:31Z

You are test_writer_track.
Your working directory is /Users/user/src/fullmetalslug/.agents/test_writer_track/.
Project workspace root is /Users/user/src/fullmetalslug/.

Read these files before starting:
- /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
- /Users/user/src/fullmetalslug/COLLABORATION.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/PROJECT.md
- /Users/user/src/fullmetalslug/.agents/orchestrator/TEST_INFRA.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_2/spec_report.md
- /Users/user/src/fullmetalslug/.agents/spec_miner_survey_3/spec_report.md

Milestone: Testing Track — Unit & E2E Test Suite Creation.

File Write Ownership (Exclusively yours):
- tests/unit/player_weapon_state.test.ts
- tests/unit/enemy_boss_statemachine.test.ts
- tests/unit/melee_ranged_decision.test.ts
- tests/e2e/game_initialization.spec.ts
- TEST_READY.md (at project root: /Users/user/src/fullmetalslug/TEST_READY.md)

Specifications to implement:
1. `tests/unit/player_weapon_state.test.ts`:
   - Vitest unit tests verifying:
     - Initial player weapon state (default Handgun, infinite ammo).
     - Weapon upgrade to Heavy Machine Gun (200 ammo, rapid fire rate, automatic flag).
     - Ammo depletion countdown on firing.
     - Automatic seamless fallback to Handgun when HMG ammo reaches 0.
     - Weapon upgrade to Flame Shot (30 ammo, continuous fireball pierce).
     - Automatic fallback to Handgun when Flame Shot ammo reaches 0.
     - Grenade inventory decrement on toss.
     - Hostage POW state transitions and item drop generation.
2. `tests/unit/enemy_boss_statemachine.test.ts`:
   - Vitest unit tests verifying:
     - Rebel soldier damage reception, state machine, and death removal.
     - Shield trooper frontal bullet deflection vs rear/explosive vulnerability.
     - Mid-Boss Iron Technical health gating, turret tracking, and add spawning limit.
     - Stage 1 Tetsuyuki Boss:
       - Phase 1 (Artillery & Rockets) down to health threshold.
       - Phase 2 (Hull breach, laser sweep, gatling) transition.
       - Phase 3 (Meltdown, reactor core weak point taking 1.5x damage).
       - Timed death explosion chain sequence and final DESTROYED state.
3. `tests/unit/melee_ranged_decision.test.ts`:
   - Vitest unit tests verifying:
     - Player within melee threshold (distance <= 38px) to living infantry triggers knife slash.
     - Knife slash inflicts 3.0 damage and suppresses projectile firing.
     - Player outside melee threshold (distance > 38px) fires ranged projectile.
     - Armored Mid-Boss vehicle and Tetsuyuki Boss reject knife attacks (`isMeleeVulnerable: false`) and trigger projectile shots even at point-blank range.
4. `tests/e2e/game_initialization.spec.ts`:
   - Playwright E2E test verifying:
     - Headless browser boot against Vite preview (`http://localhost:4173`).
     - `#game-container` and Canvas element presence with valid width/height.
     - 60 FPS animation loop running stably over 300 frames without crashing.
     - Zero uncaught fatal console errors or exceptions (`page.on('console', ...)` and `page.on('pageerror', ...)`).
5. Create `TEST_READY.md` at project root with complete test runner commands and coverage summary table.

Verification:
- Run `npm run test` and `npm run test:e2e` when implementation code is ready.
- Write handoff report to /Users/user/src/fullmetalslug/.agents/test_writer_track/handoff.md and notify orchestrator via send_message.
