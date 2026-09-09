## 2026-09-08T04:56:55Z

You are a Worker subagent (teamwork_preview_worker) for Milestone M3 Iteration 2.
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_2
Project root is: /Users/user/teamwork_projects/metal_slug_web

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MANDATORY CONTEXT:
Read these files first:
- ORIGINAL_REQUEST: /Users/user/teamwork_projects/metal_slug_web/.agents/ORIGINAL_REQUEST.md
- PROJECT.md: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md
- COLLABORATION.md: /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- Reviewer 1 Report: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1/handoff.md

FILE OWNERSHIP:
You have exclusive write ownership of:
- src/main.ts
- src/core/player/UltimateManager.ts
- tests/unit/adversarial_m3_challenger_stress.test.ts

TASK & IMPLEMENTATION REQUIREMENTS:
Resolve the 4 integration defects and test compatibility issues identified by Reviewer 1:
1. In `src/main.ts:247-257` (`FullMetalSlugGame.step()`):
   - Add `ultimatePressed: kbSnap.ultimatePressed,` to the `input: PlayerInputSnapshot` passed to `this.player.handleInput(input, dt, this.engine)`. This ensures pressing KeyU in browser gameplay and E2E tests triggers the ultimate move.
2. In `src/core/player/UltimateManager.ts`:
   - In `executeDetonation(engine)` (around line 218):
     Query both `engine.getAllEntities()` and `(engine as any).entitiesToAdd`:
     ```typescript
     const entities = engine.getAllEntities();
     if (Array.isArray((engine as any).entitiesToAdd)) {
       for (const ent of (engine as any).entitiesToAdd) {
         if (!entities.some((e) => e.id === ent.id)) {
           entities.push(ent);
         }
       }
     }
     ```
     Also, if any culled hostile projectile is located in `(engine as any).entitiesToAdd`, remove it or mark it inactive/dead so it does not spawn into the active game loop.
   - Add `public get cameraShakeOffset(): { x: number; y: number }` getter returning `{ x: 0, y: 0 }` (or active shake offset if tracked) to satisfy backwards compatibility with adversarial stress tests.
3. In `src/main.ts:469-482` (`buildRenderSceneState()`):
   - In the returned `RenderSceneState`, include `cinematicFX: this.player.ultimateManager?.getCinematicState()`. Check `CanvasRenderer.ts` to ensure property names match what `CanvasRenderer.renderCinematicFXPass()` expects.
4. In `src/main.ts:526` (`setupAudioAndEventBus()`):
   - Map ultimate audio events emitted by `UltimateManager` / event bus (e.g. `sfx_air_raid_siren`, `sfx_bomber_flyover`, `sfx_heavy_detonation`) to call:
     - `this.soundEngine.playUltimateSiren()`
     - `this.soundEngine.playFlyoverRoar()`
     - `this.soundEngine.playApocalypticBlast()`
5. In `tests/unit/adversarial_m3_challenger_stress.test.ts`:
   - Check line 394: If `new PowEntity(vec2(150, 200))` has missing ID parameter, update to `new PowEntity('pow_friendly', vec2(150, 200))` so all test suites run cleanly.

VERIFICATION COMMANDS:
1. `npx tsc -b` (must pass with 0 errors)
2. `npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts`
3. `npx vitest run` (all 34+ test files must pass, 100% green)
4. `npm run build` (clean production build)

DELIVERABLE:
Write your full handoff report to:
`/Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_2/handoff.md`
and call `send_message` to parent.
