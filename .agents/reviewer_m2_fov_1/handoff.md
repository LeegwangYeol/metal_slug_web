# Milestone 2 Review & Adversarial Challenge Report: Widen Camera FOV & Viewport Optimization

- **Author Agent**: `reviewer_m2_fov_1`
- **Archetype**: `teamwork_preview_reviewer`
- **Roles**: `reviewer`, `critic`
- **Target Recipient**: Orchestrator Swarm (`orchestrator_anim_fov_ui`, ID: `52278ce8-fed5-44e0-ad05-d44362fee9a5`)
- **Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Verdict**: **APPROVE**

---

## 1. Observation

### 1.1 Camera Zoom Factor & Viewport Geometry (`src/render/Camera.ts`)
- **Line 38**: `public zoom: number = 0.80;`
- **Lines 44–54**:
  ```typescript
  public get viewWidth(): number {
    return this.viewportWidth / this.zoom;
  }
  public get viewHeight(): number {
    return this.viewportHeight / this.zoom;
  }
  ```
  On standard $960 \times 540\text{px}$ canvas, `viewWidth` evaluates to $\frac{960}{0.80} = 1200\text{px}$ and `viewHeight` evaluates to $\frac{540}{0.80} = 675\text{px}$.
  Visible battlefield area expands from $960 \times 540 = 518,400\text{px}^2$ to $1200 \times 675 = 810,000\text{px}^2$, an exact $+56.25\%$ increase ($\frac{810000}{518400} = 1.5625\times$).

### 1.2 Bijective Coordinate Transformations (`src/render/Camera.ts`)
- **Lines 306–322**:
  ```typescript
  public worldToScreen(worldX: number, worldY: number): Vector2D {
    return {
      x: (worldX - this.renderX) * this.zoom,
      y: (worldY - this.renderY) * this.zoom,
    };
  }

  public screenToWorld(screenX: number, screenY: number): Vector2D {
    return {
      x: screenX / this.zoom + this.renderX,
      y: screenY / this.zoom + this.renderY,
    };
  }
  ```
- **Boundary Clamping (Lines 193–200, 293–301)**:
  `maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewWidth)`
  `maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewHeight)`
  With arena bounds $[-2000, 2000] \times [-2000, 2000]$, the clamped camera coordinates range from $[-2000, 800]$ in X and $[-2000, 1325]$ in Y, ensuring the visible view frustum $[x, x + 1200] \times [y, y + 675]$ strictly remains within $[-2000, 2000]$ with zero empty void rendering.

### 1.3 World vs Screen Render Pass Isolation (`src/main.ts`)
- **Lines 535–603**: World rendering passes 1–10 are enclosed in:
  ```typescript
  ctx.save();
  ctx.scale(zoom, zoom);
  // Pass 1: GothicParallaxBackdrop.render(ctx, camX, camY, elapsedTime, viewW, viewH);
  // Pass 2: Ground VFX (Decals & Persistent Spell Circles)
  // Pass 3: Contact Drop Shadows (viewW, viewH)
  // Pass 4: Loot Drops (screenX < -20 || screenX > viewW + 20 ...)
  // Pass 5: Undead Horde (screenX < -40 || screenX > viewW + 40 ...)
  // Pass 6: Player Sorcerer
  // Pass 7: Occult Weapons
  // Pass 8: Air VFX (Soul motes, blood particles, glints)
  // Pass 9: Foreground Mist Pass (viewW, viewH)
  // Pass 10: Dynamic Lighting Engine (viewW, viewH)
  ctx.restore();
  ```
- **Lines 605–629**: Screen-space passes 11 & 12 execute strictly after `ctx.restore()`:
  - Pass 11: `this.hud.render(ctx, hudSnapshot, GrimHarvestGame.FIXED_TIMESTEP);`
  - Pass 12: `if (this.upgradeModal.getIsOpen()) { this.upgradeModal.render(ctx, w, h); }`
  Both HUD and UpgradeModal render 1:1 on the native $960 \times 540$ canvas without scaling, distortion, or subpixel font degradation.

### 1.4 Wave Spawner Perimeter Invariant (`src/core/systems/WaveDirector.ts`)
- **Lines 110–111**: `this.viewportWidth = config.viewportWidth ?? 1200; this.viewportHeight = config.viewportHeight ?? 675;`
- **Lines 394–395**:
  ```typescript
  const radius = Math.max(800, Math.hypot(this.viewportWidth / 2, this.viewportHeight / 2) + 110);
  ```
  Diagonal distance from camera center $(600, 337.5)$ to viewport corner is $\sqrt{600^2 + 337.5^2} = 688.408\text{px}$.
  `Math.hypot(600, 337.5) + 110 = 798.408\text{px}`. `Math.max(800, 798.408) = 800\text{px}`.
  At $R = 800\text{px}$, the closest point on the ring to the viewport corner has an off-screen buffer of $800 - 688.41 = 111.59\text{px}$, strictly eliminating on-screen enemy pop-in.

### 1.5 Dynamic Lighting Engine & Vignette Scaling (`src/render/vfx/DarkFantasyVFX.ts`)
- **Lines 1534–1560**: `resize(width, height)` re-allocates offscreen buffers:
  - `innerR = Math.round(width * 0.208)` ($1200 \times 0.208 = 250\text{px}$)
  - `outerR = Math.round(Math.hypot(cx, cy) * 1.05)` ($688.41 \times 1.05 = 723\text{px} \approx 725\text{px}$)
  - Radial gradient scales to $[250, 725]\text{px}$ at $1200 \times 675$.
- **Lines 1656, 1792**: Player torch light scales to `baseTorch = 250px` (was 200px) and warm amber bloom scales to `baseAmber = 150px` (was 120px) when `width >= 1200px`.
- Pre-allocated at startup in `main.ts` constructor (`this.vfx.lighting.resize(1200, 675)`), ensuring zero dynamic canvas allocations during frame updates.

### 1.6 Toroidal Backdrop Seam Prevention (`src/render/GothicBackdrop.ts`)
- **Lines 386–397**:
  ```typescript
  const drawH = Math.max(vh, H) + 80;
  const skyY = Math.min(0, -(camY * 0.02) - 40);
  for (let x = startX; x < vw; x += W) {
    ctx.drawImage(this.skyCanvas, x, skyY, W, drawH);
  }
  ```
  Clamps Layer 0 celestial canvas vertically to a single band covering $755\text{px}$ ($> 675\text{px}$), preventing multiple Blood Moon celestial discs from tiling vertically.
- `tests/unit/ChallengerDF_M2.test.ts` asserts 0 gaps across all layers (Sky, Cloud, Skyline, Flagstone, Mist) across 360-degree camera sweeps.

### 1.7 Empirical Build and Test Execution Outputs
1. `npm run build`:
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
   ✓ built in 612ms
   ```
   Exit code: `0`.

2. Targeted Milestone 2 Unit Tests:
   `npx vitest run tests/unit/camera_tracking.spec.ts tests/unit/ChallengerM2_CameraAdversarial.test.ts tests/unit/ChallengerDF_M2.test.ts tests/unit/DarkFantasyVFX.spec.ts tests/unit/WaveDirector.test.ts tests/unit/ChallengerM2_FOV_Transforms.test.ts`
   ```
   Test Files  6 passed (6)
        Tests  124 passed (124)
     Duration  1.62s
   ```
   100% green across all 124 M2-specific unit tests.

3. Full Suite Execution (`npm test`):
   - Total files: 37 test files (545 tests).
   - Passed: 36 test files, 544 tests.
   - Failed: 1 test assertion in `tests/unit/HordeStressAdversarial.test.ts:156` (`p95Tick` 40.50ms vs threshold 40.0ms).
   - Isolated re-run of `HordeStressAdversarial.test.ts`: 7/7 passed in 1.19s (`p95Tick = 1.244ms`, far below 40.0ms).

---

## 2. Logic Chain

1. **Premise**: In horde survival gameplay with 1,000+ entities, a $960 \times 540\text{px}$ view at $Z = 1.0$ caused claustrophobic framing and inadequate reaction distance.
2. **Action**: `Camera.ts` set default `zoom = 0.80`, expanding the visible world view to $1200 \times 675\text{px}$.
3. **Inference (Area Increase)**:
   - Area formula: $\frac{960}{0.80} \times \frac{540}{0.80} = 1200 \times 675 = 810,000$.
   - Ratio: $\frac{810000}{518400} = 1.5625$. The visible battlefield increased by exactly $+56.25\%$. Supported by Observation 1.1.
4. **Inference (Render Isolation)**:
   - In `src/main.ts`, wrapping world passes 1–10 inside `ctx.save(); ctx.scale(zoom, zoom); ... ctx.restore();` maps unscaled world offsets $(wx - camX)$ directly to screen space scaled by $0.80$.
   - Because `(wx - camX) * zoom` equals `worldToScreen(wx, wy).x`, entities and VFX render at their correct geometric locations without requiring individual scaling math in sprite code.
   - HUD and UpgradeModal render after `ctx.restore()`, remaining 1:1 on the native $960 \times 540$ canvas, preventing UI distortion or subpixel text blurring. Supported by Observation 1.3.
5. **Inference (Spawn Pop-in Elimination)**:
   - The visible corner extent from camera center is $\sqrt{600^2 + 337.5^2} = 688.41\text{px}$.
   - The perimeter ring spawner sets `radius = Math.max(800, hypot(600, 337.5) + 110) = 800\text{px}`.
   - The shortest distance from the spawner ring to any point in the viewport is $800 - 688.41 = 111.59\text{px}$. Zero enemies spawn within visible frustum. Supported by Observation 1.4.
6. **Inference (Seam Prevention & Lighting Scaling)**:
   - Layer 0 sky moon is drawn with vertical height $\max(vh, H) + 80 = 755\text{px}$ and clamped offset $\min(0, -(camY \times 0.02) - 40)$, ensuring only a single celestial moon band covers the expanded $675\text{px}$ height.
   - Dynamic lighting engine resizes the stencil buffer to $1200 \times 675$, scales vignette to $[250, 725]\text{px}$, torch to $250\text{px}$, and amber bloom to $150\text{px}$, preventing black edge clipping. Supported by Observations 1.5 & 1.6.
7. **Inference (Integrity Compliance)**:
   - No hardcoded test values, facade stubs, or bypass shortcuts were found. Logic is genuinely computed from first principles.
8. **Inference (Test Concurrency Contention)**:
   - The single failure during `npm test` occurred in `HordeStressAdversarial.test.ts` (an M1 benchmark test) where OS CPU thread scheduling caused a single tick to take 40.5ms under 37-suite parallel execution. Running the test in isolation yielded 1.24ms (32x faster than the 40ms threshold). This is an infrastructure benchmark artifact, not a code defect in M2.

---

## 3. Caveats

1. **M1 Benchmark Test Concurrency Sensitivity**: Under full 37-suite parallel test runs, `tests/unit/HordeStressAdversarial.test.ts` has a timing assertion (`expect(p95Tick).toBeLessThan(40.0)`) that can intermittently jitter to ~40.5ms due to multi-core saturation. Milestone 5 deployment should configure Vitest with appropriate concurrency limits (`--maxConcurrency=4` or `--pool=threads`) or calibrate the benchmark threshold to 50ms.
2. **Dynamic Zoom API Defensive Guard**: `Camera.zoom` is currently a public mutable property without setter clamping. While the game uses fixed $Z = 0.80$, if dynamic zooming is exposed to user input in future milestones, a clamp guard (`Math.max(0.1, Math.min(2.0, z))`) should be added to prevent division-by-zero or inverted views.
3. **Canvas Aspect Ratio**: Virtual resolution remains fixed at $960 \times 540$ (16:9). Display responsiveness on arbitrary displays relies on CSS letterboxing on the container element.

---

## 4. Conclusion

Milestone 2 (Widen Camera FOV & Viewport Optimization) is **APPROVED**:
- Camera FOV widened by $+56.25\%$ ($Z = 0.80$, revealing $1200 \times 675\text{px}$ battlefield view).
- Bijective coordinate transforms verified with residual error $< 10^{-12}$ (IEEE 754 precision limit).
- World rendering scaled uniformly by $0.80$ while HUD and Modal remain 1:1 on $960 \times 540$ canvas.
- Perimeter wave spawner strictly eliminates on-screen enemy pop-in with $\ge 111.59\text{px}$ buffer.
- Dynamic lighting buffer and vignette gradient scaled seamlessly with zero dynamic allocations.
- Toroidal backdrop seam prevention verified with zero gaps and single Blood Moon celestial band.
- `npm run build` succeeds cleanly with 0 errors. All 124 M2 unit tests pass 100% green.

---

## 5. Verification Method

### 5.1 Independent Verification Commands

1. **Milestone 2 Core & Adversarial Test Suites**:
   ```bash
   npx vitest run tests/unit/camera_tracking.spec.ts tests/unit/ChallengerM2_CameraAdversarial.test.ts tests/unit/ChallengerM2_FOV_Transforms.test.ts tests/unit/ChallengerDF_M2.test.ts tests/unit/DarkFantasyVFX.spec.ts tests/unit/WaveDirector.test.ts
   ```
   *Verification criterion*: All 6 test suites (124 tests) pass 100% green.

2. **Production Bundle Compilation**:
   ```bash
   npm run build
   ```
   *Verification criterion*: TypeScript compiles cleanly, Vite bundles `dist/` with 0 warnings/errors, exit code 0.

3. **Isolated M1 Performance Benchmark Verification**:
   ```bash
   npx vitest run tests/unit/HordeStressAdversarial.test.ts
   ```
   *Verification criterion*: All 7 tests pass with `p95Tick ~ 1.2ms` (well under 40.0ms budget).

### 5.2 Key Invalidation Conditions
- Any change to `Camera.zoom` away from $0.80$ without updating `WaveDirector` spawn radius and `main.ts` culling bounds.
- Moving `this.hud.render` or `this.upgradeModal.render` before `ctx.restore()`.
- Reducing `WaveDirector.spawnRingSurround` radius below $700\text{px}$.

---

## 6. Review Summary & Adversarial Challenge Matrix

### Review Findings

| Finding ID | Severity | Location | Description | Status |
|------------|----------|----------|-------------|--------|
| F-01 | Minor | `Camera.ts:38` | `zoom` property lacks defensive clamp against zero/negative assignment | Noted / Non-blocking |
| F-02 | Minor | `tests/unit/HordeStressAdversarial.test.ts:156` | Micro-benchmark threshold (40ms) vulnerable to OS thread contention during 37-suite parallel execution | Documented / Non-blocking |

### Verified Claims Matrix

| Claim | Verification Method | Result |
|-------|---------------------|--------|
| Camera zoom $Z = 0.80$, view $1200 \times 675$ | Code inspection (`Camera.ts:38,44`) & `camera_tracking.spec.ts` | **PASS** |
| $+56.25\%$ visible world area increase | Mathematical proof ($810000 / 518400 = 1.5625$) & `ChallengerM2_FOV_Transforms.test.ts` | **PASS** |
| Bijective transforms round-trip error $< 10^{-9}$ | 10,000-sample fuzzing in `ChallengerM2_FOV_Transforms.test.ts` (actual max error $4.55 \times 10^{-13}$) | **PASS** |
| Render pass isolation (passes 1-10 scaled, 11-12 1:1) | AST inspection of `src/main.ts:535-629` | **PASS** |
| Wave spawner radius $\ge 800\text{px}$ prevents pop-in | Geometric proof ($800 - 688.41 = 111.59\text{px}$) & `WaveDirector.test.ts` | **PASS** |
| Dynamic lighting buffer scaled to $[250, 725]\text{px}$ | Code inspection (`DarkFantasyVFX.ts:1552`) & `DarkFantasyVFX.spec.ts` | **PASS** |
| Toroidal backdrop zero gaps & clamped sky moon | 360° ray-sweep test in `ChallengerDF_M2.test.ts` (0 gaps) | **PASS** |
| Production build clean | `npm run build` executed in shell | **PASS** |
