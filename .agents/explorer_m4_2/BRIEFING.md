# BRIEFING — 2026-09-08T05:26:30Z

## Mission
Design comprehensive Playwright E2E test scenarios and assertions for `tests/e2e/ultimate_and_crisis_expansion.spec.ts` covering Ultimate Move execution, Crisis Boss encounters, and Autonomous Ally support.

## 🔒 My Identity
- Archetype: explorer
- Roles: teamwork_preview_explorer, explorer
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m4_2
- Original parent: 05969896-3516-4d88-a516-8ffeaafab39c
- Milestone: M4 (Playwright E2E Integration & Visual Proof Screenshots)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- DO NOT edit or modify source code files
- Design Playwright E2E test scenarios for `tests/e2e/ultimate_and_crisis_expansion.spec.ts`
- Must produce 5-component handoff report in `handoff.md`
- Send final notification back to parent agent via `send_message`

## Current Parent
- Conversation ID: 05969896-3516-4d88-a516-8ffeaafab39c
- Updated: 2026-09-08T05:26:30Z

## Investigation State
- **Explored paths**:
  - `src/main.ts`: browser bootstrap, 60Hz loop, scene compilation, window exposure, stage triggers
  - `src/core/player/UltimateManager.ts`: 4-phase state machine (FREEZE -> STRIKE_PASS -> DETONATION -> RECOVERY), minion wipe (999 explosion damage), boss burst (120 HP)
  - `src/core/player/PlayerController.ts`: KeyU handling, weapon management, shield charges, drop collision
  - `src/core/entities/boss/CrisisEventManager.ts`: 75% artillery, 50% platform collapse, 25% rage overdrive
  - `src/core/entities/boss/IronNokanaBoss.ts`: 4-phase crawler boss, turrets, weakpoint, custom render
  - `src/core/entities/allies/AllyNPC.ts` & `AllyManager.ts`: Hyakutaro Ichimonji AI, follow, target acquisition, ki blasts
  - `src/core/weapons/WeaponManager.ts`: Shotgun, Laser, Rocket, Medkit, Shield, ItemPickup
  - `src/render/CanvasRenderer.ts` & `ProceduralSpriteFactory.ts`: cinematic FX rendering, expansion sprites
  - `tests/e2e/*.spec.ts`: Existing Playwright suites (game_initialization, gameplay_controls, death_animations, visual_verification)
- **Key findings**:
  - TypeScript build is 100% clean (`tsc -b && vite build` passes).
  - All 453 Vitest unit tests across 34 files pass 100%.
  - All 17 existing Playwright E2E tests pass 100% when preview server is active.
  - `KeyboardController` maps `KeyU` -> action `'ultimate'`, triggering `player.triggerUltimateMove(engine)`.
  - For tests requiring programmatic expansion entity spawning in the browser context, `src/main.ts` should expose `IronNokanaBoss`, `CrisisEventManager`, `AllyNPC`, `AllyManager`, `ItemPickupEntity` on `window.__EXPANSION__`.
- **Unexplored areas**: None for M4 exploration scope.

## Key Decisions Made
- Fully designed all 3 Playwright E2E scenarios for `tests/e2e/ultimate_and_crisis_expansion.spec.ts`.
- Outlined exact assertions, `page.waitForFunction` timings, viewport queries, and screenshot generation to `artifacts/expansion/`.
- Documented worker recommendations for `src/main.ts` window exposure and rendering support.

## Artifact Index
- handoff.md — Comprehensive E2E test design and verification specification
- progress.md — Heartbeat and activity log
- DISPATCH.md — Initial dispatch log
