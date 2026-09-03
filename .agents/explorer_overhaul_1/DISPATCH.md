# Dispatch: Explorer Overhaul 1 (R1 Physics & Spawning)

## Mission
Investigate R1: Physics (PlayerKinematics, collision, jump arc, Newtonian equations) and Enemy Spawning/Despawning (StageManager.ts, main.ts).

## Working Directory
/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1

## Scope & Instructions
1. Read `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md`, `/Users/user/src/fullmetalslug/COLLABORATION.md`, and `/Users/user/src/fullmetalslug/PROJECT.md`.
2. Inspect `src/core/player/PlayerKinematics.ts`, `src/core/physics/`, `src/core/engine/StageManager.ts`, and `src/main.ts`.
3. Analyze current jump curves, falling velocity, gravity, ground landing logic, and collision forgiveness. Compare against authentic Newtonian parabolic kinematics and arcade feel.
4. Analyze current enemy spawn triggers in `src/main.ts` and `src/core/engine/StageManager.ts`. Why do enemies pop in on screen? How should spawners position minions out-of-bounds (e.g. camera.maxX + 40px or camera.minX - 40px) so they enter smoothly with running/patrol animations? Where should off-screen despawning occur?
5. Write a comprehensive technical report and handoff report (`handoff.md`) with verified line numbers, concrete formulas, and step-by-step implementation recommendations for Worker 1 & Worker 2.
