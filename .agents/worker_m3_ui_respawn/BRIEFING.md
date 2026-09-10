# BRIEFING — 2026-09-10T01:41:00Z

## Mission
Implement authentic player death sequence (1.2s knockback arc & anim frames), arcade continue countdown (10s timer, 9..0 digits, continue re-entry), tactical parachute respawn, on-screen tutorial/controls placard with [H] toggle, and HUD polish (Marco portrait, Ultimate stock meter, metallic framing).

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m3_ui_respawn
- Original parent: dc4b76ec-2c8d-41af-8152-fb6d5ed83654
- Milestone: M3

## 🔒 Key Constraints
- Exclusive file ownership:
  - src/core/player/PlayerController.ts
  - src/core/player/PlayerTypes.ts
  - src/ui/HUDOverlay.ts
  - src/render/CanvasRenderer.ts
  - src/main.ts
  - src/input/KeyboardController.ts
  - tests/unit/death_respawn_ui.test.ts
- Integrity mandate: No cheating, no hardcoding, genuine physics & state machines.
- Minimal change principle; zero regressions on existing 463 tests.
- 100% green tests (vitest) and 0 tsc errors.

## Current Parent
- Conversation ID: dc4b76ec-2c8d-41af-8152-fb6d5ed83654
- Updated: not yet

## Task Summary
- **What to build**: Player death arc, continue countdown, tactical parachute respawn loop, tutorial placard, HUD polish.
- **Success criteria**: 100% green tests, authentic retro arcade feel, comprehensive unit tests in tests/unit/death_respawn_ui.test.ts, tsc pass.
- **Interface contracts**: PROJECT.md § Interface Contracts (M3)
- **Code layout**: src/core/player, src/render, src/ui, src/input, src/main.ts

## Key Decisions Made
- Use pre-rendered player_death_0..3 frames with genuine kinematics (vy = -260, vx = -facing * 80).
- Parachute drop-in from screen top (Y=20, vy=60) with canopy rendering and sinusoidal sway until grounded.
- Continue countdown 10s state with digit countdown, restoring 3 lives upon Fire/Jump.
- Tutorial placard auto-dismissing after 5s and toggleable via KeyH.

## Artifact Index
- DISPATCH.md — Dispatch instructions
- BRIEFING.md — Context and identity
- progress.md — Liveness heartbeat and milestone progress
- handoff.md — Final handoff report

## Change Tracker
- **Files modified**:
  - `src/core/player/PlayerKinematics.ts`: Added DYING, RESPAWNING_PARACHUTE, CONTINUE_COUNTDOWN action states, helpPressed in snapshot.
  - `src/core/player/PlayerTypes.ts`: Added types barrel.
  - `src/core/player/PlayerController.ts`: Implemented death knockback arc, continue countdown, parachute respawn with lateral steering, mid-air firing, and landing invulnerability.
  - `src/input/KeyboardController.ts`: Mapped KeyH / h to 'help' action and edge-triggered helpPressed snapshot.
  - `src/render/CanvasRenderer.ts`: Connected player parachute canopy, suspension cords, invulnerability flashing, death frames cycling 0..3, and expanded HUD states.
  - `src/ui/HUDOverlay.ts`: Implemented metallic top frame, cute mini Marco, sizzling fuse spark, [U] Ultimate meter, tutorial placard, and continue countdown digits.
  - `src/main.ts`: Connected tutorial state, toggleTutorial(), and full player/HUD render scene pipeline.
  - `tests/unit/death_respawn_ui.test.ts`: Added 19 comprehensive unit tests covering all M3 features.
- **Build status**: PASS (`tsc` 0 errors, `npm run build` PASS in 314ms)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS (41 test files, 578 tests passed, 0 failed)
- **Lint status**: Clean (tsc --noEmit 0 errors)
- **Tests added/modified**: 19 new unit tests in `tests/unit/death_respawn_ui.test.ts`

## Loaded Skills
- None
