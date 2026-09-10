## 2026-09-10T00:54:20Z

You are explorer_ui_survey_respawn_3.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_respawn_3
Your parent conversation ID is: dc4b76ec-2c8d-41af-8152-fb6d5ed83654

MANDATORY INSTRUCTIONS:
1. FIRST READ:
   - /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (read verbatim, especially the latest entries at 2026-09-10T00:51:57Z, 2026-09-10T00:52:02Z, and 2026-09-10T00:53:24Z).
   - /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md (Claude collaboration guide and user feedback).
2. MISSION:
   Survey player death flow, game over / continue countdown screen, respawn loop, tutorial overlay, controls guide, and HUD design across the codebase (e.g., src/core/player/, src/core/game/, src/ui/, src/input/, src/main.ts, tests/).
3. KEY INVESTIGATION POINTS:
   - What happens right now when player HP reaches 0? Where is death handled?
   - How does respawn or restart currently work? Is it abrupt or jarring?
   - What state machine exists for Game Over, Continue countdown (e.g. classic arcade 9, 8, 7...), and respawn drop-in (invulnerability timer, flashing, tactical re-entry)?
   - What HUD and UI elements currently exist (src/ui/, src/render/HUD.ts, etc.)?
   - How should the tutorial / controls overlay be structured? (Clear, charming arcade instruction overlay showing WASD/Arrows to move, J/Z fire, K/X jump, L/C grenade, U/Space ultimate, with an easy toggle or auto-dismiss).
   - How can the UI be made visually charming, cute, and arcade-authentic rather than sterile?
   - What unit and E2E tests are needed to verify the continue screen, countdown, respawn, and tutorial overlay?
4. OUTPUT:
   Write survey_report.md and handoff.md in your working directory (/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_respawn_3/).
   Update progress.md frequently.
   When done, send a message to parent (ID: dc4b76ec-2c8d-41af-8152-fb6d5ed83654).
   DO NOT MODIFY SOURCE CODE. You are read-only.
