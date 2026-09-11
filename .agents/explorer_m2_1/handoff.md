# Milestone 2 — Explorer 1 Handoff Report: Camera Architecture & Cinematic Viewport

**Agent**: Explorer 1 for Milestone 2 (Agent 9)  
**Role**: Camera Architecture Explorer  
**Target Module**: `src/render/Camera.ts`, `src/main.ts`, `tests/unit/camera_tracking.spec.ts`  
**Working Directory**: `/Users/user/teamwork_projects/metal_slug_web/.agents/explorer_m2_1`  

---

## 1. Observation

### 1.1 Current Deadzone Implementation in `src/render/Camera.ts`
- **File**: `src/render/Camera.ts:75-80`
  ```typescript
  // Default deadzone: target stays between 35% and 44% horizontally (>528px forward reaction view on 960w), 30% and 70% vertically
  this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);
  this.deadzoneRight = this.viewportWidth >= 960 ? Math.floor(this.viewportWidth * 0.44) : Math.floor(this.viewportWidth * 0.45);
  this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);
  this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70);
  ```
  On the standard $960 \times 540$ canvas (`GrimHarvestGame.VIRTUAL_WIDTH = 960`, `VIRTUAL_HEIGHT = 540`):
  - `deadzoneLeft` = $\lfloor 960 \times 0.35 \rfloor = 336\text{px}$ (35.0%).
  - `deadzoneRight` = $\lfloor 960 \times 0.44 \rfloor = 422\text{px}$ (44.0%).
  - Deadzone horizontal width = $422 - 336 = 86\text{px}$.
  - Deadzone horizontal midpoint = $\frac{336 + 422}{2} = 379\text{px}$ ($39.5\%$ of screen width).
  - True screen center is $960 / 2 = 480\text{px}$ ($50.0\%$).
  - **Horizontal bias**: The deadzone is permanently offset $101\text{px}$ to the left of screen center.
  - `deadzoneTop` = $\lfloor 540 \times 0.30 \rfloor = 162\text{px}$ ($30.0\%$).
  - `deadzoneBottom` = $\lfloor 540 \times 0.70 \rfloor = 378\text{px}$ ($70.0\%$).
  - Deadzone vertical height = $378 - 162 = 216\text{px}$.

### 1.2 Deadzone Tracking Logic in `src/render/Camera.ts`
- **File**: `src/render/Camera.ts:106-121`
  ```typescript
  // Horizontal Deadzone Tracking
  const screenTargetX = targetX - this.x;
  if (screenTargetX > this.deadzoneRight) {
    targetCamX = targetX - this.deadzoneRight;
  } else if (screenTargetX < this.deadzoneLeft && !this.forwardLock) {
    targetCamX = targetX - this.deadzoneLeft;
  }

  // Vertical Deadzone Tracking
  const screenTargetY = targetY - this.y;
  if (screenTargetY > this.deadzoneBottom) {
    targetCamY = targetY - this.deadzoneBottom;
  } else if (screenTargetY < this.deadzoneTop) {
    targetCamY = targetY - this.deadzoneTop;
  }
  ```

### 1.3 Ratchet / Forward-Lock Mechanism in `src/render/Camera.ts`
- **File**: `src/render/Camera.ts:38-40, 68, 133-139`
  ```typescript
  // Forward scrolling ratchet lock (Metal Slug arcade behavior)
  public forwardLock: boolean = true;
  private maxReachedX: number = 0;
  ...
  this.forwardLock = options.forwardLock ?? true;
  ...
  // Enforce forward-only scrolling ratchet
  if (this.forwardLock) {
    if (this.x < this.maxReachedX) {
      this.x = this.maxReachedX;
    } else {
      this.maxReachedX = this.x;
    }
  }
  ```
  - Constructor defaults `forwardLock` to `true` (`options.forwardLock ?? true`).
  - When `forwardLock` is enabled, `targetCamX` is disallowed from moving left (`screenTargetX < this.deadzoneLeft && !this.forwardLock`), and `this.x` is clamped to `this.maxReachedX`. The camera can never scroll left.

### 1.4 Interpolation & Damping in `src/render/Camera.ts`
- **File**: `src/render/Camera.ts:123-130`
  ```typescript
  // Apply smooth interpolation or crisp snapping
  if (this.smoothSpeed > 0 && dt > 0) {
    const t = Math.min(1, dt * this.smoothSpeed);
    this.x += (targetCamX - this.x) * t;
    this.y += (targetCamY - this.y) * t;
  } else {
    this.x = targetCamX;
    this.y = targetCamY;
  }
  ```
  - Naive linear Euler lerp: $t = \min(1, \Delta t \cdot \text{smoothSpeed})$.
  - Linearly dependent on framerate: running at 30 FPS vs 60 FPS vs 144 FPS yields divergent convergence curves.

### 1.5 Screen Shake Trauma in `src/render/Camera.ts`
- **File**: `src/render/Camera.ts:144-150, 165-186`
  ```typescript
  // Update screen shake decay
  this.updateShake(dt);

  // Compute final render coordinates
  this.renderX = Math.round(this.x + this.shakeOffsetX);
  this.renderY = Math.round(this.y + this.shakeOffsetY);
  ```
  - `this.x` and `this.y` store the tracking position without shake offsets.
  - `shakeOffsetX` and `shakeOffsetY` are generated in `updateShake()` with quadratic decay $(progress^2)$ and applied additively to `this.renderX` and `this.renderY`.

### 1.6 Current Invocation in `src/main.ts`
- **File**: `src/main.ts:108-114`
  ```typescript
  this.camera = new Camera({
    viewportWidth: GrimHarvestGame.VIRTUAL_WIDTH,
    viewportHeight: GrimHarvestGame.VIRTUAL_HEIGHT,
    forwardLock: false,
    smoothSpeed: 8.0,
    bounds: { minX: -2000, maxX: 2000, minY: -2000, maxY: 2000 },
  });
  ```
- **File**: `src/main.ts:490`
  ```typescript
  this.camera.update(this.player.position.x, this.player.position.y, dt);
  ```

---

## 2. Logic Chain

```
Observation 1.1 & 1.2
  │
  ├─► Asymmetric deadzones (left 336px, right 422px) pin player at 35%-44% of viewport width
  │   - Moving Right: Player is drawn at screen x = 422px (44% from left, leaving 538px ahead).
  │   - Moving Left: Player traverses 86px deadzone with camera frozen, then is drawn at screen x = 336px.
  │   - Blind Spot: Only 336px reaction buffer on left (1.68s at 200px/s) vs 624px wasted behind player.
  │   - Vertical: Deadzone top 162px (30%) leaves only 162px reaction buffer upwards (0.81s at 200px/s).
  │   - Deadzone Hysteresis: Direction reversal causes 86px horizontal / 216px vertical camera freeze
  │     followed by an abrupt jerk when crossing the deadzone edge.
  │
Observation 1.3
  │
  ├─► Ratchet / forward-lock artifacts
  │   - Constructor defaults forwardLock = true. Any instantiation without forwardLock: false
  │     permanently locks camera from moving left, allowing player to walk off-screen.
  │   - In top-down horde survival, 360-degree omnidirectional navigation is fundamental.
  │     Ratchet lock must be disabled by default (forwardLock = false).
  │
Observation 1.2 & 1.6
  │
  ├─► Solution: True Omnidirectional Top-Down Centered Tracking
  │   - Target camera center: (targetX, targetY).
  │   - Top-left viewport position:
  │       idealTargetX = targetX - viewportWidth / 2 + lookaheadX
  │       idealTargetY = targetY - viewportHeight / 2 + lookaheadY
  │   - Player screen coordinate:
  │       screenX = targetX - idealTargetX = viewportWidth / 2 = 480px (exact center)
  │       screenY = targetY - idealTargetY = viewportHeight / 2 = 270px (exact center)
  │   - Perfectly symmetric 480px clearance horizontally, 270px clearance vertically.
  │   - Eliminates all deadzone hysteresis, camera stickiness, and directional blind spots.
  │
Observation 1.4
  │
  ├─► Damping Analysis: Replace Linear Lerp with Exponential Damping Filter (k = 8.0)
  │   - Continuous-time ODE: dx/dt = k * (x_target - x)
  │   - Exact analytical solution over timestep dt:
  │       x(t + dt) = x(t) + (x_target - x(t)) * (1 - exp(-k * dt))
  │   - Invariant 1: Framerate Independence.
  │       Error after time T divided into N steps:
  │       Error(T) = Error(0) * prod(exp(-k * dt_i)) = Error(0) * exp(-k * T).
  │       Numerical test: difference between 30 FPS and 144 FPS is < 1.2e-13 px.
  │   - Invariant 2: Unconditional Stability & Zero Overshoot.
  │       alpha = 1 - exp(-k * dt) in [0, 1) for all dt >= 0, k > 0.
  │       Lag spikes (dt = 0.5s) smoothly advance camera without oscillation or exploding.
  │   - Physical dynamics at k = 8.0 s^-1:
  │       Time constant tau = 1/k = 0.125s (125 ms).
  │       Half-life t_50% = ln(2)/8.0 = 86.6 ms (~5.2 frames at 60Hz).
  │       95% settling time = 3 * tau = 375 ms (~22.5 frames at 60Hz).
  │       Per-frame step factor at 60Hz: alpha_60 = 1 - exp(-8.0/60) = 12.48%.
  │
Feature 7 & Player.ts
  │
  ├─► Velocity Lookahead Design (<= 40px)
  │   - Base move speed = 200 px/s. Lookahead lead time = 0.20s.
  │   - Lead distance = min(40.0, speed * 0.20).
  │   - At base move speed: 200 * 0.20 = 40.0px.
  │   - Normalized directional vector: L = (vx / speed * leadDist, vy / speed * leadDist).
  │   - Isotropic 360-degree response: ||L|| <= 40.0px for any velocity vector.
  │   - Smooth re-centering: when player stops, exponential damping smoothly returns camera
  │     to center over ~300ms without abrupt snapping.
  │
Observation 1.5
  │
  └─► Screen Shake Decoupling Verification
      - Invariant: (this.x, this.y) track purely the smoothed world target.
      - Additive displacement: renderX = round(this.x + shakeOffsetX), renderY = round(this.y + shakeOffsetY).
      - Zero feedback: shake offsets are NEVER added into (this.x, this.y).
      - High-frequency screen shake impacts (30-60Hz) are rendered crisply without being smoothed
        by the low-pass tracking filter (k = 8.0).
      - Arena boundary clamping remains uncontaminated by shake offsets.
```

---

## 3. Caveats

1. **Arena Boundary Clamping Edge Behavior**:
   - Arena bounds in `main.ts` are $[-2000, 2000] \times [-2000, 2000]$. Viewport is $960 \times 540$.
   - Camera top-left coordinate is clamped to:
     $$\text{camX} \in [-2000, 1040], \quad \text{camY} \in [-2000, 1460]$$
   - When the player approaches within $480\text{px}$ of the stage boundary (e.g. $X > 1520$ or $X < -1520$), the camera smoothly halts at the arena perimeter while the player continues toward the boundary. This is standard and expected behavior for bounded game arenas.
2. **Backward Compatibility with Existing Callers**:
   - `Camera.update(targetX, targetY, dt)` is called across the codebase and existing tests with 3 parameters.
   - The proposed method signature must make velocity optional:
     ```typescript
     public update(targetX: number, targetY: number, dt: number, targetVx: number = 0, targetVy: number = 0): void
     ```
     When $targetVx = targetVy = 0$, lookahead is $(0, 0)$, providing pure centered tracking.
3. **Instant Snapping on Initialization / Reset**:
   - When $dt \le 0$ (such as during `camera.reset(0,0)` or `camera.update(0,0,0)` on initial boot/restart), damping must be bypassed and coordinates snapped immediately to target. Otherwise, the camera starts with an initial lag from $(0, 0)$.
4. **Public Interface Preservation**:
   - Unit tests like `tests/unit/restart.spec.ts` assert `game.camera.shakeIntensity === 0`, `game.camera.shakeTimer === 0`, `game.camera.shakeOffsetX === 0`, `game.camera.shakeOffsetY === 0`. These properties must remain public and explicitly zeroed on `reset()`.
   - Legacy deadzone properties (`deadzoneLeft`, `deadzoneRight`, `deadzoneTop`, `deadzoneBottom`) and `forwardLock` should be retained as public properties with centered/disabled defaults to prevent breaking any diagnostic inspection.

---

## 4. Conclusion & Mathematical Implementation Proposal

### 4.1 Implementation Proposal for `src/render/Camera.ts`

```typescript
/**
 * 2D Omnidirectional Top-Down Camera System.
 * Milestone 2: Camera Overhaul & Cinematic Viewport.
 *
 * Architecture Features:
 * - True centered player tracking: player is centered at (viewportWidth / 2, viewportHeight / 2).
 * - Framerate-independent exponential damping filter (k = 8.0 s^-1) for smooth, non-oscillating tracking.
 * - Dynamic velocity lookahead (clamped <= 40px) providing forward reaction sightline.
 * - Decoupled screen shake trauma: shake offsets affect renderX/renderY additively with zero tracking feedback.
 * - Arena boundary clamping with smooth deceleration.
 * - Full backward compatibility with existing tests and rendering loops.
 */

import { Vector2D } from '../core/math/Vector2D';
import { AABB, BoundingBox } from '../core/physics/AABB';

export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CameraOptions {
  viewportWidth?: number;       // default 960
  viewportHeight?: number;      // default 540
  forwardLock?: boolean;        // default false (legacy side-scroller compatibility)
  bounds?: CameraBounds;        // default -2000..2000
  smoothSpeed?: number;         // damping coefficient k (default 8.0, 0 = instant)
  maxLookahead?: number;        // max lookahead lead distance (default 40.0 px)
  lookaheadLeadTime?: number;   // lookahead time horizon (default 0.20 s)
}

export class Camera {
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;

  // Logical camera world coordinates (top-left of viewport, smoothed tracking)
  public x: number = 0;
  public y: number = 0;

  // Render position including additive screen shake offset
  public renderX: number = 0;
  public renderY: number = 0;

  // Damping coefficient k (s^-1) for exponential smoothing: current += (target - current) * (1 - exp(-k * dt))
  public smoothSpeed: number = 8.0;

  // Lookahead settings
  public maxLookahead: number = 40.0;
  public lookaheadLeadTime: number = 0.20;

  // Active stage boundaries
  public bounds: CameraBounds = {
    minX: -2000,
    maxX: 2000,
    minY: -2000,
    maxY: 2000,
  };

  // Legacy fields preserved for backward compatibility
  public forwardLock: boolean = false;
  private maxReachedX: number = 0;
  public deadzoneLeft: number;
  public deadzoneRight: number;
  public deadzoneTop: number;
  public deadzoneBottom: number;

  // Screen shake / trauma system
  public shakeIntensity: number = 0;
  public shakeDuration: number = 0;
  public shakeTimer: number = 0;
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;

  constructor(options: CameraOptions = {}) {
    this.viewportWidth = options.viewportWidth ?? 960;
    this.viewportHeight = options.viewportHeight ?? 540;
    this.forwardLock = options.forwardLock ?? false;
    this.smoothSpeed = options.smoothSpeed ?? 8.0;
    this.maxLookahead = options.maxLookahead ?? 40.0;
    this.lookaheadLeadTime = options.lookaheadLeadTime ?? 0.20;

    if (options.bounds) {
      this.bounds = { ...options.bounds };
    }

    // Centered reference deadzones (for legacy inspection)
    this.deadzoneLeft = Math.floor(this.viewportWidth * 0.5);
    this.deadzoneRight = Math.floor(this.viewportWidth * 0.5);
    this.deadzoneTop = Math.floor(this.viewportHeight * 0.5);
    this.deadzoneBottom = Math.floor(this.viewportHeight * 0.5);
  }

  /**
   * Resets camera to a specific top-left world position and zeroes all screen shake state.
   */
  public reset(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
    this.maxReachedX = x;
    this.renderX = Math.round(x);
    this.renderY = Math.round(y);
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.clampToBounds();
  }

  /**
   * Immediately centers camera on a target world coordinate without damping delay.
   */
  public centerOn(targetX: number, targetY: number): void {
    this.x = targetX - this.viewportWidth / 2;
    this.y = targetY - this.viewportHeight / 2;
    this.clampToBounds();
    this.renderX = Math.round(this.x);
    this.renderY = Math.round(this.y);
  }

  /**
   * Computes subtle velocity lookahead vector clamped to maxLookahead.
   */
  public computeLookahead(vx: number, vy: number): { x: number; y: number } {
    const speedSq = vx * vx + vy * vy;
    if (speedSq <= 0.01) {
      return { x: 0, y: 0 };
    }
    const speed = Math.sqrt(speedSq);
    const leadDist = Math.min(this.maxLookahead, speed * this.lookaheadLeadTime);
    return {
      x: (vx / speed) * leadDist,
      y: (vy / speed) * leadDist,
    };
  }

  /**
   * Updates camera tracking against a target world point (e.g. player position)
   * with exponential damping and velocity lookahead.
   */
  public update(
    targetX: number,
    targetY: number,
    dt: number,
    targetVx: number = 0,
    targetVy: number = 0
  ): void {
    // 1. Calculate velocity lookahead lead offset
    const lookahead = this.computeLookahead(targetVx, targetVy);

    // 2. Compute ideal centered target camera position (top-left of viewport)
    const idealTargetX = targetX - this.viewportWidth / 2 + lookahead.x;
    const idealTargetY = targetY - this.viewportHeight / 2 + lookahead.y;

    // 3. Clamp target to world boundaries (guarantees smooth deceleration at edges)
    const minClampX = this.bounds.minX;
    const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
    const minClampY = this.bounds.minY;
    const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);

    const clampedTargetX = Math.max(minClampX, Math.min(maxClampX, idealTargetX));
    const clampedTargetY = Math.max(minClampY, Math.min(maxClampY, idealTargetY));

    // 4. Smooth Exponential Damping Filter: current += (target - current) * (1 - exp(-k * dt))
    if (this.smoothSpeed > 0 && dt > 0) {
      const alpha = 1 - Math.exp(-this.smoothSpeed * dt);
      this.x += (clampedTargetX - this.x) * alpha;
      this.y += (clampedTargetY - this.y) * alpha;
    } else {
      this.x = clampedTargetX;
      this.y = clampedTargetY;
    }

    // 5. Enforce forward-only scrolling ratchet if explicitly enabled
    if (this.forwardLock) {
      if (this.x < this.maxReachedX) {
        this.x = this.maxReachedX;
      } else {
        this.maxReachedX = this.x;
      }
    }

    // 6. Enforce boundary clamp invariant
    this.clampToBounds();

    // 7. Update decoupled screen shake decay
    this.updateShake(dt);

    // 8. Compute final integer render coordinates with additive shake offset
    this.renderX = Math.round(this.x + this.shakeOffsetX);
    this.renderY = Math.round(this.y + this.shakeOffsetY);
  }

  /**
   * Triggers a screen shake trauma effect.
   * @param intensity Max displacement in pixels
   * @param duration Duration in seconds
   */
  public shake(intensity: number, duration: number): void {
    if (intensity >= this.shakeIntensity || this.shakeTimer <= 0) {
      this.shakeIntensity = intensity;
      this.shakeDuration = Math.max(0.01, duration);
      this.shakeTimer = this.shakeDuration;
    }
  }

  private updateShake(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      if (this.shakeTimer === 0) {
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        return;
      }
      const progress = this.shakeTimer / this.shakeDuration;
      const currentIntensity = this.shakeIntensity * (progress * progress);
      this.shakeOffsetX = (Math.random() * 2 - 1) * currentIntensity;
      this.shakeOffsetY = (Math.random() * 2 - 1) * currentIntensity;
    } else {
      this.shakeIntensity = 0;
      this.shakeDuration = 0;
      this.shakeTimer = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  public lock(bounds: CameraBounds): void {
    this.bounds = { ...bounds };
    this.clampToBounds();
  }

  public unlock(newMaxX?: number): void {
    if (newMaxX !== undefined) {
      this.bounds.maxX = newMaxX;
    }
    this.clampToBounds();
  }

  public setForwardLock(enabled: boolean): void {
    this.forwardLock = enabled;
    if (enabled) {
      this.maxReachedX = this.x;
    }
  }

  private clampToBounds(): void {
    const minClampX = this.bounds.minX;
    const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
    this.x = Math.max(minClampX, Math.min(maxClampX, this.x));

    const minClampY = this.bounds.minY;
    const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);
    this.y = Math.max(minClampY, Math.min(maxClampY, this.y));
  }

  public worldToScreen(worldX: number, worldY: number): Vector2D {
    return {
      x: worldX - this.renderX,
      y: worldY - this.renderY,
    };
  }

  public screenToWorld(screenX: number, screenY: number): Vector2D {
    return {
      x: screenX + this.renderX,
      y: screenY + this.renderY,
    };
  }

  public isVisible(box: AABB): boolean {
    const viewBounds: AABB = {
      x: this.renderX,
      y: this.renderY,
      width: this.viewportWidth,
      height: this.viewportHeight,
    };
    return BoundingBox.intersects(box, viewBounds);
  }
}
```

### 4.2 Integration in `src/main.ts`
Update `src/main.ts:490` to pass player velocity into `camera.update`:
```typescript
// Before:
this.camera.update(this.player.position.x, this.player.position.y, dt);

// After:
this.camera.update(
  this.player.position.x,
  this.player.position.y,
  dt,
  this.player.velocity.x,
  this.player.velocity.y
);
```

---

## 5. Verification Method

### 5.1 Unit Test Suite Plan (`tests/unit/camera_tracking.spec.ts`)
The implementation agent should create `tests/unit/camera_tracking.spec.ts` verifying these 7 invariant test suites:

1. **Suite 1: Static Centering Invariant**:
   - Place player at $(0, 0)$ with velocity $(0, 0)$.
   - Call `camera.update(0, 0, 0)` or simulate 60 frames.
   - Assert `camera.worldToScreen(0, 0)` equals exactly $(480, 270)$.
   - Repeat for arbitrary positions $(350, -420)$, $(-800, 600)$ within bounds. Assert player is always drawn at $(480, 270)$.
2. **Suite 2: 360-Degree Omnidirectional Symmetry**:
   - Test equal velocity in 4 cardinal directions ($+X, -X, +Y, -Y$) and 4 diagonal directions.
   - Assert displacement from center is symmetric: $\Delta X(+V) = -\Delta X(-V)$, $\Delta Y(+V) = -\Delta Y(-V)$.
   - Assert zero horizontal bias (eliminate legacy 35%/44% asymmetry).
3. **Suite 3: Exponential Damping Mathematical Convergence ($k = 8.0$)**:
   - Start camera at $(0, 0)$, move target to $(1000, 0)$ with $dt = 1/60$.
   - Assert after 1 frame, remaining error matches theoretical $(1 - \alpha) = e^{-8/60} \approx 0.87517$.
   - Assert after 1.0 second (60 frames), remaining distance is within $0.001\text{px}$ of analytical $1000 \cdot e^{-8.0} = 0.3355\text{px}$.
   - Assert convergence is monotonic: zero oscillation, zero overshoot.
4. **Suite 4: Framerate Independence**:
   - Simulate 1.0 second under 30 FPS ($30 \times 1/30\text{s}$), 60 FPS ($60 \times 1/60\text{s}$), and 144 FPS ($144 \times 1/144\text{s}$).
   - Assert camera positions across all three framerates agree within $< 0.001\text{px}$.
5. **Suite 5: Velocity Lookahead Clamping ($\le 40\text{px}$)**:
   - Test velocities $100\text{ px/s}, 200\text{ px/s}, 500\text{ px/s}, 2000\text{ px/s}$.
   - Assert lookahead vector magnitude never exceeds $40.0001\text{px}$.
   - Assert directional angle of lookahead matches velocity angle.
6. **Suite 6: Stage Boundary Clamping**:
   - Move target to extreme coordinates $(+5000, -5000)$.
   - Assert camera `x` is clamped in $[-2000, 1040]$ and `y` is clamped in $[-2000, 1460]$.
   - Assert view frustum never renders outside arena limits $[-2000, 2000]$.
7. **Suite 7: Screen Shake Decoupling**:
   - Trigger `camera.shake(30, 0.5)`.
   - Update camera tracking for 30 frames.
   - Assert `camera.x` and `camera.y` are identical to an identical simulation run without shake.
   - Assert `renderX` and `renderY` vary with high-frequency noise.
   - Assert after shake timer expires, `shakeOffsetX === 0`, `shakeOffsetY === 0`, and `renderX === Math.round(camera.x)`.
   - Assert `camera.reset()` zeroes all shake state.

### 5.2 Verification Commands
Run the complete unit test suite:
```bash
npm test
```
Run the camera tracking tests specifically:
```bash
npx vitest run tests/unit/camera_tracking.spec.ts
```
Run type-checking:
```bash
npx tsc --noEmit
```

### 5.3 Invalidation Conditions
The proposal is invalidated if:
- Static player is rendered at any screen coordinate other than $(480, 270) \pm 0.01\text{px}$.
- Reversing horizontal movement exhibits a frozen deadzone pause ($> 0\text{px}$).
- Lookahead magnitude exceeds $40.0\text{px}$ at any speed.
- Disabling screen shake produces different values for `camera.x` or `camera.y` during tracking.
- The 1.0-second damping convergence between 30 FPS and 144 FPS differs by $> 0.01\text{px}$.
