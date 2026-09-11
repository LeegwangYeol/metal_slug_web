# Milestone 2 Handoff Report: Widen Camera FOV & Viewport Optimization

- **Author Agent**: worker_m2_camera
- **Role**: teamwork_preview_worker
- **Target Recipient**: orchestrator_anim_fov_ui (parent: 52278ce8-fed5-44e0-ad05-d44362fee9a5)
- **Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Status**: Completed (100% Green Build & Tests)

---

## 1. Observation

### Codebase Inspection & Empirical Data
1. **Camera Zoom & Viewport Extents (`src/render/Camera.ts`)**:
   - Initial state: Camera viewport was locked at $960 \times 540\text{px}$ with no zoom factor ($Z = 1.0$).
   - Current implementation: Added `public zoom: number = 0.80;`, `public get viewWidth(): number { return this.viewportWidth / this.zoom; }` ($1200\text{px}$), and `public get viewHeight(): number { return this.viewportHeight / this.zoom; }` ($675\text{px}$).
   - Visible battlefield area expanded from $960 \times 540 = 518,400\text{px}^2$ to $1200 \times 675 = 810,000\text{px}^2$, an exact $+56.25\%$ increase ($1.5625\times$).
   - Bijective coordinate transforms:
     - `worldToScreen(wx, wy)`: `x = (wx - renderX) * zoom`, `y = (wy - renderY) * zoom`.
     - `screenToWorld(sx, sy)`: `x = screenX / zoom + renderX`, `y = screenY / zoom + renderY`.
   - Bounds clamping: Clamped to `[bounds.minX, bounds.maxX - this.viewWidth]` and `[bounds.minY, bounds.maxY - this.viewHeight]`, preventing empty void exposure at boundaries ($[-2000, 800] \times [-2000, 1325]$).

2. **World Rendering vs Screen HUD Isolation (`src/main.ts`)**:
   - Render passes 1–10 (Backdrop, Decals, Ground VFX, Drop Shadows, Loot, Horde, Player, Weapons, Air VFX, Mist, Lighting) are wrapped inside `ctx.save(); ctx.scale(zoom, zoom); ... ctx.restore();`.
   - Render passes 11 (GothicHUD) and 12 (UpgradeModal) execute after `ctx.restore()`, rendering 1:1 on the native $960 \times 540$ canvas without scaling or subpixel font blurriness.
   - Entity and loot culling margins updated from $w, h$ ($960, 540$) to $viewW, viewH$ ($1200, 675$):
     - Loot culling: `screenX < -20 || screenX > viewW + 20 || screenY < -20 || screenY > viewH + 20`.
     - Horde culling: `screenX < -40 || screenX > viewW + 40 || screenY < -40 || screenY > viewH + 40`.

3. **Wave Spawning & Off-Screen Invariants (`src/core/systems/WaveDirector.ts`)**:
   - Config and constructor default viewport extents updated to `viewportWidth = 1200`, `viewportHeight = 675`.
   - `spawnRingSurround` radius dynamically calculated:
     `const radius = Math.max(800, Math.hypot(this.viewportWidth / 2, this.viewportHeight / 2) + 110);`
   - Diagonal distance from camera center to viewport corner is $\sqrt{600^2 + 337.5^2} = 688.41\text{px}$. Spawning at $\ge 800\text{px}$ guarantees a minimum off-screen buffer of $111.59\text{px}$, strictly eliminating on-screen enemy pop-in.

4. **Dynamic Radial Lighting & Vignette Expansion (`src/render/vfx/DarkFantasyVFX.ts`)**:
   - `DynamicLightingEngine` made mutable with `resize(width, height)` method.
   - Pre-baked vignette radial gradient scales to $[250, 725]\text{px}$ (`innerR = Math.round(width * 0.208)`, `outerR = Math.round(Math.hypot(cx, cy) * 1.05)`).
   - Player torch light radius scales to `baseTorch = 250px` when width $\ge 1200\text{px}$.
   - Additive amber torch bloom scales to `baseAmber = 150px` when width $\ge 1200\text{px}$.
   - Offscreen lighting buffer is pre-allocated at game startup in `main.ts` via `this.vfx.lighting.resize(this.camera.viewWidth, this.camera.viewHeight)`, guaranteeing zero dynamic canvas allocations (`dynamicCanvasAllocations === 0`) during active gameplay.

5. **Toroidal Backdrop Seam Prevention (`src/render/GothicBackdrop.ts`)**:
   - Clamped Layer 0 (Sky Canvas) vertical draw: `const drawH = Math.max(vh, H) + 80; const skyY = Math.min(0, -(camY * 0.02) - 40); ctx.drawImage(this.skyCanvas, x, skyY, W, drawH);`
   - Eliminates vertical tile repetition of the blood moon across the expanded $675\text{px}$ vertical viewport while maintaining continuous 360-degree horizontal wrapping.
   - Sub-layer A mist canvas height scaled to `Math.max(vh, H)`.
   - Empirical test suite `tests/unit/ChallengerDF_M2.test.ts` reports 0 gaps across all layers (Sky, Cloud, Skyline, Flagstone, Mist).

6. **Build & Test Outputs**:
   - `npm run build`:
     ```
     > fullmetalslug@1.0.0 build
     > tsc -b && vite build
     vite v6.4.3 building for production...
     transforming...
     ✓ 34 modules transformed.
     rendering chunks...
     computing gzip size...
     dist/index.html                  1.37 kB │ gzip:  0.61 kB
     dist/assets/index-CBaFEAKF.js  186.66 kB │ gzip: 50.42 kB │ map: 660.55 kB
     ✓ built in 238ms
     ```
   - `npm test`:
     ```
     Test Files  36 passed (36)
          Tests  529 passed (529)
       Duration  4.63s
     ```

---

## 2. Logic Chain

1. **Premise**: In "Grim Harvest: Undead Siege", the default $960 \times 540$ camera view was too narrow for situational awareness when fighting 1,000+ enemy hordes.
2. **Action**: Rather than changing the HTML5 canvas resolution (which would impact UI layout and performance), camera zoom was calibrated to $Z = 0.80$. At $Z = 0.80$, the visible world rectangle becomes $\frac{960}{0.80} \times \frac{540}{0.80} = 1200 \times 675\text{px}$, expanding the visible world area by exactly $+56.25\%$.
3. **Inference & Consequence**:
   - When world entities render with screen coordinates $(wx - camX) \times 0.80$, the coordinate system must be transformed bijectively: `worldToScreen` scales by $0.80$, and `screenToWorld` divides by $0.80$.
   - In `main.ts`, wrapping world render passes 1–10 in `ctx.save(); ctx.scale(zoom, zoom); ... ctx.restore();` allows all entity sprite rendering code (`DarkFantasySprites.drawPlayer`, `drawEnemy`, `drawLoot`, weapons, and VFX) to continue using unscaled world offsets $(wx - camX)$ natively while automatically scaling to fit the $960 \times 540$ canvas.
   - Screen-space UI (HUD in pass 11 and UpgradeModal in pass 12) renders after `ctx.restore()`, remaining perfectly 1:1 on the native $960 \times 540$ canvas without blurriness, distortion, or layout breakage.
   - Because the visible world extent grew to $1200 \times 675$, entity culling margins, wave spawner ring radius, dynamic lighting stencil buffer, and backdrop tiling had to be updated to match $1200 \times 675$; otherwise, enemies would visibly pop into existence on-screen, lighting would have black corner artifacts, and entities would pop out at screen borders.
   - `spawnRingSurround` radius was increased from $670\text{px} \to 800\text{px}$, ensuring spawns are $\ge 111.59\text{px}$ outside the $688.41\text{px}$ screen corner.
   - `DynamicLightingEngine` buffer was pre-allocated to $1200 \times 675$, vignette scaled to $[250, 725]\text{px}$, and player torch light increased to $250\text{px}$, preserving the gothic atmosphere.
   - All legacy test suites were safeguarded, and 6 new unit tests were added to `tests/unit/camera_tracking.spec.ts` verifying zoom defaults, area expansion, bijective round-trips, boundary clamping, and off-screen spawn invariants.

---

## 3. Caveats

1. **UI Layer Ownership**: `src/ui/GothicHUD.ts` and `src/ui/UpgradeModal.ts` were strictly NOT modified, honoring ownership boundaries for Milestone 3. The 1:1 rendering pass isolation guarantees that Milestone 3 workers can overhaul the UI without camera zoom side effects.
2. **Fixed Canvas Resolution**: Canvas resolution remains locked at $960 \times 540\text{px}$. Higher DPI / fullscreen scaling continues to be handled by CSS letterboxing on the container element.
3. **Test Concurrency Timing**: Under extreme test concurrency (36 Vitest test suites executing simultaneously across all available CPU cores), micro-benchmark assertions for sub-millisecond sprite blits can occasionally face OS thread scheduling contention. Adequate thresholds were preserved without compromising invariant guarantees.

---

## 4. Conclusion

Milestone 2 (Widen Camera FOV & Viewport Optimization) is complete, robust, and verified:
- Camera FOV widened by $+56.25\%$ ($Z = 0.80$, revealing $1200 \times 675\text{px}$ battlefield view).
- Complete isolation between world rendering (scaled by $0.80$) and screen-space HUD/Modal (1:1 at $960 \times 540$).
- Viewport culling adapted to $1200 \times 675$.
- Wave spawner adapted to $800\text{px}$ radius with zero on-screen enemy pop-in.
- Dynamic radial lighting and vignette seamlessly scaled to $1200 \times 675$ with zero runtime memory allocations.
- Toroidal backdrop seam prevention verified with zero gaps and clamped sky moon stacking.
- Build compiles cleanly (`npm run build` exits with 0 errors).
- All 36 test files (529 unit tests) pass 100% green without regressions.

---

## 5. Verification Method

### Independent Verification Commands
1. **Full Test Suite Execution**:
   ```bash
   npm test
   ```
   *Expected outcome*: 36 test files pass, 529 unit tests pass with zero failures.

2. **Camera FOV & Transform Unit Tests**:
   ```bash
   npx vitest run tests/unit/camera_tracking.spec.ts
   ```
   *Expected outcome*: 29/29 tests pass, verifying $Z = 0.80$, $1200 \times 675$ view extents, $+56.25\%$ area ratio, bijective coordinate transforms, and $800\text{px}$ spawn ring safety.

3. **Camera Adversarial Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM2_CameraAdversarial.test.ts
   ```
   *Expected outcome*: 21/21 tests pass, verifying 180° reversals, lookahead bounds, delta time invariance, and screen shake decoupling.

4. **Backdrop Seam & Lighting Tests**:
   ```bash
   npx vitest run tests/unit/ChallengerDF_M2.test.ts tests/unit/DarkFantasyVFX.spec.ts
   ```
   *Expected outcome*: All tests pass with zero backdrop gaps and verified dynamic lighting buffer.

5. **Production Build Compilation**:
   ```bash
   npm run build
   ```
   *Expected outcome*: TypeScript and Vite bundle successfully into `dist/` with 0 warnings or errors.
