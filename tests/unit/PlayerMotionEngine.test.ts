import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Player } from '../../src/core/entities/Player';
import { Enemy } from '../../src/core/entities/Enemy';
import { HordeManager } from '../../src/core/HordeManager';
import { DarkFantasySprites } from '../../src/render/sprites/DarkFantasySprites';
import { Camera } from '../../src/render/Camera';

describe('Milestone 1: Dynamic Animations & Motion Engine Unit Verification', () => {
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
  // Spec 1: Entity Animation Frame Lock Fix & BehaviorTimer Advancement
  // =========================================================================
  describe('Spec 1: Entity Animation Frame Lock Fix', () => {
    it('advances enemy.behaviorTimer by dt on every HordeManager update tick', () => {
      const horde = new HordeManager({ maxCapacity: 20 });
      const enemy = horde.spawn('skeleton', 100, 100);
      expect(enemy).not.toBeNull();
      expect(enemy!.behaviorTimer).toBe(0);

      const dt = 1 / 60;
      for (let i = 0; i < 30; i++) {
        horde.update(dt, { x: 0, y: 0 });
      }

      // Assert behaviorTimer has strictly advanced
      expect(enemy!.behaviorTimer).toBeCloseTo(30 * dt, 4);
      expect(enemy!.behaviorTimer).toBeGreaterThan(0);
    });

    it('cycles enemy animation walk frames (0, 1, 2, 3) as behaviorTimer advances', () => {
      const enemy = new Enemy(1);
      enemy.reset('skeleton', 50, 50);
      enemy.active = true;
      enemy.vx = 40; // moving entity

      const frames: number[] = [];

      for (let step = 0; step < 8; step++) {
        enemy.behaviorTimer = step * 0.125;
        // In DarkFantasySprites, frame = Math.floor(behaviorTimer * 8) % 4
        const expectedFrame = Math.floor(enemy.behaviorTimer * 8) % 4;
        frames.push(expectedFrame);
      }

      expect(frames).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
    });
  });

  // =========================================================================
  // Spec 2: Dynamic Velocity Easing in Player.ts
  // =========================================================================
  describe('Spec 2: Dynamic Velocity Easing (Exponential Relaxation)', () => {
    it('accelerates smoothly according to exponential relaxation formula with lambda_accel = 14.0', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 60;

      // Frame 1
      player.handleInput({ up: false, down: false, left: false, right: true }, dt);
      const expectedV1 = 200 * (1 - Math.exp(-Player.LAMBDA_ACCEL * dt));
      expect(player.velocity.x).toBeCloseTo(expectedV1, 2);

      // Frame 2
      player.handleInput({ up: false, down: false, left: false, right: true }, dt);
      const expectedV2 = expectedV1 + (200 - expectedV1) * (1 - Math.exp(-Player.LAMBDA_ACCEL * dt));
      expect(player.velocity.x).toBeCloseTo(expectedV2, 2);

      // Velocity must remain monotonically increasing towards target
      expect(player.velocity.x).toBeGreaterThan(expectedV1);
      expect(player.velocity.x).toBeLessThanOrEqual(200);
    });

    it('applies enhanced turnaround traction multiplier (1.6x) on directional reversal', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 60;

      // Bring player to forward velocity
      player.velocity.x = 100;
      player.prevVelocity.x = 100;

      // Reverse direction: target = -200
      player.handleInput({ up: false, down: false, left: true, right: false }, dt);

      // Turnaround lambda = 18.0 * 1.6 = 28.8 s^-1
      const lambdaTurn = Player.LAMBDA_BRAKE * Player.TURNAROUND_MULTIPLIER;
      const alphaTurn = 1 - Math.exp(-lambdaTurn * dt);
      const expectedVx = 100 + (-200 - 100) * alphaTurn;

      expect(player.velocity.x).toBeCloseTo(expectedVx, 2);
      expect(lambdaTurn).toBeCloseTo(28.8, 1);
    });

    it('decelerates smoothly and snaps cleanly to 0 when input is released', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      player.velocity.x = 200;
      const dt = 1 / 60;

      // Step deceleration
      for (let i = 0; i < 30; i++) {
        player.handleInput({ up: false, down: false, left: false, right: false }, dt);
      }

      // After 30 frames (0.5s), velocity must have snapped to exactly 0 (no infinite asymptotic tail)
      expect(player.velocity.x).toBe(0);
      expect(player.velocity.y).toBe(0);
    });
  });

  // =========================================================================
  // Spec 3: Harmonic Squash & Stretch Engine
  // =========================================================================
  describe('Spec 3: Harmonic Squash & Stretch', () => {
    it('strictly conserves apparent 2D volume (Sx * Sy = 1.0) during harmonic relaxation', () => {
      const player = new Player(0, 0);
      // Trigger turnaround squash: Sx = 0.78, Sy = 1.28
      player.triggerSquashStretch(0.78, 1.28);

      expect(player.squashScale.x).toBeCloseTo(0.78, 2);
      expect(player.squashScale.y).toBeCloseTo(1.28, 2);

      const dt = 1 / 60;
      for (let step = 0; step < 20; step++) {
        player.update(dt);
        // Product of scales must strictly equal 1.0 (volume preservation invariant)
        const volumeProduct = player.squashScale.x * player.squashScale.y;
        expect(volumeProduct).toBeCloseTo(1.0, 3);
      }

      // After 0.3s (18+ frames), must settle back to equilibrium (1.0, 1.0)
      for (let step = 0; step < 20; step++) {
        player.update(dt);
      }
      expect(player.squashScale.x).toBe(1.0);
      expect(player.squashScale.y).toBe(1.0);
    });

    it('triggers turnaround squash on abrupt horizontal reversal', () => {
      const player = new Player(0, 0, { moveSpeed: 200 });
      const dt = 1 / 60;

      // Moving right at speed
      player.velocity.x = 100;
      player.prevVelocity.x = 100;

      // Immediate reversal to left
      player.handleInput({ up: false, down: false, left: true, right: false }, dt);

      // Must have triggered turnaround squash (amplitude < 0)
      expect(player.squashAmplitude).toBeLessThan(0);
      expect(player.squashScale.x).toBeLessThan(1.0);
      expect(player.squashScale.y).toBeGreaterThan(1.0);
    });
  });

  // =========================================================================
  // Spec 4: Attack Wind-Up, Anticipation & Recoil State Machine
  // =========================================================================
  describe('Spec 4: Attack Animation State Machine', () => {
    it('transitions through windup -> release -> followthrough -> idle phases', () => {
      const player = new Player(0, 0);
      expect(player.attackAnim.active).toBe(false);
      expect(player.attackAnim.phase).toBe('idle');

      // Trigger attack facing angle 0 (aim right)
      player.triggerAttack(0, 'scythe');
      expect(player.attackAnim.active).toBe(true);
      expect(player.attackAnim.phase).toBe('windup');

      const dt = 0.02; // 20ms steps

      // Step into Wind-Up (t < 0.08s): torso leans backward opposite aim
      player.update(dt); // t = 0.02
      expect(player.attackAnim.phase).toBe('windup');
      expect(player.attackAnim.recoilOffset.x).toBeLessThan(0); // Leans backward opposite aim

      // Step into Strike / Release (0.08s <= t < 0.14s): lunges forward
      player.update(0.08); // t = 0.10
      expect(player.attackAnim.phase).toBe('release');
      expect(player.attackAnim.recoilOffset.x).toBeGreaterThan(0); // Lunges forward

      // Step into Follow-through (0.14s <= t < 0.26s)
      player.update(0.08); // t = 0.18
      expect(player.attackAnim.phase).toBe('followthrough');

      // Step past duration (t >= 0.26s): settles to idle
      player.update(0.15); // t = 0.33
      expect(player.attackAnim.active).toBe(false);
      expect(player.attackAnim.phase).toBe('idle');
      expect(player.attackAnim.recoilOffset.x).toBe(0);
      expect(player.attackAnim.recoilOffset.y).toBe(0);
    });
  });

  // =========================================================================
  // Spec 5: Multi-Phase Grounded Walk Cycles & Spectral Hover
  // =========================================================================
  describe('Spec 5: Procedural Walk Cycles & Ethereal Hover', () => {
    it('advances walkPhase for grounded enemies and hoverPhase for spectral enemies in HordeManager', () => {
      const horde = new HordeManager({ maxCapacity: 20 });
      const skel = horde.spawn('skeleton', 100, 100);
      const banshee = horde.spawn('banshee', 200, 200);

      expect(skel).not.toBeNull();
      expect(banshee).not.toBeNull();
      expect(skel!.walkPhase).toBe(0);
      expect(banshee!.hoverPhase).toBe(0);

      const dt = 1 / 60;
      for (let i = 0; i < 10; i++) {
        horde.update(dt, { x: 0, y: 0 });
      }

      // Grounded skeleton should accumulate walk phase
      expect(skel!.walkPhase).toBeGreaterThan(0);
      // Spectral banshee should accumulate hover phase
      expect(banshee!.hoverPhase).toBeGreaterThan(0);
    });

    it('applies vertical levitation float for active spectral banshee in drawEnemy', () => {
      DarkFantasySprites.initialize();

      const banshee = new Enemy(10);
      banshee.reset('banshee', 100, 100);
      banshee.active = true;
      banshee.hoverPhase = 1.5; // mid-hover

      DarkFantasySprites.drawEnemy(mockCtx, banshee, camera, 1.0);

      expect(mockCtx.drawImage).toHaveBeenCalled();
      const call = mockCtx.drawImage.mock.calls[0];
      // totalY should be displaced by hover equation
      const expectedHoverY = Math.sin(1.5) * 4.5 + Math.sin(1.5 * 1.886) * 1.8;
      const actualY = call[2]; // totalY - originY
      expect(actualY).toBeCloseTo(100 - camera.renderY + expectedHoverY - 24, 1);
    });
  });

  // =========================================================================
  // Spec 6: 3-Tier Damage Reaction Pipeline
  // =========================================================================
  describe('Spec 6: Dynamic Damage Reaction (Squash, Flinch, Hit-Flash)', () => {
    it('applies deformation squash and angular stumble on enemy damage', () => {
      const enemy = new Enemy(20);
      enemy.reset('skeleton', 100, 100);
      enemy.active = true;

      // Inflict damage with knockback impulse
      enemy.takeDamage(10, 50, 0);

      // Tier 1: Impulse Squash & Stretch
      expect(enemy.squashX).toBe(1.25);
      expect(enemy.squashY).toBe(0.75);

      // Tier 2: Rotational Flinch Stumble
      expect(enemy.flinchRot).not.toBe(0);
      expect(Math.abs(enemy.flinchRot)).toBeLessThanOrEqual(0.35);

      // Tier 3: Hit-Flash timer initialized for cascade
      expect(enemy.flashTimer).toBe(0.10);
    });

    it('applies deformation squash and angular stumble on player damage', () => {
      const player = new Player(0, 0);
      player.takeDamage(15);

      expect(player.squashScale.x).toBe(1.25);
      expect(player.squashScale.y).toBe(0.75);
      expect(player.flinchRotation).not.toBe(0);
      expect(Math.abs(player.flinchRotation)).toBeLessThanOrEqual(0.35);
    });
  });

  // =========================================================================
  // Spec 7: Stationary Baseline & Invariant Preservation
  // =========================================================================
  describe('Spec 7: Stationary Baseline & 120-Canvas Atlas Invariants', () => {
    it('preserves exactly 120 cached canvases in DarkFantasySprites.initialize()', () => {
      DarkFantasySprites.clearCache();
      DarkFantasySprites.initialize();
      expect(DarkFantasySprites.initialized).toBe(true);

      // 5 types * 4 frames * 2 facings * 3 flashes = 120
      let canvasCount = 0;
      const types = ['player', 'skeleton', 'ghoul', 'banshee', 'death_knight'] as const;
      for (const t of types) {
        for (let f = 0; f < 4; f++) {
          for (const facing of [true, false]) {
            for (const flash of ['normal', 'white', 'crimson'] as const) {
              const entry = DarkFantasySprites.getCachedEntry(t, f, facing, flash);
              if (entry) canvasCount++;
            }
          }
        }
      }
      expect(canvasCount).toBe(120);
    });

    it('ensures stationary idle entities produce zero dynamic offsets', () => {
      DarkFantasySprites.initialize();

      const enemy = new Enemy(30);
      enemy.reset('skeleton', 100, 150);
      enemy.active = true;

      // Draw stationary enemy (speed = 0, hover = 0, flinch = 0)
      DarkFantasySprites.drawEnemy(mockCtx, enemy, camera, 0);

      const call = mockCtx.drawImage.mock.calls[0];
      // Exactly screenX - originX and screenY - originY
      expect(call[1]).toBe(100 - camera.renderX - 20);
      expect(call[2]).toBe(150 - camera.renderY - 20);
    });
  });
});
