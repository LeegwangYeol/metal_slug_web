## 2026-09-08T14:27:00Z

You are a Worker subagent (teamwork_preview_worker) for Milestone M4 (Playwright E2E Integration & Visual Proof Screenshots).
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Explorer 1 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_1/handoff.md
- Explorer 2 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2/handoff.md
- Explorer 3 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/handoff.md

FILE OWNERSHIP:
You have exclusive write ownership of:
- src/main.ts (for __EXPANSION__ window exposure in bootstrap)
- tests/e2e/ultimate_and_crisis_expansion.spec.ts
- artifacts/expansion/

TASK & IMPLEMENTATION REQUIREMENTS:
1. In `src/main.ts`:
   - Inside `bootstrap()`, expose expansion classes under `(window as any).__EXPANSION__` so Playwright tests can construct expansion entities in `page.evaluate()`:
     ```typescript
     if (typeof window !== 'undefined') {
       (window as any).__GAME__ = game;
       (window as any).__ENGINE__ = game.engine;
       (window as any).__AUDIO_CTX__ = game.soundEngine.ctx;
       (window as any).__CORPSE_MANAGER__ = game.corpseManager;
       (window as any).__EXPANSION__ = {
         IronNokanaBoss,
         CrisisEventManager,
         AllyNPC,
         AllyManager,
         ItemPickupEntity,
         ItemDropType,
         vec2,
       };
     }
     ```
     Ensure required imports (`IronNokanaBoss`, `CrisisEventManager`, `AllyNPC`, `AllyManager`, `ItemPickupEntity`, `ItemDropType`, `vec2`) are present in `src/main.ts`.
2. In `tests/e2e/ultimate_and_crisis_expansion.spec.ts`:
   - Implement the complete Playwright E2E expansion suite based on the blueprint in `explorer_m4_2/handoff.md`:
     * Scenario 1: KeyU ultimate move input, 4-phase progression (`FREEZE` -> `STRIKE_PASS` -> `DETONATION` -> `RECOVERY`), on-screen minion wipe (100% standard enemies cleared) with 0 friendly fire.
     * Scenario 2: Mid-Boss vehicle encounter and Iron Nokana multi-phase crisis triggers (75% artillery, 50% platform collapse & camera contraction, 25% rage overdrive) and 120 HP burst damage.
     * Scenario 3: Autonomous Ally NPC (Hyakutaro follow & Ki blast attack), diverse weapon pickups (Shotgun, Laser Gun, Rocket Launcher, Shield, Medkit).
3. Visual Proof Screenshots in `artifacts/expansion/`:
   - Save screenshots capturing the game canvas:
     * `artifacts/expansion/ultimate_strike_pass.png` (and `screenshot_ultimate_strike_bomber.png`)
     * `artifacts/expansion/ultimate_detonation_flash.png` (and `screenshot_ultimate_detonation_blast.png`)
     * `artifacts/expansion/crisis_boss_encounter.png` (and `screenshot_boss_nokana_crisis.png`)
     * `artifacts/expansion/ally_pow_rescue.png` (and `screenshot_ally_and_weapons.png`)
   - Ensure `fs.mkdirSync('artifacts/expansion', { recursive: true })` is called and files have size > 5,000 bytes.
4. Run verification commands:
   - `npm run build` (must pass cleanly, exit code 0)
   - `npx vitest run` (all 34 test files must pass, 453/453 green)
   - `npx playwright test tests/e2e/ultimate_and_crisis_expansion.spec.ts` (all tests pass)
   - `npx playwright test` (all 20+ E2E tests pass across all suites)
   - Check that all screenshots exist in `artifacts/expansion/`.
5. Write your complete handoff report to:
   `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1/handoff.md`
   and call `send_message` to parent.
