import { AABB, BoundingBox } from './AABB';
import { Vector2D } from '../math/Vector2D';

export type PlatformType = 'SOLID' | 'SEMI_SOLID';

export interface Platform {
  id: string;
  bounds: AABB;
  type: PlatformType;
  friction?: number;
}

export interface PlatformCollisionResult {
  isGrounded: boolean;
  groundY: number;
  platform: Platform | null;
}

export interface SolidCollisionResult {
  isColliding: boolean;
  resolvedPosition: Vector2D;
  isGrounded: boolean;
  hitCeiling: boolean;
  hitWall: boolean;
  platform: Platform | null;
}

/**
 * PlatformManager & collision solver for solid ground and semi-solid one-way platforms.
 */
export class PlatformPhysics {
  /** Default snap margin in pixels for detecting downward crossing of platform top surface */
  static readonly DEFAULT_SNAP_TOLERANCE: number = 4.0;

  /** Downward velocity impulse when initiating drop-through (120 px/s = 2.0 px/frame) */
  static readonly DROP_THROUGH_IMPULSE: number = 120.0;

  /** Number of frames to ignore platform during drop-through (18 frames = 0.3s) */
  static readonly DROP_THROUGH_DURATION_FRAMES: number = 18;

  /**
   * Check if a moving entity's foot contacts and lands on a single semi-solid platform.
   *
   * @param footX Current X coordinate of entity foot center
   * @param prevFootY Previous Y coordinate of foot center (before current tick)
   * @param currFootY Current Y coordinate of foot center (after velocity integration)
   * @param vy Current vertical velocity (must be >= 0 to land)
   * @param halfWidth Half-width of entity foot contact area
   * @param platform Platform to test
   * @param ignoredPlatformId Optional ID of platform currently being dropped through
   * @param snapTolerance Snap margin above platform edge (default 4.0px)
   */
  static checkSemiSolidLanding(
    footX: number,
    prevFootY: number,
    currFootY: number,
    vy: number,
    halfWidth: number,
    platform: Platform,
    ignoredPlatformId?: string | null,
    snapTolerance: number = PlatformPhysics.DEFAULT_SNAP_TOLERANCE
  ): PlatformCollisionResult {
    // If downward velocity is negative (moving up), entity passes through
    if (vy < 0) {
      return { isGrounded: false, groundY: currFootY, platform: null };
    }

    // Ignore platform if actively dropping through it
    if (ignoredPlatformId && platform.id === ignoredPlatformId) {
      return { isGrounded: false, groundY: currFootY, platform: null };
    }

    const platLeft = platform.bounds.x;
    const platRight = platform.bounds.x + platform.bounds.width;
    const platTop = platform.bounds.y;

    // Horizontal overlap check
    const horizontalOverlap = footX + halfWidth > platLeft && footX - halfWidth < platRight;
    if (!horizontalOverlap) {
      return { isGrounded: false, groundY: currFootY, platform: null };
    }

    // Vertical crossing condition:
    // Previous foot was at or above the platform (within snap tolerance),
    // and current foot has reached or penetrated downward through the top surface.
    const crossedTopSurface =
      prevFootY <= platTop + snapTolerance && currFootY >= platTop;

    if (crossedTopSurface) {
      return {
        isGrounded: true,
        groundY: platTop,
        platform,
      };
    }

    return { isGrounded: false, groundY: currFootY, platform: null };
  }

  /**
   * Evaluates collision against a list of platforms, returning the highest valid ground contact.
   */
  static resolveGroundContact(
    footX: number,
    prevFootY: number,
    currFootY: number,
    vy: number,
    halfWidth: number,
    platforms: Platform[],
    ignoredPlatformId?: string | null,
    snapTolerance: number = PlatformPhysics.DEFAULT_SNAP_TOLERANCE
  ): PlatformCollisionResult {
    let bestResult: PlatformCollisionResult = {
      isGrounded: false,
      groundY: currFootY,
      platform: null,
    };

    let highestGroundY = Infinity;

    for (const plat of platforms) {
      if (plat.type === 'SEMI_SOLID') {
        const result = PlatformPhysics.checkSemiSolidLanding(
          footX,
          prevFootY,
          currFootY,
          vy,
          halfWidth,
          plat,
          ignoredPlatformId,
          snapTolerance
        );
        if (result.isGrounded && result.groundY < highestGroundY) {
          highestGroundY = result.groundY;
          bestResult = result;
        }
      } else if (plat.type === 'SOLID') {
        // For solid platforms, also check top surface landing if coming from above
        const platLeft = plat.bounds.x;
        const platRight = plat.bounds.x + plat.bounds.width;
        const platTop = plat.bounds.y;

        const horizontalOverlap = footX + halfWidth > platLeft && footX - halfWidth < platRight;
        if (horizontalOverlap && vy >= 0) {
          const crossedTopSurface =
            prevFootY <= platTop + snapTolerance && currFootY >= platTop;
          if (crossedTopSurface && platTop < highestGroundY) {
            highestGroundY = platTop;
            bestResult = {
              isGrounded: true,
              groundY: platTop,
              platform: plat,
            };
          }
        }
      }
    }

    return bestResult;
  }

  /**
   * Comprehensive AABB resolution for solid obstacles (ground, walls, ceilings).
   */
  static resolveSolidAABB(
    box: AABB,
    _velocity: Vector2D,
    solidPlatforms: Platform[]
  ): SolidCollisionResult {
    const current = BoundingBox.clone(box);
    let hitGround = false;
    let hitCeiling = false;
    let hitWall = false;
    let contactPlat: Platform | null = null;

    for (const plat of solidPlatforms) {
      if (plat.type !== 'SOLID') continue;

      if (BoundingBox.intersects(current, plat.bounds)) {
        const penetration = BoundingBox.getPenetration(current, plat.bounds);
        if (penetration) {
          if (penetration.y !== 0) {
            current.y += penetration.y;
            if (penetration.y < 0) {
              // Pushed up -> landed on ground
              hitGround = true;
              contactPlat = plat;
            } else {
              // Pushed down -> hit ceiling
              hitCeiling = true;
            }
          } else if (penetration.x !== 0) {
            current.x += penetration.x;
            hitWall = true;
          }
        }
      }
    }

    return {
      isColliding: hitGround || hitCeiling || hitWall,
      resolvedPosition: { x: current.x, y: current.y },
      isGrounded: hitGround,
      hitCeiling,
      hitWall,
      platform: contactPlat,
    };
  }
}
