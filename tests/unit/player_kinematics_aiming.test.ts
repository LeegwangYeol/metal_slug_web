import { describe, it, expect } from 'vitest';
import {
  PlayerKinematics,
  PlayerPosture,
  PlayerActionState,
  AimAngle,
  PlayerInputSnapshot,
} from '../../src/core/player/PlayerKinematics';
import { PlayerController } from '../../src/core/player/PlayerController';
import { GameEngine } from '../../src/core/engine/GameEngine';
import { Platform } from '../../src/core/physics/Platform';
import { createAABB } from '../../src/core/physics/AABB';
import { Vec2, vec2 } from '../../src/core/math/Vector2D';

function makeInput(overrides: Partial<PlayerInputSnapshot> = {}): PlayerInputSnapshot {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    jumpPressed: false,
    jumpHeld: false,
    shootPressed: false,
    shootHeld: false,
    grenadePressed: false,
    ...overrides,
  };
}

describe('Player Kinematics & Posture Suite', () => {
  it('should have exact specified physics constants', () => {
    expect(PlayerKinematics.RUN_SPEED).toBe(132.0);
    expect(PlayerKinematics.CRAWL_SPEED).toBe(54.0);
    expect(PlayerKinematics.JUMP_IMPULSE).toBe(-360.0);
    expect(PlayerKinematics.GRAVITY).toBe(800.0);
    expect(PlayerKinematics.JUMP_CUT_RATIO).toBe(0.5);
    expect(PlayerKinematics.TERMINAL_FALL_VELOCITY).toBe(500.0);
    expect(PlayerKinematics.APEX_FLOAT_VELOCITY_THRESHOLD).toBe(40.0);
    expect(PlayerKinematics.APEX_GRAVITY_SCALE).toBe(0.65);
    expect(PlayerKinematics.COYOTE_FRAMES).toBe(4);
    expect(PlayerKinematics.JUMP_BUFFER_FRAMES).toBe(4);
  });

  it('should generate standing AABB of 24x40 px anchored at feet', () => {
    // Player at foot anchor (100, 200)
    const box = PlayerKinematics.getBoundingBox(100, 200, PlayerPosture.STANDING);
    expect(box.width).toBe(24);
    expect(box.height).toBe(40);
    expect(box.x).toBe(100 - 12);
    expect(box.y).toBe(200 - 40);
  });

  it('should generate crouching AABB of 24x22 px anchored at feet', () => {
    const box = PlayerKinematics.getBoundingBox(100, 200, PlayerPosture.CROUCHING);
    expect(box.width).toBe(24);
    expect(box.height).toBe(22);
    expect(box.x).toBe(100 - 12);
    expect(box.y).toBe(200 - 22);
  });

  it('should calculate jump velocity cut correctly', () => {
    // If upward moving (vy < 0), cut by 0.50
    const cutVy = PlayerKinematics.applyJumpCut(-300);
    expect(cutVy).toBeCloseTo(-150);

    // If falling downward (vy >= 0), no cut applied
    expect(PlayerKinematics.applyJumpCut(100)).toBe(100);
  });
});

describe('Newtonian Arcade Kinematics & PlayerController Jump Dynamics', () => {
  it('should apply apex float dampening (0.65 * GRAVITY) when airborne and |vy| < 40 px/s', () => {
    const engine = new GameEngine();
    const player = new PlayerController(vec2(100, 100));
    player.isGrounded = false;
    player.velocity.y = -30.0; // within apex window |vy| < 40

    const dt = 1 / 60;
    player.update(dt, engine);

    // Expected gravity = 800 * 0.65 = 520 px/s^2
    // Expected vy = -30 + 520 * (1/60) = -30 + 8.6667 = -21.3333
    expect(player.velocity.y).toBeCloseTo(-30 + 520 * dt, 4);

    // Now test non-apex velocity (|vy| >= 40): full GRAVITY (800 px/s^2)
    player.velocity.y = -200.0;
    player.update(dt, engine);
    expect(player.velocity.y).toBeCloseTo(-200 + 800 * dt, 4);
  });

  it('should strictly execute single-shot jump cut once upon releasing jump key', () => {
    const engine = new GameEngine();
    const player = new PlayerController(vec2(100, 200));

    // Player initiates jump on ground
    player.handleInput(makeInput({ jumpPressed: true, jumpHeld: true }), 1 / 60, engine);
    expect(player.velocity.y).toBe(PlayerKinematics.JUMP_IMPULSE); // -360 px/s
    expect(player.jumpCutApplied).toBe(false);

    // Frame 1: Player releases jump key while ascending
    player.handleInput(makeInput({ jumpHeld: false }), 1 / 60, engine);
    expect(player.velocity.y).toBeCloseTo(-360 * 0.5); // -180 px/s
    expect(player.jumpCutApplied).toBe(true);

    // Frame 2: Jump cut MUST NOT execute again on subsequent frames
    const vyBefore = player.velocity.y;
    player.handleInput(makeInput({ jumpHeld: false }), 1 / 60, engine);
    expect(player.velocity.y).toBe(vyBefore); // Unchanged by handleInput (no repeated cuts)
  });

  it('should allow jumping within 4-frame coyote time window after leaving ledge', () => {
    const engine = new GameEngine();
    const player = new PlayerController(vec2(100, 200));
    const dt = 1 / 60;

    // Player is grounded, coyote timer initialized
    player.handleInput(makeInput(), dt, engine);
    expect(player.coyoteTimer).toBeCloseTo(4 * dt);

    // Player steps off ledge: isGrounded becomes false
    player.isGrounded = false;
    expect(player.coyoteTimer).toBeGreaterThan(0);

    // Frame 1 off ledge: coyote jump is allowed
    player.handleInput(makeInput({ jumpPressed: true }), dt, engine);
    expect(player.velocity.y).toBe(PlayerKinematics.JUMP_IMPULSE); // -360 px/s
    expect(player.actionState).toBe(PlayerActionState.JUMPING);
    expect(player.coyoteTimer).toBe(0); // coyote consumed

    // If coyote timer completely elapses, jumping is rejected
    const player2 = new PlayerController(vec2(100, 200));
    player2.isGrounded = false;
    player2.coyoteTimer = 0; // expired
    player2.handleInput(makeInput({ jumpPressed: true }), dt, engine);
    expect(player2.velocity.y).toBe(0); // Not jumping
  });

  it('should buffer jump input within 4 frames before landing and execute upon landing', () => {
    const engine = new GameEngine();
    const platform: Platform = {
      id: 'ground_platform',
      bounds: createAABB(0, 200, 500, 20),
      type: 'SOLID',
    };
    engine.addPlatform(platform);

    const player = new PlayerController(vec2(100, 195));
    const dt = 1 / 60;
    player.isGrounded = false;
    player.coyoteTimer = 0; // In mid-air, past coyote window
    player.velocity.y = 300; // falling toward y=200 ground

    // Player presses jump 1 frame before landing (buffered)
    player.handleInput(makeInput({ jumpPressed: true, jumpHeld: true }), dt, engine);
    expect(player.jumpBufferTimer).toBeCloseTo(4 * dt);
    expect(player.velocity.y).toBe(300); // Still falling, not yet on ground

    // Physics tick: player hits ground platform at y=200 (prevY=195, currY ~200.22)
    player.update(dt, engine);

    // Landing triggers the buffered jump immediately
    expect(player.position.y).toBe(200); // Snapped cleanly to ground
    expect(player.velocity.y).toBe(PlayerKinematics.JUMP_IMPULSE); // -360 px/s executed!
    expect(player.jumpBufferTimer).toBe(0); // Consumed
  });

  it('should ensure clean platform landing snapping, velocity zeroing, and state reset', () => {
    const engine = new GameEngine();
    const platform: Platform = {
      id: 'floor',
      bounds: createAABB(0, 200, 500, 20),
      type: 'SOLID',
    };
    engine.addPlatform(platform);

    const player = new PlayerController(vec2(100, 195));
    player.isGrounded = false;
    player.coyoteTimer = 0;
    player.velocity.y = 360;
    player.actionState = PlayerActionState.FALLING;

    // Tick lands on platform (prevY=195, currY ~201.22 -> snapped to 200)
    player.update(1 / 60, engine);

    expect(player.position.y).toBe(200); // Clean platform snap
    expect(player.velocity.y).toBe(0); // Velocity zeroed
    expect(player.isGrounded).toBe(true); // Grounded
    expect(player.actionState).toBe(PlayerActionState.IDLE); // State reset
    expect(player.jumpCutApplied).toBe(false); // Reset for next jump
  });

  it('should clamp falling velocity to TERMINAL_FALL_VELOCITY (500 px/s)', () => {
    const engine = new GameEngine();
    const player = new PlayerController(vec2(100, 50));
    player.isGrounded = false;
    player.velocity.y = 495.0;

    const dt = 1 / 60;
    player.update(dt, engine);

    // 495 + 800 * (1/60) = 508.33 -> Clamped to 500.0
    expect(player.velocity.y).toBe(PlayerKinematics.TERMINAL_FALL_VELOCITY);
    expect(player.velocity.y).toBe(500.0);
  });
});

describe('8-Way Aiming & Directional Vectors Suite', () => {
  it('should calculate horizontal forward aim when grounded with neutral input', () => {
    const right = PlayerKinematics.calculateAim(false, false, false, 1, true);
    expect(right.aimVector).toEqual({ x: 1, y: 0 });
    expect(right.angleName).toBe(AimAngle.FORWARD);

    const left = PlayerKinematics.calculateAim(false, false, false, -1, true);
    expect(left.aimVector).toEqual({ x: -1, y: 0 });
    expect(left.angleName).toBe(AimAngle.FORWARD);
  });

  it('should calculate upward and upward-diagonal aim when grounded', () => {
    // Straight Up
    const up = PlayerKinematics.calculateAim(true, false, false, 1, true);
    expect(up.aimVector).toEqual({ x: 0, y: -1 });
    expect(up.angleName).toBe(AimAngle.UP);

    // Up-Forward (Facing Right)
    const upDiagRight = PlayerKinematics.calculateAim(true, false, true, 1, true);
    expect(upDiagRight.aimVector.x).toBeCloseTo(Math.SQRT1_2);
    expect(upDiagRight.aimVector.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Vec2.len(upDiagRight.aimVector)).toBeCloseTo(1.0);
    expect(upDiagRight.angleName).toBe(AimAngle.UP_FORWARD);

    // Up-Forward (Facing Left)
    const upDiagLeft = PlayerKinematics.calculateAim(true, false, true, -1, true);
    expect(upDiagLeft.aimVector.x).toBeCloseTo(-Math.SQRT1_2);
    expect(upDiagLeft.aimVector.y).toBeCloseTo(-Math.SQRT1_2);
    expect(Vec2.len(upDiagLeft.aimVector)).toBeCloseTo(1.0);
  });

  it('CRITICAL: Grounded DOWN input causes crouch and fires HORIZONTALLY FORWARD, never down into floor', () => {
    // Grounded player presses Down
    const crouchAimRight = PlayerKinematics.calculateAim(false, true, false, 1, true);
    expect(crouchAimRight.aimVector).toEqual({ x: 1, y: 0 });
    expect(crouchAimRight.angleName).toBe(AimAngle.FORWARD);

    const crouchAimLeft = PlayerKinematics.calculateAim(false, true, false, -1, true);
    expect(crouchAimLeft.aimVector).toEqual({ x: -1, y: 0 });
    expect(crouchAimLeft.angleName).toBe(AimAngle.FORWARD);
  });

  it('should permit downward and downward-diagonal aim ONLY while airborne', () => {
    // Airborne straight down
    const airDown = PlayerKinematics.calculateAim(false, true, false, 1, false);
    expect(airDown.aimVector).toEqual({ x: 0, y: 1 });
    expect(airDown.angleName).toBe(AimAngle.DOWN);

    // Airborne down-forward (Facing Right)
    const airDownDiagRight = PlayerKinematics.calculateAim(false, true, true, 1, false);
    expect(airDownDiagRight.aimVector.x).toBeCloseTo(Math.SQRT1_2);
    expect(airDownDiagRight.aimVector.y).toBeCloseTo(Math.SQRT1_2);
    expect(Vec2.len(airDownDiagRight.aimVector)).toBeCloseTo(1.0);
    expect(airDownDiagRight.angleName).toBe(AimAngle.DOWN_FORWARD);

    // Airborne down-forward (Facing Left)
    const airDownDiagLeft = PlayerKinematics.calculateAim(false, true, true, -1, false);
    expect(airDownDiagLeft.aimVector.x).toBeCloseTo(-Math.SQRT1_2);
    expect(airDownDiagLeft.aimVector.y).toBeCloseTo(Math.SQRT1_2);
    expect(Vec2.len(airDownDiagLeft.aimVector)).toBeCloseTo(1.0);
  });

  it('should compute correct muzzle positions for standing, crouching, and airborne postures', () => {
    const anchorX = 100;
    const anchorY = 200;

    // Standing forward: (Fx * 18, -24)
    const standMuzzle = PlayerKinematics.getMuzzlePosition(
      anchorX,
      anchorY,
      1,
      PlayerPosture.STANDING,
      AimAngle.FORWARD
    );
    expect(standMuzzle).toEqual({ x: 118, y: 176 });

    // Crouching forward: (Fx * 18, -12) -> Lowered shooting muzzle
    const crouchMuzzle = PlayerKinematics.getMuzzlePosition(
      anchorX,
      anchorY,
      1,
      PlayerPosture.CROUCHING,
      AimAngle.FORWARD
    );
    expect(crouchMuzzle).toEqual({ x: 118, y: 188 });

    // Airborne down: (Fx * 2, -6)
    const airDownMuzzle = PlayerKinematics.getMuzzlePosition(
      anchorX,
      anchorY,
      1,
      PlayerPosture.AIRBORNE,
      AimAngle.DOWN
    );
    expect(airDownMuzzle).toEqual({ x: 102, y: 194 });
  });
});
