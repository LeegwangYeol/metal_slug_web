# Milestone 2 Adversarial Challenge Report: Widened Camera FOV & Coordinate Systems

- **Author Agent**: challenger_m2_fov_1
- **Role**: critic, specialist (teamwork_preview_challenger)
- **Target Recipient**: parent (ID: 52278ce8-fed5-44e0-ad05-d44362fee9a5)
- **Milestone**: Milestone 2 (Widen Camera FOV & Viewport Optimization)
- **Gate Verdict**: **APPROVE**

---

## 1. Observation

### Codebase Inspection & Empirical Test Data
1. **Camera FOV & Viewport Extents (`src/render/Camera.ts:38-54`)**:
   - `zoom`: Default value `0.80`.
   - `viewWidth`: Returns `this.viewportWidth / this.zoom` ($960 / 0.80 = 1200\text{px}$).
   - `viewHeight`: Returns `this.viewportHeight / this.zoom` ($540 / 0.80 = 675\text{px}$).
   - Visible battlefield area: $1200 \times 675 = 810,000\text{px}^2$, representing exactly $+56.25\%$ area expansion ($1.5625\times$) over legacy $960 \times 540 = 518,400\text{px}^2$.

2. **Coordinate Transform Implementation (`src/render/Camera.ts:306-321`)**:
   - `worldToScreen(worldX, worldY)`:
     ```ts
     return {
       x: (worldX - this.renderX) * this.zoom,
       y: (worldY - this.renderY) * this.zoom,
     };
     ```
   - `screenToWorld(screenX, screenY)`:
     ```ts
     return {
       x: screenX / this.zoom + this.renderX,
       y: screenY / this.zoom + this.renderY,
     };
     ```

3. **Empirical Precision Stress Across 10,000 Floating-Point Points (`tests/unit/ChallengerM2_FOV_Transforms.test.ts:40-77`)**:
   - Tested $N = 10,000$ randomized high-precision coordinates spanning $[-3000.0, 3000.0]$:
     - `Max Residual Error`: $4.5475 \times 10^{-13}\text{px}$ (requirement was $< 1.0 \times 10^{-9}\text{px}$; actual error is more than 3 orders of magnitude smaller).
     - `Average Residual Error`: $7.1017 \times 10^{-14}\text{px}$.
   - Tested extreme coordinates $[-10^6, 10^6]$, fractional micro-coordinates ($1/3, \pi \times 10^3, e \times 10^3$): all residual errors $< 1.0 \times 10^{-9}\text{px}$.
   - Tested inverse bijective round-trip `worldToScreen(screenToWorld(sx, sy))` across 10,000 screen positions: max error $< 1.0 \times 10^{-9}\text{px}$.

4. **Map Extent Boundary Clamping (`src/render/Camera.ts:194-201, 293-301`)**:
   - Clamping logic:
     ```ts
     const minClampX = this.bounds.minX;
     const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewWidth);
     const minClampY = this.bounds.minY;
     const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewHeight);
     ```
   - In `tests/unit/ChallengerM2_FOV_Transforms.test.ts:133-176`, tested 1,000 randomized targets spanning $[-10000, 10000]$ and 8-way directional velocities at $100,000\text{px/s}$:
     - `camera.x >= bounds.minX` ($-2000$) satisfied 100%.
     - `camera.x + viewWidth <= bounds.maxX` ($+2000 \implies camera.x \le 800$) satisfied 100%.
     - `camera.y >= bounds.minY` ($-2000$) satisfied 100%.
     - `camera.y + viewHeight <= bounds.maxY` ($+2000 \implies camera.y \le 1325$) satisfied 100%.
     - Total boundary crossing violations: 0.

5. **Screen Shake Trauma & Coordinate Bijective Inversion (`tests/unit/ChallengerM2_FOV_Transforms.test.ts:360-405`)**:
   - Under active trauma (`shake(100, 2.0)` with active non-zero displacement offsets $\Delta x = -84.25, \Delta y = +23.43$):
     - 10,000 floating-point round-trips executed:
       - `Max Residual Error`: $4.5475 \times 10^{-13}\text{px} < 1.0 \times 10^{-9}\text{px}$.
     - 120 consecutive frames of simultaneous movement and active shake: 0 round-trip errors $> 1.0 \times 10^{-9}\text{px}$.
     - Base tracking position `(camera.x, camera.y)` experienced zero drift after shake expiry.

6. **Dynamic Zoom Transitions & Pathological Cases (`tests/unit/ChallengerM2_FOV_Transforms.test.ts:258-350`)**:
   - Zoom scaling across valid range $[0.25, 4.00]$: exact bijective fidelity maintained.
   - Continuous sine wave zoom interpolation between $0.50$ and $1.50$: zero discontinuity.
   - Pathological zoom factors:
     - `zoom = 0`: produces `viewWidth = Infinity`, `worldToScreen = 0`, `screenToWorld = Infinity`.
     - `zoom < 0`: inverts viewport coordinates.
     - `zoom = NaN`: produces `NaN`.

7. **Wave Spawn Ring & Culling Invariants (`tests/unit/ChallengerM2_FOV_Transforms.test.ts:460-500`)**:
   - Viewport half-extents: $\frac{1200}{2} = 600\text{px}$, $\frac{675}{2} = 337.5\text{px}$.
   - Diagonal corner distance from camera center: $\sqrt{600^2 + 337.5^2} = 688.408\text{px}$.
   - `spawnRingRadius = 800px`: provides safety buffer of $800 - 688.408 = 111.592\text{px}$.
   - Empirical sweep across 360 degrees: 100% of spawns land outside the camera view frustum (`camera.isVisible(spawnBox) === false`).

8. **Test Suite & Build Results**:
   - `npx vitest run tests/unit/ChallengerM2_FOV_Transforms.test.ts`:
     ```
     ✓ tests/unit/ChallengerM2_FOV_Transforms.test.ts (16 tests) 363ms
     Test Files  1 passed (1)
          Tests  16 passed (16)
     ```
   - `npm test`:
     ```
     Test Files  37 passed (37)
          Tests  545 passed (545)
       Duration  6.85s
     ```
   - `npm run build`:
     ```
     ✓ 34 modules transformed.
     dist/index.html                  1.37 kB │ gzip:  0.61 kB
     dist/assets/index-CBaFEAKF.js  186.66 kB │ gzip: 50.42 kB │ map: 660.55 kB
     ✓ built in 223ms
     ```

---

## 2. Logic Chain

1. **Premise 1 (Coordinate Invertibility)**:
   The forward mapping is defined as:
   $$x_s = (x_w - x_{\text{render}}) \cdot Z, \quad y_s = (y_w - y_{\text{render}}) \cdot Z$$
   The inverse mapping is defined as:
   $$x_w' = \frac{x_s}{Z} + x_{\text{render}}, \quad y_w' = \frac{y_s}{Z} + y_{\text{render}}$$
   Substituting $x_s$:
   $$x_w' = \frac{(x_w - x_{\text{render}}) \cdot Z}{Z} + x_{\text{render}} = x_w - x_{\text{render}} + x_{\text{render}} = x_w$$
   This identity holds for all $Z \neq 0$ and is completely independent of $x_{\text{render}}$, meaning screen shake trauma offsets ($\Delta x, \Delta y$) cancel out identically in the forward-inverse composition.

2. **Empirical Verification of Precision**:
   In double-precision IEEE-754 floating point arithmetic, machine epsilon is $\epsilon \approx 2.22 \times 10^{-16}$. In our 10,000-point empirical test harness (`tests/unit/ChallengerM2_FOV_Transforms.test.ts`), the observed maximum residual error was $4.5475 \times 10^{-13}\text{px}$, well below the required threshold of $1.0 \times 10^{-9}\text{px}$.

3. **Boundary Clamping Invariant**:
   For the visible world rectangle $[x_{\text{cam}}, x_{\text{cam}} + W_v] \times [y_{\text{cam}}, y_{\text{cam}} + H_v]$ to never expose void outside the arena $[\text{minX}, \text{maxX}] \times [\text{minY}, \text{maxY}]$, the camera position must satisfy:
   $$x_{\text{cam}} \ge \text{minX} \quad \text{and} \quad x_{\text{cam}} + W_v \le \text{maxX} \iff x_{\text{cam}} \le \text{maxX} - W_v$$
   In `Camera.ts`, `clampToBounds()` clamps $x$ between `minClampX = bounds.minX` and `maxClampX = Math.max(bounds.minX, bounds.maxX - viewWidth)`. For arena $[-2000, 2000]$ and $W_v = 1200$, $x_{\text{cam}} \in [-2000, 800]$, ensuring the right edge $x_{\text{cam}} + 1200 \le 2000$. Our stress test confirmed zero boundary crossings across 1,000 extreme targets and outward velocities up to $100,000\text{px/s}$.

4. **Off-Screen Spawning Invariant**:
   The distance from the center of the widened viewport $(0, 0)$ to the farthest visible corner is:
   $$D_{\text{corner}} = \sqrt{(W_v / 2)^2 + (H_v / 2)^2} = \sqrt{600^2 + 337.5^2} \approx 688.408\text{px}$$
   `WaveDirector.ts` sets `spawnRingSurround` to $\max(800, D_{\text{corner}} + 110) = 800\text{px}$. The minimum clearance buffer between the spawning perimeter and any visible pixel is $800 - 688.408 = 111.592\text{px} > 111\text{px}$. Empirical frustum tests across 360 degrees confirmed 0% visible spawns.

5. **Test Suite Invariant**:
   All 37 test files (545 unit tests) pass 100% green without regressions, and `npm run build` succeeds cleanly.

---

## 3. Caveats

1. **Dynamic Zoom Protection**:
   `Camera.zoom` is currently a public mutable numeric property without a setter guard. Setting `camera.zoom = 0` or negative values will result in infinite or negative viewports per IEEE-754 semantics. In the current architecture, `zoom` is fixed at `0.80` during gameplay, so this is not a runtime vulnerability. However, if dynamic zoom features (e.g. sniper zoom, boss cutscenes) are exposed in future milestones, a property setter enforcing `Math.max(0.1, Math.min(3.0, value))` is recommended.
2. **Extreme Concurrency Micro-benchmarks**:
   When all 37 Vitest suites run in parallel across CPU cores, CPU thread contention can occasionally add sub-millisecond scheduling latency to tight timer assertions (e.g. $< 5.0\text{ms}$ thresholds for 1,500 entity simulation). When executed under normal system loads or isolated suites, execution averages $< 0.5\text{ms}$, well within the 60Hz 16.6ms budget.

---

## 4. Conclusion

**Gate Verdict: APPROVE**

The widened Camera FOV ($Z = 0.80$, $1200 \times 675\text{px}$) and coordinate transform systems have been adversarially stress-tested and proven robust:
- **Round-Trip Precision**: Residual error across 10,000 floating-point world positions is $4.5475 \times 10^{-13}\text{px}$ (exceeding $< 10^{-9}$ requirement).
- **Bounds Clamping**: 0 boundary violations across 1,000 randomized out-of-bounds targets and extreme outward velocities ($100,000\text{px/s}$).
- **Screen Shake Invariance**: Decoupled additive shake offsets preserve exact bijective coordinate inverses ($4.5475 \times 10^{-13}$ error) with zero base coordinate drift.
- **Wave Spawn Safety**: $800\text{px}$ spawn ring guarantees $> 111.5\text{px}$ off-screen margin beyond the $688.41\text{px}$ diagonal viewport corner.
- **Test Suite Status**: 37 test files, 545 tests passing 100% green; build succeeds with 0 errors.

---

## 5. Verification Method

To independently verify this evaluation, execute the following commands in the project directory:

1. **Run Challenger M2 FOV Adversarial Harness**:
   ```bash
   npx vitest run tests/unit/ChallengerM2_FOV_Transforms.test.ts
   ```
   *Expected Outcome*: 16/16 tests pass, reporting $< 10^{-12}$ round-trip residual error and 0 boundary violations.

2. **Run Full Test Suite**:
   ```bash
   npm test
   ```
   *Expected Outcome*: 37 test files pass, 545 tests pass with 0 failures.

3. **Verify Production Build**:
   ```bash
   npm run build
   ```
   *Expected Outcome*: TypeScript and Vite bundle successfully with 0 warnings or errors.

4. **Inspect Files**:
   - `tests/unit/ChallengerM2_FOV_Transforms.test.ts`
   - `src/render/Camera.ts`
   - `.agents/challenger_m2_fov_1/handoff.md`
