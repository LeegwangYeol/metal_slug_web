## 2026-09-10T12:12:03Z
You are Worker 1 for Milestone M4 (Automated E2E Playtesting & Hardening) of "Grim Harvest: Undead Siege".

Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_1
Project root: /Users/user/teamwork_projects/metal_slug_web

Authoritative Files:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md (MANDATORY: read this first!)
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md

Explorer Handoff Reports (READ THESE CAREFULLY FOR TEST BLUEPRINTS AND SCREENSHOT PROTOCOLS):
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_1/handoff.md (Playwright config, server lifecycle, error tracking)
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_2/handoff.md (30s continuous survival simulation, dynamic dodging, level-up card selection, unpause logic)
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_3/handoff.md (Visual proof screenshot protocol, 3 artifacts)
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_df_m4_3/screenshot_protocol.md (Turnkey screenshot code)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Tasks for Milestone M4:
1. Update `playwright.config.ts`:
   - Set testDir to `./tests/e2e`.
   - Set global timeout to 60000ms (or 90000ms) to support 30s+ active survival playtesting without false timeouts.
   - Configure viewport: `{ width: 960, height: 540 }` and `deviceScaleFactor: 1` (exact 1:1 match with game virtual resolution).
   - Configure webServer: command `'npm run build && npm run preview'`, port 4173, reuseExistingServer: !process.env.CI, timeout 60000ms.
   - Project: chromium desktop with 960x540 viewport.
2. Relocate Legacy E2E Tests:
   - Move old Metal Slug / Cute specs from `tests/e2e/` (e.g., `cute_gameplay_loop.spec.ts`, `adversarial_cute_input_spam.spec.ts`, `death_animations_screenshots.spec.ts`, `gameplay_controls.spec.ts`, `ui_overhaul_artifacts.spec.ts`, `ultimate_and_crisis_expansion.spec.ts`, `visual_verification.spec.ts`) into `tests/legacy/` so they do not conflict with the Dark Fantasy reboot.
   - Update `tests/e2e/game_initialization.spec.ts` to target Dark Fantasy `window.__game` (and `canvas#game-canvas`).
3. Implement `tests/e2e/horde_survival.spec.ts`:
   - Test 1: Continuous 30+ second survival playtest:
     - Attach listeners for console errors (`page.on('console', ...)`) and page errors (`page.on('pageerror', ...)`).
     - Navigate to game (`/`).
     - Wait for `canvas#game-canvas` to mount and `window.__game` to initialize.
     - Implement dynamic player dodging (WASD / arrow keys) using the bounded kiting steering logic from `explorer_df_m4_2/handoff.md` to avoid contact damage and stay in the arena.
     - Verify weapons auto-fire and enemies are slain (`hordeManager.totalKilled > 0`).
     - Verify loot gems are vacuumed and XP accumulates (`player.progression.currentXP >= 10`).
     - When Level-Up modal opens, verify simulation pauses (`isPaused === true`), send keypress `'1'` or `Digit1` (or canvas click) to choose an upgrade card.
     - Verify modal closes, upgrade is applied, simulation unpauses cleanly, and accumulator resets with zero delta spikes.
     - Continue simulation until survival timer >= 30.0 seconds.
     - Assert player is still alive (`player.isAlive === true` and `player.currentHealth > 0`).
     - Assert zero console errors and zero unhandled page errors.
   - Test 2: High-Resolution Visual Proof Screenshot Generation:
     - Using the deterministic protocol from `explorer_df_m4_3/screenshot_protocol.md`:
     - Ensure directory `artifacts/dark_fantasy/` exists (`fs.mkdirSync('artifacts/dark_fantasy', { recursive: true })`).
     - Capture `artifacts/dark_fantasy/horde_swarm.png` (dense undead swarm around sorcerer against blood moon).
     - Capture `artifacts/dark_fantasy/level_up_modal.png` (canvas-rendered gothic card modal with gold filigree and rank pips).
     - Capture `artifacts/dark_fantasy/survival_gameplay.png` (active spell VFX: Arcane Scythe cleave, Soul Orbiters skulls, Abyssal Lightning arcs, Bone Spear trails, and Cursed Aura pulses).
     - Assert all 3 image files exist and each file size is strictly `> 50 KB`.
4. Run and Verify Test Suites:
   - Run `npx tsc --noEmit` (0 errors)
   - Run `npm test` (all 18 unit test files, 210 tests, pass 100% green)
   - Run `npm run build` (clean build)
   - Run `npx playwright test` (all tests in `tests/e2e/` pass 100% green)
   - Verify that the 3 image files in `artifacts/dark_fantasy/` exist and are valid.
5. Keep your liveness updated in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_1/progress.md`.
6. Write a comprehensive handoff report at `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_df_m4_1/handoff.md` detailing all files modified/created, test execution outputs, and screenshot file sizes.
7. Send a message to parent when done.
