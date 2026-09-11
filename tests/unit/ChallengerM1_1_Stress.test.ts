import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Player, PlayerInputSnapshot } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { DarkFantasySprites } from '../../src/render/sprites/DarkFantasySprites';
import { Camera } from '../../src/render/Camera';

describe('Adversarial Stress Harness M1-1: Kinematics, Extreme dt, Volume Invariant & Baselines', () => {
  let camera: Camera;
  let mockCtx: any;

  function createMockCanvasContext() {
    return {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
    };
  }

  function setupDocumentStub() {
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag === 'canvas') {
          const ctx = createMockCanvasContext();
          return {
            width: 0,
            height: 0,
            getContext: () => ctx,
          };
        }
        return {};
      },
    });
  }

  beforeEach(() => {
    setupDocumentStub();
    DarkFantasySprites.clearCache();
    camera = new Camera({ viewportWidth: 960, viewportHeight: 540 });
    camera.renderX = 0;
    camera.renderY = 0;
    mockCtx = createMockCanvasContext();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    DarkFantasySprites.clearCache();
  });

  // =========================================================================
  // Challenge 1: Rapid Key-Mashing Direction Reversals (60Hz & 120Hz)
  // =========================================================================
  describe('Challenge 1: Rapid Key-Mashing Direction Reversals (60Hz & 120Hz)', () => {
    it('survives 1,000 frames of 180° rapid direction mashing at 60Hz without velocity runaway or NaNs', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 60;
      const maxSpeed = player.stats.moveSpeed;

      let reversalCount = 0;
      let turnaroundSquashCount = 0;

      for (let frame = 0; frame < 1000; frame++) {
        // Alternate Right vs Left every frame
        const goRight = frame % 2 === 0;
        const input: PlayerInputSnapshot = {
          up: false,
          down: false,
          left: !goRight,
          right: goRight,
        };

        const prevVx = player.velocity.x;
        player.handleInput(input, dt);
        player.update(dt);

        // Track reversal
        if (prevVx !== 0 && Math.sign(player.velocity.x) !== Math.sign(prevVx)) {
          reversalCount++;
        }
        if (player.squashAmplitude !== 0) {
          turnaroundSquashCount++;
        }

        // Invariant 1: Speed cannot exceed maxSpeed
        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        expect(currentSpeed).toBeLessThanOrEqual(maxSpeed + 1e-4);

        // Invariant 2: Coordinates and velocities must be finite non-NaN
        expect(Number.isFinite(player.position.x)).toBe(true);
        expect(Number.isFinite(player.position.y)).toBe(true);
        expect(Number.isFinite(player.velocity.x)).toBe(true);
        expect(Number.isFinite(player.velocity.y)).toBe(true);
        expect(player.velocity.y).toBe(0);

        // Invariant 3: Volume conservation on every single frame
        const volume = player.squashScale.x * player.squashScale.y;
        expect(volume).toBeCloseTo(1.0, 4);

        // Invariant 4: Facing direction must be valid
        expect([1, -1]).toContain(player.facingDirection);
      }

      // Assert high turnaround count occurred
      expect(turnaroundSquashCount).toBeGreaterThan(500);
      expect(reversalCount).toBeGreaterThan(400);
    });

    it('survives 1,200 frames of 180° rapid direction mashing at 120Hz (high refresh rate)', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 120;
      const maxSpeed = player.stats.moveSpeed;

      for (let frame = 0; frame < 1200; frame++) {
        // Alternate Up vs Down every frame
        const goUp = frame % 2 === 0;
        const input: PlayerInputSnapshot = {
          up: goUp,
          down: !goUp,
          left: false,
          right: false,
        };

        player.handleInput(input, dt);
        player.update(dt);

        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        expect(currentSpeed).toBeLessThanOrEqual(maxSpeed + 1e-4);
        expect(Number.isFinite(player.position.y)).toBe(true);
        expect(Number.isFinite(player.velocity.y)).toBe(true);
        expect(player.velocity.x).toBe(0);

        const volume = player.squashScale.x * player.squashScale.y;
        expect(volume).toBeCloseTo(1.0, 4);
      }
    });

    it('survives 2,000 frames of continuous 360° omnidirectional compass churn at 60Hz and 120Hz', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const maxSpeed = player.stats.moveSpeed;

      const compassHeadings: PlayerInputSnapshot[] = [
        { right: true, left: false, up: false, down: false }, // E
        { right: true, left: false, up: true, down: false },  // NE
        { right: false, left: false, up: true, down: false }, // N
        { right: false, left: true, up: true, down: false },  // NW
        { right: false, left: true, up: false, down: false }, // W
        { right: false, left: true, up: false, down: true },  // SW
        { right: false, left: false, up: false, down: true }, // S
        { right: true, left: false, up: false, down: true },  // SE
      ];

      for (let frame = 0; frame < 2000; frame++) {
        // Switch heading every 2 frames, alternating framerate between 60Hz and 120Hz
        const headingIndex = Math.floor(frame / 2) % compassHeadings.length;
        const dt = frame % 2 === 0 ? 1 / 60 : 1 / 120;
        const input = compassHeadings[headingIndex];

        player.handleInput(input, dt);
        player.update(dt);

        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        expect(currentSpeed).toBeLessThanOrEqual(maxSpeed + 1e-4);

        expect(Number.isFinite(player.position.x)).toBe(true);
        expect(Number.isFinite(player.position.y)).toBe(true);
        expect(Number.isFinite(player.facingAngle)).toBe(true);
        expect(player.facingAngle).toBeGreaterThanOrEqual(-Math.PI - 1e-4);
        expect(player.facingAngle).toBeLessThanOrEqual(Math.PI + 1e-4);
        expect([1, -1]).toContain(player.facingDirection);

        // Walk bob phase must remain in [0, 2*PI]
        expect(player.walkBobPhase).toBeGreaterThanOrEqual(0);
        expect(player.walkBobPhase).toBeLessThanOrEqual(2 * Math.PI + 1e-4);

        const volume = player.squashScale.x * player.squashScale.y;
        expect(volume).toBeCloseTo(1.0, 4);
      }
    });

    it('handles chaotic pseudorandom key mash (all 16 key combinations) without numeric corruption', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 60;

      // Seeded LCG for deterministic chaotic inputs
      let seed = 123456789;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      for (let frame = 0; frame < 1000; frame++) {
        const input: PlayerInputSnapshot = {
          right: pseudoRandom() > 0.5,
          left: pseudoRandom() > 0.5,
          up: pseudoRandom() > 0.5,
          down: pseudoRandom() > 0.5,
        };

        player.handleInput(input, dt);
        player.update(dt);

        const currentSpeed = Math.hypot(player.velocity.x, player.velocity.y);
        expect(currentSpeed).toBeLessThanOrEqual(player.stats.moveSpeed + 1e-4);
        expect(Number.isNaN(player.position.x)).toBe(false);
        expect(Number.isNaN(player.position.y)).toBe(false);
        expect(Number.isNaN(player.velocity.x)).toBe(false);
        expect(Number.isNaN(player.velocity.y)).toBe(false);
      }
    });
  });

  // =========================================================================
  // Challenge 2: Numerical Stability Across Extreme dt & Boundary Resistance
  // =========================================================================
  describe('Challenge 2: Numerical Stability Across Extreme dt & Boundary Inputs', () => {
    it('maintains absolute numerical stability under micro-steps (dt = 1e-5)', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const tinyDt = 1e-5;

      // Accelerate over 2,000 tiny steps
      for (let i = 0; i < 2000; i++) {
        player.handleInput({ up: false, down: false, left: false, right: true }, tinyDt);
        player.update(tinyDt);

        expect(Number.isFinite(player.velocity.x)).toBe(true);
        expect(player.velocity.x).toBeGreaterThanOrEqual(0);
        expect(player.velocity.x).toBeLessThanOrEqual(200);
      }

      // Assert continuous forward progress
      expect(player.velocity.x).toBeGreaterThan(0);
      expect(player.position.x).toBeGreaterThan(0);

      // Verify squash/stretch works under tiny dt without underflowing to NaN
      player.triggerSquashStretch(0.78, 1.28);
      for (let i = 0; i < 1000; i++) {
        player.update(tinyDt);
        const volume = player.squashScale.x * player.squashScale.y;
        expect(volume).toBeCloseTo(1.0, 4);
      }
    });

    it('maintains absolute stability and clamp invariants under massive lag spikes (dt = 0.5, 1.0, 10.0)', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });

      // Massive spike during acceleration: dt = 0.5 (exponential curve reaches 99.9% of target)
      player.handleInput({ up: false, down: false, left: false, right: true }, 0.5);
      expect(player.velocity.x).toBeCloseTo(200, 0);
      expect(player.velocity.x).toBeGreaterThan(199.0);
      expect(player.velocity.x).toBeLessThanOrEqual(200.0);

      // On next step, cleanly snaps exactly to 200 without asymptotic tail
      player.handleInput({ up: false, down: false, left: false, right: true }, 0.5);
      expect(player.velocity.x).toBe(200);

      // Massive spike during 180° turnaround: dt = 0.5 (turnaround traction lambda = 28.8 snaps cleanly to -200)
      player.handleInput({ up: false, down: false, left: true, right: false }, 0.5);
      expect(player.velocity.x).toBe(-200); // Cleanly reaches -200 without overshoot or NaN

      // Massive spike on squash oscillator: dt = 1.0
      player.triggerSquashStretch(0.78, 1.28);
      player.update(1.0);
      // Since t = 1.0 > 0.3s, must cleanly settle to (1.0, 1.0)
      expect(player.squashAmplitude).toBe(0);
      expect(player.squashScale.x).toBe(1.0);
      expect(player.squashScale.y).toBe(1.0);

      // Massive spike on attack animation: dt = 10.0
      player.triggerAttack(0, 'scythe');
      expect(player.attackAnim.active).toBe(true);
      player.update(10.0);
      // Must cleanly reset to idle
      expect(player.attackAnim.active).toBe(false);
      expect(player.attackAnim.phase).toBe('idle');
      expect(player.attackAnim.recoilOffset.x).toBe(0);
      expect(player.attackAnim.recoilOffset.y).toBe(0);

      // Massive spike on flinch rotation
      player.flinchRotation = 0.35;
      player.update(0.5);
      expect(player.flinchRotation).toBe(0);
    });

    it('handles dt = 0 boundary without zero-division in acceleration or kinematics', () => {
      const player = new Player(50, 50, { moveSpeed: 200 });
      player.velocity.x = 100;
      player.velocity.y = -50;

      // Call handleInput and update with dt = 0
      player.handleInput({ up: true, down: false, left: false, right: true }, 0);
      player.update(0);

      expect(Number.isFinite(player.position.x)).toBe(true);
      expect(Number.isFinite(player.position.y)).toBe(true);
      expect(Number.isFinite(player.velocity.x)).toBe(true);
      expect(Number.isFinite(player.velocity.y)).toBe(true);
      expect(player.position.x).toBe(50);
      expect(player.position.y).toBe(50);
    });

    it('resists astronomical knockback and damage values without corrupting flinch or health state', () => {
      const enemy = new Enemy(1);
      enemy.reset('skeleton', 100, 100);
      enemy.active = true;

      // Apply extreme knockback: 1e9 px/s
      enemy.takeDamage(50, 1e9, 1e9);

      // Flinch rotation must be clamped to [-0.35, 0.35]
      expect(enemy.flinchRot).toBe(0.35);
      expect(enemy.squashX).toBe(1.25);
      expect(enemy.squashY).toBe(0.75);
      expect(enemy.flashTimer).toBe(0.10);

      // Player flinch resistance under extreme damage
      const player = new Player(0, 0);
      player.takeDamage(1e6);
      expect(Math.abs(player.flinchRotation)).toBeLessThanOrEqual(0.35);
      expect(player.stats.currentHealth).toBe(0);
      expect(player.isAlive).toBe(false);
    });
  });

  // =========================================================================
  // Challenge 3: Volume Conservation Invariant (Sx * Sy = 1.0) Across 10,000 Ticks
  // =========================================================================
  describe('Challenge 3: Volume Conservation Invariant (Sx * Sy = 1.0) Across 10,000 Ticks', () => {
    it('strictly preserves volume conservation (Sx * Sy = 1.0) across 10,000 randomized squash/stretch ticks', () => {
      const player = new Player(0, 0);

      let seed = 987654321;
      function pseudoRandom(): number {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
      }

      let squashEventsTriggered = 0;

      for (let tick = 0; tick < 10000; tick++) {
        // Randomly trigger squash events (~every 25 ticks on average)
        if (pseudoRandom() < 0.04) {
          squashEventsTriggered++;
          const mode = Math.floor(pseudoRandom() * 4);
          if (mode === 0) {
            // Turnaround squash
            player.triggerSquashStretch(0.78, 1.28);
          } else if (mode === 1) {
            // Damage impact squash
            player.triggerSquashStretch(1.25, 0.75);
          } else if (mode === 2) {
            // Sprint burst
            const burst = 0.05 + pseudoRandom() * 0.15;
            player.triggerSquashStretch(1.0 + burst, 1.0 / (1.0 + burst));
          } else {
            // Randomized volume-conserving initial scale
            const sx = 0.5 + pseudoRandom() * 1.5; // [0.5, 2.0]
            player.triggerSquashStretch(sx, 1.0 / sx);
          }
        }

        // Random fluctuating framerate dt in [0.001, 0.04]
        const dt = 0.001 + pseudoRandom() * 0.039;
        player.update(dt);

        // ORACLE INVARIANT: Volume must strictly equal 1.0 on every tick
        const sx = player.squashScale.x;
        const sy = player.squashScale.y;
        const volumeProduct = sx * sy;

        expect(Number.isFinite(sx)).toBe(true);
        expect(Number.isFinite(sy)).toBe(true);
        expect(sx).toBeGreaterThan(0);
        expect(sy).toBeGreaterThan(0);
        expect(Math.abs(volumeProduct - 1.0)).toBeLessThan(1e-4);
      }

      // Confirm significant squash activity occurred
      expect(squashEventsTriggered).toBeGreaterThan(300);

      // Advance 1 second of calm time to verify settling to neutral equilibrium
      for (let i = 0; i < 60; i++) {
        player.update(1 / 60);
      }
      expect(player.squashScale.x).toBe(1.0);
      expect(player.squashScale.y).toBe(1.0);
      expect(player.squashAmplitude).toBe(0);
    });
  });

  // =========================================================================
  // Challenge 4: Stationary Baseline Invariant (Idle Player at (100, 150) Zero Offset)
  // =========================================================================
  describe('Challenge 4: Stationary Baseline Invariant (Idle at (100, 150))', () => {
    it('empirically verifies idle player at (100, 150) has strictly zero offset across all elapsed times', () => {
      DarkFantasySprites.clearCache();
      DarkFantasySprites.initialize();

      const player = new Player(100, 150);
      player.velocity.x = 0;
      player.velocity.y = 0;

      // Invariant: squash is neutral
      expect(player.squashScale.x).toBe(1.0);
      expect(player.squashScale.y).toBe(1.0);
      expect(player.flinchRotation).toBe(0);
      expect(player.attackAnim.active).toBe(false);

      const entry = DarkFantasySprites.getCachedEntry('player', 0, true, 'normal');
      expect(entry).not.toBeNull();
      const originX = entry!.originX;
      const originY = entry!.originY;

      // Test across multiple elapsed times (0.0s, 0.5s, 1.0s, 10.0s, 500.0s)
      const testTimes = [0.0, 0.25, 0.5, 1.0, 5.0, 25.0, 100.0, 500.0];

      for (const time of testTimes) {
        mockCtx.drawImage.mockClear();
        mockCtx.save.mockClear();

        DarkFantasySprites.drawPlayer(mockCtx, player, camera, time);

        // Assert drawImage was invoked exactly once
        expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);

        const call = mockCtx.drawImage.mock.calls[0];
        const drawnX = call[1];
        const drawnY = call[2];

        // STRICT INVARIANT: Exact zero offset
        const expectedX = 100 - camera.renderX - originX;
        const expectedY = 150 - camera.renderY - originY;

        expect(drawnX).toBe(expectedX);
        expect(drawnY).toBe(expectedY);

        // Displacement must be strictly zero
        const offsetX = drawnX - expectedX;
        const offsetY = drawnY - expectedY;
        expect(offsetX).toBe(0);
        expect(offsetY).toBe(0);

        // Performance invariant: Idle blit must not trigger save/restore
        expect(mockCtx.save).not.toHaveBeenCalled();
      }
    });

    it('strictly returns to zero offset after dynamic movement cycle concludes', () => {
      DarkFantasySprites.clearCache();
      DarkFantasySprites.initialize();

      const player = new Player(100, 150, { moveSpeed: 200 });
      const dt = 1 / 60;

      // 1. Move player aggressively for 60 frames (1 second)
      for (let i = 0; i < 60; i++) {
        player.handleInput({ up: false, down: false, left: false, right: true }, dt);
        player.update(dt);
      }

      // Must have moved and accumulated walk bob
      expect(player.position.x).toBeGreaterThan(100);
      expect(player.velocity.x).toBeGreaterThan(150);
      expect(player.walkBobPhase).toBeGreaterThan(0);

      // 2. Release input and decelerate for 60 frames
      for (let i = 0; i < 60; i++) {
        player.handleInput({ up: false, down: false, left: false, right: false }, dt);
        player.update(dt);
      }

      // Assert complete resting state reached
      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);
      expect(player.walkBobPhase).toBe(0);
      expect(player.squashScale.x).toBe(1.0);
      expect(player.squashScale.y).toBe(1.0);
      expect(player.flinchRotation).toBe(0);

      const restingX = player.position.x;
      const restingY = player.position.y;

      const entry = DarkFantasySprites.getCachedEntry('player', 0, true, 'normal');
      expect(entry).not.toBeNull();
      const originX = entry!.originX;
      const originY = entry!.originY;

      mockCtx.drawImage.mockClear();
      DarkFantasySprites.drawPlayer(mockCtx, player, camera, 2.0);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
      const call = mockCtx.drawImage.mock.calls[0];

      // Exact zero dynamic offset at resting position
      expect(call[1]).toBe(restingX - camera.renderX - originX);
      expect(call[2]).toBe(restingY - camera.renderY - originY);
    });

    it('empirically verifies stationary enemy baseline across all enemy types', () => {
      DarkFantasySprites.clearCache();
      DarkFantasySprites.initialize();

      const types = ['skeleton', 'ghoul', 'banshee', 'death_knight'] as const;

      for (const type of types) {
        const enemy = new Enemy(50);
        enemy.reset(type, 200, 300);
        enemy.active = true;
        enemy.vx = 0;
        enemy.vy = 0;
        enemy.walkPhase = 0;
        enemy.hoverPhase = 0;

        mockCtx.drawImage.mockClear();
        mockCtx.save.mockClear();

        // Draw at elapsedTime = 0
        DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);

        expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
        const call = mockCtx.drawImage.mock.calls[0];

        const entry = DarkFantasySprites.getCachedEntry(type, 0, true, 'normal');
        expect(entry).not.toBeNull();

        // Must be exactly 200 - renderX - originX and 300 - renderY - originY
        expect(call[1]).toBe(200 - camera.renderX - entry!.originX);
        expect(call[2]).toBe(300 - camera.renderY - entry!.originY);
      }
    });
  });
});
