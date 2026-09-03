# Milestone M4 Overhaul Handoff Report: Dynamic Weapon Aiming Reticles & 5-Directional Upper-Body Aiming Animations

**Agent**: `worker_m4`  
**Working Directory**: `/Users/user/src/fullmetalslug/.agents/worker_m4`  
**Exclusive File Ownership**:
- `src/render/CanvasRenderer.ts`
- `src/main.ts` (`buildRenderSceneState()` player render state forwarding)
- `tests/unit/render_components.test.ts`
**Target Recipient**: `orchestrator` (`390e9a3c-c60d-42f9-80ff-35ac81372992`)  
**Date**: 2026-09-03  

---

## 1. Observation

1. **Aiming State Forwarding Gap in `src/main.ts`**:
   - In `src/main.ts:265-272`, `buildRenderSceneState()` previously only passed `x`, `y`, `facing`, `state`, and `isMelee` to `RenderPlayerState`. `aimAngle` and `aimDirection` were omitted, preventing the renderer from knowing the player's true aiming vector.
   - `RenderPlayerState` in `src/render/CanvasRenderer.ts` was previously constrained to `aimAngle?: number`, lacking `aimDirection`, `weaponType`, and `isFiring`.

2. **Absence of Visual Tactical Crosshair (Pass 3.5)**:
   - In `src/render/CanvasRenderer.ts:184-213`, `renderScene()` transitioned immediately from Pass 3 (Entities) to Pass 4 (Projectiles & Explosions). No visual crosshair or aiming indicator was rendered on-screen along the aim vector.

3. **Decoupled 5-Directional Upper-Body Animation Support**:
   - Worker M3 generated and registered 164 high-resolution 16-color Neo Geo sprites in `ProceduralSpriteFactory.ts`, including composite directional keys:
     - Standing idle: `player_idle_aim_FORWARD_0..3`, `player_idle_aim_UP_FORWARD_0..3`, `player_idle_aim_UP_0..3`
     - Running: `player_run_aim_FORWARD_0..5`, `player_run_aim_UP_FORWARD_0..5`, `player_run_aim_UP_0..5`
     - Airborne jump: `player_jump_aim_FORWARD`, `player_jump_aim_UP_FORWARD`, `player_jump_aim_UP`, `player_jump_aim_DOWN_FORWARD`, `player_jump_aim_DOWN`
     - Crouching: `player_crouch_aim_FORWARD`
     - Legacy aliases: `player_aim_0..7`, `player_idle_0..3`, `player_run_0..5`, etc.
   - `CanvasRenderer.ts:425-455` previously selected player sprites via static `p.state` without checking `p.aimAngle` or using the composite keys.

4. **Implementation and Verification**:
   - Updated `RenderPlayerState` in `src/render/CanvasRenderer.ts` and re-exported it in `src/main.ts`:
     ```typescript
     export interface RenderPlayerState {
       x: number;
       y: number;
       facing: 1 | -1;
       state: 'idle' | 'run' | 'jump' | 'crouch' | 'aim' | 'knife' | 'fire' | 'death';
       aimAngle?: any;
       aimDirection?: Vector2D;
       weaponType?: 'PISTOL' | 'HEAVY_MACHINE_GUN' | 'FLAME_SHOT';
       animFrame?: number;
       isMelee?: boolean;
       isFiring?: boolean;
     }
     ```
   - Updated `src/main.ts:buildRenderSceneState()` to pass `aimAngle: this.player.aimAngle`, `aimDirection: this.player.aimDirection`, `weaponType: this.player.weaponManager.getActiveWeapon()`, and `isFiring` based on `this.lastInputSnapshot`.
   - Implemented Pass 3.5 (`renderCrosshairPass` & `calculateCrosshairGeometry`) in `src/render/CanvasRenderer.ts`:
     - **Pistol (`PISTOL`)**: Laser targeting pip (2x2 white-hot core with `#2ECC71` neon green glow), 4 corner brackets at 6px radius, and subtle dashed laser sight tracer line.
     - **Heavy Machine Gun (`HEAVY_MACHINE_GUN`)**: Tactical amber circular ring (`#F1C40F`) with 4 cardinal ticks, dynamic recoil spread expansion during firing (8px -> 10.5px), and dual bullet spread pips framing the bullet trajectory cone.
     - **Flame Shot (`FLAME_SHOT`)**: Tapered incendiary cone radiating from muzzle across $\pm 24^\circ$ spread, 3 swept fiery concentric pressure arcs (`#E84800` $\to$ `#FFA010` $\to$ `#FFF060`), sinusoidal flame flicker pulse, and center hazard diamond.
     - Pure vector and trigonometric projection seamlessly handles facing left ($p.facing = -1$), facing right ($p.facing = 1$), vertical aiming (UP, DOWN), and diagonals (UP_FORWARD, DOWN_FORWARD).
   - Implemented `resolvePlayerSpriteKey()` in `CanvasRenderer.ts` resolving the 5 authentic aim directions across idle, running, jumping, and crouching states, with graceful fallback to base locomotion or `player_aim_${aimAngle}`.
   - Added 14 new comprehensive unit tests in `tests/unit/render_components.test.ts` (now 35 total tests in file).
   - `npm test`: **14 test files, 170 passed (100% green)** in 1.07s.
   - `npm run build`: **Built successfully in 340ms** with 0 errors (`tsc -b && vite build`).

---

## 2. Logic Chain

1. **Unified State Pipeline (`src/main.ts` -> `CanvasRenderer.ts`)**:
   - `PlayerKinematics.calculateAim` already outputs canonical unit vectors and `AimAngle` enums (`FORWARD`, `UP_FORWARD`, `UP`, `DOWN_FORWARD`, `DOWN`), tracked by `PlayerController`.
   - By populating `aimAngle` and `aimDirection` inside `buildRenderSceneState()`, the presentation pipeline directly mirrors simulation kinematics with zero lag.
2. **Decoupled Upper-Body Aiming Animation Selection**:
   - In 2D run-and-gun arcade shooters like Metal Slug, leg locomotion (running, idling, jumping) must be decoupled from upper-body gun aiming.
   - `CanvasRenderer.resolvePlayerSpriteKey()` queries the pre-baked composite sprites (`player_idle_aim_${aimName}_${frame}`, `player_run_aim_${aimName}_${frame}`, `player_jump_aim_${aimName}`). If a specific composite is absent, it gracefully falls back to base locomotion or legacy `player_aim_${aimAngle}`, preventing any missing-texture or rendering crash bugs.
3. **Pass 3.5 Crosshair Layering & Kinematics**:
   - Rendering Pass 3.5 after Pass 3 (Entities) and before Pass 4 (Projectiles/Explosions) ensures the crosshair is drawn above world terrain and player/enemy bodies, yet underneath active bullet tracers and screen-space HUD overlays.
   - Muzzle offsets are accurately computed using `PlayerKinematics.getMuzzlePosition(anchorX, anchorY, facing, posture, aimAngle)`, ensuring the reticle and tracer lines originate from the actual gun barrel rather than the player's feet.
   - Left-facing orientation is handled naturally: the direction vector has $dirX < 0$, placing the reticle at $x_{\text{reticle}} < x_{\text{muzzle}}$, and flame cone arcs/spread normal vectors rotate symmetrically according to $\theta = \text{atan2}(dirY, dirX)$.
4. **Headless & CI Resilience**:
   - Canvas context calls check `typeof (ctx as any).setLineDash === 'function'` before invoking, ensuring seamless execution on Node.js headless in-memory canvas mocks under Vitest where `setLineDash` is undefined.

---

## 3. Caveats

1. **Grounded Downward Aiming Constraint**:
   - As per authentic Metal Slug mechanics and `PlayerKinematics.ts`, pressing DOWN while grounded transitions the player into crouch and fires HORIZONTALLY FORWARD. Downward (`DOWN`) and down-diagonal (`DOWN_FORWARD`) aiming are strictly available only while airborne. Crosshair projection and upper-body animation keys adhere strictly to this rule.
2. **No External Asset Dependencies**:
   - All reticle graphics, laser sights, tactical rings, and incendiary arcs are generated procedurally on Canvas 2D without requiring external image bitmaps.
3. **Exclusive File Ownership Preserved**:
   - Only `src/main.ts`, `src/render/CanvasRenderer.ts`, and `tests/unit/render_components.test.ts` were modified. No other workers' files were touched.

---

## 4. Conclusion

- Milestone M4 overhaul objectives are **100% complete**.
- Dynamic weapon-specific crosshairs / reticles (Pistol laser pip/brackets, HMG tactical circle with spread pips, Flame Shot incendiary arc/cone) are implemented and operational in Pass 3.5.
- 5-directional upper-body aiming animations are integrated and active across idle, run, jump, and crouch states.
- Both `src/main.ts` and `src/render/CanvasRenderer.ts` export `RenderPlayerState` with `aimAngle` and `aimDirection`.
- All 170 unit tests across 14 suites pass 100% green, and `npm run build` completes cleanly with 0 compilation errors.

---

## 5. Verification Method

To independently verify this implementation:

1. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected result*: All 14 test files and 170 tests pass (100% green).

2. **Run Render & Crosshair Unit Tests**:
   ```bash
   npx vitest run tests/unit/render_components.test.ts
   ```
   *Expected result*: All 35 tests in `render_components.test.ts` pass with 0 failures.

3. **Verify Production Compilation & Bundling**:
   ```bash
   npm run build
   ```
   *Expected result*: `tsc -b && vite build` succeeds with 0 errors.

4. **Verify Crosshair Geometry & Sprite Resolution via CLI**:
   ```bash
   npx tsx -e "
     import { CanvasRenderer } from './src/render/CanvasRenderer';
     import { AimAngle } from './src/core/player/PlayerKinematics';
     const r = new CanvasRenderer();
     const geom = r.calculateCrosshairGeometry({ x: 100, y: 200, facing: 1, state: 'idle', aimAngle: AimAngle.UP_FORWARD, weaponType: 'HEAVY_MACHINE_GUN' });
     console.log('Muzzle:', geom.muzzle, 'Reticle:', geom.worldReticle, 'Distance:', geom.distance);
     console.log('Sprite Key:', r.resolvePlayerSpriteKey({ x: 100, y: 200, facing: 1, state: 'run', aimAngle: AimAngle.UP_FORWARD, animFrame: 2 }, 0));
   "
   ```
   *Expected result*:
   - Muzzle: `{ x: 116, y: 162 }`
   - Reticle: `{ x: ~149.9, y: ~128.1 }`
   - Distance: `48`
   - Sprite Key: `'player_run_aim_UP_FORWARD_2'`
