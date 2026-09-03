# Dispatch: Worker M2 (Smooth Out-of-Bounds Enemy Spawning & Despawning)

## Mission
Implement smooth out-of-bounds enemy spawning and clean off-screen despawning according to R1 requirements and Explorer 1's handoff specification.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m2

## Exclusive File Ownership
- `src/core/engine/StageManager.ts`
- `src/core/entities/enemies/SoldierEnemy.ts`
- `src/main.ts` (spawn triggers & stage manager update loop)

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_1/survey_report.md`

## Instructions
1. In `src/core/engine/StageManager.ts`:
   - Pass camera state / `cameraX` to `StageTrigger.spawnAction(engine, cameraX)`.
   - Implement off-screen despawning: in `update(cameraX, playerX)`, scan active enemies; if an enemy drops behind the screen ($X < \text{cameraX} - 180\text{px}$) or falls below the stage ($Y > 320\text{px}$), despawn it cleanly from the engine and remove from tracking to prevent memory leaks and spatial grid clutter.
2. In `src/core/entities/enemies/SoldierEnemy.ts`:
   - Support smooth entrance behavior: when spawned off-screen, soldier enters with an initial inward velocity / run-in state ($v_x = -110\text{ px/s}$) until crossing into visible viewport bounds ($X \le \text{cameraX} + 460\text{px}$), then smoothly transitions to its tactical patrol / combat AI.
3. In `src/main.ts`:
   - Update wave spawn triggers (`trigger_wave_1`, `trigger_wave_2`, `trigger_wave_3`, etc.) so enemies NEVER spawn directly inside the visible viewport.
   - Position right-entering minions out-of-bounds: $X_{\text{spawn}} = \text{cameraX} + \text{camera.viewportWidth} + 40\text{px} = \text{cameraX} + 520\text{px}$, with $+40\text{px}$ echelon staggering for multi-enemy squads.
   - For elevated fortification sentries, ensure they are pre-placed on stage creation or triggered when platforms are still off-screen.
   - Pass `this.camera.x` to `this.stageManager.update(this.camera.x, this.player.position.x)`.
4. Run `npm test` using `run_command` and confirm all 145+ unit tests pass 100% green.
5. Deliver `handoff.md` in your working directory with build & test output.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-03T06:30:56Z

You are worker_m2.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m2
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m2/DISPATCH.md

Exclusive File Ownership:
- src/core/engine/StageManager.ts
- src/core/entities/enemies/SoldierEnemy.ts
- src/main.ts (spawn triggers & stage manager update)

Your task:
1. In src/core/engine/StageManager.ts:
   - Update StageTrigger interface and execution to pass camera parameters to spawnAction (engine, cameraX).
   - Implement despawnOffscreenEntities(): in update(cameraX, playerX), scan active minions and cleanly despawn any minion that falls behind the camera (x < cameraX - 180) or drops below stage (y > 320), removing them from the engine to prevent memory leaks.
2. In src/core/entities/enemies/SoldierEnemy.ts:
   - Support smooth ingress: when spawned off-screen, minions move inward with a run-in velocity (vx = -110 px/s) until reaching the visible screen boundary margin (x <= cameraX + 460), then seamlessly transition to their normal patrol / combat AI state.
3. In src/main.ts:
   - Update all enemy wave triggers (trigger_wave_1, trigger_wave_2, trigger_wave_3, etc.) so that enemies NEVER pop onto the visible screen.
   - Calculate right-entering spawn positions out-of-bounds: x = cameraX + camera.viewportWidth + 40 (i.e. cameraX + 520), staggered by +40px for multi-enemy squads.
   - Pass camera.x to stageManager.update(this.camera.x, this.player.position.x).
4. Run npm test to verify all tests pass 100% green.
5. Deliver handoff.md in your working directory with test outputs. Send a message to orchestrator when done.

