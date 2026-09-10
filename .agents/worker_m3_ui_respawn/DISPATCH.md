# DISPATCH — 2026-09-10T01:40:53Z

You are worker_m3_ui_respawn.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_respawn
Your parent conversation ID is: dc4b76ec-2c8d-41af-8152-fb6d5ed83654

MANDATORY READING:
1. /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (read verbatim, especially latest entries at 2026-09-10T00:51:57Z, 2026-09-10T00:52:02Z, and 2026-09-10T00:53:24Z).
2. /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
3. /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
4. /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_respawn_3/handoff.md
5. /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_respawn_3/survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- src/core/player/PlayerController.ts
- src/core/player/PlayerTypes.ts (or wherever PlayerActionState is defined)
- src/ui/HUDOverlay.ts
- src/render/CanvasRenderer.ts (player death frames cycle & player parachute canopy pass)
- src/main.ts (continue countdown input wiring & tutorial toggle)
- src/input/KeyboardController.ts (ensure key 'H' or 'KeyH' is mapped for tutorial toggle)
- tests/unit/death_respawn_ui.test.ts (create unit tests)

TASKS & DELIVERABLES:
1. Authentic Player Death Sequence:
   - In PlayerController.ts: When HP <= 0, do NOT instantly reset health or freeze. Instead, transition to PlayerActionState.DYING with a 1.2s knockback arc (initial velocity.y = -260, velocity.x = facing * -80, gravity applied).
   - In CanvasRenderer.ts: Animate through pre-rendered player_death_0, player_death_1, player_death_2, player_death_3 frames based on death timer progress.
   - If lives > 1, decrement lives and smoothly transition into RESPAWNING_PARACHUTE.
2. Classic Arcade Continue Countdown:
   - If lives <= 0, enter CONTINUE_COUNTDOWN state with a 10s timer.
   - In HUDOverlay.ts: Render classic arcade countdown screen with prominent pixel-art digits "CONTINUE 9... 8... 7...".
   - Pressing Fire (J / Z) or Jump (K / X / Spacebar) resets lives to 3 and triggers tactical parachute re-entry!
   - If the 10s timer expires without input, transition to the final GAME_OVER banner.
3. Tactical Parachute Respawn Loop:
   - In PlayerController.ts: PlayerActionState.RESPAWNING_PARACHUTE drops in from top of screen (Y = 20) with smooth descent velocity (vy = 60 px/s) and sinusoidal sway.
   - In CanvasRenderer.ts: Render parachute canopy and suspension cords above the player during descent.
   - Upon touchdown on ground or an elevated platform, transition to IDLE with 2.5s invulnerability flashing.
4. On-Screen Tutorial & Controls Placard:
   - In HUDOverlay.ts: Render an authentic arcade instructional placard displaying controls:
     - Move: WASD / Arrows
     - Fire: J / Z
     - Jump: K / X / Space
     - Grenade: L / C
     - Ultimate: U
     - Help: H to toggle tutorial
   - Automatically display on game start, auto-dismiss after 5 seconds, or toggle visibility at any time with key H.
5. HUD Polish:
   - In HUDOverlay.ts: Add Ultimate Move stock meter [U], cute animated Marco portrait, and beveled metallic arcade framing.
6. Verification:
   - Add comprehensive unit tests in tests/unit/death_respawn_ui.test.ts asserting death arc duration, continue countdown transition, continue key press restart, parachute drop-in kinematics, and tutorial toggle state.
   - Run npx tsc --noEmit and npm test (vitest run). Verify 100% green pass.
   - Document all changes, test commands, and passing output in handoff.md in your working directory.
   - Send completion message to parent when done.
