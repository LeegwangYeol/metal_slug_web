## 2026-09-10T06:43:30Z

You are Worker M3 for the Autonomous Cute Shooter Reinvention Project.
Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m3_test
Project root: /Users/user/teamwork_projects/metal_slug_web
Authoritative request: /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
Project blueprint: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_cute_reinvention/PROJECT.md
Explorer 3 Survey handoff: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_cute_test_3/handoff.md
Parent conversation ID: 126ae93c-9f63-4451-b923-a4f1126318fc

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A forensic auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK: Milestone M3 — Automated Playtesting (15s Playwright Loop), Visual Proof Screenshots & Test Hardening
Implement and execute the automated playtesting, visual proof screenshot capture, and test suite verification per Explorer 3's detailed specification (`/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_cute_test_3/handoff.md` §3):

1. Create directory:
   `artifacts/cute_reinvention/` at project root.

2. Implement `tests/e2e/cute_gameplay_loop.spec.ts`:
   Follow Explorer 3's exact blueprint (§3.1):
   - `test.setTimeout(60000)`
   - TEST 1 (Playable Core Loop):
     - Actively plays the new cute game loop for >= 15 continuous seconds without any JavaScript errors or engine errors.
     - Partition into 5 dynamic phases (Phase 1: 0-3s navigation & sweet bubble firing; Phase 2: 3-7s combat & bubble cascades; Phase 3: 7-11s platform climbing & candy pickup; Phase 4: 11-13.5s sweet fever/ultimate; Phase 5: 13.5-16s altar navigation).
     - Samples coordinates and entity count every 1.5s to assert `Number.isFinite(x)`, `Number.isFinite(y)`, entities >= 1.
     - Listens to `page.on('pageerror')` and `page.on('console', type === 'error')` asserting 0 errors.
     - Asserts `actualDurationMs >= 15000`.
   - TEST 2 (Visual Proof):
     - Captures 4 canonical screenshots into `artifacts/cute_reinvention/`:
       1. `01_cute_hero_and_pastel_world.png` (Chibi hero, pastel meadow, beating heart HUD)
       2. `02_cute_combat_and_candy_projectiles.png` (Active bubble combat, candy pickups)
       3. `03_cute_star_blossom_ultimate.png` (Sweet star blossom / rainbow rush ultimate burst)
       4. `04_cute_arena_overview.png` (Panoramic view with Mochi pet companion, Blossom Altars)
     - Asserts all 4 files exist and each file size is > 10,000 bytes.
   - TEST 3 (Artifact Audit):
     - Validates PNG magic bytes (`0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A`).
     - Validates exact 960x540 dimensions for all 4 images.

3. Unit Test Hardening (`tests/unit/cute_sprites_and_palette.test.ts`):
   - Implement unit tests verifying pastel palette RGBA conversions and procedural rendering of cute expansion sprites (slimes, bees, donut rollers, gummy colossus, cubs) without altering the 164 canonical baseline sprite keys invariant.

4. Execution & Verification:
   - Run `npm run build` (must succeed with 0 TypeScript compilation errors).
   - Run `npm test` (must pass 100% green across all unit test suites).
   - Run `npx playwright test tests/e2e/cute_gameplay_loop.spec.ts` (must pass 100% green).
   - Run `npm run test:e2e` (all E2E suites must pass 100% green).
   - Inspect `artifacts/cute_reinvention/` to confirm all 4 PNG files exist, are > 10KB, and 960x540.

DELIVERABLES:
- Write a comprehensive `handoff.md` in your working directory (`/Users/user/teamwork_projects/metal_slug_web/.agents/worker_cute_m3_test/handoff.md`) with build/test command outputs, screenshot artifact metadata, and pass/fail evidence.
- Send a message to parent when finished.
