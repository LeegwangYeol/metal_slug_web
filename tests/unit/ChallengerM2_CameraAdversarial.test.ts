/**
 * tests/unit/ChallengerM2_CameraAdversarial.test.ts
 *
 * Empirical Adversarial Challenger Test Suite: Milestone 2 (Camera Overhaul & Cinematic Viewport Engine)
 * Agent: Challenger 1 (Agent 15)
 *
 * Purpose:
 * Stress-test, challenge assumptions, and empirically verify the camera engine and viewport boundaries:
 * 1. High-frequency direction flipping (rapid 180° reversals, zig-zags, irregular oscillations, circular orbits).
 * 2. Velocity lookahead boundary stress (extreme player velocities up to 100,000 px/s, omnidirectional 360° clamp <= 40px, sudden halt decay).
 * 3. Stage boundary clamping (-2000 to +2000, zero empty void rendering, smooth deceleration, outward velocity lookahead clamping, dynamic arena locking).
 * 4. Variable frame rate / delta time extremes (144Hz, 60Hz, 30Hz invariance, lag spike dt = 0.5s..5.0s, micro-stepping dt = 0.0001s, zero dt, erratic delta series).
 * 5. Screen shake trauma decay and strict base coordinate decoupling (quadratic decay, zero residual drift, continuous barrage stress).
 * 6. Frustum culling and coordinate transformation round-trips under extreme coordinates.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Camera, CameraBounds } from '../../src/render/Camera';
import { AABB } from '../../src/core/physics/AABB';

describe('Empirical Challenger Suite: Milestone 2 Camera & Viewport Engine', () => {
  let camera: Camera;
  const W = 960;
  const H = 540;
  const stageBounds: CameraBounds = {
    minX: -2000,
    maxX: 2000,
    minY: -2000,
    maxY: 2000,
  };

  beforeEach(() => {
    camera = new Camera({
      viewportWidth: W,
      viewportHeight: H,
      zoom: 1.0,
      bounds: stageBounds,
      smoothSpeed: 8.0,
      lookaheadMax: 40.0,
      lookaheadSpeed: 5.0,
      forwardLock: false,
    });
  });

  // =========================================================================
  // Challenge 1: High-Frequency Direction Flipping (Rapid 180° Reversals)
  // =========================================================================
  describe('Challenge 1: High-Frequency Direction Flipping & Damping Continuity', () => {
    it('handles 1-frame alternating 180° reversals (+400px/s to -400px/s at 60Hz) with bounded jerk and zero snapping', () => {
      let px = 0;
      const py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const dt = 1 / 60;
      const speed = 400; // 400 px/s
      const frameDeltas: number[] = [];
      const jerks: number[] = [];

      // Alternate direction every single frame for 120 frames (2 seconds of 60Hz jitter)
      for (let i = 0; i < 120; i++) {
        const prevX = camera.x;
        const direction = i % 2 === 0 ? 1 : -1;
        const vx = direction * speed;
        px += vx * dt;

        camera.update(px, py, dt, vx, 0);

        const delta = camera.x - prevX;
        frameDeltas.push(delta);

        if (frameDeltas.length > 1) {
          const jerk = Math.abs(delta - frameDeltas[frameDeltas.length - 2]);
          jerks.push(jerk);
        }
      }

      // 1. Zero snapping: max displacement in any single frame must be < 10px
      for (const delta of frameDeltas) {
        expect(Math.abs(delta)).toBeLessThan(10.0);
      }

      // 2. Continuous-time damping: acceleration change (jerk) between consecutive frames must be bounded (< 4.0px)
      for (const jerk of jerks) {
        expect(jerk).toBeLessThan(4.0);
      }

      // 3. Camera remains centered around origin (player oscillates between 0 and ~6.67px)
      expect(Math.abs(camera.x - (0 - W / 2))).toBeLessThan(15.0);

      // 4. Coordinates remain completely finite
      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
    });

    it('maintains smooth C1 continuity under irregular, asymmetric velocity flip bursts', () => {
      let px = 0;
      let py = 0;
      camera.reset(px - W / 2, py - H / 2);

      const dt = 1 / 60;
      // Irregular burst pattern of directions and durations
      const bursts = [
        { vx: 350, vy: 0, frames: 3 },
        { vx: -350, vy: 0, frames: 5 },
        { vx: 0, vy: 350, frames: 2 },
        { vx: 0, vy: -350, frames: 4 },
        { vx: -250, vy: 250, frames: 6 },
        { vx: 250, vy: -250, frames: 7 },
        { vx: 400, vy: 0, frames: 1 },
        { vx: -400, vy: 0, frames: 2 },
      ];

      const maxDeltas: number[] = [];

      for (const burst of bursts) {
        for (let f = 0; f < burst.frames; f++) {
          const prevX = camera.x;
          const prevY = camera.y;

          px += burst.vx * dt;
          py += burst.vy * dt;
          camera.update(px, py, dt, burst.vx, burst.vy);

          const stepDist = Math.hypot(camera.x - prevX, camera.y - prevY);
          maxDeltas.push(stepDist);
        }
      }

      // Every frame step must be smooth, without tele-porting or discontinuity
      for (const step of maxDeltas) {
        expect(step).toBeLessThan(15.0);
      }

      expect(Number.isFinite(camera.x)).toBe(true);
      expect(Number.isFinite(camera.y)).toBe(true);
    });

    it('smoothly follows high-speed circular orbit (5 rev/s, 400px/s) without phase divergence or oscillation explosion', () => {
      camera.reset(0 - W / 2, 0 - H / 2);
      const radius = 50;
      const omega = 10 * Math.PI; // 5 revolutions per second
      const dt = 1 / 60;

      for (let frame = 0; frame < 180; frame++) {
        const t = frame * dt;
        const px = radius * Math.cos(omega * t);
        const py = radius * Math.sin(omega * t);
        const vx = -radius * omega * Math.sin(omega * t);
        const vy = radius * omega * Math.cos(omega * t);

        camera.update(px, py, dt, vx, vy);

        // Camera center should remain in the vicinity of the orbit center (0, 0)
        const camCenterX = camera.x + W / 2;
        const camCenterY = camera.y + H / 2;
        const centerOffset = Math.hypot(camCenterX, camCenterY);

        // Max orbit radius + max lookahead = 50 + 40 = 90. Camera center must not diverge beyond 90px
        expect(centerOffset).toBeLessThan(90.0);
        expect(Number.isFinite(camera.x)).toBe(true);
        expect(Number.isFinite(camera.y)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Challenge 2: Velocity Lookahead Boundary Stress & Extreme Velocities
  // =========================================================================
  describe('Challenge 2: Velocity Lookahead Boundary Stress & Invariants', () => {
    it('asserts that lookahead NEVER exceeds 40.0px under extreme player velocities (500, 2000, 10000, 100000 px/s)', () => {
      const extremeSpeeds = [500, 2000, 10000, 100000];
      const dt = 1 / 60;

      for (const speed of extremeSpeeds) {
        // Test along +X
        let targetLook = camera.computeLookahead(speed, 0);
        expect(targetLook.x).toBeCloseTo(40.0, 4);
        expect(targetLook.y).toBe(0);

        // Test along -X
        targetLook = camera.computeLookahead(-speed, 0);
        expect(targetLook.x).toBeCloseTo(-40.0, 4);
        expect(targetLook.y).toBe(0);

        // Test along +Y
        targetLook = camera.computeLookahead(0, speed);
        expect(targetLook.x).toBe(0);
        expect(targetLook.y).toBeCloseTo(40.0, 4);

        // Test along -Y
        targetLook = camera.computeLookahead(0, -speed);
        expect(targetLook.x).toBe(0);
        expect(targetLook.y).toBeCloseTo(-40.0, 4);

        // Simulate multi-frame tracking at extreme speed
        camera.reset(0, 0);
        let px = 0;
        for (let f = 0; f < 60; f++) {
          px += speed * dt;
          camera.update(px, 0, dt, speed, 0);
          expect(camera.lookaheadX).toBeLessThanOrEqual(40.0001);
          expect(camera.lookaheadY).toBeLessThanOrEqual(40.0001);
        }
      }
    });

    it('empirically asserts 2D Euclidean norm of lookahead is <= 40.0px across all 360 degree angles at 50,000 px/s', () => {
      const extremeSpeed = 50000;
      const dt = 1 / 60;

      // Sweep 360 angles in 1-degree increments
      for (let deg = 0; deg < 360; deg += 1) {
        const rad = (deg * Math.PI) / 180;
        const vx = extremeSpeed * Math.cos(rad);
        const vy = extremeSpeed * Math.sin(rad);

        const look = camera.computeLookahead(vx, vy);
        const magnitude = Math.hypot(look.x, look.y);

        // Invariant: Euclidean norm strictly bounded by lookaheadMax (40.0)
        expect(magnitude).toBeLessThanOrEqual(40.00001);
        expect(magnitude).toBeGreaterThanOrEqual(39.99999);

        // Also test through update step
        camera.reset(0, 0);
        camera.update(0, 0, dt, vx, vy);
        const stateMag = Math.hypot(camera.lookaheadX, camera.lookaheadY);
        expect(stateMag).toBeLessThanOrEqual(40.00001);
      }
    });

    it('strictly damps lookahead to 0 without negative overshoot when player halts from 2000 px/s', () => {
      const dt = 1 / 60;
      let px = 0;
      camera.reset(px - W / 2, 0 - H / 2);

      // Build up max lookahead at 2000 px/s
      for (let f = 0; f < 60; f++) {
        px += 2000 * dt;
        camera.update(px, 0, dt, 2000, 0);
      }
      expect(camera.lookaheadX).toBeGreaterThan(39.0);

      // Sudden halt: vx = 0, vy = 0
      let prevLookahead = camera.lookaheadX;
      for (let f = 0; f < 90; f++) {
        camera.update(px, 0, dt, 0, 0);

        // Monotonic decay towards zero: lookaheadX must decrease and NEVER become negative
        expect(camera.lookaheadX).toBeLessThanOrEqual(prevLookahead + 1e-6);
        expect(camera.lookaheadX).toBeGreaterThanOrEqual(-1e-6);

        prevLookahead = camera.lookaheadX;
      }

      // Final lookahead offset after 90 frames (1.5s): e^(-5 * 1.5) = e^(-7.5) ~ 0.00055 => ~0.02px
      expect(camera.lookaheadX).toBeLessThan(0.05);
      expect(camera.lookaheadY).toBe(0);
    });

    it('safely handles sub-threshold tiny velocities (speed <= 0.01 px/s) without NaN or division by zero', () => {
      const tinyVelocities = [
        { vx: 0, vy: 0 },
        { vx: 0.001, vy: 0 },
        { vx: 0, vy: 0.005 },
        { vx: 0.007, vy: 0.007 },
        { vx: -0.009, vy: 0 },
      ];

      for (const { vx, vy } of tinyVelocities) {
        const look = camera.computeLookahead(vx, vy);
        expect(look.x).toBe(0);
        expect(look.y).toBe(0);
        expect(Number.isNaN(look.x)).toBe(false);
        expect(Number.isNaN(look.y)).toBe(false);

        camera.update(0, 0, 1 / 60, vx, vy);
        expect(Number.isNaN(camera.lookaheadX)).toBe(false);
        expect(Number.isNaN(camera.lookaheadY)).toBe(false);
      }
    });
  });

  // =========================================================================
  // Challenge 3: Stage Boundary Clamping & Empty Void Prevention
  // =========================================================================
  describe('Challenge 3: Stage Boundary Clamping & Zero Empty Void Rendering', () => {
    it('strictly clamps camera viewport within stage boundaries [-2000, 2000] across all 4 cardinal edges and corners', () => {
      const extremePositions = [
        { x: -5000, y: 0, desc: 'Extreme Left' },
        { x: 5000, y: 0, desc: 'Extreme Right' },
        { x: 0, y: -5000, desc: 'Extreme Top' },
        { x: 0, y: 5000, desc: 'Extreme Bottom' },
        { x: -99999, y: -99999, desc: 'Extreme Top-Left Corner' },
        { x: 99999, y: 99999, desc: 'Extreme Bottom-Right Corner' },
        { x: -99999, y: 99999, desc: 'Extreme Bottom-Left Corner' },
        { x: 99999, y: -99999, desc: 'Extreme Top-Right Corner' },
      ];

      for (const pos of extremePositions) {
        camera.reset(0, 0);
        for (let i = 0; i < 60; i++) {
          camera.update(pos.x, pos.y, 1 / 60, 0, 0);
        }

        // Viewport left edge must be >= -2000
        expect(camera.x).toBeGreaterThanOrEqual(-2000.0);
        // Viewport right edge must be <= +2000
        expect(camera.x + W).toBeLessThanOrEqual(2000.0001);
        // Viewport top edge must be >= -2000
        expect(camera.y).toBeGreaterThanOrEqual(-2000.0);
        // Viewport bottom edge must be <= +2000
        expect(camera.y + H).toBeLessThanOrEqual(2000.0001);

        // Assert renderX / renderY when no shake also respect stage boundaries
        expect(camera.renderX).toBeGreaterThanOrEqual(-2000);
        expect(camera.renderX + W).toBeLessThanOrEqual(2000);
        expect(camera.renderY).toBeGreaterThanOrEqual(-2000);
        expect(camera.renderY + H).toBeLessThanOrEqual(2000);
      }
    });

    it('prevents rendering empty void even when player has extreme velocity directed OUT of the world', () => {
      const dt = 1 / 60;
      // Player right at the stage boundary moving outward at 2000 px/s
      const px = 2000;
      const py = 2000;
      const vx = 2000;
      const vy = 2000;

      camera.reset(px - W / 2, py - H / 2);

      for (let i = 0; i < 60; i++) {
        camera.update(px, py, dt, vx, vy);

        // Lookahead is pushed outward, but viewport MUST NOT peek into empty void
        expect(camera.x + W).toBeLessThanOrEqual(2000.0001);
        expect(camera.y + H).toBeLessThanOrEqual(2000.0001);
      }
    });

    it('smoothly decelerates to a stop without jitter or bounce when running into world boundary', () => {
      const dt = 1 / 60;
      // Player starts at x = 1200 and runs right towards boundary at 300 px/s
      let px = 1200;
      camera.reset(px - W / 2, 0 - H / 2);

      const displacements: number[] = [];
      for (let frame = 0; frame < 120; frame++) {
        const prevX = camera.x;
        px += 300 * dt;
        camera.update(px, 0, dt, 300, 0);
        displacements.push(camera.x - prevX);
      }

      // Maximum camera.x is 2000 - 960 = 1040; camera must not overshoot and must converge closely
      expect(camera.x).toBeLessThanOrEqual(1040.0001);
      expect(camera.x).toBeGreaterThan(1039.9);

      // Displacement must decrease smoothly to 0 near the boundary
      const tailDisplacements = displacements.slice(-15);
      for (const d of tailDisplacements) {
        expect(d).toBeLessThan(0.5);
        expect(d).toBeGreaterThanOrEqual(0); // Zero bouncing back
      }
    });

    it('robustly handles edge cases where custom arena bounds are smaller than viewport', () => {
      const tinyBounds: CameraBounds = {
        minX: 0,
        maxX: 400, // 400 < viewportWidth 960
        minY: 0,
        maxY: 300, // 300 < viewportHeight 540
      };

      const customCam = new Camera({
        viewportWidth: W,
        viewportHeight: H,
        zoom: 1.0,
        bounds: tinyBounds,
      });

      customCam.reset(500, 500);
      customCam.update(200, 150, 1 / 60, 100, 100);

      // Must clamp cleanly to minX/minY without crashing or NaN
      expect(customCam.x).toBe(0);
      expect(customCam.y).toBe(0);
      expect(Number.isFinite(customCam.x)).toBe(true);
      expect(Number.isFinite(customCam.y)).toBe(true);
    });
  });

  // =========================================================================
  // Challenge 4: Variable Frame Rate & Delta Time Extremes
  // =========================================================================
  describe('Challenge 4: Variable Frame Rate & Delta Time Extremes', () => {
    it('verifies exact continuous-time frame rate invariance across 144Hz, 60Hz, and 30Hz', () => {
      // Analytical ODE: dx/dt = k * (target - x)
      // Solution: x(t) = target - (target - x0) * exp(-k * t)
      const x0 = 0;
      const targetCamX = 400;
      const k = 8.0;
      const totalTime = 1.0; // 1.0 second
      const theoreticalX = targetCamX - (targetCamX - x0) * Math.exp(-k * totalTime);

      // 1. 144Hz simulation (144 frames of dt = 1/144)
      const cam144 = new Camera({ smoothSpeed: k, bounds: stageBounds, zoom: 1.0 });
      cam144.reset(x0, 0);
      const dt144 = 1 / 144;
      for (let i = 0; i < 144; i++) {
        cam144.update(targetCamX + W / 2, H / 2, dt144, 0, 0);
      }

      // 2. 60Hz simulation (60 frames of dt = 1/60)
      const cam60 = new Camera({ smoothSpeed: k, bounds: stageBounds, zoom: 1.0 });
      cam60.reset(x0, 0);
      const dt60 = 1 / 60;
      for (let i = 0; i < 60; i++) {
        cam60.update(targetCamX + W / 2, H / 2, dt60, 0, 0);
      }

      // 3. 30Hz simulation (30 frames of dt = 1/30)
      const cam30 = new Camera({ smoothSpeed: k, bounds: stageBounds, zoom: 1.0 });
      cam30.reset(x0, 0);
      const dt30 = 1 / 30;
      for (let i = 0; i < 30; i++) {
        cam30.update(targetCamX + W / 2, H / 2, dt30, 0, 0);
      }

      // Assert all three converge to the identical theoretical continuous-time position within 0.05px!
      expect(cam144.x).toBeCloseTo(theoreticalX, 1);
      expect(cam60.x).toBeCloseTo(theoreticalX, 1);
      expect(cam30.x).toBeCloseTo(theoreticalX, 1);

      // Assert difference between 144Hz and 60Hz is < 0.01px
      expect(Math.abs(cam144.x - cam60.x)).toBeLessThan(0.01);
      // Assert difference between 60Hz and 30Hz is < 0.01px
      expect(Math.abs(cam60.x - cam30.x)).toBeLessThan(0.01);
    });

    it('proves unconditional stability under extreme lag spikes (dt = 0.5s, 1.0s, 5.0s) with zero overshoot', () => {
      const lagSpikes = [0.5, 1.0, 2.0, 5.0];
      const targetCamX = 500;

      for (const dtSpike of lagSpikes) {
        camera.reset(0, 0);
        camera.update(targetCamX + W / 2, H / 2, dtSpike, 0, 0);

        // Invariant: Must NOT overshoot target
        expect(camera.x).toBeLessThanOrEqual(targetCamX);
        // Must approach close to target
        expect(camera.x).toBeGreaterThan(450.0);
        // Zero NaNs or infinities
        expect(Number.isFinite(camera.x)).toBe(true);
      }
    });

    it('demonstrates numerical precision under micro-stepping dt = 0.0001s (10,000 sub-steps)', () => {
      camera.reset(0, 0);
      const targetCamX = 300;
      const microDt = 0.0001; // 10,000 Hz micro-stepping

      for (let i = 0; i < 10000; i++) {
        camera.update(targetCamX + W / 2, H / 2, microDt, 0, 0);
      }

      // Theoretical after 1.0s: 300 * (1 - e^-8) = 299.899
      expect(camera.x).toBeCloseTo(299.9, 1);
      expect(Number.isFinite(camera.x)).toBe(true);
    });

    it('remains stable when delta times oscillate erratically (thermal throttling simulation)', () => {
      camera.reset(0, 0);
      const targetCamX = 600;
      const erraticDts = [1 / 144, 0.25, 1 / 30, 0.001, 0.5, 1 / 60, 0.1, 0.0005, 0.4];

      let prevX = camera.x;
      for (const dt of erraticDts) {
        camera.update(targetCamX + W / 2, H / 2, dt, 0, 0);

        // Monotonic progression towards target
        expect(camera.x).toBeGreaterThanOrEqual(prevX);
        expect(camera.x).toBeLessThanOrEqual(targetCamX);
        expect(Number.isFinite(camera.x)).toBe(true);

        prevX = camera.x;
      }
    });

    it('instantly snaps when dt <= 0, preserving game restart initialization semantics', () => {
      camera.reset(100, 100);
      camera.update(500 + W / 2, 400 + H / 2, 0, 0, 0);

      // Snapped immediately to (500, 400)
      expect(camera.x).toBe(500);
      expect(camera.y).toBe(400);
      expect(camera.renderX).toBe(500);
      expect(camera.renderY).toBe(400);
    });
  });

  // =========================================================================
  // Challenge 5: Screen Shake Trauma Decay & Decoupling Invariants
  // =========================================================================
  describe('Challenge 5: Screen Shake Trauma Decay & Decoupling Invariants', () => {
    it('strictly isolates tracking coordinates (camera.x, camera.y) from screen shake trauma offsets', () => {
      const px = 250;
      const py = 350;
      camera.reset(px - W / 2, py - H / 2);

      // Undisturbed reference camera
      const refCam = new Camera({
        viewportWidth: W,
        viewportHeight: H,
        zoom: 1.0,
        bounds: stageBounds,
      });
      refCam.reset(px - W / 2, py - H / 2);

      // Trigger massive trauma on test camera
      camera.shake(50, 0.6);

      // Step both cameras forward in sync for 30 frames (0.5s)
      for (let f = 0; f < 30; f++) {
        camera.update(px, py, 1 / 60, 0, 0);
        refCam.update(px, py, 1 / 60, 0, 0);

        // Decoupling Invariant: camera.x and camera.y MUST MATCH refCam EXACTLY!
        expect(camera.x).toBe(refCam.x);
        expect(camera.y).toBe(refCam.y);

        // Shake offsets are only present in renderX / renderY
        expect(camera.renderX).toBe(Math.round(camera.x + camera.shakeOffsetX));
        expect(camera.renderY).toBe(Math.round(camera.y + camera.shakeOffsetY));
      }
    });

    it('verifies trauma intensity strictly follows quadratic decay curve (progress^2)', () => {
      const initialIntensity = 40;
      const duration = 0.5;
      camera.shake(initialIntensity, duration);

      // Advance by 0.25s (progress = (0.5 - 0.25) / 0.5 = 0.5)
      camera.update(0, 0, 0.25, 0, 0);

      // Current intensity should be initialIntensity * (0.5)^2 = 40 * 0.25 = 10px
      // Offsets are bounded by current intensity
      expect(Math.abs(camera.shakeOffsetX)).toBeLessThanOrEqual(10.0001);
      expect(Math.abs(camera.shakeOffsetY)).toBeLessThanOrEqual(10.0001);

      // Advance past remaining duration (0.3s > 0.25s)
      camera.update(0, 0, 0.3, 0, 0);

      // Zero trauma remaining
      expect(camera.shakeIntensity).toBe(0);
      expect(camera.shakeTimer).toBe(0);
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);
      expect(camera.renderX).toBe(Math.round(camera.x));
      expect(camera.renderY).toBe(Math.round(camera.y));
    });

    it('survives rapid-fire continuous bombardment (50 consecutive explosions) without runaway intensity', () => {
      camera.reset(0, 0);

      // Fire 50 explosions of intensity 30
      for (let i = 0; i < 50; i++) {
        camera.shake(30, 0.2);
        camera.update(0, 0, 1 / 60, 0, 0);

        // Intensity must NEVER exceed 30 (no runaway stacking)
        expect(camera.shakeIntensity).toBeLessThanOrEqual(30);
        expect(Math.abs(camera.shakeOffsetX)).toBeLessThanOrEqual(30.0001);
        expect(Math.abs(camera.shakeOffsetY)).toBeLessThanOrEqual(30.0001);
      }

      // Let explosions subside (advance 0.3s)
      camera.update(0, 0, 0.3, 0, 0);

      // Cleanly zeroed
      expect(camera.shakeIntensity).toBe(0);
      expect(camera.shakeOffsetX).toBe(0);
      expect(camera.shakeOffsetY).toBe(0);
      expect(camera.renderX).toBe(Math.round(camera.x));
      expect(camera.renderY).toBe(Math.round(camera.y));
    });
  });

  // =========================================================================
  // Challenge 6: Frustum Culling & Coordinate Transformations
  // =========================================================================
  describe('Challenge 6: Frustum Culling & Coordinate Transformations', () => {
    it('preserves exact bijective round-trip transformations across extreme coordinate space', () => {
      camera.reset(1234.56, -789.12);

      const testPoints = [
        { x: -50000.125, y: -40000.75 },
        { x: 0, y: 0 },
        { x: 50000.875, y: 40000.25 },
      ];

      for (const pt of testPoints) {
        const screen = camera.worldToScreen(pt.x, pt.y);
        const roundTrip = camera.screenToWorld(screen.x, screen.y);
        expect(roundTrip.x).toBeCloseTo(pt.x, 4);
        expect(roundTrip.y).toBeCloseTo(pt.y, 4);
      }
    });

    it('reliably culls entities outside camera viewport frustum even with active screen shake', () => {
      camera.reset(0, 0);
      camera.shake(20, 1.0);
      camera.update(0, 0, 0.1, 0, 0);

      // An entity safely inside frustum
      const insideBox: AABB = {
        x: camera.renderX + W / 2 - 16,
        y: camera.renderY + H / 2 - 16,
        width: 32,
        height: 32,
      };
      expect(camera.isVisible(insideBox)).toBe(true);

      // An entity far outside frustum to the left
      const farLeftBox: AABB = {
        x: camera.renderX - 200,
        y: camera.renderY + 100,
        width: 32,
        height: 32,
      };
      expect(camera.isVisible(farLeftBox)).toBe(false);

      // An entity far outside frustum to the bottom
      const farBottomBox: AABB = {
        x: camera.renderX + 100,
        y: camera.renderY + H + 200,
        width: 32,
        height: 32,
      };
      expect(camera.isVisible(farBottomBox)).toBe(false);
    });
  });
});
