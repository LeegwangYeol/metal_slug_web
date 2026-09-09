# BRIEFING — 2026-09-08T05:06:00Z

## Mission
Remediate 4 integration defects and test compatibility issues for Milestone M3 Iteration 2: KeyU input wiring, UltimateManager detonation entity sync including entitiesToAdd, CanvasRenderer cinematicFX scene connection, SoundEngine ultimate SFX event bus routing, and adversarial stress test POW entity instantiation.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_2
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M3 Iteration 2

## 🔒 Key Constraints
- Exclusive write ownership: src/main.ts, src/core/player/UltimateManager.ts, tests/unit/adversarial_m3_challenger_stress.test.ts
- Genuine implementations only: DO NOT cheat, fake test outputs, or create dummy facade implementations.
- Verification gates: npx tsc -b (0 errors), vitest for targeted & challenger tests, vitest full suite (100% green), npm run build.
- Follow 5-component handoff protocol in handoff.md.

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T05:06:00Z

## Task Summary
- **What to build**:
  1. Add `ultimatePressed: kbSnap.ultimatePressed` to `PlayerInputSnapshot` in `src/main.ts:247-257`.
  2. In `UltimateManager.executeDetonation()`, query `engine.getAllEntities()` and `(engine as any).entitiesToAdd`, removing culled projectiles from `entitiesToAdd`. Add `cameraShakeOffset` getter and `getCinematicState()` method.
  3. In `src/main.ts:buildRenderSceneState()`, include `cinematicFX: this.player.ultimateManager?.getCinematicState()`.
  4. In `src/main.ts:setupAudioAndEventBus()`, map `sfx_air_raid_siren`, `sfx_bomber_flyover`, `sfx_heavy_detonation` (and aliases) to SoundEngine methods.
  5. In `tests/unit/adversarial_m3_challenger_stress.test.ts`, verified line 394 and added 3 empirical tests (3G, 3H, 3I) covering cameraShakeOffset, entitiesToAdd synchronization, and getCinematicState.
- **Success criteria**:
  - `npx tsc -b` passes with 0 errors (PASSED)
  - `npx vitest run tests/unit/ultimate_move_system.test.ts tests/unit/adversarial_ultimate_challenge.test.ts tests/unit/adversarial_m3_challenger_stress.test.ts` (64/64 PASSED)
  - `npx vitest run` (34/34 files, 453/453 PASSED)
  - `npm run build` succeeds (PASSED)
- **Interface contracts**: PROJECT.md
- **Code layout**: PROJECT.md § Code Layout

## Key Decisions Made
- [2026-09-08T04:56:55Z] Initialized briefing for M3 Iteration 2 remediation.
- [2026-09-08T05:00:00Z] Implemented `cameraShakeOffset` getter and `getCinematicState()` on `UltimateManager` returning `RenderCinematicFXState | undefined` matching CanvasRenderer interface contracts.
- [2026-09-08T05:01:00Z] In `UltimateManager.executeDetonation()`, merged `(engine as any).entitiesToAdd` and spliced out culled projectiles.
- [2026-09-08T05:02:00Z] In `src/main.ts`, wired `ultimatePressed`, `cinematicFX`, and mapped SFX events to SoundEngine.
- [2026-09-08T05:05:00Z] Successfully passed all verification gates: `tsc -b`, targeted vitest (64/64), full vitest suite (453/453 across 34 suites), and `npm run build`.

## Artifact Index
- `.agents/worker_m3_2/DISPATCH.md` — Dispatch instructions
- `.agents/worker_m3_2/BRIEFING.md` — Situational awareness
- `.agents/worker_m3_2/progress.md` — Liveness and progress heartbeat
- `.agents/worker_m3_2/handoff.md` — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/main.ts`: Added `ultimatePressed` to step input snapshot, `cinematicFX` to `RenderSceneState`, and mapped ultimate SFX bus events to SoundEngine.
  - `src/core/player/UltimateManager.ts`: Added `entitiesToAdd` querying and projectile culling in `executeDetonation()`, `cameraShakeOffset` getter, and `getCinematicState()` method.
  - `tests/unit/adversarial_m3_challenger_stress.test.ts`: Added 3 empirical tests (3G, 3H, 3I) covering cameraShakeOffset, entitiesToAdd synchronization, and getCinematicState.
- **Build status**: PASS (`tsc -b`, `npm run build`, `npx vitest run` 453/453 passing)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (453/453 tests passing across 34 test files)
- **Lint status**: Clean (0 TypeScript errors)
- **Tests added/modified**: 3 new empirical tests in `adversarial_m3_challenger_stress.test.ts` (3G, 3H, 3I)

## Loaded Skills
- None specified in dispatch
