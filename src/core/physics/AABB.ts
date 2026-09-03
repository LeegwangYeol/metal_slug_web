import { Vector2D } from '../math/Vector2D';

/**
 * Axis-Aligned Bounding Box (AABB)
 * Origin (x, y) is top-left in standard 2D screen coordinate space.
 */
export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ReadonlyAABB {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export class BoundingBox implements AABB {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0
  ) {}

  static create(x: number = 0, y: number = 0, width: number = 0, height: number = 0): AABB {
    return { x, y, width, height };
  }

  static fromMinMax(minX: number, minY: number, maxX: number, maxY: number): AABB {
    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }

  static fromCenter(centerX: number, centerY: number, width: number, height: number): AABB {
    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
    };
  }

  static clone(box: AABB): AABB {
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  static copy(out: AABB, src: AABB): AABB {
    out.x = src.x;
    out.y = src.y;
    out.width = src.width;
    out.height = src.height;
    return out;
  }

  static intersects(a: AABB, b: AABB): boolean {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  static containsPoint(box: AABB, point: Vector2D): boolean {
    return (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    );
  }

  static containsBox(container: AABB, target: AABB): boolean {
    return (
      target.x >= container.x &&
      target.x + target.width <= container.x + container.width &&
      target.y >= container.y &&
      target.y + target.height <= container.y + container.height
    );
  }

  static getCenter(box: AABB): Vector2D {
    return {
      x: box.x + box.width / 2,
      y: box.y + box.height / 2,
    };
  }

  static getHalfExtents(box: AABB): Vector2D {
    return {
      x: box.width / 2,
      y: box.height / 2,
    };
  }

  static getMin(box: AABB): Vector2D {
    return { x: box.x, y: box.y };
  }

  static getMax(box: AABB): Vector2D {
    return { x: box.x + box.width, y: box.y + box.height };
  }

  static expand(box: AABB, amount: number): AABB {
    return {
      x: box.x - amount,
      y: box.y - amount,
      width: Math.max(0, box.width + amount * 2),
      height: Math.max(0, box.height + amount * 2),
    };
  }

  static expandXY(box: AABB, dx: number, dy: number): AABB {
    return {
      x: box.x - dx,
      y: box.y - dy,
      width: Math.max(0, box.width + dx * 2),
      height: Math.max(0, box.height + dy * 2),
    };
  }

  static offset(box: AABB, delta: Vector2D): AABB {
    return {
      x: box.x + delta.x,
      y: box.y + delta.y,
      width: box.width,
      height: box.height,
    };
  }

  static offsetXY(box: AABB, dx: number, dy: number): AABB {
    return {
      x: box.x + dx,
      y: box.y + dy,
      width: box.width,
      height: box.height,
    };
  }

  static union(a: AABB, b: AABB): AABB {
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Calculates the minimum penetration vector to push A out of B.
   * Returns null if not intersecting.
   */
  static getPenetration(a: AABB, b: AABB): Vector2D | null {
    if (!BoundingBox.intersects(a, b)) {
      return null;
    }

    const overlapLeft = (a.x + a.width) - b.x;
    const overlapRight = (b.x + b.width) - a.x;
    const overlapTop = (a.y + a.height) - b.y;
    const overlapBottom = (b.y + b.height) - a.y;

    const minX = overlapLeft < overlapRight ? -overlapLeft : overlapRight;
    const minY = overlapTop < overlapBottom ? -overlapTop : overlapBottom;

    if (Math.abs(minX) < Math.abs(minY)) {
      return { x: minX, y: 0 };
    } else {
      return { x: 0, y: minY };
    }
  }
}

// Top-level functional aliases
export const createAABB = BoundingBox.create;
export const aabbIntersects = BoundingBox.intersects;
export const aabbContainsPoint = BoundingBox.containsPoint;
export const aabbContainsBox = BoundingBox.containsBox;
export const aabbGetCenter = BoundingBox.getCenter;
export const aabbExpand = BoundingBox.expand;
export const aabbOffset = BoundingBox.offset;
export const aabbUnion = BoundingBox.union;
