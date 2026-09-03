# BRIEFING — 2026-09-03T08:31:00Z

## Mission
Investigate Input and Player Kinematics / Jump Mechanics for Metal Slug Web overhaul.

## 🔒 My Identity
- Archetype: explorer
- Roles: [investigation, synthesis]
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1
- Original parent: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Milestone: Explorer Survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Wait for explicit user approval before proceeding with implementation
- Communicate with Claude via Rule Guide (COLLABORATION.md)
- Teamwork explorer role constraints

## Current Parent
- Conversation ID: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/input/KeyboardController.ts` (key mappings, event listeners, getSnapshot, resolveAction)
  - `src/input/TouchVirtualPad.ts` (touch overlay, D-pad, action buttons)
  - `src/core/player/PlayerKinematics.ts` (Newtonian constants, AABB, 8-way aim, jump cut)
  - `src/core/player/PlayerController.ts` (handleInput, performJump, gravity integration, ground collision)
  - `src/core/physics/Platform.ts` (resolveGroundContact, checkSemiSolidLanding, solid landing)
  - `src/core/engine/GameEngine.ts` (60Hz accumulator, entity update loop)
  - `src/render/Camera.ts` (worldToScreen, viewport bounds)
  - `src/main.ts` (FullMetalSlugGame, bootstrap, accumulator loop, stage 1 platforms)
  - `tests/unit/input_and_hud.test.ts`, `tests/unit/player_kinematics_aiming.test.ts`, `tests/e2e/game_initialization.spec.ts`, `tests/e2e/visual_verification.spec.ts`
- **Key findings**:
  1. Space was explicitly mapped to `'fire'` (`Space: 'fire'` and `case ' ': return 'fire'`), causing Spacebar to fire bullets instead of jumping.
  2. Edge latching was missing in `KeyboardController.ts`, causing rapid key taps (e.g. `page.keyboard.press('KeyK')`) to be dropped between animation frames.
  3. The core Newtonian physics in `PlayerKinematics.ts` and `PlayerController.ts` is fully functional and mathematically sound: when jump is triggered, `velocity.y = -360 px/s` and `position.y` moves upward from 230 to ~166px in 15 frames, snapping back on landing.
  4. Movement via Arrow keys and WASD is functional; horizontal velocity (+/- 132 px/s) integrates cleanly.
- **Unexplored areas**: None regarding input, kinematics, and jump mechanics. Full root cause established.

## Key Decisions Made
- Confirmed Space must be mapped to `'jump'`, and 'J'/'Z' strictly to `'fire'`, 'L'/'C' to `'grenade'`.
- Identified necessary edge latching in `KeyboardController.ts` (`jumpJustPressed`, `fireJustPressed`, `grenadeJustPressed`) to prevent dropped inputs.
- Prepared comprehensive Playwright E2E and Vitest unit test specifications.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/DISPATCH.md — Dispatch log
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/BRIEFING.md — Working memory
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/progress.md — Liveness heartbeat
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_1/handoff.md — Comprehensive handoff report
