# Milestone 2 Empirical Challenge Report: Wave Spawner, Viewport Culling, Backdrop Tiling, and Dynamic Lighting at 1200x675

- **Author Agent**: challenger_m2_fov_2
- **Role**: critic, specialist (teamwork_preview_challenger)
- **Target Recipient**: parent (orchestrator_anim_fov_ui, ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5)
- **Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Gate Verdict**: **APPROVE**

---

## 1. Observation

### Codebase Inspection & Empirical Test Data

1. **Adversarial Test Harness Execution**:
   - Created test harness `tests/unit/ChallengerM2_FOV_SpawningBackdrop.test.ts` containing 14 adversarial stress tests across 4 suites.
   - Command: `npx vitest run tests/unit/ChallengerM2_FOV_SpawningBackdrop.test.ts`
   - Output:
     ```
     Test Files  1 passed (1)
          Tests  14 passed (14)
       Duration  2.04s
     ```

2. **Off-Screen Spawner Invariant (`src/core/systems/WaveDirector.ts:391-407`)**:
   - Radius calculation: `const radius = Math.max(800, Math.hypot(this.viewportWidth / 2, this.viewportHeight / 2) + 110);`
   - At $1200 \times 675$: `halfW = 600`, `halfH = 337.5`, diagonal corner distance is $\sqrt{600^2 + 337.5^2} = 688.408\text{px}$.
   - Stress-tested under 1,000 randomized camera positions spanning `[-10000, 10000] \times [-10000, 10000]` (46,099 enemies spawned):
     - `Min Distance to Center`: $800.000\text{px}$ ($\ge 800.0\text{px}$)
     - `Min Distance to Boundary`: $111.825\text{px}$ ($\ge 111.0\text{px}$)
     - `On-Screen Spawn Count`: $0$ (strictly zero on-screen spawns)
   - Stress-tested under 1,000 randomized camera orientations $\theta \in [0, 2\pi)$ (36,000 enemies spawned):
     - `Min Rotated Boundary Clearance`: $111.592\text{px}$ ($\ge 111.0\text{px}$)
   - Verified that `getPerimeterPoint`, `spawnPincerRush`, `spawnQuadFlank`, and `spawnDeathKnightMiniBoss` across 500 test frames produce 0 spawns within the $1200 \times 675$ viewport.

3. **Backdrop Tiling Seams (`src/render/GothicBackdrop.ts:386-523`)**:
   - Tested toroidal wrapping across arbitrary camera translations $(camX, camY) \in [-100000, 100000]$:
     - **Layer 3 (Flagstone Floor 512x512)**: 100% 2D toroidal coverage across $[-100000, 100000]$ with 0 horizontal gaps and 0 vertical gaps.
     - **Layer 1 (Drifting Clouds 1920x240)**: 100% continuous horizontal wrapping across $[-100000, 100000]$ with 0 gaps.
     - **Layer 2 (Skyline Silhouette 1920x160)**: 100% continuous horizontal wrapping across $[-100000, 100000]$ with 0 gaps.
     - **Layer 6 (Mist Canvas 1024x540)** and **Foreground Mist**: 100% continuous 2D coverage across $[-100000, 100000]$ with 0 gaps.
     - **Layer 0 (Celestial Sky 1024x540)**:
       - 100% continuous horizontal wrapping across $[-100000, 100000]$ with 0 gaps.
       - 100% vertical coverage across all legal arena camera bounds $[-2000, 1325]$ with 0 gaps and zero duplicate moon stacking (`drawH = 755`, `skyY` clamped between $0$ and $-66.5$).
       - Finding: At unconstrained translations $camY > 2000$ (beyond the game arena bounds), `skyY = Math.min(0, -(camY * 0.02) - 40)` is not clamped from below by $vh - drawH$ ($-80\text{px}$), which leaves a bottom gap if camera bounds are disabled. Within active camera bounds ($camY \le 1325$), coverage is 100% complete.

4. **Dynamic Lighting Buffer Integrity (`src/render/vfx/DarkFantasyVFX.ts:1515-1660`)**:
   - Instantiated `DynamicLightingEngine(1200, 675)`:
     - `lighting.width === 1200`, `lighting.height === 675`
     - `lighting.lightCanvas!.width === 1200`, `lighting.lightCanvas!.height === 675`
     - `lighting.vignetteCanvas!.width === 1200`, `lighting.vignetteCanvas!.height === 675`
   - Radial vignette gradient geometry:
     - Center: $(600, 337.5)$
     - Inner radius: `r0 = Math.round(1200 * 0.208) = 250px`
     - Outer radius: `r1 = Math.round(Math.hypot(600, 337.5) * 1.05) = 723px` (strictly within $[250, 725]\text{px}$)
     - Viewport corner distance: $\sqrt{600^2 + 337.5^2} = 688.408\text{px} < 723\text{px}$
     - All 4 corners of the visible screen lie within the outer vignette radius: 100% screen corner coverage.
   - Player torch light: Base radius scales to $250\text{px}$ when `width >= 1200`.
   - Allocation hygiene: Zero dynamic canvas allocations (`dynamicCanvasAllocations === 0`) across 60 active rendering frames.

5. **Viewport Culling & Frustum Math (`src/render/Camera.ts:326-335` & `src/main.ts:557-575`)**:
   - `camera.viewWidth === 1200`, `camera.viewHeight === 675` at `zoom = 0.80` (exact $+56.25\%$ area expansion).
   - `Camera.isVisible(box)` correctly uses $1200 \times 675$ view extents.
   - Horde culling margin in `main.ts` is `[-40, 1240] x [-40, 715]`.
   - Newly spawned enemies at $800\text{px}$ radius on cardinal axes have screen positions $x = 1400$ ($> 1240$), $x = -200$ ($< -40$), $y = 1137.5$ ($> 715$), $y = -462.5$ ($< -40$), confirming they are culled from rendering at spawn and walk smoothly onto the screen without pop-in.

6. **Full Test Suite & Production Build**:
   - `npm test`:
     ```
     Test Files  38 passed (38)
          Tests  559 passed (559)
       Duration  7.09s
     ```
   - `npm run build`:
     ```
     vite v6.4.3 building for production...
     ✓ 34 modules transformed.
     dist/index.html                  1.37 kB │ gzip:  0.61 kB
     dist/assets/index-CBaFEAKF.js  186.66 kB │ gzip: 50.42 kB │ map: 660.55 kB
     ✓ built in 236ms
     ```

---

## 2. Logic Chain

1. **Premise**: In Milestone 2, the game widened its effective camera FOV by $+56.25\%$ ($Z = 0.80$, revealing $1200 \times 675\text{px}$ battlefield view).
2. **Wave Spawner Invariant**:
   - If enemies spawned on-screen or within view margins, players would witness jarring pop-in.
   - Because the viewport extends $600\text{px}$ horizontally and $337.5\text{px}$ vertically from camera center, the maximum distance of any viewport corner is $\sqrt{600^2 + 337.5^2} = 688.41\text{px}$.
   - In `WaveDirector.ts:395`, `radius` is set to $\max(800, 688.41 + 110) = 800\text{px}$.
   - Under 1,000 randomized camera positions and 1,000 orientations, every enemy spawns at exactly $800\text{px}$ from center, maintaining a minimum boundary clearance of $\ge 111.59\text{px}$. Empirical on-screen spawn count is strictly $0 / 46,099$.
3. **Backdrop Tiling Invariant**:
   - The arena flagstone floor tiles with `fSize = 512` using standard modulo wrapping. Under camera translations from $-100,000$ to $+100,000$, intervals $[startX + k \cdot 512, startX + (k+1) \cdot 512]$ cover $[0, 1200] \times [0, 675]$ without empty bands.
   - The sky canvas uses a single celestial band of height $755\text{px}$ (`Math.max(vh, H) + 80`) with `skyY = Math.min(0, -(camY * 0.02) - 40)`. Within the active camera bounds $[-2000, 1325]$, `skyY` is bounded in $[-66.5, 0]$, completely covering $[0, 675]$ vertically without moon repetition.
4. **Dynamic Lighting Buffer Invariant**:
   - At $1200 \times 675$, the darkness canvas and pre-baked vignette are sized to exactly $1200 \times 675$.
   - The pre-baked radial vignette gradient has inner radius $250\text{px}$ and outer radius $723\text{px}$ ($[250, 725]\text{px}$). Because $723 > 688.41\text{px}$, the outer dark rim extends past all 4 screen corners, preventing bright unvignetted corner artifacts.
   - Zero canvas allocations occur during the 60Hz render loop.
5. **Conclusion Support**:
   - All empirical invariants requested in the dispatch are verified with 100% green test passes and clean build compilation.

---

## 3. Caveats

1. **Unconstrained Sky Clamping Edge Case**: In `src/render/GothicBackdrop.ts:394`, `skyY = Math.min(0, -(camY * 0.02) - 40)` is clamped from above at $0$, but has no lower bound clamp `Math.max(vh - drawH, ...)`. In actual gameplay, this is completely benign because `Camera.bounds.maxY = 2000` restricts `camY \le 1325`, keeping `skyY \ge -66.5` and `skyY + drawH \ge 688.5 > 675`. However, for defense-in-depth, if camera bounds are ever expanded beyond $camY > 2000$, adding `Math.max(vh - drawH, ...)` is recommended.
2. **Headless Canvas Context**: Offscreen canvas stencils were tested under headless mock context (`safeCreateOffscreenCanvas`). Visual color blending and raster fidelity will be cross-verified in browser by Milestone 4 Playwright E2E visual proof suites.

---

## 4. Conclusion

Milestone 2 (Widen Camera FOV & Viewport Optimization) is **APPROVED**:
- **Off-Screen Spawner**: 100% invariant verified across 1,000 positions and 1,000 orientations. Min center distance $= 800.0\text{px}$, min boundary clearance $= 111.59\text{px}$, 0 on-screen spawns.
- **Backdrop Tiling**: 100% toroidal wrapping verified across $[-100000, 100000]$ with zero empty horizontal or vertical bands on floor, clouds, skyline, and mist.
- **Dynamic Lighting**: Resolution verified at $1200 \times 675$, vignette gradient $[250, 723]\text{px}$ spans all 4 corners, player torch scales to $250\text{px}$, and zero dynamic heap allocations.
- **Viewport Culling**: Frustum extents and culling margins verified to prevent pop-in.
- **Test Suite**: 38 test files, 559 unit tests passing 100% green. Production build compiles cleanly in 236ms.

Gate Verdict: **APPROVE**.

---

## 5. Verification Method

### Independent Verification Commands

1. **Execute Milestone 2 FOV & Spawner Adversarial Suite**:
   ```bash
   npx vitest run tests/unit/ChallengerM2_FOV_SpawningBackdrop.test.ts
   ```
   *Expected outcome*: 14 passed (14 tests) in ~2.0s with 0 failures.

2. **Execute Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected outcome*: 38 test files passed, 559 unit tests passed (100% green).

3. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Expected outcome*: `tsc -b && vite build` succeeds with 0 errors and 0 warnings.
