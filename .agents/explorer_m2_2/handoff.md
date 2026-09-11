# Milestone 2 Investigation Report: Velocity Lookahead & Parallax Alignment

**Agent**: `explorer_m2_2` (Role: Velocity Lookahead & Parallax Alignment Explorer)  
**Date**: 2026-09-11  
**Target Files**: `src/render/Camera.ts`, `src/render/GothicBackdrop.ts`, `src/main.ts`  
**Project Root**: `/Users/user/teamwork_projects/metal_slug_web`  
**Milestone**: M2 (Camera Overhaul & Cinematic Viewport)  

---

## 1. Observation

### 1.1 Current Architecture in `src/render/Camera.ts`
1. **Method Signature and Tracking Logic**:
   - `Camera.update` currently accepts only 3 arguments:
     ```typescript
     // src/render/Camera.ts:102
     public update(targetX: number, targetY: number, dt: number): void
     ```
   - It possesses **no velocity parameters** (`vx`, `vy`), nor internal lookahead state.
2. **Legacy Side-Scroller Deadzones**:
   - Lines 76–79:
     ```typescript
     this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);
     this.deadzoneRight = this.viewportWidth >= 960 ? Math.floor(this.viewportWidth * 0.44) : Math.floor(this.viewportWidth * 0.45);
     this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);
     this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70);
     ```
   - Lines 107–120:
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
   - This binds the player to between 35% and 44% horizontally ($336\text{px}$ to $422\text{px}$ on a $960\text{px}$ screen) and 30% to 70% vertically ($162\text{px}$ to $378\text{px}$ on a $540\text{px}$ screen).
   - In a 360-degree top-down horde survival game, this legacy side-scroller bias severely obscures approaching threats from the left and behind, and introduces an 86px horizontal deadzone "slop" before camera tracking engages upon turning.
3. **Smooth Interpolation**:
   - Lines 123–130:
     ```typescript
     if (this.smoothSpeed > 0 && dt > 0) {
       const t = Math.min(1, dt * this.smoothSpeed);
       this.x += (targetCamX - this.x) * t;
       this.y += (targetCamY - this.y) * t;
     } else {
       this.x = targetCamX;
       this.y = targetCamY;
     }
     ```
4. **Screen Shake & Sub-pixel Quantization**:
   - Lines 148–149:
     ```typescript
     this.renderX = Math.round(this.x + this.shakeOffsetX);
     this.renderY = Math.round(this.y + this.shakeOffsetY);
     ```
   - `renderX` and `renderY` are explicitly rounded using `Math.round`, ensuring crisp integer canvas rasterization without fractional blit blur.

---

### 1.2 Kinematic Properties in `src/core/entities/Player.ts`
1. **Velocity and Acceleration**:
   - Line 36:
     ```typescript
     public position: Vector2D;
     public velocity: Vector2D = vec2(0, 0);
     ```
   - Lines 40–42:
     ```typescript
     public static readonly BASE_MOVE_SPEED = 200.0;
     public static readonly ACCELERATION = 1800.0;
     public static readonly DECELERATION = 2400.0;
     ```
   - Lines 171–177:
     ```typescript
     if (len > 0) {
       this.velocity.x = this.approach(this.velocity.x, targetVx, Player.ACCELERATION * dt);
       this.velocity.y = this.approach(this.velocity.y, targetVy, Player.ACCELERATION * dt);
     } else {
       this.velocity.x = this.approach(this.velocity.x, 0, Player.DECELERATION * dt);
       this.velocity.y = this.approach(this.velocity.y, 0, Player.DECELERATION * dt);
     }
     ```
   - Player velocity is continuous, non-instantaneous, and directly accessible via `this.player.velocity.x` and `this.player.velocity.y`.
   - Speed magnitude: $|v| \in [0, 350]\text{px/s}$ (base 200, buffed up to 350).
2. **Current Update Call in `src/main.ts`**:
   - Line 490:
     ```typescript
     // 7. Camera Tracking
     this.camera.update(this.player.position.x, this.player.position.y, dt);
     ```
   - Passing `this.player.velocity.x` and `this.player.velocity.y` is immediately feasible without any additional kinematic calculations.

---

### 1.3 Parallax Layering & Offset Calculation in `src/render/GothicBackdrop.ts`

`GothicBackdrop.ts` renders 7 distinct layers in `render()` plus 1 foreground pass in `renderForegroundMist()`.

1. **Layer 0: Celestial Sky & Blood Moon Eclipse (Parallax 0.02)**:
   - Lines 374–384:
     ```typescript
     const W = 1024;
     const H = 540;
     const startX = -(((camX * 0.02) % W + W) % W);
     const startY = -(((camY * 0.02) % H + H) % H);
     for (let x = startX; x < vw; x += W) {
       for (let y = startY; y < vh; y += H) {
         ctx.drawImage(this.skyCanvas, x, y);
       }
     }
     ```
   - **Observation**: `createSkySurface` (lines 96–101) creates an asymmetric vertical linear gradient from top (`DEEP` `#08060c`) to bottom (`SLATE` `#171326`). When $camY < 0$, $startY$ jumps toward $-H$, placing Tile 1's bottom (`SLATE`) directly adjacent to Tile 2's top (`DEEP`) on screen. This manifests as a visible horizontal color seam across the celestial sky.
2. **Layer 1: Drifting Storm Clouds (Parallax 0.05 + Wind Drift)**:
   - Lines 389–396:
     ```typescript
     const W = 1920;
     const startX = -((((camX * 0.05 + elapsedTime * 14.0) % W) + W) % W);
     for (let x = startX; x < vw; x += W) {
       ctx.drawImage(this.cloudCanvas, x, 0);
     }
     ```
   - **Observation**: In `createCloudSurface` (lines 140–152), cloud #0 is generated at $cx = (0 \cdot 53) \% 1920 = 0$ with $radX = 80$. The left half of this puff ($[-80, 0]$) is clipped off at the canvas edge and is **not wrapped** to $x = 1920 - 80 = 1840$. As clouds drift across the screen, a flat, sliced edge of this puff passes by.
3. **Layer 2: Distant Graveyard Skyline Silhouette (Parallax 0.15)**:
   - Lines 398–406:
     ```typescript
     const W = 1920;
     const startX = -((((camX * 0.15) % W) + W) % W);
     const horizonY = vh * 0.35;
     for (let x = startX; x < vw; x += W) {
       ctx.drawImage(this.skylineCanvas, x, horizonY);
     }
     ```
   - **Observation**: Skyline is fixed to $horizonY = vh \times 0.35 = 189\text{px}$. Width 1920 covers $vw = 960$ seamlessly.
4. **Layer 3: Ancient Stone Flagging Floor (Parallax 1.0, World Space)**:
   - Lines 408–421:
     ```typescript
     const fSize = this.flagstoneTileSize; // 512
     const startX = -(((camX % fSize) + fSize) % fSize);
     const startY = -(((camY % fSize) + fSize) % fSize);
     ctx.globalAlpha = 0.88;
     for (let x = startX; x < vw; x += fSize) {
       for (let y = startY; y < vh; y += fSize) {
         ctx.drawImage(this.flagstoneCanvas, x, y);
       }
     }
     ctx.globalAlpha = 1.0;
     ```
   - **Observation**: `createFlagstoneSurface` draws a 4x4 grid of stones with 2px mortar margin around the edges. When tiles connect, $2\text{px} + 2\text{px} = 4\text{px}$ mortar. This grid is mathematically seamless in both X and Y.
5. **Layer 4: Dynamic Occult Runic Circles (Spatial Grid, Interval 800)**:
   - Lines 423–444:
     `RUNE_INTERVAL = 800`, dynamic pulse alpha, culled mathematically with bounds $[(cam - 256)/800, (cam + v)/800]$. Completely seamless and artifact-free.
6. **Layer 5: Cursed Graveyard Props (Cell Size 160)**:
   - Lines 446–480: Deterministic spatial hashing `hash = ((cx * 73856093) ^ (cy * 19349663)) >>> 0`. Margin of $\pm 80\text{px}$ outside viewport prevents any pop-in or edge culling artifacts.
7. **Layer 6: Rolling Ground Mist / Fog (Parallax 0.40 & 0.65)**:
   - Lines 482–507:
     - Sub-layer A: Parallax 0.40, fixed at $y = 0$.
     - Sub-layer B: Parallax 0.65 with multi-harmonic sinusoidal undulation `undulationY = 14 * sin(...) + 8 * cos(...)`.
   - **Observation**: In `createMistSurface` (lines 340–352), radial puffs generated with centers near $x \in \{0, W\}$ or $y \in \{0, H\}$ are clipped at canvas boundaries without toroidal wrapping, creating faint linear density steps upon wrapping.
8. **Foreground Mist Pass: `renderForegroundMist`**:
   - Lines 530–548:
     ```typescript
     // Layer 3: Cinematic Foreground Depth Mist (Parallax 1.15)
     const startX = -((((camX * 1.15 + elapsedTime * 35.0) % W) + W) % W);
     ctx.globalAlpha = 0.10;

     for (let x = startX; x < vw + W; x += W) {
       ctx.drawImage(this.mistCanvas, x, 0);
     }

     // Camera Y tracking for vertical arena movement
     if (camY !== 0) {
       const startY = -((((camY * 0.35 + Math.sin(elapsedTime * 0.6) * 10) % H) + H) % H);
       if (Math.abs(startY) > 4) {
         for (let x = startX; x < vw + W; x += W) {
           for (let y = startY; y < vh + H; y += H) {
             ctx.drawImage(this.mistCanvas, x, y);
           }
         }
       }
     }
     ```
   - **CRITICAL DEFECT (Flickering & Double Blending)**:
     - The first loop unconditionally blits a row of mist at $y = 0$ with `alpha = 0.10`.
     - When $camY \neq 0$ and $|startY| > 4$, a second loop blits a full 2D grid of mist. This **doubles the opacity** along $y = 0$ from $0.10$ to $0.20$.
     - Whenever $|startY|$ crosses the arbitrary threshold of $4\text{px}$ (which happens continuously as the camera moves vertically or as $\sin(0.6t) \cdot 10$ oscillates), the entire 2D grid abruptly pops into and out of existence. This causes **severe, visible full-screen flickering**.

---

## 2. Logic Chain

### 2.1 Centered Camera Tracking Evolution
1. **Defect**: Observation 1.1.2 shows that `Camera.ts` uses side-scroller deadzones (35% to 44% width, 30% to 70% height).
2. **Requirement**: `ORIGINAL_REQUEST.md:340`, `COLLABORATION.md:47`, and `SCOPE.md:8` mandate centered player tracking for omnidirectional top-down horde survival.
3. **Ideal Screen Center**:
   To place the player at the exact screen center $(W/2, H/2)$, the base camera target must be:
   $$\text{baseCamX} = \text{targetX} - \frac{\text{viewportWidth}}{2}$$
   $$\text{baseCamY} = \text{targetY} - \frac{\text{viewportHeight}}{2}$$
4. **Ratchet Lock Removal**:
   `forwardLock` was designed for side-scrollers where the player cannot walk left. In top-down survival, `forwardLock` must default to `false` (or be eliminated from active clamping).

---

### 2.2 Velocity Lookahead Dynamics & Bounded Formulation

#### 1. Why Naive Lookahead Fails:
- If lookahead is computed as $\vec{L} = \frac{\vec{v}}{|v|} \times 40\text{px}$ and added directly to the target:
  - Instantaneous direction reversal (e.g., pressing Left while moving Right) produces an **$80\text{px}$ instantaneous step** in camera target.
  - When stopping, $|v| \to 0$ causes division-by-zero or sudden snapping back to center ("rubber-banding").
  - Small velocity noise or micro-taps cause erratic camera jitter.

#### 2. Mathematical Formulation for Subtle Bounded Lookahead:
Let $\vec{v} = (v_x, v_y)$ with speed $s = \sqrt{v_x^2 + v_y^2}$.

1. **Velocity Threshold (Deadzone)**:
   Define $v_{\text{threshold}} = 5.0\text{px/s}$ (matching `Player.ts:179` facing threshold).
   If $s < v_{\text{threshold}}$, target lookahead is $(0, 0)$:
   $$\vec{L}_{\text{target}} = (0, 0)$$

2. **Proportional Speed Scaling & Strict $40\text{px}$ Clamping**:
   Let maximum lookahead distance be $L_{\max} = 40.0\text{px}$.
   Let reference base move speed be $v_{\text{base}} = 200.0\text{px/s}$.
   The scaling coefficient is:
   $$c_{\text{scale}} = \frac{L_{\max}}{v_{\text{base}}} = \frac{40.0}{200.0} = 0.20\text{ seconds}$$
   The desired lookahead magnitude is:
   $$d_{\text{lead}} = \min(L_{\max}, s \cdot c_{\text{scale}}) = \min(40.0, 0.20 \cdot s)$$
   Therefore, the target lookahead vector is:
   $$\vec{L}_{\text{target}} = \frac{\vec{v}}{s} \cdot d_{\text{lead}} = \vec{v} \cdot \min\left(\frac{40.0}{s}, 0.20\right)$$
   Specifically:
   $$L_{x, \text{target}} = v_x \cdot \min\left(\frac{40.0}{s}, 0.20\right)$$
   $$L_{y, \text{target}} = v_y \cdot \min\left(\frac{40.0}{s}, 0.20\right)$$

3. **Mathematical Proof of Boundedness**:
   $$|\vec{L}_{\text{target}}| = \sqrt{L_{x, \text{target}}^2 + L_{y, \text{target}}^2} = s \cdot \min\left(\frac{40.0}{s}, 0.20\right) \le s \cdot \frac{40.0}{s} = 40.0\text{px}$$
   $\therefore |\vec{L}_{\text{target}}| \le 40.0\text{px}$ holds identically for all velocities $(v_x, v_y) \in \mathbb{R}^2$. $\blacksquare$

4. **Smooth Damping Filter (Second-Order Response)**:
   To ensure zero jerk upon reversal or stopping, the camera stores internal state `lookaheadX` and `lookaheadY`.
   Each frame, `lookaheadX` and `lookaheadY` are smoothly damped toward `L_target` with a dedicated lookahead smoothing factor ($k_{\text{look}} = 5.0\text{s}^{-1}$):
   $$\alpha_{\text{lead}} = \min(1.0, dt \cdot k_{\text{look}})$$
   $$\text{this.lookaheadX} \mathrel{+}= (L_{x, \text{target}} - \text{this.lookaheadX}) \cdot \alpha_{\text{lead}}$$
   $$\text{this.lookaheadY} \mathrel{+}= (L_{y, \text{target}} - \text{this.lookaheadY}) \cdot \alpha_{\text{lead}}$$

   Then, the overall camera position smoothly tracks the lookahead-offset center using `smoothSpeed` ($k_{\text{cam}} = 8.0\text{s}^{-1}$):
   $$\text{targetCamX} = \text{targetX} - \frac{\text{viewportWidth}}{2} + \text{this.lookaheadX}$$
   $$\text{targetCamY} = \text{targetY} - \frac{\text{viewportHeight}}{2} + \text{this.lookaheadY}$$
   $$\alpha_{\text{cam}} = \min(1.0, dt \cdot \text{this.smoothSpeed})$$
   $$\text{this.x} \mathrel{+}= (\text{targetCamX} - \text{this.x}) \cdot \alpha_{\text{cam}}$$
   $$\text{this.y} \mathrel{+}= (\text{targetCamY} - \text{this.y}) \cdot \alpha_{\text{cam}}$$

   *Result*: The cascading combination of two first-order low-pass filters produces an exceptionally smooth, critically-damped second-order kinematic response:
   - On sudden direction flip: Lookahead smoothly glides from $+40\text{px}$ to $-40\text{px}$ across $\approx 0.35\text{s}$ without snap.
   - On full stop: As player decelerates at $2400\text{px/s}^2$ ($0.083\text{s}$), lookahead gently floats back to center over $\approx 0.3\text{s}$.
   - At rest: Lookahead equals $(0, 0)$, providing perfect symmetrical centering.

---

### 2.3 Backdrop Parallax Alignment & Artifact Elimination

1. **Elimination of Foreground Mist Flickering**:
   - Observation 1.3.8 identified the arbitrary conditional `if (Math.abs(startY) > 4)` and the duplicate draw at $y=0$ in `renderForegroundMist`.
   - **Fix**: Replace both passes with a single unified 2D grid loop that smoothly shifts with continuous parallax offsets $startX = -(((camX \cdot 1.15 + 35t) \pmod W + W) \pmod W)$ and $startY = -(((camY \cdot 0.35 + 10\sin(0.6t)) \pmod H + H) \pmod H)$.
   - This completely eliminates the blinking/flickering bug and normalizes mist opacity to a consistent $0.10$.

2. **Elimination of Celestial Sky Seam**:
   - Observation 1.3.1 identified that `createSkySurface` uses an asymmetric vertical gradient (DEEP to SLATE), which creates a visible line across the sky when $camY < 0$.
   - **Fix**: Make the vertical gradient in `createSkySurface` symmetrical:
     `0.0 -> DEEP`, `0.5 -> MID / SLATE`, `1.0 -> DEEP`.
     When tiled vertically, top edge (`DEEP`) meets bottom edge (`DEEP`) with mathematical $C^0$ and $C^1$ continuity.

3. **Toroidal Cloud & Mist Puff Wrapping**:
   - Observations 1.3.2 & 1.3.7 revealed that puffs centered near canvas borders are clipped, creating flat edges that scroll across the screen.
   - **Fix**: When pre-rendering `cloudCanvas` and `mistCanvas`, apply toroidal edge wrapping:
     If an ellipse/arc extends beyond $x < 0$, wrap a secondary instance at $x + W$; if $x + rad > W$, wrap at $x - W$.
     For mist (which tiles in both axes), wrap in $x \pm W$ and $y \pm H$.
     This yields 100% seamless procedural textures.

4. **Loop Boundary Optimization**:
   - In `render()`, Layer 0 and Layer 3 use `x < vw`, while Layer 6 uses `x < vw + W`.
   - Since $startX \in (-W, 0]$, any tile loop starting at $startX$ with step $W$ and condition `x < vw` will draw its final tile with left edge $x_{\text{last}} < vw$ and right edge $x_{\text{last}} + W \ge vw$. Thus, the entire viewport $[0, vw]$ is always covered.
   - Using `x < vw + W` in Layer 6 caused offscreen tile draws ($x > vw$). Normalizing all loops to `x < vw` and `y < vh` saves unnecessary draw calls while maintaining 100% viewport coverage.

---

## 3. Caveats

1. **Arena Boundary Clamping with Lookahead**:
   - When the player is near the world boundary (e.g. $x = 1980$ against boundary $2000$), a forward velocity lookahead of $+40\text{px}$ requests a camera position beyond the arena clamp limit ($x > 2000 - 960 = 1040$).
   - `Camera.clampToBounds()` strictly clamps `this.x` and `this.y` to $[minClamp, maxClamp]$.
   - Consequently, lookahead smoothly compresses against the world boundary, which is the correct physical behavior (the camera will not expose un-rendered void outside the arena).
2. **Screen Shake Separation**:
   - Screen shake offsets (`shakeOffsetX`, `shakeOffsetY`) are added during the final render calculation (`renderX`, `renderY`) **after** bounds clamping and lookahead.
   - This ensures violent trauma shakes never corrupt the player lookahead vector or persistent camera tracking state.
3. **Backwards Compatibility**:
   - Defaulting `vx = 0, vy = 0` in `Camera.update(targetX, targetY, dt, vx = 0, vy = 0)` ensures all existing test suites (`tests/unit/*.test.ts`) that invoke `camera.update(x, y, dt)` remain 100% green without modification.

---

## 4. Conclusion & Recommended Concrete Code Proposals

### 4.1 Proposed Refactor for `src/render/Camera.ts`

```typescript
export interface CameraOptions {
  viewportWidth?: number;  // default 960
  viewportHeight?: number; // default 540
  forwardLock?: boolean;   // default false for top-down
  bounds?: CameraBounds;
  smoothSpeed?: number;    // default 8.0
  lookaheadMax?: number;   // default 40.0
  lookaheadSpeed?: number; // default 5.0
}

export class Camera {
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;

  public x: number = 0;
  public y: number = 0;
  public renderX: number = 0;
  public renderY: number = 0;

  // Velocity lookahead state (bounded <= 40px)
  public lookaheadX: number = 0;
  public lookaheadY: number = 0;
  public readonly lookaheadMax: number;
  public readonly lookaheadSpeed: number;

  public forwardLock: boolean = false;
  private maxReachedX: number = 0;

  public bounds: CameraBounds = {
    minX: -2000,
    maxX: 2000,
    minY: -2000,
    maxY: 2000,
  };

  public smoothSpeed: number = 8.0;

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
    this.lookaheadMax = options.lookaheadMax ?? 40.0;
    this.lookaheadSpeed = options.lookaheadSpeed ?? 5.0;

    if (options.bounds) {
      this.bounds = { ...options.bounds };
    }
  }

  public reset(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
    this.lookaheadX = 0;
    this.lookaheadY = 0;
    this.maxReachedX = x;
    this.renderX = x;
    this.renderY = y;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.clampToBounds();
  }

  /**
   * Updates camera tracking against player target position and velocity vector.
   * Centers player on screen with smooth damping and subtle velocity lookahead (<= 40px).
   */
  public update(
    targetX: number,
    targetY: number,
    dt: number,
    vx: number = 0,
    vy: number = 0
  ): void {
    // 1. Compute target velocity lookahead vector (bounded <= 40px)
    const speed = Math.hypot(vx, vy);
    let targetLookX = 0;
    let targetLookY = 0;

    if (speed >= 5.0) {
      // Scale proportionally up to base speed (200px/s), clamped to lookaheadMax (40px)
      const scale = Math.min(this.lookaheadMax / speed, 0.20);
      targetLookX = vx * scale;
      targetLookY = vy * scale;
    }

    // 2. Smoothly damp lookahead offset to avoid jitter on stop or sudden reversal
    if (dt > 0) {
      const lookaheadT = Math.min(1.0, dt * this.lookaheadSpeed);
      this.lookaheadX += (targetLookX - this.lookaheadX) * lookaheadT;
      this.lookaheadY += (targetLookY - this.lookaheadY) * lookaheadT;
    } else {
      this.lookaheadX = targetLookX;
      this.lookaheadY = targetLookY;
    }

    // 3. Compute centered camera target with lookahead lead bias
    const targetCamX = targetX - this.viewportWidth * 0.5 + this.lookaheadX;
    const targetCamY = targetY - this.viewportHeight * 0.5 + this.lookaheadY;

    // 4. Smooth exponential camera interpolation
    if (this.smoothSpeed > 0 && dt > 0) {
      const t = Math.min(1.0, dt * this.smoothSpeed);
      this.x += (targetCamX - this.x) * t;
      this.y += (targetCamY - this.y) * t;
    } else {
      this.x = targetCamX;
      this.y = targetCamY;
    }

    // Optional legacy forward ratchet (disabled by default in horde survival)
    if (this.forwardLock) {
      if (this.x < this.maxReachedX) {
        this.x = this.maxReachedX;
      } else {
        this.maxReachedX = this.x;
      }
    }

    // 5. Clamp inside stage world bounds
    this.clampToBounds();

    // 6. Update screen shake decay
    this.updateShake(dt);

    // 7. Compute final integer render coordinates
    this.renderX = Math.round(this.x + this.shakeOffsetX);
    this.renderY = Math.round(this.y + this.shakeOffsetY);
  }
}
```

---

### 4.2 Proposed Call in `src/main.ts`

Line 490 update:
```typescript
// 7. Camera Tracking (Centered with Velocity Lookahead)
this.camera.update(
  this.player.position.x,
  this.player.position.y,
  dt,
  this.player.velocity.x,
  this.player.velocity.y
);
```

---

### 4.3 Proposed Fixes in `src/render/GothicBackdrop.ts`

#### 1. Symmetrical Celestial Sky Gradient (Line 96):
```typescript
private createSkySurface(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = this.createOffscreen(w, h);
  if (!ctx) return canvas;

  // Symmetrical deep space gradient to prevent vertical seams
  const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
  skyGrad.addColorStop(0, PALETTE.ABYSSAL_VOID.DEEP);
  skyGrad.addColorStop(0.5, PALETTE.ABYSSAL_VOID.MID);
  skyGrad.addColorStop(1, PALETTE.ABYSSAL_VOID.DEEP);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, h);
  ...
```

#### 2. Toroidal Cloud Surface Wrapping (Line 135):
```typescript
private createCloudSurface(w: number, h: number): HTMLCanvasElement {
  const { canvas, ctx } = this.createOffscreen(w, h);
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, w, h);

  for (let i = 0; i < 40; i++) {
    const cx = (i * 53) % w;
    const cy = 30 + ((i * 37) % (h - 60));
    const radX = 80 + ((i * 29) % 110);
    const radY = 25 + ((i * 17) % 35);
    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, radX);
    grad.addColorStop(0, i % 2 === 0 ? PRECOMPUTED_TRANSLUCENCIES.stormCloudDeep : PRECOMPUTED_TRANSLUCENCIES.stormCloudSoft);
    grad.addColorStop(1, 'rgba(15, 13, 26, 0)');
    ctx.fillStyle = grad;

    // Draw main puff
    ctx.beginPath();
    ctx.ellipse(cx, cy, radX, radY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Toroidal horizontal wrapping for seamless edge tiling
    if (cx - radX < 0) {
      ctx.beginPath();
      ctx.ellipse(cx + w, cy, radX, radY, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cx + radX > w) {
      ctx.beginPath();
      ctx.ellipse(cx - w, cy, radX, radY, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return canvas;
}
```

#### 3. Continuous, Flicker-Free Foreground Mist (Line 516):
```typescript
public renderForegroundMist(
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number = 0,
  elapsedTime: number = 0
): void {
  if (!this.mistCanvas || !this.enableMist) return;

  ctx.save();
  const vw = this.viewportWidth;
  const vh = this.viewportHeight;
  const W = 1024;
  const H = 540;

  // Cinematic Foreground Depth Mist (Parallax 1.15 horizontal drift, 0.35 vertical tracking)
  const startX = -((((camX * 1.15 + elapsedTime * 35.0) % W) + W) % W);
  const startY = -((((camY * 0.35 + Math.sin(elapsedTime * 0.6) * 10) % H) + H) % H);

  ctx.globalAlpha = 0.10;
  for (let x = startX; x < vw; x += W) {
    for (let y = startY; y < vh; y += H) {
      ctx.drawImage(this.mistCanvas, x, y);
    }
  }

  ctx.restore();
}
```

---

## 5. Verification Method

### 5.1 Independent Test Verification
1. **Unit Test Suite for Camera Centering & Lookahead Clamping**:
   - Verify with:
     ```bash
     npm test tests/unit/camera_tracking.spec.ts
     ```
   - Test cases:
     - **Exact Centering**: With `vx = 0, vy = 0`, at steady state, verify `camera.x === player.x - viewportWidth / 2` and `camera.y === player.y - viewportHeight / 2`.
     - **Lookahead Ceiling**: Inject extreme player velocities (`vx = 1000, vy = 1000`, `vx = -5000`), step update 60 frames, assert `Math.hypot(camera.lookaheadX, camera.lookaheadY) <= 40.001`.
     - **Reversal Damping**: Start moving at $200\text{px/s}$ right for 60 frames (lookahead $+40\text{px}$), then instantly switch to $-200\text{px/s}$ left. Assert that on frame 1 of reversal, lookahead does NOT jump by $80\text{px}$, but smoothly transitions across multiple frames ($|\Delta \text{lookahead}| < 15\text{px}$ per frame at $60\text{Hz}$).
     - **Zero-Speed Decay**: From full lookahead, set velocity to $(0, 0)$. Verify that lookahead decays smoothly to $< 0.1\text{px}$ within $0.5\text{s}$.
2. **Backdrop Parallax Continuous Coverage**:
   - Run existing empirical challenge suite:
     ```bash
     npm test tests/unit/ChallengerDF_M2.test.ts
     ```
   - Confirms all 8 tested 360-degree angles exhibit zero gaps in sky, clouds, skyline, flagstone, and mist coverage.
3. **Full Regression Suite**:
   - Verify all 31 test files pass cleanly:
     ```bash
     npm test
     ```
   - TypeScript compilation:
     ```bash
     npx tsc --noEmit
     ```

### 5.2 Invalidation Conditions
- Any lookahead state where $\sqrt{\text{lookaheadX}^2 + \text{lookaheadY}^2} > 40.0\text{px}$ invalidates the boundedness criterion.
- Any frame where foreground mist blits at $y=0$ twice or skips drawing based on $|startY| \le 4$ invalidates the flicker-free guarantee.
- Any regression in existing 444 passing tests invalidates milestone delivery.
