/**
 * 2D Run-and-Gun Camera System.
 * Supports deadzone tracking, forward-only scrolling ratchet lock,
 * boss arena lockdown boundaries, and decaying screen shake trauma.
 */

import { Vector2D } from '../core/math/Vector2D';
import { AABB, BoundingBox } from '../core/physics/AABB';
import { CameraBounds } from '../core/engine/StageManager';

export interface CameraOptions {
  viewportWidth?: number;  // default 480
  viewportHeight?: number; // default 270
  forwardLock?: boolean;   // default true
  bounds?: CameraBounds;
  smoothSpeed?: number;    // lerp factor for smooth tracking (0 = instant, >0 = smooth)
}

export class Camera {
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;

  // Current camera world coordinates (top-left of viewport)
  public x: number = 0;
  public y: number = 0;

  // Render position including screen shake offset
  public renderX: number = 0;
  public renderY: number = 0;

  // Forward scrolling ratchet lock (Metal Slug arcade behavior)
  public forwardLock: boolean = true;
  private maxReachedX: number = 0;

  // Active stage boundaries
  public bounds: CameraBounds = {
    minX: 0,
    maxX: 2000,
    minY: 0,
    maxY: 270,
  };

  // Deadzone margins relative to viewport
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

  // Smooth camera following speed (0 for crisp lockstep)
  public smoothSpeed: number = 0;

  constructor(options: CameraOptions = {}) {
    this.viewportWidth = options.viewportWidth ?? 480;
    this.viewportHeight = options.viewportHeight ?? 270;
    this.forwardLock = options.forwardLock ?? true;
    this.smoothSpeed = options.smoothSpeed ?? 0;

    if (options.bounds) {
      this.bounds = { ...options.bounds };
    }

    // Default deadzone: target stays between 35% and 45% horizontally, 30% and 70% vertically
    this.deadzoneLeft = Math.floor(this.viewportWidth * 0.35);
    this.deadzoneRight = Math.floor(this.viewportWidth * 0.45);
    this.deadzoneTop = Math.floor(this.viewportHeight * 0.30);
    this.deadzoneBottom = Math.floor(this.viewportHeight * 0.70);
  }

  /**
   * Resets camera to a specific world position.
   */
  public reset(x: number = 0, y: number = 0): void {
    this.x = x;
    this.y = y;
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
   * Updates camera tracking against a target world point (e.g. player position).
   */
  public update(targetX: number, targetY: number, dt: number): void {
    let targetCamX = this.x;
    let targetCamY = this.y;

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

    // Apply smooth interpolation or crisp snapping
    if (this.smoothSpeed > 0 && dt > 0) {
      const t = Math.min(1, dt * this.smoothSpeed);
      this.x += (targetCamX - this.x) * t;
      this.y += (targetCamY - this.y) * t;
    } else {
      this.x = targetCamX;
      this.y = targetCamY;
    }

    // Enforce forward-only scrolling ratchet
    if (this.forwardLock) {
      if (this.x < this.maxReachedX) {
        this.x = this.maxReachedX;
      } else {
        this.maxReachedX = this.x;
      }
    }

    // Clamp inside current stage camera bounds
    this.clampToBounds();

    // Update screen shake decay
    this.updateShake(dt);

    // Compute final render coordinates
    this.renderX = Math.round(this.x + this.shakeOffsetX);
    this.renderY = Math.round(this.y + this.shakeOffsetY);
  }

  /**
   * Triggers a screen shake trauma effect.
   * @param intensity Max displacement in pixels
   * @param duration Duration in seconds
   */
  public shake(intensity: number, duration: number): void {
    if (intensity >= this.shakeIntensity) {
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
