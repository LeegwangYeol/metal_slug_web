# BRIEFING — 2026-09-08T04:26:00Z

## Mission
Implement Milestone M3: Ultimate Move System & Procedural Sprites / Cinematic FX with zero regressions.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M3_ULTIMATE_FX

## 🔒 Key Constraints
- KeyU is strictly the dedicated Ultimate Move trigger key. KeyX MUST remain bound to jump (tested by adversarial jump tests).
- ProceduralSpriteFactory: getAllKeys(false, false) MUST return exactly 164 keys by default! All expansion sprites must be in expansionKeys: Set<string>.
- Viewport query: Minion elimination is strictly within active camera viewport [cameraX, 0, 480, 270]. Off-screen minions are 100% preserved.
- Zero friendly fire: Player, AllyNPC, and POWs are completely immune.
- Boss damage: Deals 120 damage to bosses (IronNokana, Tetsuyuki, MidBoss).
- Web Audio: Audio synthesis methods must be safe in headless / mock environments.
- Zero regressions across all 31 existing test suites. Clean tsc and npm run build.

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T04:40:40Z

## Task Summary
- **What to build**: UltimateManager, KeyU input mapping, PlayerController integration, StageManager viewport getters, ProceduralSpriteFactory expansion sprites (164 invariant), CanvasRenderer cinematic FX passes, SoundEngine audio synthesis, tests/unit/ultimate_move_system.test.ts.
- **Success criteria**: 100% passing tests on vitest, clean tsc, clean npm run build, full test coverage of 4 phases, 100% minion elimination, 120 boss damage, off-screen preservation, friendly immunity.
- **Interface contracts**: PROJECT.md & Explorer handoffs.
- **Code layout**: PROJECT.md § Code Layout.

## Change Tracker
- **Files modified**:
  - `src/core/player/UltimateManager.ts`: 4-phase cinematic state machine, stock management, lethal minion wipe, boss damage, zero friendly fire.
  - `src/core/player/PlayerKinematics.ts`: Added `ultimatePressed?: boolean` to `PlayerInputSnapshot`.
  - `src/input/KeyboardController.ts`: KeyU mapping to 'ultimate', snapshot generation, preserve KeyX jump.
  - `src/core/player/PlayerController.ts`: UltimateManager integration, triggerUltimateMove(), update loop.
  - `src/core/engine/StageManager.ts`: Added getCamera() and getViewportBoundingBox().
  - `src/render/sprites/ProceduralSpriteFactory.ts`: Added expansionKeys Set, 41 expansion procedural sprites, preserved 164 baseline keys invariant.
  - `src/render/CanvasRenderer.ts`: Added renderCinematicFXPass (screen flash, bomber & shadow, shockwave rings, camera shake).
  - `src/audio/AudioTypes.ts` & `src/audio/SoundEngine.ts`: Web Audio procedural synthesis methods (siren, flyover roar, apocalyptic blast) with headless safety.
  - `tests/unit/ultimate_move_system.test.ts`: 28 comprehensive unit tests covering all M3 contracts.
- **Build status**: PASS (tsc -b clean, npm run build clean, vitest 32/32 files, 417/417 tests passed)
- **Pending issues**: none

## Quality Status
- **Build/test result**: 417 passed out of 417 tests across 32 suites (100% pass)
- **Lint status**: clean (tsc -b passed with exit code 0)
- **Tests added/modified**: `tests/unit/ultimate_move_system.test.ts` (28 tests added, 0 failures)

## Loaded Skills
- None

## Key Decisions Made
- KeyU used for ultimate move, leaving KeyX as jump to satisfy existing adversarial test contracts.
- Expansion sprites isolated in `expansionKeys` with helper `registerExpansionSprite`, guaranteeing 164 baseline keys.
- UltimateManager handles 4 phases: FREEZE (0.5s) -> STRIKE_PASS (0.6s) -> DETONATION (0.4s) -> RECOVERY (0.3s) -> IDLE/READY.
- Minion elimination strictly queries active viewport `[cameraX, 0, 480, 270]`; off-screen enemies preserved. Bosses take 120 damage. Player, allies, and POWs are 100% immune.

## Artifact Index
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1/DISPATCH.md — Assignment instructions
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1/BRIEFING.md — Working memory
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1/progress.md — Liveness & progress heartbeat
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_1/handoff.md — 5-component handoff report
