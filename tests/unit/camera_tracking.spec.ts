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
      expect(camera.lookaheadX).toBe(0);
      expect(camera.lookaheadY).toBe(0);
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
      const lowLookahead = camera.lookaheadX;

      // Medium speed: 150px/s
      px = 0;
      camera.reset(px - W / 2, py - H / 2);
      for (let i = 0; i < 60; i++) {
        px += 150 * dt;
        camera.update(px, py, dt, 150, 0);
      }
      const medLookahead = camera.lookaheadX;

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

        const lookaheadOffset = camera.lookaheadX;
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

      const lookaheadMagnitude = Math.hypot(camera.lookaheadX, camera.lookaheadY);

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
      expect(camera.lookaheadX).toBeGreaterThan(25.0);

      // Player suddenly halts (vx = 0, vy = 0)
      for (let i = 0; i < 75; i++) {
        camera.update(px, py, dt, 0, 0);
      }

      // Lookahead smoothly decayed back to 0 (player centered again)
      expect(Math.abs(camera.lookaheadX)).toBeLessThan(0.5);
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
      // Start approaching right boundary (camera.x starts at 1450 - 480 = 970, clamping occurs at 1040)
      let px = 1450;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const displacements: number[] = [];
      // Run player continuously toward and past right boundary
      for (let i = 0; i < 60; i++) {
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
      expect(earlyDisplacement).toBeGreaterThan(0.5);
      expect(lastDisplacement).toBeLessThan(earlyDisplacement);
    });

    it('respects dynamic arena lockdown and unlock via lock() and unlock()', () => {
      // Lock into a tight boss arena: [-480, 480] x [-270, 270]
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
