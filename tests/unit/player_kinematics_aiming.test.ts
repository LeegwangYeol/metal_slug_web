import { describe, it, expect } from 'vitest';
import {
  PlayerKinematics,
  PlayerPosture,
  AimAngle,
} from '../../src/core/player/PlayerKinematics';
import { Vec2 } from '../../src/core/math/Vector2D';

describe('Player Kinematics & Posture Suite', () => {
  it('should have exact specified physics constants', () => {
    expect(PlayerKinematics.RUN_SPEED).toBe(132.0);
    expect(PlayerKinematics.CRAWL_SPEED).toBe(54.0);
    expect(PlayerKinematics.JUMP_IMPULSE).toBe(-348.0);
    expect(PlayerKinematics.GRAVITY).toBe(720.0);
    expect(PlayerKinematics.JUMP_CUT_RATIO).toBe(0.45);
    expect(PlayerKinematics.TERMINAL_FALL_VELOCITY).toBe(480.0);
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
    // If upward moving (vy < 0), cut by 0.45
    const cutVy = PlayerKinematics.applyJumpCut(-300);
    expect(cutVy).toBeCloseTo(-135);

    // If falling downward (vy >= 0), no cut applied
    expect(PlayerKinematics.applyJumpCut(100)).toBe(100);
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
