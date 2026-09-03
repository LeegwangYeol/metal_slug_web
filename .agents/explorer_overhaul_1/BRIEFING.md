# BRIEFING — 2026-09-03T06:21:40Z

## Mission
Investigate R1 Physics (kinematics, collision, jump arc) and Enemy Spawning/Despawning (StageManager.ts, main.ts), producing survey report and handoff.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: /Users/user/src/fullmetalslug/.agents/explorer_overhaul_1
- Original parent: 390e9a3c-c60d-42f9-80ff-35ac81372992
- Milestone: M1, M2 investigation (R1 Physics & Spawning)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement source code
- Adhere to Teamwork protocol (evidence chain, verified line numbers)
- Always wait for user approval before implementing (we produce specs & analysis only)
- Output analysis to survey_report.md and deliver handoff.md

## Current Parent
- Conversation ID: 390e9a3c-c60d-42f9-80ff-35ac81372992
- Updated: not yet

## Investigation State
- **Explored paths**: ORIGINAL_REQUEST.md, PROJECT.md, COLLABORATION.md, DISPATCH.md, `src/core/player/PlayerKinematics.ts`, `src/core/player/PlayerController.ts`, `src/core/physics/Platform.ts`, `src/core/physics/SpatialGrid.ts`, `src/core/engine/StageManager.ts`, `src/core/engine/GameEngine.ts`, `src/main.ts`, `src/render/Camera.ts`, `src/core/entities/enemies/SoldierEnemy.ts`, `tests/unit/player_kinematics_aiming.test.ts`, `tests/unit/adversarial_challenge.test.ts`, `tests/unit/core_engine.test.ts`.
- **Key findings**:
  1. Jump physics: Initial impulse (-360 px/s), gravity (800 px/s²), apex float dampening ($0.65\times g$), single-shot jump cut, 4-frame coyote time & jump buffering.
  2. Spawning pop-in: Hardcoded trigger coordinates (x=340, 420) fall inside viewport [0, 480] at trigger X=180. Out-of-bounds spawn ($X_{\text{spawn}} = \text{camera.x} + 520\text{px}$) with $110\text{ px/s}$ run-in ingress state eliminates pop-in.
  3. Despawning: Clean off-screen culling for $X < \text{camera.x} - 180\text{px}$ or $Y > 320\text{px}$ in StageManager.
  4. Flake calibration: `adversarial_challenge.test.ts:394` threshold calibrated from 50µs to 250µs.
- **Unexplored areas**: None for R1 scope. Ready for handoff.

## Key Decisions Made
- Formulated complete Newtonian parabolic equations and discrete semi-implicit Euler integration formulas.
- Outlined concrete implementation directives for Worker 1 (Physics) and Worker 2 (Spawning).
- Synthesized findings into `survey_report.md` and `handoff.md`.

## Artifact Index
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/BRIEFING.md` — persistent briefing state
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/progress.md` — liveness heartbeat
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/survey_report.md` — comprehensive R1 physics and spawning analysis
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/handoff.md` — 5-component handoff report
