import { Vector2D, vec2 } from '../math/Vector2D';
import { AABB, createAABB } from '../physics/AABB';

export type FacingDirection = -1 | 1;

export enum PlayerPosture {
  STANDING = 'STANDING',
  CROUCHING = 'CROUCHING',
  AIRBORNE = 'AIRBORNE',
}

export enum PlayerActionState {
  IDLE = 'IDLE',
  RUNNING = 'RUNNING',
  JUMPING = 'JUMPING',
  FALLING = 'FALLING',
  CROUCH_IDLE = 'CROUCH_IDLE',
  CRAWLING = 'CRAWLING',
  MELEE_SLASH = 'MELEE_SLASH',
  HIT_STUN = 'HIT_STUN',
  DEAD = 'DEAD',
}

export enum AimAngle {
  FORWARD = 'FORWARD',
  UP_FORWARD = 'UP_FORWARD',
  UP = 'UP',
  DOWN_FORWARD = 'DOWN_FORWARD',
  DOWN = 'DOWN',
}

export interface AimResult {
  aimVector: Vector2D;
  angleName: AimAngle;
  angleRadians: number;
}

export interface PlayerInputSnapshot {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  shootPressed: boolean;
  shootHeld: boolean;
  grenadePressed: boolean;
}

export class PlayerKinematics {
  // Movement Physics Constants (Continuous px/s and px/s^2)
  static readonly RUN_SPEED: number = 132.0; // px/s
  static readonly CRAWL_SPEED: number = 54.0; // px/s
  static readonly JUMP_IMPULSE: number = -360.0; // px/s (upward)
  static readonly GRAVITY: number = 800.0; // px/s^2 (downward)
  static readonly JUMP_CUT_RATIO: number = 0.5; // early jump release cut
  static readonly TERMINAL_FALL_VELOCITY: number = 500.0; // px/s maximum fall speed
  static readonly DROP_THROUGH_IMPULSE: number = 120.0; // px/s downward push on semi-solid drop
  static readonly DROP_THROUGH_FRAMES: number = 18; // duration of platform exclusion (0.3s)

  // Apex Float Dampening Constants
  static readonly APEX_FLOAT_VELOCITY_THRESHOLD: number = 40.0; // px/s (|vy| < 40)
  static readonly APEX_GRAVITY_SCALE: number = 0.65; // 0.65 * GRAVITY for arcade hangtime

  // Coyote Time & Jump Input Buffering
  static readonly COYOTE_FRAMES: number = 4; // 4 frames (~66.7ms @ 60Hz)
  static readonly JUMP_BUFFER_FRAMES: number = 4; // 4 frames (~66.7ms @ 60Hz)

  // Bounding Box Dimensions
  static readonly STANDING_WIDTH: number = 24;
  static readonly STANDING_HEIGHT: number = 40;
  static readonly CROUCHING_WIDTH: number = 24;
  static readonly CROUCHING_HEIGHT: number = 22;
  static readonly AIRBORNE_WIDTH: number = 24;
  static readonly AIRBORNE_HEIGHT: number = 36;

  // Melee Knife Scan Box Specifications
  static readonly MELEE_FORWARD_REACH: number = 38.05; // px in front of anchor (ensures 38.0px boundary inclusive trigger)
  static readonly MELEE_REAR_REACH: number = 6.0; // px behind anchor
  static readonly MELEE_VERTICAL_UP: number = 34.0; // px above anchor
  static readonly MELEE_VERTICAL_DOWN: number = 10.0; // px below anchor
  static readonly MELEE_DAMAGE: number = 3.0; // 3 HP instantly kills standard 1 HP soldier
  static readonly MELEE_TOTAL_FRAMES: number = 18; // 300ms
  static readonly MELEE_ACTIVE_FRAME_START: number = 5; // frame 5
  static readonly MELEE_ACTIVE_FRAME_END: number = 9; // frame 9
  static readonly MELEE_SCORE_BONUS: number = 500;

  private static readonly INV_SQRT2 = Math.SQRT1_2; // ~0.70710678

  /**
   * Generates the AABB bounding box for the player given their foot anchor (x, y) and posture.
   */
  static getBoundingBox(x: number, y: number, posture: PlayerPosture): AABB {
    switch (posture) {
      case PlayerPosture.CROUCHING:
        return createAABB(
          x - PlayerKinematics.CROUCHING_WIDTH / 2,
          y - PlayerKinematics.CROUCHING_HEIGHT,
          PlayerKinematics.CROUCHING_WIDTH,
          PlayerKinematics.CROUCHING_HEIGHT
        );
      case PlayerPosture.AIRBORNE:
        return createAABB(
          x - PlayerKinematics.AIRBORNE_WIDTH / 2,
          y - 38,
          PlayerKinematics.AIRBORNE_WIDTH,
          PlayerKinematics.AIRBORNE_HEIGHT
        );
      case PlayerPosture.STANDING:
      default:
        return createAABB(
          x - PlayerKinematics.STANDING_WIDTH / 2,
          y - PlayerKinematics.STANDING_HEIGHT,
          PlayerKinematics.STANDING_WIDTH,
          PlayerKinematics.STANDING_HEIGHT
        );
    }
  }

  /**
   * Calculates the 8-way aim unit vector and AimAngle based on directional inputs,
   * player facing direction, and grounded status.
   *
   * Critical Authentic Metal Slug Constraint:
   * When grounded, pressing DOWN triggers crouch and fires HORIZONTALLY FORWARD.
   * Downward vertical and down-diagonal shooting are strictly enabled ONLY while airborne.
   */
  static calculateAim(
    inputUp: boolean,
    inputDown: boolean,
    inputForward: boolean,
    facing: FacingDirection,
    isGrounded: boolean
  ): AimResult {
    // 1. Grounded aiming
    if (isGrounded) {
      if (inputDown) {
        // Down on ground -> Crouched forward shooting
        return {
          aimVector: vec2(facing, 0),
          angleName: AimAngle.FORWARD,
          angleRadians: facing === 1 ? 0 : Math.PI,
        };
      }

      if (inputUp) {
        if (inputForward) {
          // Up-forward diagonal
          return {
            aimVector: vec2(facing * PlayerKinematics.INV_SQRT2, -PlayerKinematics.INV_SQRT2),
            angleName: AimAngle.UP_FORWARD,
            angleRadians: facing === 1 ? -Math.PI / 4 : (-3 * Math.PI) / 4,
          };
        } else {
          // Straight up
          return {
            aimVector: vec2(0, -1),
            angleName: AimAngle.UP,
            angleRadians: -Math.PI / 2,
          };
        }
      }

      // Neutral or forward on ground
      return {
        aimVector: vec2(facing, 0),
        angleName: AimAngle.FORWARD,
        angleRadians: facing === 1 ? 0 : Math.PI,
      };
    }

    // 2. Airborne aiming
    if (inputDown) {
      if (inputForward) {
        // Down-forward diagonal (airborne only)
        return {
          aimVector: vec2(facing * PlayerKinematics.INV_SQRT2, PlayerKinematics.INV_SQRT2),
          angleName: AimAngle.DOWN_FORWARD,
          angleRadians: facing === 1 ? Math.PI / 4 : (3 * Math.PI) / 4,
        };
      } else {
        // Straight down (airborne only)
        return {
          aimVector: vec2(0, 1),
          angleName: AimAngle.DOWN,
          angleRadians: Math.PI / 2,
        };
      }
    }

    if (inputUp) {
      if (inputForward) {
        // Up-forward diagonal
        return {
          aimVector: vec2(facing * PlayerKinematics.INV_SQRT2, -PlayerKinematics.INV_SQRT2),
          angleName: AimAngle.UP_FORWARD,
          angleRadians: facing === 1 ? -Math.PI / 4 : (-3 * Math.PI) / 4,
        };
      } else {
        // Straight up
        return {
          aimVector: vec2(0, -1),
          angleName: AimAngle.UP,
          angleRadians: -Math.PI / 2,
        };
      }
    }

    // Airborne horizontal
    return {
      aimVector: vec2(facing, 0),
      angleName: AimAngle.FORWARD,
      angleRadians: facing === 1 ? 0 : Math.PI,
    };
  }

  /**
   * Returns the muzzle emission world position offset relative to the player's foot anchor (x, y).
   */
  static getMuzzlePosition(
    anchorX: number,
    anchorY: number,
    facing: FacingDirection,
    posture: PlayerPosture,
    angle: AimAngle
  ): Vector2D {
    if (posture === PlayerPosture.CROUCHING) {
      // Crouched forward: (Fx * 18, -12)
      return vec2(anchorX + facing * 18, anchorY - 12);
    }

    if (posture === PlayerPosture.AIRBORNE) {
      switch (angle) {
        case AimAngle.DOWN:
          // Airborne down: (Fx * 2, -6)
          return vec2(anchorX + facing * 2, anchorY - 6);
        case AimAngle.DOWN_FORWARD:
          // Airborne down-forward: (Fx * 14, -8)
          return vec2(anchorX + facing * 14, anchorY - 8);
        case AimAngle.UP:
          return vec2(anchorX + facing * 4, anchorY - 46);
        case AimAngle.UP_FORWARD:
          return vec2(anchorX + facing * 16, anchorY - 38);
        case AimAngle.FORWARD:
        default:
          return vec2(anchorX + facing * 18, anchorY - 24);
      }
    }

    // Standing posture
    switch (angle) {
      case AimAngle.UP:
        // Standing Up: (Fx * 4, -46)
        return vec2(anchorX + facing * 4, anchorY - 46);
      case AimAngle.UP_FORWARD:
        // Standing Diagonal Up: (Fx * 16, -38)
        return vec2(anchorX + facing * 16, anchorY - 38);
      case AimAngle.FORWARD:
      default:
        // Standing Forward: (Fx * 18, -24)
        return vec2(anchorX + facing * 18, anchorY - 24);
    }
  }

  /**
   * Constructs the forward knife slash scan box relative to player foot anchor.
   * Reach: 38px forward, 6px rear, [-34, +10]px vertical.
   */
  static getMeleeScanBox(anchorX: number, anchorY: number, facing: FacingDirection): AABB {
    const minY = anchorY - PlayerKinematics.MELEE_VERTICAL_UP; // Y - 34
    const height = PlayerKinematics.MELEE_VERTICAL_UP + PlayerKinematics.MELEE_VERTICAL_DOWN; // 44px

    if (facing === 1) {
      // Facing Right: from anchorX - 6 to anchorX + 38
      const minX = anchorX - PlayerKinematics.MELEE_REAR_REACH; // X - 6
      const width = PlayerKinematics.MELEE_FORWARD_REACH + PlayerKinematics.MELEE_REAR_REACH; // 44px
      return createAABB(minX, minY, width, height);
    } else {
      // Facing Left: from anchorX - 38 to anchorX + 6
      const minX = anchorX - PlayerKinematics.MELEE_FORWARD_REACH; // X - 38
      const width = PlayerKinematics.MELEE_FORWARD_REACH + PlayerKinematics.MELEE_REAR_REACH; // 44px
      return createAABB(minX, minY, width, height);
    }
  }

  /**
   * Applies variable jump cut when the jump button is released early.
   */
  static applyJumpCut(vy: number): number {
    if (vy < 0) {
      return vy * PlayerKinematics.JUMP_CUT_RATIO;
    }
    return vy;
  }
}
