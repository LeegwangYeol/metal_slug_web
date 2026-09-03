# BRIEFING — 2026-09-04T00:22:00+09:00

## Mission
Investigate test suite, autonomous playtest harness, proactive bug hunt scope, and visual screenshot verification (R3, Acceptance Criteria).

## 🔒 My Identity
- Archetype: explorer
- Roles: test suite investigator, bug hunter, visual verification architect
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/
- Original parent: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Milestone: Milestone 3 & Milestone 4 (Bug Hunt & Test Suite Verification)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement source code modifications
- Write only within `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/`
- Proactively audit existing codebase for bugs, glitches, collision anomalies, audio/HUD issues, or weapon balance problems
- Detail test architecture for Playwright screenshot verification (3 death animations), Vitest/Playwright diverse spawning tests, and outline BUG_HUNT_REPORT.md

## Current Parent
- Conversation ID: 9248aa64-223b-4547-a5ad-20c1dd4a3980
- Updated: not yet

## Investigation State
- **Explored paths**:
  - Configs: `package.json`, `vitest.config.ts`, `playwright.config.ts`, `vite.config.ts`, `tsconfig.json`
  - Test suites: `tests/unit/` (20 files, 257 tests), `tests/e2e/` (3 files, 14 tests)
  - Engine & entities: `src/core/engine/GameEngine.ts`, `src/core/engine/StageManager.ts`, `src/core/entities/enemies/SoldierEnemy.ts`, `src/core/entities/enemies/EnemyTypes.ts`, `src/core/entities/enemies/MidBossVehicle.ts`, `src/core/entities/boss/TetsuyukiBoss.ts`, `src/core/player/PlayerController.ts`, `src/core/player/PlayerKinematics.ts`, `src/core/weapons/WeaponManager.ts`, `src/core/weapons/ProjectileManager.ts`, `src/core/weapons/Grenade.ts`, `src/main.ts`
  - Rendering & Audio: `src/render/CanvasRenderer.ts`, `src/render/sprites/ProceduralSpriteFactory.ts`, `src/ui/HUDOverlay.ts`, `src/audio/SoundEngine.ts`, `src/audio/SpeechSynthesizer.ts`
  - Artifacts: `artifacts/screenshots/` (5 existing UI screenshots), `artifacts/VISUAL_EVALUATION.md`
- **Key findings**:
  1. Current build and all 271 existing tests pass cleanly (100% green).
  2. Critical bug discovered in damage dispatch: `ProjectileManager.ts` and `Grenade.ts` pass boolean parameters `(damage, false, isFire)` and `(damage, true)`, whereas `SoldierEnemy.ts` expects `sourceType: DamageSourceType`. As a result, Shield Trooper deflection logic and death cause attribution fail.
  3. Enemy death animations currently do not render because `SoldierEnemy.checkDeath()` sets `isAlive = false`, `GameEngine` purges dead entities after 2 ticks, and `main.ts` / `CanvasRenderer.ts` completely skip entities with `!isAlive` or `isDead`.
  4. Player invulnerability flaw: neither `EnemyBullet`, `EnemyGrenade`, `SoldierEnemy.meleeAttackBox`, nor `TetsuyukiBoss.laserFloorHitbox` actually deal damage to `PlayerController` in the main engine loop.
  5. Diverse spawning is currently absent in stage data: all wave enemies spawn on the ground at $Y = 192$ and walk in with `INGRESS`. Parachute drops and ambush leaps need dedicated states, physics, and triggers.
  6. Designed concrete Playwright screenshot test suite for `artifacts/death_animations/` (`death_standard.png`, `death_explosion_blowback.png`, `death_burning.png`).
  7. Designed Vitest & Playwright test specifications for diverse spawning ($Y < 50$ drops, descent velocity, sinusoidal sway, ground touchdown, and ambush arcs).
  8. Structured complete layout and actionable remediation blueprint for `BUG_HUNT_REPORT.md`.
- **Unexplored areas**: None within assigned scope. Ready for handoff synthesis.

## Key Decisions Made
- Structured test architecture for death animation screenshot capture with deterministic frame advancement via `setupDeterministicGame`.
- Identified necessary state machine additions for `SoldierEnemy` and `CanvasRenderer` to decouple visual death animations from physics entity lifecycle.
- Outlined 7 concrete bug hunt items with root cause analysis, affected files, and recommended fixes for `BUG_HUNT_REPORT.md`.

## Artifact Index
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/DISPATCH.md` — Inbound instructions and prompts
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/progress.md` — Liveness heartbeat and status
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/BRIEFING.md` — Persistent working memory
- `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_polish_3/handoff.md` — Final handoff report
