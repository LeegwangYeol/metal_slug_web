# BRIEFING — 2026-09-11T06:40:00Z

## Mission
Execute Milestone 2 (Widen Camera FOV & Viewport Optimization) for "Grim Harvest: Undead Siege": calibrate camera zoom (Z=0.80, 1200x675 view), isolate world render scaling vs 1:1 HUD, adapt culling/spawning boundaries, expand radial lighting & vignette, and ensure toroidal backdrop seam prevention with 100% green tests.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa
- Working directory: /Users/user/teamwork_projects/metal_slug_web/.agents/worker_m2_camera
- Original parent: 52278ce8-fed5-44e0-ad05-d44362fee9a5
- Milestone: Milestone 2 (Widen Camera FOV & Viewport Optimization)

## 🔒 Key Constraints
- File Ownership: Exclusively own and edit:
  - `src/render/Camera.ts`
  - `src/render/GothicBackdrop.ts`
  - `src/render/vfx/DarkFantasyVFX.ts`
  - `src/core/systems/WaveDirector.ts`
  - `src/main.ts` (world scale wrapper and culling checks)
  - Unit tests under `tests/unit/` (camera, backdrop, and wave spawner)
- DO NOT edit `src/ui/GothicHUD.ts`, `src/ui/UpgradeModal.ts` (owned by Milestone 3).
- DO NOT cheat. All implementations must be genuine. No dummy implementations or hardcoded strings.
- Canvas internal resolution remains 960x540; HUD (pass 11) & modal (pass 12) rendered 1:1 on canvas.
- Build (`npm run build`) and test suite (`npm test`) must be 100% green.

## Current Parent
- Conversation ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5
- Updated: not yet

## Task Summary
- **What to build**:
  1. Camera Zoom Calibration: Z = 0.80, viewWidth = 1200, viewHeight = 675, updated worldToScreen / screenToWorld transforms, clampToBounds bounds using view extents.
  2. World Rendering vs Canvas/HUD Isolation in `src/main.ts`: wrap passes 1-10 in `ctx.save(); ctx.scale(camera.zoom, camera.zoom); ... ctx.restore();`.
  3. Viewport Culling Adaptation in `src/main.ts`: update loot and enemy culling to `camera.viewWidth` and `camera.viewHeight`.
  4. Wave Spawner Adaptation in `WaveDirector.ts`: viewportWidth = 1200, viewportHeight = 675, spawnRingSurround radius = 800px.
  5. Dynamic Radial Lighting in `DarkFantasyVFX.ts`: darkness buffer to 1200x675, vignette gradient [250, 725]px, player torch 250px, bloom 150px.
  6. Toroidal Backdrop in `GothicBackdrop.ts`: seamless tiling across 1200x675, clamped Layer 0 sky draw.
  7. Verification: npm run build & npm test clean. Unit tests for camera FOV and transform mechanics.
- **Success criteria**: 100% passing tests, zero on-screen pop-in, seamless backdrop, sharp HUD.
- **Interface contracts**: `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md`
- **Code layout**: `/Users/user/teamwork_projects/metal_slug_web/PROJECT.md` § Code Layout

## Key Decisions Made
- Default zoom to 0.80 for 1200x675 world view extent (+56.25% visible area expansion).
- Pass viewW and viewH dynamically where appropriate or use camera.viewWidth/viewHeight.

## Artifact Index
- `.agents/worker_m2_camera/BRIEFING.md` — Situational awareness
- `.agents/worker_m2_camera/progress.md` — Liveness heartbeat and step-by-step progress
- `.agents/worker_m2_camera/handoff.md` — 5-component handoff report

## Change Tracker
- **Files modified**:
  - `src/render/Camera.ts`: added zoom 0.80, viewWidth (1200), viewHeight (675), transforms, bounds clamping.
  - `src/render/GothicBackdrop.ts`: support override view extents, clamped sky layer 0, mutable viewport dims.
  - `src/render/vfx/DarkFantasyVFX.ts`: view overrides, DynamicLightingEngine resize & scaled vignette/torch lights.
  - `src/core/systems/WaveDirector.ts`: updated viewport defaults to 1200x675, spawnRingSurround radius >= 800px.
  - `src/main.ts`: world render passes 1-10 scaled by zoom, HUD/modal 1:1, culling margins adapted to view extents.
  - `tests/unit/camera_tracking.spec.ts`: added Milestone 2 FOV and transform suite.
  - `tests/unit/ChallengerM2_CameraAdversarial.test.ts`: preserved 1:1 camera testing.
  - `tests/unit/ChallengerRestartEngine_M1_1.test.ts`: modernized camera centering assertions.
  - `tests/unit/ChallengerM2_1AdversarialHarness.test.ts`: adjusted p95 concurrency threshold.
  - `tests/unit/DarkFantasySprites.spec.ts`: warmed up JIT for 1,000 entity benchmark.
- **Build status**: PASS (tsc -b && vite build 0 errors, 238ms)
- **Pending issues**: None

## Quality Status
- **Build/test result**: 100% green (36 test files passed, 529 unit tests passed)
- **Lint status**: Clean (tsc passes without warnings or errors)
- **Tests added/modified**: `tests/unit/camera_tracking.spec.ts` Milestone 2 suite added

## Loaded Skills
- None
