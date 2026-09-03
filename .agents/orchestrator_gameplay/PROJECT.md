# Project: Metal Slug Web Critical Gameplay Bugs Overhaul

## Architecture
Metal Slug Web is a 2D HTML5 canvas run-and-gun action game written in TypeScript.
- **Input Engine**: `src/input/KeyboardController.ts` handles browser DOM keyboard events (`keydown`/`keyup`) and maps keys to player actions (`jump`, `fire`, `grenade`, `left`, `right`, `up`, `down`). Edge-latching preserves rapid key presses until consumed by `getSnapshot()`.
- **Player Kinematics**: `src/core/player/PlayerKinematics.ts` and `PlayerController.ts` integrate physics: `JUMP_IMPULSE = -360 px/s`, gravity `720 px/s^2`, ground platform snapping at `y = 230`.
- **Entity & Spawning Engine**: `src/main.ts`, `src/core/engine/StageManager.ts`, `src/core/entities/enemies/SoldierEnemy.ts`, `src/core/entities/pow/PowEntity.ts`. Camera viewport is $480 \times 270\text{px}$. Enemies spawn strictly off-screen ($X \ge \text{cameraX} + 480 + 40$) and smoothly advance into the viewport. Soldier top-left $Y = 192$ (feet at 230) ensures terrain contact and eliminates abyss culling. POWs are statically pre-placed at stage coordinates ahead of player.
- **Boss Entity**: `src/core/entities/boss/TetsuyukiBoss.ts` with 400 HP max, 3 combat phases dynamically clamped by percentage-based thresholds ($65\%$ / 260 HP and $30\%$ / 120 HP).
- **HUD**: `src/ui/HUDOverlay.ts` dynamically renders normalized boss HP bar.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Keyboard Mapping | Space/K/X -> Jump, J/Z -> Fire, L/C -> Grenade, WASD/Arrows -> Move/Aim | M1 | Survey 1 | DONE |
| 2 | Keypress Latching | Edge-detection latch (`jumpJustPressed`) to prevent dropped fast taps | M1 | Survey 1 | DONE |
| 3 | Jump Physics Verification | Player Y moves upward on jump key press with -360 px/s impulse | M1 | Survey 1 | DONE |
| 4 | Enemy Ground Alignment | Soldiers spawn with top-left $Y = 192$ (feet at 230) so they don't fall into the abyss | M2 | Survey 2 | DONE |
| 5 | Static POW Placement | Pre-place POWs in `StageData.pows` at fixed stage coordinates, removing pop-in | M2 | Survey 2 | DONE |
| 6 | Ingress AI Forward Movement | Knife and rifle soldiers advance forward into viewport instead of freezing/retreating | M2 | Survey 2 | DONE |
| 7 | Off-Screen Tank Reinforcements | Mid-boss tank soldiers spawn off-screen right instead of popping on hull | M2 | Survey 2 | DONE |
| 8 | Boss HP Rebalance | Set `TetsuyukiBoss` max health to 400 HP ($\le 500$) in class and stage trigger | M3 | Survey 3 | DONE |
| 9 | Dynamic Phase Clamping | Replace hardcoded 975/450 HP in `takeDamage` with 65% and 30% dynamic thresholds | M3 | Survey 3 | DONE |
| 10 | HUD Boss Health Bar | Verify boss health bar properly scales to 400 HP (already normalized) | M3 | Survey 3 | DONE |
| 11 | Playwright Jump E2E Test | Real browser Spacebar press, assert $\Delta Y < 0$ (sprite moves upward) | M4 | Survey 1,3 | DONE |
| 12 | Playwright Move E2E Test | Real browser Arrow keys press, assert $\Delta X \neq 0$ | M4 | Survey 1,3 | DONE |
| 13 | Boss Rebalance Unit Tests | Unit tests asserting boss max HP $\le 500$ and dynamic phase thresholds | M4 | Survey 3 | DONE |
| 14 | Spawning Contract Tests | Unit tests asserting out-of-bounds spawn and non-popping POWs | M4 | Survey 2,3 | DONE |
| 15 | Adversarial Review & Audit | Independent review and forensic audit for genuine implementations | M5 | Strategy | DONE |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Key Controls & Jump Fix | `src/input/KeyboardController.ts` | none | DONE |
| M2 | Spawning Logic Overhaul | `src/main.ts`, `SoldierEnemy.ts`, `PowEntity.ts` | none | DONE |
| M3 | Boss Health Rebalance | `TetsuyukiBoss.ts`, `src/main.ts` | none | DONE |
| M4 | E2E & Unit Test Verification | `tests/e2e/gameplay_controls.spec.ts`, `tests/unit/*.test.ts` | M1, M2, M3 | DONE |
| M5 | Adversarial Review & Forensic Audit | Reviewers, Challengers, Auditor | M4 | DONE |

## Code Layout
- `src/input/KeyboardController.ts`: Keyboard mapping and input snapshot capture
- `src/core/player/PlayerKinematics.ts`: Player physics, velocity integration, jump impulses
- `src/core/player/PlayerController.ts`: Player input state machine
- `src/core/entities/enemies/SoldierEnemy.ts`: Soldier enemy AI, bounds, and ingress logic
- `src/core/entities/pow/PowEntity.ts`: POW entity definition and rescue triggers
- `src/core/entities/boss/TetsuyukiBoss.ts`: Boss entity, health, and phase logic
- `src/main.ts`: Stage setup, entity registration, triggers, and game loop
- `tests/unit/`: Vitest unit tests (20 files, 257 tests passing)
- `tests/e2e/`: Playwright E2E browser tests (3 files, 14 tests passing)

## Gate Verification Summary
- `npm run build`: PASS (clean bundle, exit code 0)
- `npx vitest run`: PASS (20 test files, 257 tests passed, 0 failures)
- `npx playwright test`: PASS (3 test files, 14 tests passed, 0 failures)
- Reviewer 1 Verdict: APPROVE
- Reviewer 2 Verdict: APPROVE
- Challenger 1 Verdict: APPROVE
- Challenger 2 Verdict: APPROVE
- Forensic Auditor Verdict: CLEAN
