## 2026-09-11T03:52:16Z

You are worker_m4_1 (role: Implementation & Testing Worker).
Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY FIRST STEP:
Read /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md before starting any work. Do not skip this.
Also read:
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_1/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_3/handoff.md
- /Users/user/teamwork_projects/metal_slug_web/tests/e2e/horde_survival.spec.ts
- /Users/user/teamwork_projects/metal_slug_web/src/main.ts

Your exclusive write ownership:
- tests/e2e/restart_survival.spec.ts
- src/main.ts (only if minor exposure adjustment needed, e.g. window.__game getter)

Implementation Requirements for Milestone 4:
Create `tests/e2e/restart_survival.spec.ts` using Playwright:

1. Test 1: Game Over, Death Debounce & Pristine Restart State Invariants
   - Navigate to `/`, wait for canvas and `window.__game ?? window.__GAME__`.
   - Set player health to 0 or simulate lethal damage.
   - Assert player is dead (`isAlive === false`), Game Over plaque is active, `canResurrect() === false` during the initial 0.5s death debounce.
   - Send early Spacebar / Canvas click event and assert restart is ignored during debounce.
   - Wait until `deathTimer >= 0.5s` so `canResurrect() === true`.
   - Trigger restart via Spacebar (`page.keyboard.press('Space')`) or canvas click.
   - Assert all pristine restart invariants:
     - `player.isAlive === true`
     - `player.stats.currentHealth === 100`
     - `player.level === 1`
     - `player.position.x === 0 && player.position.y === 0`
     - `weaponManager.getActiveWeapons()[0]?.id === 'scythe'`
     - `hordeManager.getActiveCount() >= 25`
     - `lootManager.getActiveCount() === 0`
     - `accumulator === 0`
     - `elapsedTime === 0`
     - `isPaused === false`
     - `loopEpoch` incremented (no duplicate RAF loops running).

2. Test 2: Post-Restart Autonomous Survival Loop (>= 15 Continuous Seconds)
   - After restarting, run the 8-directional dynamic window evaluation steering bot (adapted from `tests/e2e/horde_survival.spec.ts:218-466` with $H=0.32$s, sweet spot distance 64–80px for Arcane Scythe, danger penalty $< 58$px, and carousel orbit $R=320$px).
   - If Level-Up modal triggers, press 'Digit1' to select upgrade and unpause.
   - Run simulation until `elapsedTime >= 15.0` seconds post-restart.
   - Assert:
     - `elapsedTime >= 15.0`
     - `player.isAlive === true`
     - `player.stats.currentHealth > 0`
     - `kills >= 1`
     - `accumulator <= 1/60 + 0.01`
     - Zero engine crashes, zero infinite accumulator loops.
     - 0 console errors and 0 unhandled page errors.

3. Test 3: Visual Proof Screenshots Generation (All 3 Artifacts > 50KB in `artifacts/dark_fantasy/`)
   - Ensure directory `artifacts/dark_fantasy/` exists.
   - Deterministic capture using `setupDeterministicGame(page)` with `game.stop()`, manual `game.step(1/60)`, and `game.render()`:
     a. `artifacts/dark_fantasy/enhanced_graphics_swarm.png` (>50KB):
        - Centered Grim Sorcerer surrounded by 4 concentric rings of Skeletons (r=150), Ghouls (r=240), Banshees (r=330), and Death Knights (r=420) (92+ entities).
        - Drop shadows under all entities, player, and gems.
     b. `artifacts/dark_fantasy/restart_verified.png` (>50KB):
        - Active post-restart gameplay: player resurrected, revived HUD (100 HP vitality bar, fresh Level 1 bar, active timer, scythe weapon), newly spawned horde, and active scythe cleave slash.
     c. `artifacts/dark_fantasy/occult_vfx_lighting.png` (>50KB):
        - Rich visual effects: dynamic amber player torch light (200px radial light with breathing flicker carved through ambient darkness + #f59e0b warm bloom), active violet scythe slash arc, branching abyssal lightning arcs, swirling soul motes, ground blood decals, and 3-layer parallax graveyard mist.
   - Invariant assertion for all 3 screenshots:
     - `fs.existsSync(filePath)` is true.
     - `fs.statSync(filePath).size > 50 * 1024` (51,200 bytes).

Verification:
- Run `npm run build` (prerequisite for playwright webServer preview)
- Run `npx playwright test tests/e2e/restart_survival.spec.ts`
- Run `npm test`
- Run `npx tsc --noEmit`
- Verify file sizes of `artifacts/dark_fantasy/*.png`

Document your implementation, command outputs, and test logs in `/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m4_1/handoff.md`.
Update `progress.md`.
When complete, send a message to orchestrator with your results.
