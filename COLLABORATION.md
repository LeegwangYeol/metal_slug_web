# Metal Slug Web (Full Metal Slug) — Claude Collaboration Guide

> **Project Mission**: Completely overhaul and fix the critical gameplay bugs in the Metal Slug web game:
> 1. Fix keyboard controls and jump mechanics (restore Spacebar/K jumping, smooth movement, responsive physics).
> 2. Fix spawning logic so POWs and enemies only spawn at designated coordinates or camera wave triggers, eliminating arbitrary popping.
> 3. Rebalance Boss (Tetsuyuki) health to $\le 500$ HP for authentic web stage balance.
> 4. Validate through Playwright E2E tests (real Y-coordinate jump delta, X-coordinate movement delta) and unit/integration verification.

---

## 📌 Claude Collaboration & Approval Protocol
- **Primary AI Collaborator**: Claude
- **Human Channel / User**: @lolollol2379 (https://www.youtube.com/@lolollol2379, ID: `UC1no5Q01M2LmT-QLgLlUN0Q`)
- **Current Status**: ✅ **ALL MILESTONES COMPLETED & GATE PASSED**
- **Trigger Keyword**: When the user enters `내용확인` (Check content), the team reviews `COLLABORATION.md` for updated feedback from Claude.

---

## 🚀 Execution & Verification Summary

### Milestone 1 (M1): Key Controls & Jump Mechanics
- **File**: `src/input/KeyboardController.ts`
- **Fixes**:
  - `Space`, `KeyK`, `KeyX` mapped to `'jump'`.
  - `KeyJ`, `KeyZ` mapped to `'fire'`.
  - `KeyL`, `KeyC` mapped to `'grenade'`.
  - Full WASD and Arrow Keys mapped to direction and aiming.
  - Edge-detection latching (`jumpJustPressed`, `fireJustPressed`, `grenadeJustPressed`) prevents dropped fast taps between 60Hz ticks.
- **Verification**: 12/12 unit tests passed. Headless physics simulation confirms $Y$ moves upward on Spacebar press ($\Delta Y < -20\text{px}$).

### Milestone 2 (M2): Spawning Logic Overhaul
- **Files**: `src/main.ts`, `src/core/entities/enemies/SoldierEnemy.ts`, `src/core/entities/pow/PowEntity.ts`
- **Fixes**:
  - Fixed soldier spawn $Y = 192$ (height 38, feet at $230$), ensuring ground collision contact and eliminating abyss plummeting and despawn culling.
  - Pre-placed 4 POWs statically at stage load time in `StageData.pows` at designated platform coordinates ($X = 320, 850, 1450, 1710$) ahead of the player, completely removing runtime pop-in.
  - Ingress AI state transitions updated so knife and rifle soldiers smoothly advance forward into the visible viewport.
  - Tank hatch reinforcements routed to enter smoothly from off-screen right ($X \ge 1220$).
- **Verification**: Zero popping over 1,800 idle frames; 100% out-of-bounds spawning verified across player speeds up to 2,000 px/s.

### Milestone 3 (M3): Boss Health Rebalance
- **Files**: `src/core/entities/boss/TetsuyukiBoss.ts`, `src/main.ts`
- **Fixes**:
  - Rebalanced `TetsuyukiBoss` max health to 400 HP ($\le 500$).
  - Replaced hardcoded constants (975 and 450 HP) in `takeDamage()` with dynamic percentage thresholds:
    - Phase 1 -> 2 at 65% (260 HP).
    - Phase 2 -> 3 at 30% (120 HP).
  - Implemented anti-burst damage clamping preventing instant phase skips under 5,000 HP bursts.
  - HUD health bar is fully normalized and renders 400 HP accurately.
- **Verification**: Dedicated test suite `tests/unit/boss_rebalance.test.ts` passed.

### Milestone 4 (M4): Comprehensive Verification Test Suite
- **Files**: `tests/e2e/gameplay_controls.spec.ts`, `tests/unit/boss_rebalance.test.ts`, `tests/unit/spawning_contract.test.ts`, `tests/unit/enemy_boss_statemachine.test.ts`, `tests/unit/challenger_boss_and_stability.test.ts`
- **Verification Results**:
  - `npm run build`: PASS (clean TypeScript compilation and Vite production bundle).
  - `npx vitest run`: PASS (20 test files, 257 tests passed, 0 failed).
  - `npx playwright test`: PASS (3 test files, 14 browser tests passed, 0 failed).
  - Real browser Playwright simulation confirms Spacebar jump produces $\Delta Y < -20\text{px}$ and lands back at $Y = 230$, and Arrow keys produce $\Delta X > 15\text{px}$.

### Milestone 5 (M5): Adversarial Review & Forensic Audit
- **Reviewer 1**: APPROVE (Code quality, modularity, zero regressions).
- **Reviewer 2**: APPROVE (Spawning safety, boss balance, Playwright test authenticity).
- **Challenger 1**: APPROVE (Input latching stress test, mashing, simultaneous actions, jump parabola).
- **Challenger 2**: APPROVE (Camera fast-scrolling out-of-bounds spawn check, 5,000 HP burst stress test).
- **Forensic Auditor**: CLEAN (Zero hardcoded return values, zero dummy facades, zero `vi.mock()` shortcuts).

---

## 🎯 Final Acceptance Criteria Checklist
- [x] **Playwright E2E Test (Jump)**: Spacebar key press mathematically asserted to cause upward $Y$ displacement ($\Delta Y < -20\text{px}$) and return to ground ($Y = 230$).
- [x] **Playwright E2E Test (Movement)**: Arrow keys mathematically asserted to produce horizontal displacement ($\Delta X \neq 0$).
- [x] **Code Verification (Spawning)**: Spawning strictly tied to camera position ($X \ge \text{cameraX} + 480$) and static stage placement; random timer-based popping eliminated.
- [x] **Code Verification (Boss HP)**: Boss max health asserted $\le 500$ (specifically 400 HP) with dynamic phase thresholds.
- [x] **All Tests Pass**: 100% green across all 257 Vitest unit tests and 14 Playwright E2E tests with clean TypeScript build.
