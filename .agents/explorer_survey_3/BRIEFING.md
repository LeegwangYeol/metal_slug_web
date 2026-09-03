# BRIEFING — 2026-09-03T17:28:45+09:00

## Mission
Investigate Boss Health Rebalancing, HUD Health Display, and the Test Suite Architecture for Metal Slug Web Critical Gameplay Bugs Overhaul.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_3
- Original parent: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Milestone: Explorer Survey 3

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT modify project source code
- Files for content delivery, Messages for coordination
- Handoff report in handoff.md with 5-component structure

## Current Parent
- Conversation ID: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Updated: 2026-09-03T17:28:45+09:00

## Investigation State
- **Explored paths**:
  - `src/core/entities/boss/TetsuyukiBoss.ts` (lines 1-710)
  - `src/core/entities/boss/BossTypes.ts` (lines 1-36)
  - `src/main.ts` (lines 310-370, 630-800)
  - `src/ui/HUDOverlay.ts` (lines 215-280)
  - `src/render/CanvasRenderer.ts` (lines 90-140, 340-390)
  - `src/input/KeyboardController.ts` (lines 1-304)
  - `src/core/player/PlayerController.ts` (lines 95-210, 460-520)
  - `src/core/player/PlayerKinematics.ts`
  - `src/core/weapons/ProjectileManager.ts`, `src/core/weapons/Grenade.ts`
  - `package.json`, `vitest.config.ts`, `playwright.config.ts`
  - `tests/e2e/game_initialization.spec.ts`, `tests/e2e/visual_verification.spec.ts`
  - `tests/unit/enemy_boss_statemachine.test.ts`, `tests/unit/challenger_boss_and_stability.test.ts`, `tests/unit/stage_spawning_despawn.test.ts`, `tests/unit/input_and_hud.test.ts`
- **Key findings**:
  1. Boss max health is hardcoded to 1500 in `TetsuyukiBoss.ts` (`maxHealth = 1500`) and `main.ts` line 755 (`customHp: 1500`).
  2. Phase transition thresholds in `TetsuyukiBoss.takeDamage` are hardcoded to 975 and 450. Setting `maxHealth <= 500` without changing this causes `Math.max(975, ...)` to clamp health up to 975, immediately skipping Phase 1 and Phase 2. Thresholds MUST be dynamic: `Math.round(this.maxHealth * 0.65)` and `Math.round(this.maxHealth * 0.30)`.
  3. Rebalancing to 400 HP reduces combat time from a tedious 300s (5 minutes) to an authentic 70-90 seconds (~1.2 - 1.5 minutes).
  4. HUD in `HUDOverlay.ts` already calculates normalized ratio `bossHealth / bossMaxHealth` and scales a 180px gauge; zero changes needed in HUD rendering code.
  5. Jump control failure root cause: `KeyboardController.ts` mapped `Space: 'fire'` instead of `'jump'`. Previous tests passed because they directly called `game.keyboard.setAction('jump', true)` instead of dispatching real browser keyboard events.
  6. Test suite architecture: Vitest (16 files, 205 tests passing) + Playwright (2 files, 9 tests passing). New tests needed: `tests/e2e/gameplay_controls.spec.ts`, `tests/unit/boss_rebalance.test.ts`, `tests/unit/spawning_contract.test.ts`.
- **Unexplored areas**: None within scope; survey complete.

## Key Decisions Made
- All findings cataloged; proceeding to author comprehensive 5-component handoff report in `handoff.md`.

## Artifact Index
- handoff.md — Comprehensive handoff report
- progress.md — Liveness heartbeat
- DISPATCH.md — Dispatch log
