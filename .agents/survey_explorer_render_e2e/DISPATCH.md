## 2026-09-03T16:18:54Z
You are a teamwork_preview_explorer assigned to survey Rendering, Audio, and E2E Testing for the Metal Slug Web Massive Expansion.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_render_e2e
You MUST read:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md

Your tasks:
1. Thoroughly investigate rendering pipeline (src/render/CanvasRenderer.ts, ProceduralSpriteFactory.ts), procedural audio synthesis (src/audio/SoundEngine.ts), and testing infrastructure (tests/unit/, tests/e2e/, playwright.config.ts).
2. Map out how to implement:
   - Procedural pixel-art sprite generators for new bosses, crisis hazards, ally NPCs, expanded weapon projectiles/items, and ultimate move visual strike effects.
   - Visual FX: Screen flash, freeze frame, siren sound effect, particle shockwaves.
   - Playwright E2E browser test: Headless browser test that MUST trigger the ultimate move and mathematically assert that it correctly clears or severely damages all enemies on screen.
   - Visual Proof: Playwright screenshots capturing the Ultimate Move execution and the new Boss/Crisis environments saved to artifacts/expansion/.
   - Strategy to ensure 100% test pass rate across all existing (294 unit tests, 17 E2E tests) and new tests, with zero build errors.
3. Identify exact files to create or modify, render loop hooks, audio synthesis methods, and E2E test specs.
4. Write your detailed findings and technical recommendations to /Users/user/teamwork_projects/metal_slug_web/.agents/survey_explorer_render_e2e/analysis.md and produce a complete handoff.md in your working directory.
5. Send a concise completion message back to the parent orchestrator when done.
