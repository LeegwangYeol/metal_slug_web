# Handoff Report: R2 Neo Geo Pixel Art Sprites, Dynamic Crosshairs, and 5-Directional Aiming

**Agent**: `explorer_overhaul_2`  
**Working Directory**: `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2`  
**Milestone**: M3 / M4 (R2 Overhaul)  
**Target Roles**: Worker 3 (Sprites), Worker 4 (Crosshair & Aim Animations), Orchestrator  
**Date**: 2026-09-03  

---

## 1. Observation

1. **Primitive Bounding Rectangles in `ProceduralSpriteFactory.ts`**:
   - `src/render/sprites/ProceduralSpriteFactory.ts:334-360`: Character body parts are rendered using coarse rectangular blocks:
     - Legs: `ctx.fillRect(11 + legL, legY, 6, isCrouch ? 8 : 10)` and `ctx.fillRect(17 + legR, legY, 6, isCrouch ? 8 : 10)`
     - Boots: `ctx.fillRect(10 + legL, legY + (isCrouch ? 8 : 10), 7, 5)`
     - Torso: `ctx.fillRect(11, torsoY, 12, 10)`
     - Face: `ctx.fillRect(13, headY + 6, 9, 5)` with a single 2x2 square eye `ctx.fillRect(19, headY + 7, 2, 2)`
   - Mid-boss vehicle hull (`ProceduralSpriteFactory.ts:771`): Monolithic rectangle `ctx.fillRect(8, 16, 120, 36)`.
   - Boss Tetsuyuki fuselage (`ProceduralSpriteFactory.ts:869`): Monolithic rectangle `ctx.fillRect(10, 20, 240, 100)`.
   - Result: Figures resemble early 1980s 8-bit/Atari blocks rather than shaded 16-color Neo Geo arcade pixel art.

2. **Aim Direction Disconnect Between Simulation and Renderer**:
   - `src/core/player/PlayerKinematics.ts:24-30`: Defines `enum AimAngle { FORWARD, UP_FORWARD, UP, DOWN_FORWARD, DOWN }`.
   - `src/core/player/PlayerController.ts:56`: Tracks `this.aimAngle: AimAngle` and `this.aimDirection: Vector2D`.
   - `src/main.ts:265-272`: In `buildRenderSceneState()`:
     ```typescript
     const playerRenderState: RenderPlayerState = {
       x: this.player.position.x,
       y: this.player.position.y,
       facing: this.player.facing,
       state: this.resolvePlayerRenderState(),
       isMelee: this.player.isAttackingMelee,
     };
     ```
     `aimAngle` and `aimDirection` are completely omitted from `playerRenderState`.
   - `src/main.ts:420-439`: `resolvePlayerRenderState()` never returns `'aim'`; it only returns `'death'`, `'knife'`, `'crouch'`, `'jump'`, `'run'`, or `'idle'`.
   - `src/render/CanvasRenderer.ts:440-442`:
     ```typescript
     } else if (p.state === 'aim') {
       const aim = p.aimAngle ?? (flip ? 4 : 0);
       spriteKey = `player_aim_${aim}`;
     }
     ```
     Since `p.state === 'aim'` is never set by `main.ts`, directional aiming sprites are never triggered during gameplay.

3. **Absence of Visual Aiming Reticle / Crosshair**:
   - Ripgrep search across all source code in `src/` for `crosshair` or `reticle` returned **zero matches** in game code.
   - `CanvasRenderer.ts` has 5 render passes (Pass 1: Parallax, Pass 2: Terrain/Platforms, Pass 3: Entities, Pass 4: Projectiles/Explosions, Pass 5: HUD Overlay). No crosshair pass exists.

4. **Existing Unit Test Assertions**:
   - `tests/unit/render_components.test.ts:42-58`: Asserts specific sprite keys exist:
     - `player_idle_0..3`
     - `player_run_0..5`
     - `player_jump_rise`, `player_jump_fall`
     - `player_crouch_idle`
     - `player_knife_0..1`
     - `player_fire_0`
     - `player_death_0`
     - `player_aim_0..7`
   - Command `npm test` executed on 2026-09-03 ran 13 test files and 139 tests: **139 passed (100% green)** in 11.15s.

---

## 2. Logic Chain

1. **Why current sprites look flat and primitive** (from Observation 1):
   - By constructing sprites out of flat `fillRect` boxes with uniform color fills, characters lack the pixel-stepped contours, multi-shade muscle/clothing highlights, and characteristic black outlines that define authentic 16-bit Neo Geo arcade pixel art.
   - Although `PALETTES` contains complete 16-color authentic ramps (e.g. 3-step skin tones `#905030` $\to$ `#E09860` $\to$ `#FFCC99`, 2-step olive vest `#445824` $\to$ `#738A44`), only single colors are stamped onto large rectangles.
   - Therefore, introducing a layered micro-primitive procedural rasterizer (`drawPixelCluster`, `drawContouredRect`, `drawBeveledPlate`, `drawRivet`) using the existing 16-color palettes will transform the visual quality to authentic arcade standards without requiring external assets.

2. **Why player aiming animations are non-functional on screen** (from Observation 2):
   - In `src/main.ts`, `resolvePlayerRenderState()` only resolves locomotion states (`idle`, `run`, `jump`, `crouch`).
   - `playerRenderState` does not pass `aimAngle` or `aimDirection`.
   - Even if it did, `CanvasRenderer.ts` treated aiming as a mutually exclusive state (`p.state === 'aim'`), which is incompatible with run-and-gun gameplay where players aim up-forward or straight-up while running, jumping, or standing.
   - Therefore, locomotion (legs) and aiming (torso) must be decoupled in sprite generation, and `CanvasRenderer.ts` must select composite sprites combining `p.state` + `p.aimAngle`.

3. **Why crosshair indicator is missing** (from Observation 3):
   - The simulation engine has exact aim unit vectors in `PlayerKinematics.ts`, but no rendering pass was implemented in `CanvasRenderer.ts`.
   - Adding a dedicated Pass 3.5 (Tactical Aim Reticle Pass) projecting from muzzle to screen coordinates along `aimDirection` with weapon-specific visual styles (Pistol laser pip/bracket, HMG tactical circle with spread, Flame Shot incendiary arc) will completely fulfill R2 requirements.

4. **Preserving 100% Test Pass Rate** (from Observation 4):
   - Because `render_components.test.ts` asserts the existence of legacy keys (`player_aim_0..7`, `player_run_0..5`), upgrading `ProceduralSpriteFactory.ts` must preserve these keys as aliases pointing to the new high-resolution frames.

---

## 3. Caveats

1. **OffscreenCanvas vs. Node.js Mock**:
   - `ProceduralSpriteFactory.ts` uses `createCanvasBuffer`, which provides a headless in-memory 2D mock for Node.js Vitest environments and native `OffscreenCanvas` / `HTMLCanvasElement` in browser environments. The upgraded rasterizer routines must use only standard 2D context methods (`fillRect`, `arc`, `save`, `restore`, etc.) supported by the mock to ensure headless tests run seamlessly.
2. **Downward Aiming on Ground**:
   - In classic Metal Slug (and verified in `PlayerKinematics.ts:77-86`), pressing DOWN while grounded causes the player to crouch and fire horizontally forward. Downward (`DOWN`) and down-diagonal (`DOWN_FORWARD`) aiming are strictly available only while airborne. Crosshair and upper-body poses must follow this authentic rule.
3. **Scope Discipline**:
   - This investigation is strictly read-only. No source files were modified. All specifications, coordinates, and architectural designs are documented in `survey_report.md` for Worker 3 and Worker 4.

---

## 4. Conclusion

- The root causes of primitive visuals, missing crosshairs, and static character aiming have been conclusively identified with verified line numbers and empirical test data.
- Complete 16-color Neo Geo pixel-art specifications, mathematical crosshair projection equations, and 5-directional upper-body animation architectures have been established and detailed in `survey_report.md`.
- Implementation can proceed cleanly in parallel:
  - **Worker 3**: Re-architect `ProceduralSpriteFactory.ts` with high-resolution 16-color pixel-art sprites and legacy key aliases.
  - **Worker 4**: Update `CanvasRenderer.ts` and `main.ts` to implement dynamic weapon crosshairs and 5-directional upper-body aiming poses.

---

## 5. Verification Method

To independently verify this investigation and the downstream implementations:

1. **Verify Existing Tests Pass**:
   ```bash
   npm test
   ```
   Must pass all 13 test suites and 139 tests with zero errors.

2. **Verify Sprite Catalogue & Crosshair Rendering**:
   ```bash
   npx vitest run tests/unit/render_components.test.ts
   ```
   Inspect that all required sprite keys and new composite directional keys exist in `ProceduralSpriteFactory.getInstance()`.

3. **Verify Kinematics & 5-Directional Aim Vectors**:
   ```bash
   npx vitest run tests/unit/player_kinematics_aiming.test.ts
   ```
   Validates the 5 authentic aim vectors:
   - `FORWARD`: `(1, 0)`
   - `UP_FORWARD`: `(0.7071, -0.7071)`
   - `UP`: `(0, -1)`
   - `DOWN_FORWARD`: `(0.7071, 0.7071)` (airborne only)
   - `DOWN`: `(0, 1)` (airborne only)

4. **Verify Documentation Artifacts**:
   Inspect `/Users/user/src/fullmetalslug/.agents/explorer_overhaul_2/survey_report.md` for complete technical specifications.
