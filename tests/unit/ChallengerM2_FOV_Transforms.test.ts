/**
 * tests/unit/ChallengerM2_FOV_Transforms.test.ts
 *
 * Empirical Adversarial Challenger Test Suite: Milestone 2 Camera FOV & Coordinate Systems
 * Agent: challenger_m2_fov_1 (teamwork_preview_challenger)
 *
 * Objectives:
 * 1. Coordinate round-trip precision: screenToWorld(worldToScreen(x, y)) across 10,000 random floating point world positions (residual error < 1e-9).
 * 2. Bounds clamping at map extents: camera view rectangle [camX, camX + viewW] x [camY, camY + viewH] never crosses bounds.minX/maxX or bounds.minY/maxY.
 * 3. Dynamic zoom transitions: test numerical stability against zero, negative, NaN zoom factors, and rapid scaling.
 * 4. Screen shake interaction: verify screen shake offsets do not violate coordinate bijective inverses.
 * 5. Viewport extents and off-screen spawn margin invariants.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Camera, CameraBounds } from '../../src/render/Camera';
import { AABB } from '../../src/core/physics/AABB';

describe('Empirical Challenger Suite: Milestone 2 Camera FOV & Coordinate Systems (challenger_m2_fov_1)', () => {
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
      zoom: 0.80,
      bounds: defaultBounds,
      smoothSpeed: 8.0,
      lookaheadMax: 40.0,
      lookaheadSpeed: 5.0,
    });
  });

  // =========================================================================
  // Challenge 1: Coordinate Round-Trip Precision Stress (10,000+ Random Points)
  // =========================================================================
  describe('Challenge 1: Coordinate Round-Trip Precision (10,000 Floating-Point Points)', () => {
    it('achieves residual error < 1e-9 across 10,000 random floating-point world positions within arena', () => {
      camera.reset(-345.67, 123.45);
      const SAMPLE_COUNT = 10000;
      let maxResidualError = 0;
      let totalResidualError = 0;

      // Seedable-like pseudo-random generator for determinism
      let seed = 42;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        // Random world coordinates in range [-3000.0, 3000.0] with high precision fractions
        const wx = (pseudoRandom() * 6000 - 3000) * 1.000000012345;
        const wy = (pseudoRandom() * 6000 - 3000) * 1.000000054321;

        const screen = camera.worldToScreen(wx, wy);
        const reconstructed = camera.screenToWorld(screen.x, screen.y);

        const errX = Math.abs(reconstructed.x - wx);
        const errY = Math.abs(reconstructed.y - wy);
        const pointMaxErr = Math.max(errX, errY);

        if (pointMaxErr > maxResidualError) {
          maxResidualError = pointMaxErr;
        }
        totalResidualError += pointMaxErr;

        // Invariant: Every individual point must have residual error < 1e-9
        expect(errX).toBeLessThan(1e-9);
        expect(errY).toBeLessThan(1e-9);
      }

      const avgResidualError = totalResidualError / SAMPLE_COUNT;
      console.log(
        `[Challenger M2 FOV] 10,000 Round-Trip Stress: Max Error = ${maxResidualError.toExponential(4)}, Avg Error = ${avgResidualError.toExponential(4)}`
      );

      expect(maxResidualError).toBeLessThan(1e-9);
    });

    it('preserves residual error < 1e-9 under extreme world coordinates ([-1e6, 1e6])', () => {
      camera.reset(50000, -25000);
      const extremePoints = [
        { wx: -1000000.5, wy: -1000000.25 },
        { wx: 1000000.75, wy: 1000000.125 },
        { wx: -543210.98765, wy: 987654.32109 },
        { wx: 0.000000001, wy: -0.000000001 },
        { wx: Math.PI * 1000, wy: Math.E * 1000 },
        { wx: 1 / 3, wy: 2 / 3 },
      ];

      for (const pt of extremePoints) {
        const screen = camera.worldToScreen(pt.wx, pt.wy);
        const reconstructed = camera.screenToWorld(screen.x, screen.y);

        const errX = Math.abs(reconstructed.x - pt.wx);
        const errY = Math.abs(reconstructed.y - pt.wy);

        expect(errX).toBeLessThan(1e-9);
        expect(errY).toBeLessThan(1e-9);
      }
    });

    it('verifies inverse bijective round-trip: worldToScreen(screenToWorld(sx, sy)) across 10,000 points', () => {
      camera.reset(100, 200);
      const SAMPLE_COUNT = 10000;
      let maxError = 0;

      let seed = 12345;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        // Screen space coordinates ranging from -1920 to +1920
        const sx = (pseudoRandom() * 3840 - 1920);
        const sy = (pseudoRandom() * 2160 - 1080);

        const world = camera.screenToWorld(sx, sy);
        const reconstructedScreen = camera.worldToScreen(world.x, world.y);

        const errX = Math.abs(reconstructedScreen.x - sx);
        const errY = Math.abs(reconstructedScreen.y - sy);
        const err = Math.max(errX, errY);

        if (err > maxError) {
          maxError = err;
        }

        expect(errX).toBeLessThan(1e-9);
        expect(errY).toBeLessThan(1e-9);
      }

      expect(maxError).toBeLessThan(1e-9);
    });
  });

  // =========================================================================
  // Challenge 2: Bounds Clamping at Map Extents Invariant
  // =========================================================================
  describe('Challenge 2: Bounds Clamping at Map Extents Invariant', () => {
    it('ensures camera view rectangle [x, x + viewW] x [y, y + viewH] NEVER crosses bounds across 1,000 random targets', () => {
      const viewW = camera.viewWidth;   // 1200
      const viewH = camera.viewHeight;  // 675
      const b = camera.bounds;          // [-2000, 2000] x [-2000, 2000]

      expect(viewW).toBe(1200);
      expect(viewH).toBe(675);

      let seed = 999;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      let boundaryViolations = 0;

      for (let i = 0; i < 1000; i++) {
        // Target points intentionally distributed both inside and far outside the bounds
        const targetX = pseudoRandom() * 20000 - 10000; // [-10000, 10000]
        const targetY = pseudoRandom() * 20000 - 10000;

        // Reset or step towards target
        camera.update(targetX, targetY, 0.1, 0, 0);

        const left = camera.x;
        const right = camera.x + viewW;
        const top = camera.y;
        const bottom = camera.y + viewH;

        // Strict boundary assertions:
        if (left < b.minX - 1e-9) boundaryViolations++;
        if (right > b.maxX + 1e-9) boundaryViolations++;
        if (top < b.minY - 1e-9) boundaryViolations++;
        if (bottom > b.maxY + 1e-9) boundaryViolations++;

        expect(left).toBeGreaterThanOrEqual(b.minX - 1e-9);
        expect(right).toBeLessThanOrEqual(b.maxX + 1e-9);
        expect(top).toBeGreaterThanOrEqual(b.minY - 1e-9);
        expect(bottom).toBeLessThanOrEqual(b.maxY + 1e-9);
      }

      expect(boundaryViolations).toBe(0);
    });

    it('prevents view rectangle boundary crossing under extreme directional velocities (100,000 px/s)', () => {
      const viewW = camera.viewWidth;
      const viewH = camera.viewHeight;
      const b = camera.bounds;

      const directions = [
        { vx: 100000, vy: 0, desc: 'East' },
        { vx: -100000, vy: 0, desc: 'West' },
        { vx: 0, vy: 100000, desc: 'South' },
        { vx: 0, vy: -100000, desc: 'North' },
        { vx: 100000, vy: 100000, desc: 'South-East' },
        { vx: -100000, vy: 100000, desc: 'South-West' },
        { vx: 100000, vy: -100000, desc: 'North-East' },
        { vx: -100000, vy: -100000, desc: 'North-West' },
      ];

      for (const dir of directions) {
        camera.reset(0, 0);
        // Simulate 60 frames of extreme velocity pushing against the boundary
        for (let frame = 0; frame < 60; frame++) {
          camera.update(dir.vx, dir.vy, 1 / 60, dir.vx, dir.vy);

          expect(camera.x).toBeGreaterThanOrEqual(b.minX - 1e-9);
          expect(camera.x + viewW).toBeLessThanOrEqual(b.maxX + 1e-9);
          expect(camera.y).toBeGreaterThanOrEqual(b.minY - 1e-9);
          expect(camera.y + viewH).toBeLessThanOrEqual(b.maxY + 1e-9);
        }
      }
    });

    it('confirms maximum clamped positions equal exactly maxX - viewWidth and maxY - viewHeight', () => {
      camera.reset(0, 0);
      // Run player to +Infinity
      for (let i = 0; i < 120; i++) {
        camera.update(50000, 50000, 1 / 60, 0, 0);
      }

      const expectedMaxX = defaultBounds.maxX - camera.viewWidth;   // 2000 - 1200 = 800
      const expectedMaxY = defaultBounds.maxY - camera.viewHeight;  // 2000 - 675 = 1325

      expect(camera.x).toBeCloseTo(expectedMaxX, 3);
      expect(camera.y).toBeCloseTo(expectedMaxY, 3);
      expect(camera.x + camera.viewWidth).toBeCloseTo(defaultBounds.maxX, 3);
      expect(camera.y + camera.viewHeight).toBeCloseTo(defaultBounds.maxY, 3);

      // Run player to -Infinity
      for (let i = 0; i < 120; i++) {
        camera.update(-50000, -50000, 1 / 60, 0, 0);
      }

      expect(camera.x).toBeCloseTo(defaultBounds.minX, 3); // -2000
      expect(camera.y).toBeCloseTo(defaultBounds.minY, 3); // -2000
    });

    it('gracefully handles boundary lockdown when arena size is smaller than visible FOV', () => {
      // Challenging edge case: arena smaller than camera viewWidth (e.g. 1000x500 < 1200x675)
      const smallBounds: CameraBounds = {
        minX: 0,
        maxX: 1000,
        minY: 0,
        maxY: 500,
      };

      camera.lock(smallBounds);

      // Camera clamp uses Math.max(minClampX, maxX - viewW), which clamps to minX when maxX - viewW < minX
      camera.update(500, 250, 1 / 60, 0, 0);

      expect(camera.x).toBe(0);
      expect(camera.y).toBe(0);
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
      expect(Number.isNaN(camera.x)).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: Dynamic Zoom Transitions & Numerical Stability
  // =========================================================================
  describe('Challenge 3: Dynamic Zoom Transitions & Numerical Stability', () => {
    it('maintains bijective precision across diverse valid zoom factors (0.25 to 4.0)', () => {
      const zoomFactors = [0.25, 0.50, 0.75, 0.80, 1.00, 1.25, 1.50, 2.00, 3.00, 4.00];

      for (const z of zoomFactors) {
        camera.zoom = z;

        expect(camera.viewWidth).toBeCloseTo(W / z, 6);
        expect(camera.viewHeight).toBeCloseTo(H / z, 6);

        // Test round trip with 500 points at this zoom level
        for (let i = 0; i < 500; i++) {
          const wx = (Math.random() - 0.5) * 2000;
          const wy = (Math.random() - 0.5) * 2000;

          const screen = camera.worldToScreen(wx, wy);
          const reconstructed = camera.screenToWorld(screen.x, screen.y);

          expect(Math.abs(reconstructed.x - wx)).toBeLessThan(1e-9);
          expect(Math.abs(reconstructed.y - wy)).toBeLessThan(1e-9);
        }
      }
    });

    it('empirically maps and analyzes numerical behavior on pathological zoom factors (0, negative, NaN)', () => {
      // 1. Zero zoom:
      camera.zoom = 0;
      expect(camera.viewWidth).toBe(Infinity);
      expect(camera.viewHeight).toBe(Infinity);

      const screenAtZero = camera.worldToScreen(100, 100);
      expect(screenAtZero.x).toBe(0);
      expect(screenAtZero.y).toBe(0);

      const worldAtZero = camera.screenToWorld(100, 100);
      expect(worldAtZero.x).toBe(Infinity);
      expect(worldAtZero.y).toBe(Infinity);

      // 2. Negative zoom:
      camera.zoom = -0.80;
      expect(camera.viewWidth).toBe(-1200);
      expect(camera.viewHeight).toBe(-675);
      // Inverts screen coordinates
      const screenNegative = camera.worldToScreen(camera.renderX + 100, camera.renderY + 100);
      expect(screenNegative.x).toBeCloseTo(-80, 2);

      // 3. NaN zoom:
      camera.zoom = NaN;
      expect(Number.isNaN(camera.viewWidth)).toBe(true);
      expect(Number.isNaN(camera.viewHeight)).toBe(true);
      const screenNaN = camera.worldToScreen(100, 100);
      expect(Number.isNaN(screenNaN.x)).toBe(true);
      expect(Number.isNaN(screenNaN.y)).toBe(true);

      // Restore zoom to baseline
      camera.zoom = 0.80;
      expect(camera.viewWidth).toBe(1200);
      expect(camera.viewHeight).toBe(675);
    });

    it('preserves continuity during continuous dynamic zoom interpolation (0.50 -> 1.50 -> 0.80)', () => {
      camera.reset(0, 0);
      const steps = 120;
      const startZoom = 0.50;
      const targetZoom = 1.50;

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // Smooth sine interpolation of zoom
        camera.zoom = startZoom + (targetZoom - startZoom) * (0.5 - 0.5 * Math.cos(t * Math.PI));

        expect(camera.zoom).toBeGreaterThanOrEqual(0.50);
        expect(camera.zoom).toBeLessThanOrEqual(1.50);
        expect(Number.isFinite(camera.viewWidth)).toBe(true);
        expect(Number.isFinite(camera.viewHeight)).toBe(true);

        const s = camera.worldToScreen(50, 50);
        const w = camera.screenToWorld(s.x, s.y);
        expect(Math.abs(w.x - 50)).toBeLessThan(1e-9);
        expect(Math.abs(w.y - 50)).toBeLessThan(1e-9);
      }
    });
  });

  // =========================================================================
  // Challenge 4: Screen Shake Interaction with Coordinate Bijections
  // =========================================================================
  describe('Challenge 4: Screen Shake Interaction & Bijective Inverses', () => {
    it('empirically proves screen shake offsets NEVER violate coordinate bijective inverses across 10,000 points', () => {
      camera.reset(0, 0);
      // Trigger massive trauma
      camera.shake(100, 2.0);

      // Advance one tick so shake offsets are generated and non-zero
      camera.update(0, 0, 1 / 60, 0, 0);

      expect(camera.shakeTimer).toBeGreaterThan(0);
      expect(camera.shakeIntensity).toBe(100);

      // Verify that shake offsets are active
      const shakeActive = camera.shakeOffsetX !== 0 || camera.shakeOffsetY !== 0;
      expect(shakeActive).toBe(true);

      const SAMPLE_COUNT = 10000;
      let maxError = 0;

      for (let i = 0; i < SAMPLE_COUNT; i++) {
        const wx = (Math.random() - 0.5) * 5000;
        const wy = (Math.random() - 0.5) * 5000;

        const screen = camera.worldToScreen(wx, wy);
        const reconstructed = camera.screenToWorld(screen.x, screen.y);

        const errX = Math.abs(reconstructed.x - wx);
        const errY = Math.abs(reconstructed.y - wy);
        const err = Math.max(errX, errY);

        if (err > maxError) {
          maxError = err;
        }

        expect(errX).toBeLessThan(1e-9);
        expect(errY).toBeLessThan(1e-9);
      }

      console.log(
        `[Challenger M2 FOV] Active Screen Shake Bijective Round-Trip Error: ${maxError.toExponential(4)} (offsets: dx=${camera.shakeOffsetX.toFixed(2)}, dy=${camera.shakeOffsetY.toFixed(2)})`
      );

      expect(maxError).toBeLessThan(1e-9);
    });

    it('maintains continuous bijective round-trips over 120 frames of active shake and player motion', () => {
      camera.reset(0, 0);
      camera.shake(60, 2.0);

      let px = 0;
      let py = 0;
      const dt = 1 / 60;

      for (let frame = 0; frame < 120; frame++) {
        px += 5;
        py += 3;
        camera.update(px, py, dt, 300, 180);

        // Every frame, verify 50 points under varying shake offset
        for (let j = 0; j < 50; j++) {
          const testWx = px + (j - 25) * 20;
          const testWy = py + (j - 25) * 15;

          const screen = camera.worldToScreen(testWx, testWy);
          const world = camera.screenToWorld(screen.x, screen.y);

          expect(Math.abs(world.x - testWx)).toBeLessThan(1e-9);
          expect(Math.abs(world.y - testWy)).toBeLessThan(1e-9);
        }
      }
    });

    it('confirms screen shake affects renderX/renderY additively with zero drift in base coordinates x/y', () => {
      const px = 0;
      const py = 0;
      camera.centerOn(px, py);
      const initialX = camera.x;
      const initialY = camera.y;

      camera.shake(50, 0.5);

      // Advance with stationary player at (0, 0)
      for (let frame = 0; frame < 60; frame++) {
        camera.update(px, py, 1 / 60, 0, 0);
      }

      // After shake completes (1.0s > 0.5s)
      expect(camera.shakeTimer).toBe(0);
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);

      // Base coordinates and render coordinates must be exactly equal to initial (within damping convergence)
      expect(camera.x).toBeCloseTo(initialX, 2);
      expect(camera.y).toBeCloseTo(initialY, 2);
      expect(camera.renderX).toBe(Math.round(camera.x));
      expect(camera.renderY).toBe(Math.round(camera.y));
    });
  });

  // =========================================================================
  // Challenge 5: Viewport Extents & Off-Screen Spawn Invariants
  // =========================================================================
  describe('Challenge 5: Viewport Extents & Off-Screen Spawn Invariants', () => {
    it('verifies exact view area ratio is +56.25% (1.5625x) over legacy 960x540', () => {
      const legacyArea = 960 * 540;
      const widenedArea = camera.viewWidth * camera.viewHeight;
      const ratio = widenedArea / legacyArea;

      expect(camera.viewWidth).toBe(1200);
      expect(camera.viewHeight).toBe(675);
      expect(widenedArea).toBe(810000);
      expect(ratio).toBe(1.5625);
    });

    it('mathematically asserts spawn ring radius 800px has >= 111.5px safety buffer beyond viewport corner', () => {
      const halfW = camera.viewWidth / 2;   // 600
      const halfH = camera.viewHeight / 2;  // 337.5
      const cornerDistance = Math.hypot(halfW, halfH); // sqrt(600^2 + 337.5^2) = 688.40849...

      const spawnRingRadius = 800;
      const buffer = spawnRingRadius - cornerDistance;

      expect(cornerDistance).toBeCloseTo(688.41, 1);
      expect(buffer).toBeGreaterThan(111.5);
      expect(buffer).toBeLessThan(112.0);

      // Assert that ANY point generated at distance 800 from camera center is strictly outside view frustum
      camera.reset(0, 0);
      for (let deg = 0; deg < 360; deg += 5) {
        const rad = (deg * Math.PI) / 180;
        const spawnX = camera.x + halfW + Math.cos(rad) * spawnRingRadius;
        const spawnY = camera.y + halfH + Math.sin(rad) * spawnRingRadius;

        const box: AABB = {
          x: spawnX - 16,
          y: spawnY - 16,
          width: 32,
          height: 32,
        };

        // Must NOT be visible inside camera view frustum
        expect(camera.isVisible(box)).toBe(false);
      }
    });

    it('verifies entities inside widened view [960, 1200] are visible and entities outside 1200 are culled', () => {
      camera.reset(0, 0);

      // Entity at x = 1100 (in between 960 and 1200)
      const insideWidened: AABB = { x: 1100, y: 300, width: 32, height: 32 };
      expect(camera.isVisible(insideWidened)).toBe(true);

      // Entity at x = 1250 (outside 1200)
      const outsideWidened: AABB = { x: 1250, y: 300, width: 32, height: 32 };
      expect(camera.isVisible(outsideWidened)).toBe(false);

      // Entity at y = 600 (in between 540 and 675)
      const insideWidenedY: AABB = { x: 500, y: 600, width: 32, height: 32 };
      expect(camera.isVisible(insideWidenedY)).toBe(true);

      // Entity at y = 700 (outside 675)
      const outsideWidenedY: AABB = { x: 500, y: 700, width: 32, height: 32 };
      expect(camera.isVisible(outsideWidenedY)).toBe(false);
    });
  });
});
