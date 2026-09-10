## 2026-09-10T00:58:57Z
You are worker_m1_viewport.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_viewport
Your parent conversation ID is: dc4b76ec-2c8d-41af-8152-fb6d5ed83654

MANDATORY READING:
1. /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (read verbatim, especially latest entries at 2026-09-10T00:51:57Z, 2026-09-10T00:52:02Z, and 2026-09-10T00:53:24Z).
2. /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
3. /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
4. /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_viewport_1/handoff.md
5. /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_ui_survey_viewport_1/survey_report.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE FILE OWNERSHIP:
- src/render/CanvasRenderer.ts
- src/render/Camera.ts
- src/render/ParallaxBackground.ts
- src/ui/HUDOverlay.ts
- src/render/sprites/ProceduralSpriteFactory.ts
- src/main.ts (canvas resolution, camera bounds, boss arena locks)
- index.html
- tests/e2e/game_initialization.spec.ts
- tests/unit/render_components.test.ts

TASK & DELIVERABLES:
1. Viewport & Canvas Resolution Expansion:
   - Set CanvasRenderer.VIRTUAL_WIDTH = 960 and VIRTUAL_HEIGHT = 540.
   - Update index.html canvas attributes and CSS styling (pixelated scaling).
   - In src/main.ts, initialize canvas and camera to 960x540.
   - In src/render/Camera.ts, set default viewport width 960, height 540, and configure widescreen deadzones (>528px forward reaction view).
   - In src/main.ts, expand mid-boss and end-boss arena lockdown widths from 480px to 1100px so players have room to maneuver and the fight does not feel claustrophobic.
2. Parallax Tiling & Charming Sunny Coastal Palette:
   - In ParallaxBackground.ts, replace hardcoded buffer assumptions with modular horizontal wrapping (while drawX < viewportWidth) supporting 960px seamlessly.
   - Infuse vibrant tropical palette: sunny azure sky, golden dunes, turquoise waters with foam, giving a delightful arcade look.
3. Visual Charm & Chibi-Arcade Styling:
   - Enhance sprite rendering with cute/charming retro arcade touches (expressive eyes, fluttering headband, bouncy posture) without breaking sprite keys (preserve 164-key invariant in ProceduralSpriteFactory).
4. HUD Responsiveness:
   - Ensure HUDOverlay.ts warning/pause/stage-clear/game-over banners span the dynamic viewport width (960) without hardcoded 480 clipping.
5. Verification:
   - Update tests/e2e/game_initialization.spec.ts and tests/unit/render_components.test.ts to match 960x540.
   - Run build and test commands: `npm test` (or `npx vitest run`) and `npx tsc --noEmit`. Verify 100% pass and 0 TS errors.
   - Document all changes, test commands, and passing output in handoff.md in your working directory.
   - Send completion message to parent when done.
