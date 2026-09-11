# Dispatch Assignment: Milestone 2 Worker (Widen Camera FOV & Viewport Optimization)

- **Role**: teamwork_preview_worker
- **Assigned Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Working Directory**: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera
- **Parent Orchestrator**: 52278ce8-fed5-44e0-ad05-d44362fee9a5

## Mandatory Reading
Before taking any action, you MUST read the following authoritative requirement documents in full:
1. `/Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md`
2. `/Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md`
3. `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
4. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/analysis.md`
5. `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/handoff.md`

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## File Ownership
You exclusively own and may edit the following files:
- `src/render/Camera.ts`
- `src/render/GothicBackdrop.ts`
- `src/render/vfx/DarkFantasyVFX.ts`
- `src/core/systems/WaveDirector.ts`
- `src/main.ts` (world scale wrapper and culling checks)
- Unit tests under `tests/unit/` relating to camera, backdrop, and wave spawning (e.g. `tests/unit/camera_tracking.spec.ts`, `tests/unit/ChallengerDF_M2.test.ts`, `tests/unit/WaveDirector.test.ts`)

DO NOT edit `src/ui/GothicHUD.ts`, `src/ui/UpgradeModal.ts` (owned by Milestone 3).

## Implementation Objectives
Execute the architectural blueprint established in the camera survey:
1. **Camera Zoom Calibration ($Z = 0.80$)**:
   - In `src/render/Camera.ts`:
     - Add `public zoom: number = 0.80;` (default 0.80, achieving +56.25% battlefield view expansion: $1200 \times 675\text{px}$).
     - Provide getters `public get viewWidth(): number { return this.viewportWidth / this.zoom; }` ($1200\text{px}$) and `public get viewHeight(): number { return this.viewportHeight / this.zoom; }` ($675\text{px}$).
     - Update coordinate transforms:
       - `worldToScreen(wx, wy)`: `x = (wx - renderX) * zoom`, `y = (wy - renderY) * zoom`.
       - `screenToWorld(sx, sy)`: `x = renderX + sx / zoom`, `y = renderY + sy / zoom`.
     - Update `clampToBounds()` using `this.viewWidth` and `this.viewHeight` to keep camera inside world bounds without displaying out-of-bounds void.
2. **World Rendering vs Canvas/HUD Isolation in `src/main.ts`**:
   - Wrap world rendering passes 1–10 inside `ctx.save(); ctx.scale(this.camera.zoom, this.camera.zoom); ... ctx.restore();`.
   - Pass 11 (HUD) and Pass 12 (UpgradeModal) remain rendered 1:1 on the native $960 \times 540$ canvas, guaranteeing 100% crisp typography and filigree framing.
3. **Viewport Culling Adaptation**:
   - In `src/main.ts`:
     - Update entity and loot culling margins to use `this.camera.viewWidth` ($1200$) and `this.camera.viewHeight` ($675$) so entities do not prematurely disappear at screen edges.
4. **Wave Spawner Adaptation**:
   - In `src/core/systems/WaveDirector.ts`:
     - Update viewport dimensions to match $1200 \times 675$.
     - Increase `spawnRingSurround` radius from $670\text{px} \to 800\text{px}$ so enemies strictly spawn outside the visible screen corners ($688.4\text{px}$ diagonal) with zero on-screen pop-in.
5. **Dynamic Radial Lighting Pass**:
   - In `src/render/vfx/DarkFantasyVFX.ts`:
     - Ensure `DynamicLightingEngine` darkness buffer covers the expanded $1200 \times 675$ viewport.
     - Scale vignette radial gradient from $[200, 580]\text{px} \to [250, 725]\text{px}$ to prevent black corner cutoffs.
     - Scale player torch radius from $200\text{px} \to 250\text{px}$ and amber bloom to $150\text{px}$ to preserve gothic illumination across the wider view.
6. **Toroidal Backdrop Seam Prevention**:
   - In `src/render/GothicBackdrop.ts`:
     - Ensure flagstones, runes, and props seamlessly tile across the widened $1200 \times 675$ view with zero edge seams or gaps.
     - Clamp Layer 0 sky draw vertically so no duplicate blood moon appears.

## Verification Requirements
You MUST:
1. Run `npm run build` and verify clean compilation with 0 errors.
2. Run `npm test` and verify that all unit tests pass 100% green without regressions.
3. Add unit tests verifying `camera.zoom`, `viewWidth`, `viewHeight`, coordinate transform roundtrips, and spawn ring radius $> 750\text{px}$.
4. Document all changes and verification outputs in your `handoff.md`.
5. Report completion to parent orchestrator.

## 2026-09-11T06:39:12Z
You are worker_m2_camera, a teamwork_preview_worker subagent in the 40-Agent Swarm for "Grim Harvest: Undead Siege".
Your working directory is: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera

First, read the authoritative documents:
- /Users/user/teamwork_projects/metal_slug_web/ORIGINAL_REQUEST.md
- /Users/user/teamwork_projects/metal_slug_web/COLLABORATION.md
- /Users/user/teamwork_projects/metal_slug_web/PROJECT.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/DISPATCH.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/analysis.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/explorer_survey_camera/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

File Ownership:
You exclusively own and may edit:
- src/render/Camera.ts
- src/render/GothicBackdrop.ts
- src/render/vfx/DarkFantasyVFX.ts
- src/core/systems/WaveDirector.ts
- src/main.ts (world scale wrapper and culling checks)
- tests/unit/ (camera, backdrop, and wave spawner test files)

Implementation Objectives:
1. Camera Zoom Calibration (Z = 0.80, viewWidth = 1200, viewHeight = 675, worldToScreen / screenToWorld transforms, clampToBounds).
2. World Rendering vs Canvas/HUD Isolation in src/main.ts: wrap world render passes 1-10 in ctx.save(); ctx.scale(camera.zoom, camera.zoom); ... ctx.restore(); while keeping HUD (pass 11) and modal (pass 12) at 1:1 on 960x540 canvas.
3. Viewport Culling Adaptation in src/main.ts using camera.viewWidth and camera.viewHeight.
4. Wave Spawner Adaptation in WaveDirector.ts (viewportWidth = 1200, viewportHeight = 675, spawnRingSurround radius = 800px).
5. Dynamic Radial Lighting Pass in DarkFantasyVFX.ts: expand darkness buffer to 1200x675, vignette gradient to [250, 725]px, player torch to 250px.
6. Toroidal Backdrop Seam Prevention in GothicBackdrop.ts across 1200x675 with clamped Layer 0 sky draw.
7. Verify build (npm run build) and tests (npm test) 100% green. Write unit tests for new camera FOV and transform mechanics.

Write your report to:
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/progress.md
- /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera/handoff.md

When complete, send a message to parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5) summarizing your results and referencing your handoff file.
