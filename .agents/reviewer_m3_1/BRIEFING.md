# BRIEFING — 2026-09-08T04:51:30Z

## Mission
Review and adversarial stress-test Milestone M3 (Ultimate Move System & Procedural Sprites / Cinematic FX).

## 🔒 My Identity
- Archetype: reviewer_critic
- Roles: reviewer, critic
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M3
- Instance: 1 of 1

## 🔒 Key Constraints
- Review-only — do NOT modify implementation code
- Check for integrity violations (hardcoded test results, facade implementations, shortcut bypasses, fabricated verification outputs)
- Issue clear verdict: APPROVE or REQUEST_CHANGES

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T04:51:30Z

## Review Scope
- **Files to review**: src/core/player/UltimateManager.ts, src/core/player/PlayerController.ts, src/input/KeyboardController.ts, tests/unit/ultimate_move_system.test.ts, src/render/sprites/ProceduralSpriteFactory.ts, src/render/CanvasRenderer.ts, src/audio/SoundEngine.ts, src/main.ts
- **Interface contracts**: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_expansion_gen3/PROJECT.md, COLLABORATION.md, ORIGINAL_REQUEST.md
- **Review criteria**: correctness, 4-phase cinematic pipeline timing, damage mechanics, key bindings, typecheck, test coverage, edge cases, integration completeness

## Review Checklist
- **Items reviewed**:
  - `src/core/player/UltimateManager.ts`: verified 4-phase state machine (0.5s -> 0.6s -> 0.4s -> 0.3s), 100% minion elimination, 120 boss damage, safe entities, projectile culling.
  - `src/core/player/PlayerController.ts`: verified `ultimateManager` instance, `triggerUltimateMove()`, input handling on `input.ultimatePressed`, and update integration.
  - `src/input/KeyboardController.ts`: verified `KeyU` / `'u'` mapped to `ultimate`, edge-triggered `ultimatePressed` in snapshot, `KeyX` untouched for `jump`.
  - `src/render/sprites/ProceduralSpriteFactory.ts`: verified 164 baseline keys invariant (`getAllKeys()` returns 164), expansion sprites isolated in `expansionKeys`.
  - `src/render/CanvasRenderer.ts`: verified `renderCinematicFXPass()` implementation.
  - `src/audio/SoundEngine.ts`: verified `playUltimateSiren()`, `playFlyoverRoar()`, `playApocalypticBlast()` procedural audio methods with headless guards.
  - `src/main.ts`: checked live game integration — identified 3 major gaps (`input.ultimatePressed` omitted, `cinematicFX` omitted in scene, audio events unmapped).
  - `tests/unit/ultimate_move_system.test.ts`: verified all 28 unit tests pass.
- **Verdict**: REQUEST_CHANGES
- **Unverified claims**: all verified; defects identified in live game integration and entitiesToAdd query.

## Attack Surface
- **Hypotheses tested**:
  1. Does `KeyU` trigger the move while keeping `KeyX` jump intact? -> Passed in isolation; but broken in `src/main.ts:257`.
  2. Does `UltimateManager.executeDetonation` handle entities added in current frame before `engine.tick()`? -> Fails; ignores `engine.entitiesToAdd`.
  3. Does `main.ts` pass `cinematicFX` to `CanvasRenderer`? -> Fails; completely omitted.
  4. Does `ProceduralSpriteFactory.getAllKeys()` preserve 164 keys? -> Passed (164 baseline keys intact).
  5. Can an ultimate move be double-triggered or triggered with 0 stock? -> Passed (correctly blocked).
- **Vulnerabilities found**:
  1. [Major] `src/main.ts:247-257` drops `ultimatePressed: kbSnap.ultimatePressed`. KeyU does nothing in live game.
  2. [Major] `UltimateManager.ts:218` only queries `engine.getAllEntities()`, omitting `(engine as any).entitiesToAdd`.
  3. [Major] `src/main.ts:469-482` omits `cinematicFX` in `buildRenderSceneState()`, so FX is never rendered in live game.
  4. [Minor] `src/main.ts:526` does not map ultimate sound events to sound engine.
- **Untested angles**: Playwright browser execution (deferred to M4).

## Key Decisions Made
- Issued REQUEST_CHANGES to ensure `src/main.ts` integration gaps and `entitiesToAdd` synchronization are resolved before M4 E2E verification.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/reviewer_m3_1/handoff.md — Final review and challenge report
