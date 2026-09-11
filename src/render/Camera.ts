/**
 * 2D Omnidirectional Top-Down Camera System.
 * Milestone 2: Camera Overhaul & Cinematic Viewport Engine.
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
  viewportWidth?: number;  // default 960
  viewportHeight?: number; // default 540
  forwardLock?: boolean;   // default false
  bounds?: CameraBounds;
  smoothSpeed?: number;    // default 8.0 (exponential damping factor k)
  lookaheadMax?: number;   // default 40.0
  lookaheadSpeed?: number; // default 5.0
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

  // Velocity lookahead state (bounded <= 40px)
  public lookaheadX: number = 0;
  public lookaheadY: number = 0;
  public readonly lookaheadMax: number;
  public readonly lookaheadSpeed: number;

  // Forward scrolling ratchet lock (Metal Slug legacy behavior, default false for top-down)
  public forwardLock: boolean = false;
  private maxReachedX: number = 0;

  // Active stage boundaries (default dark fantasy arena -2000..2000)
  public bounds: CameraBounds = {
    minX: -2000,
    maxX: 2000,
    minY: -2000,
    maxY: 2000,
  };

  // Symmetrical center deadzone references preserved for legacy inspection
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

  // Smooth camera following damping coefficient k (default 8.0)
  public smoothSpeed: number = 8.0;

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

    // Symmetrical centered references
    this.deadzoneLeft = Math.floor(this.viewportWidth * 0.5);
    this.deadzoneRight = Math.floor(this.viewportWidth * 0.5);
    this.deadzoneTop = Math.floor(this.viewportHeight * 0.5);
    this.deadzoneBottom = Math.floor(this.viewportHeight * 0.5);
  }

  /**
   * Resets camera to a specific world position and zeroes all screen shake state.
   */
  public reset(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
    this.lookaheadX = 0;
    this.lookaheadY = 0;
    this.maxReachedX = x;
    this.clampToBounds();
    this.renderX = Math.round(this.x);
    this.renderY = Math.round(this.y);
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
  }

  /**
   * Immediately centers camera on a target world coordinate without damping delay.
   */
  public centerOn(targetX: number, targetY: number): void {
    this.x = targetX - this.viewportWidth / 2;
    this.y = targetY - this.viewportHeight / 2;
    this.lookaheadX = 0;
    this.lookaheadY = 0;
    this.clampToBounds();
    this.renderX = Math.round(this.x);
    this.renderY = Math.round(this.y);
  }

  /**
   * Computes subtle velocity lookahead vector clamped to lookaheadMax.
   */
  public computeLookahead(vx: number, vy: number): { x: number; y: number } {
    const speed = Math.hypot(vx, vy);
    if (speed <= 0.01) {
      return { x: 0, y: 0 };
    }
    const leadDist = Math.min(this.lookaheadMax, speed * 0.20);
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
    vx: number = 0,
    vy: number = 0
  ): void {
    // 1. Calculate target velocity lookahead vector (bounded to <= lookaheadMax)
    const targetLook = this.computeLookahead(vx, vy);

    // 2. Smoothly damp lookahead offset with k = lookaheadSpeed (5.0) to prevent snapping on reversal or stop
    if (this.lookaheadSpeed > 0 && dt > 0) {
      const lookaheadAlpha = 1 - Math.exp(-this.lookaheadSpeed * dt);
      this.lookaheadX += (targetLook.x - this.lookaheadX) * lookaheadAlpha;
      this.lookaheadY += (targetLook.y - this.lookaheadY) * lookaheadAlpha;
    } else {
      this.lookaheadX = targetLook.x;
      this.lookaheadY = targetLook.y;
    }

    // 3. Ideal centered target camera position (top-left of viewport)
    const idealTargetX = targetX - this.viewportWidth / 2 + this.lookaheadX;
    const idealTargetY = targetY - this.viewportHeight / 2 + this.lookaheadY;

    // 4. Clamp ideal target to world boundaries (guarantees smooth deceleration at edges)
    const minClampX = this.bounds.minX;
    const maxClampX = Math.max(this.bounds.minX, this.bounds.maxX - this.viewportWidth);
    const minClampY = this.bounds.minY;
    const maxClampY = Math.max(this.bounds.minY, this.bounds.maxY - this.viewportHeight);

    const clampedTargetX = Math.max(minClampX, Math.min(maxClampX, idealTargetX));
    const clampedTargetY = Math.max(minClampY, Math.min(maxClampY, idealTargetY));

    // 5. Exponential damping filter (k = 8.0): current += (target - current) * (1 - exp(-k * dt))
    if (this.smoothSpeed > 0 && dt > 0) {
      const alpha = 1 - Math.exp(-this.smoothSpeed * dt);
      this.x += (clampedTargetX - this.x) * alpha;
      this.y += (clampedTargetY - this.y) * alpha;
    } else {
      this.x = clampedTargetX;
      this.y = clampedTargetY;
    }

    // 6. Optional forward-only scrolling ratchet (if explicitly enabled)
    if (this.forwardLock) {
      if (this.x < this.maxReachedX) {
        this.x = this.maxReachedX;
      } else {
        this.maxReachedX = this.x;
      }
    }

    // 7. Enforce boundary clamp invariant
    this.clampToBounds();

    // 8. Update screen shake decay
    this.updateShake(dt);

    // 9. Final integer render coordinates with additive decoupled shake offsets
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

  /**
   * Locks the camera to a specific arena boundary (e.g. Mid-Boss or Boss arena).
   */
  public lock(bounds: CameraBounds): void {
    this.bounds = { ...bounds };
    this.clampToBounds();
  }

  /**
   * Unlocks the camera, optionally extending the maximum horizontal boundary.
   */
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

  /**
   * Converts world space coordinates to viewport screen space coordinates.
   */
  public worldToScreen(worldX: number, worldY: number): Vector2D {
    return {
      x: worldX - this.renderX,
      y: worldY - this.renderY,
    };
  }

  /**
   * Converts viewport screen coordinates to world space coordinates.
   */
  public screenToWorld(screenX: number, screenY: number): Vector2D {
    return {
      x: screenX + this.renderX,
      y: screenY + this.renderY,
    };
  }

  /**
   * Culls entities outside the camera's active view frustum.
   */
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

