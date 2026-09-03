# Dispatch: Worker M4 (Dynamic Aiming Crosshair & 5-Directional Upper-Body Animations)

## Mission
Implement dynamic weapon aiming crosshairs/reticles and 5-directional upper-body aiming animations according to R2 requirements and Explorer 2's handoff specification.

## Working Directory
/Users/user/src/fullmetalslug/.agents/worker_m4

## Exclusive File Ownership
- `src/render/CanvasRenderer.ts`
- `src/main.ts` (`buildRenderSceneState()` player render state forwarding)

## Input References
- `/Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md` (MANDATORY: read first)
- `/Users/user/src/fullmetalslug/COLLABORATION.md`
- `/Users/user/src/fullmetalslug/PROJECT.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/handoff.md`
- `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/survey_report.md`
- `/Users/user/src/fullmetalslug/.agents/worker_m3/handoff.md` (check composite sprite keys)

## Instructions
1. In `src/main.ts`:
   - In `RenderPlayerState` interface: ensure `aimAngle?: number | string` (or `AimAngle`) and `aimDirection?: Vector2D` are present.
   - In `buildRenderSceneState()`: pass `aimAngle: this.player.aimAngle` and `aimDirection: this.player.aimDirection` in `playerRenderState`.
2. In `src/render/CanvasRenderer.ts`:
   - Implement Pass 3.5: Tactical Aiming Reticle / Crosshair:
     - Render crosshair along player aim vector from player position / muzzle.
     - Provide weapon-specific visual styling:
       - Handgun / Pistol: Laser targeting pip and subtle crosshair bracket.
       - Heavy Machine Gun: Tactical circular reticle with bullet spread pips.
       - Flame Shot: Tapered incendiary arc / cone indicator.
     - Reticle distance: positioned at responsive targeting distance (e.g. 36-54px along aim vector), flipping orientation cleanly when player faces left.
   - Implement 5-Directional Upper-Body Aiming Animations:
     - Select sprite using the high-resolution composite keys pre-baked by Worker M3:
       - `FORWARD`: `player_idle_aim_FORWARD_0..3`, `player_run_aim_FORWARD_0..5`, `player_jump_aim_FORWARD`
       - `UP_FORWARD`: `player_idle_aim_UP_FORWARD_0..3`, `player_run_aim_UP_FORWARD_0..5`, `player_jump_aim_UP_FORWARD`
       - `UP`: `player_idle_aim_UP_0..3`, `player_run_aim_UP_0..5`, `player_jump_aim_UP`
       - `DOWN_FORWARD`: `player_jump_aim_DOWN_FORWARD` (airborne)
       - `DOWN`: `player_jump_aim_DOWN` (airborne)
       - Grounded crouch: `player_crouch_aim_FORWARD`
       - Fallback to `player_aim_0..7` or base locomotion sprite if key not found.
3. Run `npm test` and `npm run build` to confirm 100% green tests and 0 compilation errors.
4. Deliver `handoff.md` in your working directory with build & test output.

## Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-09-03T06:40:33Z

You are worker_m4.
Working directory: /Users/user/src/fullmetalslug/.agents/worker_m4
Scope document: /Users/user/src/fullmetalslug/PROJECT.md
Original user request: /Users/user/src/fullmetalslug/ORIGINAL_REQUEST.md
Collaboration guide: /Users/user/src/fullmetalslug/COLLABORATION.md
Dispatch instructions: /Users/user/src/fullmetalslug/.agents/worker_m4/DISPATCH.md

Exclusive File Ownership:
- src/render/CanvasRenderer.ts
- src/main.ts (buildRenderSceneState player render state forwarding)

Your task:
1. In src/main.ts:
   - Ensure RenderPlayerState interface has aimAngle?: any and aimDirection?: Vector2D.
   - In buildRenderSceneState(): pass aimAngle: this.player.aimAngle and aimDirection: this.player.aimDirection in playerRenderState.
2. In src/render/CanvasRenderer.ts:
   - Implement Pass 3.5: Tactical Aiming Reticle / Crosshair:
     - Render crosshairs projected along aimDirection from the player position.
     - Weapon-specific styling: Pistol (laser targeting pip and subtle bracket), Heavy Machine Gun (tactical circular reticle with bullet spread pips), Flame Shot (tapered incendiary arc / cone indicator).
     - Cleanly handle facing orientation when player faces left.
   - Implement 5-Directional Upper-Body Aiming Animations:
     - Select sprite using the high-resolution composite keys pre-baked by Worker M3 (player_idle_aim_FORWARD_0..3, player_idle_aim_UP_FORWARD_0..3, player_idle_aim_UP_0..3, player_run_aim_FORWARD_0..5, player_run_aim_UP_FORWARD_0..5, player_run_aim_UP_0..5, player_jump_aim_FORWARD, player_jump_aim_UP_FORWARD, player_jump_aim_UP, player_jump_aim_DOWN_FORWARD, player_jump_aim_DOWN, player_crouch_aim_FORWARD).
     - Graceful fallback to player_aim_${aimAngle} or base locomotion sprite if key not found.
3. Run npm test and npm run build to verify all tests pass 100% green and 0 build errors.
4. Deliver handoff.md in your working directory with test outputs. Send a message to orchestrator when done.

