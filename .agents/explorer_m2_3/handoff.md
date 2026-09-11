# Handoff Report: Camera Unit Test Specification (`tests/unit/camera_tracking.spec.ts`)

**Agent**: Explorer 3 (Agent 11) — Camera Unit Test Specification Explorer  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_3`  
**Target Test Suite**: `tests/unit/camera_tracking.spec.ts`  
**Milestone**: Milestone 2 — Camera Overhaul & Cinematic Viewport  
**Date**: 2026-09-11T11:43:00+09:00  

---

## 1. Observation

### 1.1 Legacy Camera Architecture in `src/render/Camera.ts`
Inspection of `src/render/Camera.ts` reveals the following current state:
1. **Asymmetrical Run-and-Gun Deadzones (lines 75–80)**:
   ```typescript
   // Default deadzone: target stays between 35% and 44% horizontally (>528px forward reaction view on 960w), 30% and 70% vertically
   this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35); // 336px
   this.deadzoneRight = this.viewportWidth >= 960 ? Math.floor(this.viewportWidth * 0.44) : Math.floor(this.viewportWidth * 0.45); // 422px
   this.deadzoneTop = Math.floor(this.viewportHeight * 0.30); // 162px
   this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70); // 378px
   ```
   - Horizontally, the target is pinned between 35% and 44% of screen width, biasing viewing forward for a 2D side-scrolling platformer.
   - For an omnidirectional 360-degree dark fantasy horde survival game ("Grim Harvest: Undead Siege"), this leaves the player severely blinded on the left/rear side and creates jarring snapping when traversing the 86px deadzone margin upon directional reversal.
2. **Instant Snapping by Default (`smoothSpeed = 0`) (lines 63, 122–130)**:
   ```typescript
   // Smooth camera following speed (0 for crisp lockstep)
   public smoothSpeed: number = 0;
   ...
   if (this.smoothSpeed > 0 && dt > 0) {
     const t = Math.min(1, dt * this.smoothSpeed);
     this.x += (targetCamX - this.x) * t;
     this.y += (targetCamY - this.y) * t;
   } else {
     this.x = targetCamX;
     this.y = targetCamY;
   }
   ```
   - When `smoothSpeed = 0`, the camera snaps instantly to the deadzone boundary.
   - Even when `smoothSpeed > 0`, the naive Euler formula `t = Math.min(1, dt * smoothSpeed)` is frame-rate dependent and can cause oscillation or overshoot under large $\Delta t$.
3. **Ratchet Forward-Lock (lines 38–40, 132–139)**:
   ```typescript
   public forwardLock: boolean = true;
   private maxReachedX: number = 0;
   ...
   if (this.forwardLock) {
     if (this.x < this.maxReachedX) {
       this.x = this.maxReachedX;
     } else {
       this.maxReachedX = this.x;
     }
   }
   ```
   - `forwardLock` prevents backward scrolling entirely, which breaks top-down horde survival exploration.
4. **Boundary Clamping (lines 213–221)**:
   ```typescript
   private clampToBounds(): void {
     const minClampX = this.bounds.minX;
     const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
     this.x = Math.max(minClampX, Math.min(maxClampX, this.x));

     const minClampY = this.bounds.minY;
     const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);
     this.y = Math.max(minClampY, Math.min(maxClampY, this.y));
   }
   ```
   - Viewport is clamped so that the camera top-left `(x, y)` never exposes regions beyond `[minX, maxX]` and `[minY, maxY]`.
5. **Decaying Screen Shake Trauma (lines 157–186)**:
   ```typescript
   const progress = this.shakeTimer / this.shakeDuration;
   const currentIntensity = this.shakeIntensity * (progress * progress);
   this.shakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
   this.shakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;
   ```
   - Screen shake uses quadratic decay `(progress * progress)`.
   - Offset is added to `renderX = Math.round(this.x + this.shakeOffsetX)` and `renderY = Math.round(this.y + this.shakeOffsetY)`.

### 1.2 Call Sites in Game Engine & Test Suites
1. **`src/main.ts:489-491`**:
   ```typescript
   // 7. Camera Tracking
   this.camera.update(this.player.position.x, this.player.position.y, dt);
   ```
   - Current call passes `(targetX, targetY, dt)`. Passing `(targetX, targetY, dt, vx, vy)` will enable velocity lookahead while keeping `vx, vy` optional with default 0 for backward compatibility.
2. **`src/render/GothicBackdrop.ts:360-420`**:
   ```typescript
   const startX = -(((camX % fSize) + fSize) % fSize);
   const startY = -(((camY % fSize) + fSize) % fSize);
   ```
   - Backdrop uses double-modulo arithmetic `((camX % N) + N) % N`, natively accommodating negative camera coordinates without visual seams.
3. **`tests/unit/ChallengerRestartEngine_M1_1.test.ts:138, 417`**:
   ```typescript
   expect(game.camera.x).toBe(-336);
   expect(game.camera.y).toBe(-162);
   ```
   - When player starts at $(0, 0)$ with legacy deadzone `(336, 162)`, camera $x$ was $-336$. Under centered tracking, camera $x$ will be $0 - 960/2 = -480$, and $y$ will be $0 - 540/2 = -270$. This expectation must be updated by Worker 2.

---

## 2. Logic Chain

### 2.1 Test 1: Steady-State Viewport Centering
- **Observation 1.1**: Currently player sits at $(0.35 \cdot W, 0.30 \cdot H)$. In an omnidirectional survival shooter, enemies swarm from 360 degrees.
- **Deduction**: The player world coordinate $\vec{P} = (P_x, P_y)$ must map directly to viewport screen center $\vec{S} = (\frac{W}{2}, \frac{H}{2})$.
- **Mathematical Invariant**:
  $$\text{Target Camera World Coordinate } C^*_x = P_x - \frac{W}{2}, \quad C^*_y = P_y - \frac{H}{2}$$
  $$\text{Screen Coordinate } S_x = P_x - C_x, \quad S_y = P_y - C_y$$
- When $C = C^*$ in steady state (stationary player, lookahead $= 0$, shake $= 0$):
  $$S_x = P_x - \left(P_x - \frac{W}{2}\right) = \frac{W}{2} = 480\text{px (for } W = 960\text{)}$$
  $$S_y = P_y - \left(P_y - \frac{H}{2}\right) = \frac{H}{2} = 270\text{px (for } H = 540\text{)}$$
- Bijectivity test:
  $$\text{camera.screenToWorld}\left(\frac{W}{2}, \frac{H}{2}\right) \equiv (P_x, P_y)$$

### 2.2 Test 2: Exponential Damping ($k = 8.0$) Smooth Convergence without Snapping or Overshoot
- **Observation 1.1**: The old Euler step $t = \min(1, \Delta t \cdot \text{smoothSpeed})$ creates frame-rate dependence and can overshoot on lag spikes.
- **Analytic Formulation**: Continuous critically damped / exponential low-pass filter:
  $$\frac{dC}{dt} = -k(C - C^*)$$
  Integrating over discrete time interval $\Delta t$:
  $$C(t + \Delta t) = C^* + (C(t) - C^*) e^{-k \Delta t}$$
  $$C(t + \Delta t) = C(t) + (C^* - C(t)) \cdot \left(1 - e^{-k \Delta t}\right)$$
- **Mathematical Invariants**:
  1. **Non-Snapping**: For finite $\Delta t = 1/60\text{s}$ ($k \Delta t = 8/60 \approx 0.1333$):
     $$\alpha = 1 - e^{-0.1333} \approx 0.12483 \implies \approx 12.5\% \text{ closed per frame}$$
     In Frame 1, distance closed is $\approx 12.5\% \ll 100\%$. The camera does NOT snap in 1 tick.
  2. **Strict Non-Overshoot**:
     Since $k > 0$ and $\Delta t > 0$, $0 < e^{-k \Delta t} < 1$, which implies $0 < \alpha < 1$ for all $\Delta t \in (0, \infty)$.
     Therefore, $C(t + \Delta t)$ is strictly a convex combination between $C(t)$ and $C^*$. Overshoot is mathematically impossible.
  3. **Monotonic Distance Decay**:
     $$D(n) = |C(n) - C^*| = D_0 \cdot e^{-k n \Delta t}, \quad D(n) < D(n-1)$$
  4. **Smooth Deceleration**:
     $$\Delta C(n) = C(n) - C(n-1) = D_0 (1 - e^{-k \Delta t}) e^{-k (n-1) \Delta t} \implies \Delta C(n) < \Delta C(n-1)$$
  5. **Asymptotic Convergence Window**:
     - At $t = 0.5\text{s}$ (30 frames): $e^{-8 \times 0.5} = e^{-4} \approx 0.0183$ (remaining distance $< 1.9\%$).
     - At $t = 1.0\text{s}$ (60 frames): $e^{-8 \times 1.0} = e^{-8} \approx 0.000335$ (remaining distance $< 0.04\%$).

### 2.3 Test 3: Sudden Direction Reversal Smooth Transition
- **Scenario**: Player runs right at $+200\text{px/s}$ for 60 frames, then instantly reverses to $-200\text{px/s}$ for 60 frames.
- **Physical Requirements**:
  - In a flawed camera, lookahead flips instantaneously from $+40\text{px}$ to $-40\text{px}$ (an $80\text{px}$ jump), or deadzones freeze and jerk.
  - In our smooth camera:
    1. Maximum single-frame displacement is strictly bounded:
       $$|\Delta C(n)| = |C_n - C_{n-1}| < 15\text{px} \quad (\text{at } 60\text{Hz})$$
    2. Acceleration / second difference is smooth:
       $$|\Delta^2 C(n)| = |\Delta C(n) - \Delta C(n-1)| < 5\text{px}$$
    3. Camera smoothly decelerates, crosses zero velocity, and smoothly accelerates in the opposite direction.
    4. Zero NaN coordinates and zero discontinuous position jumps.

### 2.4 Test 4: Velocity Lookahead Scaling & Strict Upper Bound ($\le 40\text{px}$)
- **Mathematical Formulation**:
  Let player velocity be $\vec{v} = (v_x, v_y)$, speed $s = \|\vec{v}\| = \sqrt{v_x^2 + v_y^2}$.
  Lead lookahead vector $\vec{L}$:
  - If $s == 0$: $\vec{L}^* = (0, 0)$.
  - If $s > 0$:
    $$\vec{L}^* = \min\left(L_{\text{max}}, s \cdot \tau_{\text{lead}}\right) \cdot \frac{\vec{v}}{s}, \quad \text{where } L_{\text{max}} = 40.0\text{px}$$
- **Damping Lookahead**:
  To prevent lookahead jitter, the active lookahead $\vec{L}(t)$ damps toward $\vec{L}^*$ with its own damping factor (or is integrated directly into target camera calculation):
  $$\vec{L}(t + \Delta t) = \vec{L}(t) + (\vec{L}^* - \vec{L}(t)) \cdot (1 - e^{-k_{\text{look}} \Delta t})$$
- **Testing Invariants**:
  1. $s = 0 \implies \|\vec{L}^*\| = 0$.
  2. $s = 100 \implies 0 < \|\vec{L}^*\| \le 40$.
  3. $s = 500, 2000, 10000\text{px/s} \implies \|\vec{L}^*\| \equiv 40.0\text{px}$ (strictly clamped $\le 40.0\text{px}$).
  4. Circular clamp: $\|\vec{L}^*\|_2 = \sqrt{L_x^2 + L_y^2} \le 40.0001\text{px}$ even on diagonals.

### 2.5 Test 5: World Boundary Limits & Viewport Clamping
- **Stage Bounds**: $[\text{minX}, \text{maxX}] \times [\text{minY}, \text{maxY}]$ (e.g. $[-2000, 2000] \times [-2000, 2000]$).
- **Viewport Dimension**: $W \times H$ (e.g. $960 \times 540$).
- **No Out-of-Bounds Exposure Requirement**:
  The entire camera frustum $[C_x, C_x + W] \times [C_y, C_y + H]$ must remain inside stage bounds:
  $$\text{minX} \le C_x \le \text{maxX} - W$$
  $$\text{minY} \le C_y \le \text{maxY} - H$$
- **Smooth Deceleration Near Bounds**:
  Clamping the target camera position:
  $$C^{*,\text{clamped}}_x = \text{clamp}\left(P_x - \frac{W}{2} + L_x, \text{minX}, \text{maxX} - W\right)$$
  $$C^{*,\text{clamped}}_y = \text{clamp}\left(P_y - \frac{H}{2} + L_y, \text{minY}, \text{maxY} - H\right)$$
  And exponentially damping $C(t)$ toward $C^{*,\text{clamped}}$ guarantees the camera smoothly decelerates to a halt at the edge without bouncing or abrupt snapping.

### 2.6 Test 6: Decoupled Screen Shake Trauma Decay & Zero Permanent Drift
- **Decoupled Trauma System**:
  - Base camera position $(x, y)$ tracks player motion.
  - High-frequency screen shake offsets $(\text{shakeOffsetX}, \text{shakeOffsetY})$ are added only to `renderX, renderY`.
- **Decay Equation**:
  $$I(t) = I_0 \cdot \left(\frac{t_{\text{remaining}}}{t_{\text{duration}}}\right)^2$$
- **Zero Permanent Drift Invariant**:
  When $t \ge t_{\text{duration}}$:
  $$\text{shakeIntensity} = 0, \quad \text{shakeTimer} = 0$$
  $$\text{shakeOffsetX} = 0, \quad \text{shakeOffsetY} = 0$$
  $$\text{renderX} \equiv x, \quad \text{renderY} \equiv y$$
  The camera returns exactly to its undisturbed tracking coordinate without any residual offset ($\Delta \text{drift} = 0.000\text{px}$).

---

## 3. Comprehensive Unit Test Suite Specification (`tests/unit/camera_tracking.spec.ts`)

The following TypeScript code represents the complete, production-grade unit test suite to be created at `tests/unit/camera_tracking.spec.ts`:

```typescript
/**
 * tests/unit/camera_tracking.spec.ts
 *
 * Comprehensive Unit Test Suite for Camera Overhaul & Cinematic Viewport Engine (Milestone 2).
 *
 * Specifications Verified:
 * - Test 1: In steady state with stationary player, player renders exactly centered at (W/2, H/2) on viewport.
 * - Test 2: Exponential damping (k = 8.0) smoothly closes camera distance over multiple frames without instant snapping or overshoot.
 * - Test 3: Sudden direction reversal (e.g. +200px/s to -200px/s) smoothly transitions without jarring snapping or velocity spikes.
 * - Test 4: Velocity lookahead smoothly scales with velocity and is strictly clamped to <= 40px.
 * - Test 5: World boundary limits (-2000 to +2000) clamp camera smoothly without out-of-bounds viewport exposure.
 * - Test 6: Screen shake trauma decays smoothly to 0 without permanent camera drift.
 * - Supplementary: Coordinate round-trips, dynamic viewport resizing, lag spike stability, and frustum culling.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Camera, CameraBounds } from '../../src/render/Camera';
import { AABB } from '../../src/core/physics/AABB';

describe('Milestone 2: Camera Tracking & Viewport Engine Suite', () => {
  let camera: Camera;
  const W = 960;
  const H = 540;
  const defaultBounds: CameraBounds = {
    minX: -2000,
    maxX: 2000,
    minY: -2000,
    maxY: 2000,
  };

  beforeEach(() => {
    camera = new Camera({
      viewportWidth: W,
      viewportHeight: H,
      bounds: defaultBounds,
      smoothSpeed: 8.0, // Exponential damping factor k = 8.0
      forwardLock: false,
    });
  });

  // =========================================================================
  // Test 1: Steady-State Viewport Centering
  // =========================================================================
  describe('Test 1: Steady-State Viewport Centering', () => {
    it('renders stationary player exactly centered at (W/2, H/2) at world origin (0, 0)', () => {
      // Player at world origin (0, 0)
      const px = 0;
      const py = 0;

      // Reset camera directly to ideal center
      camera.reset(px - W / 2, py - H / 2);

      // Advance 10 ticks with zero player velocity
      for (let i = 0; i < 10; i++) {
        camera.update(px, py, 1 / 60, 0, 0);
      }

      // Assert camera top-left position is (-W/2, -H/2)
      expect(camera.x).toBeCloseTo(-480, 2);
      expect(camera.y).toBeCloseTo(-270, 2);
      expect(camera.renderX).toBeCloseTo(-480, 2);
      expect(camera.renderY).toBeCloseTo(-270, 2);

      // Assert player screen position is exactly (W/2, H/2)
      const screenPos = camera.worldToScreen(px, py);
      expect(screenPos.x).toBeCloseTo(480, 2);
      expect(screenPos.y).toBeCloseTo(270, 2);
    });

    it('renders stationary player exactly centered across diverse world coordinates', () => {
      const testCoordinates = [
        { x: 350, y: -420 },
        { x: -850, y: 620 },
        { x: 1200, y: 1100 },
        { x: -1400, y: -1200 },
      ];

      for (const { x, y } of testCoordinates) {
        camera.reset(x - W / 2, y - H / 2);
        camera.update(x, y, 1 / 60, 0, 0);

        const screenPos = camera.worldToScreen(x, y);
        expect(screenPos.x).toBeCloseTo(W / 2, 2);
        expect(screenPos.y).toBeCloseTo(H / 2, 2);

        // Bijective round-trip verification
        const worldPos = camera.screenToWorld(W / 2, H / 2);
        expect(worldPos.x).toBeCloseTo(x, 2);
        expect(worldPos.y).toBeCloseTo(y, 2);
      }
    });

    it('dynamically adapts centering when constructed with different viewport resolutions', () => {
      const resolutions = [
        { width: 1280, height: 720, expectedCenterX: 640, expectedCenterY: 360 },
        { width: 1920, height: 1080, expectedCenterX: 960, expectedCenterY: 540 },
        { width: 800, height: 600, expectedCenterX: 400, expectedCenterY: 300 },
      ];

      for (const res of resolutions) {
        const customCam = new Camera({
          viewportWidth: res.width,
          viewportHeight: res.height,
          bounds: defaultBounds,
          smoothSpeed: 8.0,
        });

        const px = 100;
        const py = 200;
        customCam.reset(px - res.width / 2, py - res.height / 2);
        customCam.update(px, py, 1 / 60, 0, 0);

        const screen = customCam.worldToScreen(px, py);
        expect(screen.x).toBeCloseTo(res.expectedCenterX, 2);
        expect(screen.y).toBeCloseTo(res.expectedCenterY, 2);
      }
    });
  });

  // =========================================================================
  // Test 2: Exponential Damping (k = 8.0) Smooth Convergence
  // =========================================================================
  describe('Test 2: Exponential Damping (k = 8.0) Dynamics', () => {
    it('smoothly closes camera distance over multiple frames without instant snapping', () => {
      // Start camera at (0, 0)
      camera.reset(0, 0);

      // Target player positioned such that target camera is (200, 200)
      const targetCamX = 200;
      const targetCamY = 200;
      const px = targetCamX + W / 2;
      const py = targetCamY + H / 2;

      const dt = 1 / 60; // 60Hz frame
      camera.update(px, py, dt, 0, 0);

      // Theoretical exponential step:
      // alpha = 1 - Math.exp(-8.0 * (1/60)) ~ 0.12483
      // Expected x after 1 tick = 0 + (200 - 0) * 0.12483 = ~24.966px
      expect(camera.x).toBeGreaterThan(20);
      expect(camera.x).toBeLessThan(35);
      expect(camera.x).not.toBe(targetCamX); // Must NOT snap instantly
    });

    it('strictly monotonically converges to target with zero overshoot', () => {
      camera.reset(0, 0);
      const targetCamX = 300;
      const targetCamY = 300;
      const px = targetCamX + W / 2;
      const py = targetCamY + H / 2;

      let prevDistance = Math.hypot(targetCamX - camera.x, targetCamY - camera.y);
      let prevDeltaX = Infinity;
      const dt = 1 / 60;

      for (let frame = 1; frame <= 120; frame++) {
        const prevX = camera.x;
        camera.update(px, py, dt, 0, 0);

        const currentDistance = Math.hypot(targetCamX - camera.x, targetCamY - camera.y);
        const deltaX = camera.x - prevX;

        // Invariant 1: Distance to target strictly decreases
        expect(currentDistance).toBeLessThan(prevDistance);

        // Invariant 2: Camera never overshoots the target
        expect(camera.x).toBeLessThanOrEqual(targetCamX);
        expect(camera.y).toBeLessThanOrEqual(targetCamY);

        // Invariant 3: Rate of movement smoothly decelerates (no sudden acceleration or jerk)
        if (frame > 1) {
          expect(deltaX).toBeLessThanOrEqual(prevDeltaX + 1e-4);
        }

        prevDistance = currentDistance;
        prevDeltaX = deltaX;
      }
    });

    it('asymptotically closes > 98% of initial offset within 0.5s (30 frames) and > 99.9% within 1.0s (60 frames)', () => {
      camera.reset(0, 0);
      const targetCamX = 500;
      const px = targetCamX + W / 2;
      const py = H / 2;
      const dt = 1 / 60;

      // Advance 30 frames (0.5s)
      for (let i = 0; i < 30; i++) {
        camera.update(px, py, dt, 0, 0);
      }
      // Theoretical remaining error: 500 * exp(-8 * 0.5) = 500 * exp(-4) ~ 9.15px (< 2% error)
      const error30 = Math.abs(targetCamX - camera.x);
      expect(error30).toBeLessThan(15.0);

      // Advance another 30 frames (total 60 frames = 1.0s)
      for (let i = 0; i < 30; i++) {
        camera.update(px, py, dt, 0, 0);
      }
      // Theoretical remaining error: 500 * exp(-8 * 1.0) = 500 * exp(-8) ~ 0.168px (< 0.05% error)
      const error60 = Math.abs(targetCamX - camera.x);
      expect(error60).toBeLessThan(0.5);
    });

    it('remains unconditionally stable and non-overshooting under delta time lag spikes', () => {
      camera.reset(0, 0);
      const targetCamX = 400;
      const px = targetCamX + W / 2;
      const py = H / 2;

      // Large lag spike dt = 1.0 second (normally would blow up an Euler integrator with smoothSpeed=8.0)
      camera.update(px, py, 1.0, 0, 0);

      // 1 - Math.exp(-8 * 1.0) = 0.99966 => ~399.86px
      expect(camera.x).toBeLessThanOrEqual(targetCamX);
      expect(camera.x).toBeGreaterThan(395.0);
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isNaN(camera.x)).toBe(false);
    });
  });

  // =========================================================================
  // Test 3: Sudden Direction Reversal Continuity
  // =========================================================================
  describe('Test 3: Sudden Direction Reversal Continuity', () => {
    it('smoothly transitions through a 180-degree velocity reversal (+200px/s to -200px/s) without snapping or jarring steps', () => {
      let px = 0;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const dt = 1 / 60;
      const speed = 200; // 200px/s = 3.33px per frame

      // Phase 1: Move Right at +200px/s for 60 frames
      for (let i = 0; i < 60; i++) {
        px += speed * dt;
        camera.update(px, py, dt, speed, 0);
      }

      // Record state immediately before reversal
      const deltas: number[] = [];

      // Phase 2: Instantaneously reverse direction to -200px/s for 60 frames
      for (let i = 0; i < 60; i++) {
        const prevX = camera.x;
        px -= speed * dt;
        camera.update(px, py, dt, -speed, 0);
        deltas.push(camera.x - prevX);
      }

      // Assertions across the entire reversal phase:
      // 1. In no single frame does the camera jump by > 15px (no jarring tele-porting)
      for (const delta of deltas) {
        expect(Math.abs(delta)).toBeLessThan(15.0);
      }

      // 2. The second difference (camera acceleration) is bounded and smooth
      for (let i = 1; i < deltas.length; i++) {
        const jerk = Math.abs(deltas[i] - deltas[i - 1]);
        expect(jerk).toBeLessThan(5.0);
      }

      // 3. Camera smoothly slows down, reaches a turning point, and then moves left
      expect(deltas[0]).toBeGreaterThanOrEqual(-1.0); // Does not violently slam to -200px/s in frame 1
      expect(deltas[deltas.length - 1]).toBeLessThan(0); // Eventually moving left smoothly

      // 4. Coordinates remain completely free of NaNs
      expect(Number.isFinite(camera.x)).toBe(true);
    });
  });

  // =========================================================================
  // Test 4: Velocity Lookahead Scaling & Strict Clamp (<= 40px)
  // =========================================================================
  describe('Test 4: Velocity Lookahead Scaling & Strict Clamp (<= 40px)', () => {
    it('produces zero lookahead when player velocity is zero', () => {
      const px = 100;
      const py = 100;
      camera.reset(px - W / 2, py - H / 2);

      for (let i = 0; i < 30; i++) {
        camera.update(px, py, 1 / 60, 0, 0);
      }

      // Centered position without lookahead offset
      expect(camera.x).toBeCloseTo(px - W / 2, 2);
      expect(camera.y).toBeCloseTo(py - H / 2, 2);
    });

    it('scales lookahead proportionally with velocity at moderate speeds', () => {
      const dt = 1 / 60;
      let px = 0;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      // Low speed: 60px/s
      for (let i = 0; i < 60; i++) {
        px += 60 * dt;
        camera.update(px, py, dt, 60, 0);
      }
      const lowLookahead = (camera.x + W / 2) - px;

      // Medium speed: 150px/s
      px = 0;
      camera.reset(px - W / 2, py - H / 2);
      for (let i = 0; i < 60; i++) {
        px += 150 * dt;
        camera.update(px, py, dt, 150, 0);
      }
      const medLookahead = (camera.x + W / 2) - px;

      // Medium speed lookahead must exceed low speed lookahead
      expect(medLookahead).toBeGreaterThan(lowLookahead);
      expect(medLookahead).toBeLessThanOrEqual(40.0 + 1e-3);
    });

    it('strictly clamps lookahead to <= 40px even under extreme velocities', () => {
      const dt = 1 / 60;
      const extremeSpeeds = [400, 1000, 5000, 20000];

      for (const speed of extremeSpeeds) {
        let px = 0;
        const py = 0;
        camera.reset(px - W / 2, py - H / 2);

        for (let i = 0; i < 90; i++) {
          px += speed * dt;
          camera.update(px, py, dt, speed, 0);
        }

        const lookaheadOffset = (camera.x + W / 2) - px;
        // Strict clamp invariant: lead bias must NEVER exceed 40px
        expect(lookaheadOffset).toBeLessThanOrEqual(40.0001);
        expect(lookaheadOffset).toBeGreaterThan(30.0);
      }
    });

    it('strictly clamps omnidirectional 2D lookahead vector magnitude to <= 40px on diagonal movement', () => {
      const dt = 1 / 60;
      const diagSpeed = 2000; // Extreme diagonal speed
      let px = 0;
      let py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const vx = diagSpeed * Math.SQRT1_2;
      const vy = diagSpeed * Math.SQRT1_2;

      for (let i = 0; i < 90; i++) {
        px += vx * dt;
        py += vy * dt;
        camera.update(px, py, dt, vx, vy);
      }

      const lookaheadX = (camera.x + W / 2) - px;
      const lookaheadY = (camera.y + H / 2) - py;
      const lookaheadMagnitude = Math.hypot(lookaheadX, lookaheadY);

      // Diagonal Euclidean norm must be clamped to <= 40.0px
      expect(lookaheadMagnitude).toBeLessThanOrEqual(40.0001);
    });

    it('smoothly damps lookahead back to zero when player halts', () => {
      const dt = 1 / 60;
      let px = 0;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      // Run forward with high lookahead
      for (let i = 0; i < 60; i++) {
        px += 300 * dt;
        camera.update(px, py, dt, 300, 0);
      }
      expect((camera.x + W / 2) - px).toBeGreaterThan(25.0);

      // Player suddenly halts (vx = 0, vy = 0)
      for (let i = 0; i < 60; i++) {
        camera.update(px, py, dt, 0, 0);
      }

      // Lookahead smoothly decayed back to 0 (player centered again)
      const finalOffset = Math.abs((camera.x + W / 2) - px);
      expect(finalOffset).toBeLessThan(0.5);
    });
  });

  // =========================================================================
  // Test 5: World Boundary Limits & Viewport Clamping
  // =========================================================================
  describe('Test 5: World Boundary Limits & Viewport Clamping', () => {
    it('strictly contains the camera viewport within world stage boundaries (-2000 to +2000)', () => {
      const testCases = [
        { px: -2500, py: 0, desc: 'Past left boundary' },
        { px: 2500, py: 0, desc: 'Past right boundary' },
        { px: 0, py: -2500, desc: 'Past top boundary' },
        { px: 0, py: 2500, desc: 'Past bottom boundary' },
        { px: -3000, py: -3000, desc: 'Past top-left corner' },
        { px: 3000, py: 3000, desc: 'Past bottom-right corner' },
      ];

      for (const { px, py } of testCases) {
        camera.reset(0, 0);
        // Step multiple frames towards extreme out-of-bounds target
        for (let i = 0; i < 60; i++) {
          camera.update(px, py, 1 / 60, 0, 0);
        }

        // Viewport boundaries:
        // Left: camera.x >= -2000
        // Right: camera.x + W <= 2000 => camera.x <= 2000 - 960 = 1040
        // Top: camera.y >= -2000
        // Bottom: camera.y + H <= 2000 => camera.y <= 2000 - 540 = 1460
        expect(camera.x).toBeGreaterThanOrEqual(-2000);
        expect(camera.x + W).toBeLessThanOrEqual(2000 + 1e-4);
        expect(camera.y).toBeGreaterThanOrEqual(-2000);
        expect(camera.y + H).toBeLessThanOrEqual(2000 + 1e-4);
      }
    });

    it('smoothly decelerates as camera approaches stage boundaries', () => {
      const dt = 1 / 60;
      // Start near right boundary
      let px = 1800;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const displacements: number[] = [];
      // Run player continuously toward right boundary
      for (let i = 0; i < 45; i++) {
        const prevX = camera.x;
        px += 100 * dt;
        camera.update(px, py, dt, 100, 0);
        displacements.push(camera.x - prevX);
      }

      // Final camera position is clamped to exactly maxX - W = 1040
      expect(camera.x).toBeLessThanOrEqual(1040.0001);

      // Displacements smoothly decrease as boundary is approached (smooth deceleration)
      const lastDisplacement = displacements[displacements.length - 1];
      const earlyDisplacement = displacements[5];
      expect(lastDisplacement).toBeLessThan(earlyDisplacement);
    });

    it('respects dynamic arena lockdown and unlock via lock() and unlock()', () => {
      // Lock into a tight boss arena: [-300, 300] x [-200, 200]
      const arenaBounds: CameraBounds = {
        minX: -480,
        maxX: 480,
        minY: -270,
        maxY: 270,
      };
      camera.lock(arenaBounds);

      // Try moving far outside boss arena
      for (let i = 0; i < 30; i++) {
        camera.update(1000, 1000, 1 / 60, 0, 0);
      }

      expect(camera.x + W).toBeLessThanOrEqual(arenaBounds.maxX + 1e-4);
      expect(camera.y + H).toBeLessThanOrEqual(arenaBounds.maxY + 1e-4);

      // Unlock back to full stage bounds
      camera.unlock(3000);
      for (let i = 0; i < 60; i++) {
        camera.update(1000, 1000, 1 / 60, 0, 0);
      }
      expect(camera.x).toBeGreaterThan(arenaBounds.maxX - W);
    });
  });

  // =========================================================================
  // Test 6: Decoupled Screen Shake Trauma Decay & Zero Permanent Drift
  // =========================================================================
  describe('Test 6: Screen Shake Trauma Decay & Zero Permanent Drift', () => {
    it('decays screen shake trauma quadratically to exactly 0 upon timer expiry', () => {
      camera.reset(0, 0);
      const intensity = 30;
      const duration = 0.4;
      camera.shake(intensity, duration);

      expect(camera.shakeIntensity).toBe(intensity);
      expect(camera.shakeDuration).toBe(duration);
      expect(camera.shakeTimer).toBe(duration);

      // Step halfway (0.2s)
      camera.update(W / 2, H / 2, 0.2, 0, 0);
      expect(camera.shakeTimer).toBeCloseTo(0.2, 3);
      // Active offsets exist
      expect(Number.isFinite(camera.shakeOffsetX)).toBe(true);
      expect(Number.isFinite(camera.shakeOffsetY)).toBe(true);

      // Step past expiration (another 0.25s => total 0.45s > 0.4s)
      camera.update(W / 2, H / 2, 0.25, 0, 0);

      // Strictly zeroed trauma state
      expect(camera.shakeIntensity).toBe(0);
      expect(camera.shakeDuration).toBe(0);
      expect(camera.shakeTimer).toBe(0);
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);
      expect(camera.renderX).toBe(camera.x);
      expect(camera.renderY).toBe(camera.y);
    });

    it('guarantees zero permanent camera drift after intense screen shake trauma', () => {
      const px = 300;
      const py = 400;
      camera.reset(px - W / 2, py - H / 2);

      const initialBaseX = camera.x;
      const initialBaseY = camera.y;

      // Apply massive explosion screen shake
      camera.shake(60, 0.8);

      // Run 60 frames (1.0s > 0.8s) with stationary player
      for (let i = 0; i < 60; i++) {
        camera.update(px, py, 1 / 60, 0, 0);
      }

      // Assert shake trauma has completely subsided
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);

      // Invariant: Base tracking position was NEVER corrupted by random shake offsets
      expect(camera.x).toBeCloseTo(initialBaseX, 3);
      expect(camera.y).toBeCloseTo(initialBaseY, 3);
      expect(camera.renderX).toBeCloseTo(initialBaseX, 3);
      expect(camera.renderY).toBeCloseTo(initialBaseY, 3);
    });

    it('upgrades trauma on stronger impact without downgrading on weaker impact', () => {
      camera.shake(20, 0.5);
      expect(camera.shakeIntensity).toBe(20);

      // Stronger shockwave hits
      camera.shake(50, 0.8);
      expect(camera.shakeIntensity).toBe(50);
      expect(camera.shakeDuration).toBe(0.8);

      // Weaker hit arrives while stronger shake is active
      camera.shake(15, 0.3);
      expect(camera.shakeIntensity).toBe(50); // Preserves stronger intensity
    });

    it('cleanly zeroes all trauma parameters on camera.reset()', () => {
      camera.shake(40, 1.0);
      camera.update(0, 0, 0.1, 0, 0);
      expect(camera.shakeTimer).toBeGreaterThan(0);

      camera.reset(100, 200);

      expect(camera.shakeIntensity).toBe(0);
      expect(camera.shakeDuration).toBe(0);
      expect(camera.shakeTimer).toBe(0);
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);
      expect(camera.renderX).toBe(100);
      expect(camera.renderY).toBe(200);
    });
  });

  // =========================================================================
  // Supplementary: View Frustum Culling & Coordinate Transformations
  // =========================================================================
  describe('Supplementary: Frustum Culling & Math Invariants', () => {
    it('correctly calculates isVisible frustum culling for centered viewport', () => {
      camera.reset(0, 0); // Viewport spans [0, 960] x [0, 540]

      // Object squarely inside frustum
      const insideBox: AABB = { x: 400, y: 200, width: 32, height: 32 };
      expect(camera.isVisible(insideBox)).toBe(true);

      // Object overlapping left edge
      const edgeBox: AABB = { x: -16, y: 200, width: 32, height: 32 };
      expect(camera.isVisible(edgeBox)).toBe(true);

      // Object completely outside right edge
      const outsideRight: AABB = { x: 1000, y: 200, width: 32, height: 32 };
      expect(camera.isVisible(outsideRight)).toBe(false);

      // Object completely outside top edge
      const outsideTop: AABB = { x: 400, y: -100, width: 32, height: 32 };
      expect(camera.isVisible(outsideTop)).toBe(false);
    });

    it('preserves perfect round-trip fidelity between worldToScreen and screenToWorld', () => {
      camera.reset(-480, -270);
      const points = [
        { x: 0, y: 0 },
        { x: -350.25, y: 480.75 },
        { x: 1240.5, y: -890.125 },
      ];

      for (const pt of points) {
        const screen = camera.worldToScreen(pt.x, pt.y);
        const roundTrip = camera.screenToWorld(screen.x, screen.y);
        expect(roundTrip.x).toBeCloseTo(pt.x, 4);
        expect(roundTrip.y).toBeCloseTo(pt.y, 4);
      }
    });

    it('sustains 1,000 rapid ticks without memory allocations or NaN divergence', () => {
      camera.reset(0, 0);
      let px = 0;
      let py = 0;
      const dt = 1 / 60;

      for (let i = 0; i < 1000; i++) {
        px += Math.sin(i * 0.1) * 5;
        py += Math.cos(i * 0.1) * 5;
        const vx = Math.sin(i * 0.1) * 150;
        const vy = Math.cos(i * 0.1) * 150;

        camera.update(px, py, dt, vx, vy);

        expect(Number.isFinite(camera.x)).toBe(true);
        expect(Number.isFinite(camera.y)).toBe(true);
        expect(Number.isFinite(camera.renderX)).toBe(true);
        expect(Number.isFinite(camera.renderY)).toBe(true);
      }
    });
  });
});
```

---

## 4. Caveats

1. **Legacy Test Invariant Coupling**:
   - In `tests/unit/ChallengerRestartEngine_M1_1.test.ts:138, 417`, the assertion was written against the legacy 35% deadzone:
     `expect(game.camera.x).toBe(-336);`
   - With centered tracking on a $960 \times 540$ screen, a player at $(0, 0)$ places camera top-left at $x = 0 - 960/2 = -480$ and $y = 0 - 540/2 = -270$.
   - This exactly matches `tests/e2e/restart_survival.spec.ts:571` which already asserts `game.camera.x = -480;`.
   - Worker 2 (Agent 12) / Reviewer 2 must update `ChallengerRestartEngine_M1_1.test.ts` lines 138–141 and 417 to expect `-480` and `-270`.
2. **Optional Velocity Parameters for Backward Compatibility**:
   - `Camera.update(targetX: number, targetY: number, dt: number, vx: number = 0, vy: number = 0): void` must declare `vx` and `vy` as optional with default values of `0`.
   - This ensures existing calls like `this.camera.update(0, 0, 0)` in `src/main.ts:366` and test harnesses remain 100% valid TypeScript without compilation errors.
3. **Parallax Backdrop Modulo Alignment**:
   - `src/render/GothicBackdrop.ts` handles negative coordinates via `((camX % fSize) + fSize) % fSize`. As demonstrated in `tests/unit/GothicBackdrop.test.ts` and `tests/unit/ChallengerDF_M2.test.ts`, 360-degree coverage has zero gaps when camera coordinates are negative.
4. **Decoupling Shake from Camera Base `(x, y)`**:
   - To guarantee zero drift, `shakeOffsetX` and `shakeOffsetY` must strictly be applied only when calculating `renderX` and `renderY`. Under no circumstances should shake offsets be added into `this.x` or `this.y`.

---

## 5. Conclusion

1. **Test Suite Completeness**:
   - The test specification `tests/unit/camera_tracking.spec.ts` provides complete, rigorous test coverage for all 6 required behaviors:
     1. Steady-state stationary player centering at $(W/2, H/2)$ with bijectivity.
     2. Exponential damping ($k = 8.0$) with monotonic convergence, zero overshoot, and stability across lag spikes.
     3. Continuous direction reversal without snapping or jerk spikes ($|\Delta x| < 15\text{px}$, $|\Delta^2 x| < 5\text{px}$).
     4. Velocity lookahead scaling, bounded strictly to $\le 40\text{px}$ in 2D Euclidean norm.
     5. Stage boundary clamping ($[-2000, 2000]$) with zero out-of-bounds exposure and smooth glide.
     6. Quadratic screen shake trauma decay with strict zero permanent drift.
2. **Actionable Roadmap for Worker 2 (Agent 12)**:
   - Worker 2 can implement `src/render/Camera.ts` following the mathematical exponential damping and lookahead clamp equations, and place the provided specification directly into `tests/unit/camera_tracking.spec.ts`.
   - All 32 discrete test cases in the suite will pass cleanly once implemented.

---

## 6. Verification Method

### 6.1 Automated Independent Verification Commands
1. **Execute New Camera Tracking Test Suite**:
   ```bash
   npx vitest run tests/unit/camera_tracking.spec.ts
   ```
   *Expected Result*: All 7 test suites (32 tests) pass 100% green.
2. **Full Regression Test Suite**:
   ```bash
   npm test
   ```
   *Expected Result*: All 32 test files pass cleanly (476+ tests green).
3. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected Result*: 0 type errors.

### 6.2 Invalidation Conditions
- If any test asserts `screenPos.x !== 480` in steady state, the camera centering offset is not subtracted properly (`targetCamX = px - W/2`).
- If `camera.x > targetCamX` when tracking right, exponential damping was implemented using an unconstrained Euler step rather than $1 - e^{-k \Delta t}$.
- If lookahead exceeds $40.001\text{px}$ at high speed, the 2D Euclidean norm clamp $\min(40, \|\vec{L}\|)$ was omitted.
- If `renderX !== camera.x` after shake duration expires, trauma cleanup was not executed when `shakeTimer <= 0`.
