# BRIEFING — 2026-09-03T08:37:15Z

## Mission
Implement Milestone 1 (M1: Key Controls and Jump Fix) in KeyboardController.ts: correct key mappings and edge-detection latching.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m1_controls
- Original parent: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Milestone: M1 Key Controls and Jump Fix

## 🔒 Key Constraints
- Exclusive Write Ownership: `src/input/KeyboardController.ts` only.
- Do NOT modify any other files.
- Map Space, KeyK, KeyX to 'jump'.
- Map KeyJ, KeyZ to 'fire'.
- Map KeyL, KeyC to 'grenade'.
- Ensure WASD and Arrow keys map to directions: KeyA/ArrowLeft -> left, KeyD/ArrowRight -> right, KeyW/ArrowUp -> up, KeyS/ArrowDown -> down.
- Implement edge-detection latching for jumpJustPressed (and fireJustPressed, grenadeJustPressed) to avoid missed inputs on fast key taps.
- Run tests (`npx vitest run tests/unit/input_and_hud.test.ts`) and build (`npm run build`).
- No cheating, no hardcoding, maintain genuine state and logic.

## Current Parent
- Conversation ID: a2ad7268-5c33-444b-8b9c-8f3b306edacd
- Updated: 2026-09-03T08:37:15Z

## Task Summary
- **What to build**: Key mapping fix and latched edge-detection in KeyboardController.ts.
- **Success criteria**: Unit tests and build pass, Spacebar/K/X reliably jump, J/Z fire, L/C grenade, WASD/Arrows move/aim, latched flags survive until getSnapshot().
- **Interface contracts**: /Users/user/teamwork_projects/metal_slug_web/.agents/orchestrator_gameplay/PROJECT.md
- **Code layout**: /Users/user/teamwork_projects/metal_slug_web/src/input/KeyboardController.ts

## Key Decisions Made
- Added `public jumpJustPressed`, `public fireJustPressed`, `public grenadeJustPressed` latch booleans.
- Re-mapped `Space` in `codeMap` and `resolveAction` to `'jump'`.
- Re-mapped `KeyJ` and `KeyZ` to `'fire'`.
- Re-mapped `KeyL` and `KeyC` to `'grenade'`.
- Preserved WASD and Arrow keys for movement/aiming.
- In `handleKeyDown` and `setAction`, latched flags become `true` on keydown (guarded against `e.repeat`).
- In `getSnapshot()`, `jumpPressed = this.jumpJustPressed || (this.jump && !this.prevJump);` and then clears `jumpJustPressed`.
- In `reset()`, all keys and latched flags are reset to `false`.

## Artifact Index
- handoff.md — Final handoff report for Worker 1

## Change Tracker
- **Files modified**: `src/input/KeyboardController.ts` (mapped Space/K/X to jump, J/Z to fire, L/C to grenade; added edge latching)
- **Build status**: PASS (`tsc -b && vite build`)
- **Pending issues**: None for M1

## Quality Status
- **Build/test result**: PASS (12/12 passed in `tests/unit/input_and_hud.test.ts`)
- **Lint status**: PASS (Clean TypeScript compilation)
- **Tests added/modified**: Verified via automated scripts for DOM event mapping, rapid tap latching, and in-game simulation jump ($\Delta Y = -16.89\text{px}$)

## Loaded Skills
- None
